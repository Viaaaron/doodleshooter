#!/usr/bin/env python3
# SPDX-License-Identifier: MIT
"""Check signing, recover keychain access, then build and optionally install."""
import argparse
import base64
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]
BUILD = ROOT / "ios/build"
LOGS = BUILD / "automation"


def run(args, **kwargs):
    result = subprocess.run([str(a) for a in args], cwd=ROOT, text=True,
                            stdout=subprocess.PIPE, stderr=subprocess.PIPE, **kwargs)
    if result.returncode:
        raise RuntimeError((result.stderr or result.stdout).strip())
    return result.stdout


def signing_identity(keychain, team):
    # Inspect public certificate metadata only. Never export a private key.
    identities = run(["security", "find-identity", "-v", "-p", "codesigning", keychain])
    valid = set(re.findall(r"\b[0-9A-F]{40}\b", identities))
    certs = run(["security", "find-certificate", "-a", "-c", "Apple Development", "-p", keychain])
    for pem in re.findall(r"-----BEGIN CERTIFICATE-----.*?-----END CERTIFICATE-----", certs, re.S):
        der = base64.b64decode("".join(pem.splitlines()[1:-1]))
        fingerprint = hashlib.sha1(der).hexdigest().upper()
        if fingerprint not in valid:
            continue
        subject = run(["openssl", "x509", "-noout", "-subject", "-nameopt", "sep_multiline,sname"], input=pem)
        if re.search(r"^\s*OU\s*=\s*" + re.escape(team) + r"\s*$", subject, re.M):
            return fingerprint
    raise RuntimeError("No valid Apple Development signing identity for this project's team. "
                       "Select your team in Xcode's Signing & Capabilities first.")


def signing_probe(identity, keychain):
    with tempfile.TemporaryDirectory(prefix="doodleshooter-sign-") as folder:
        probe = Path(folder) / "signing-probe"
        shutil.copyfile("/usr/bin/true", probe)
        result = subprocess.run(["/usr/bin/codesign", "--force", "--sign", identity,
                                 "--keychain", keychain, "--timestamp=none", str(probe)],
                                text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        if result.returncode == 0:
            run(["/usr/bin/codesign", "--verify", "--strict", str(probe)])
        return result


def access_error(text):
    return any(error in text for error in ["errSecInternalComponent", "User interaction is not allowed",
                                           "errSecInteractionNotAllowed"])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--install", action="store_true", help="Install and launch after building")
    parser.add_argument("--device", help="Target device ID (otherwise select the only connected iPhone/iPad)")
    parser.add_argument("--check-signing", action="store_true", help="Only verify signing access")
    args = parser.parse_args()
    if sys.platform != "darwin":
        raise RuntimeError("iOS device builds require a Mac with Xcode installed.")
    LOGS.mkdir(parents=True, exist_ok=True)
    awake = subprocess.Popen(["/usr/bin/caffeinate", "-i", "-w", str(os.getpid())])
    try:
        xcode = ["xcodebuild", "-project", "ios/DoodleShooter.xcodeproj", "-scheme", "DoodleShooter",
                 "-configuration", "Debug", "-destination", "generic/platform=iOS",
                 "-derivedDataPath", "ios/build/device", "-allowProvisioningUpdates"]
        settings = next(t["buildSettings"] for t in json.loads(run(xcode + ["-showBuildSettings", "-json"]))
                        if t["target"] == "DoodleShooter")
        keychain = os.environ.get("DOODLE_KEYCHAIN") or run(["security", "default-keychain", "-d", "user"]).strip().strip('"')
        helper = LOGS / "signing-keychain"
        source = ROOT / "scripts/signing-keychain.swift"
        if not helper.exists() or helper.stat().st_mtime < source.stat().st_mtime:
            run(["xcrun", "swiftc", "-suppress-warnings", source, "-o", helper])
        if run([helper, "check", keychain]).strip() != "unlocked":
            print("Unlocking the signing keychain with macOS. Complete its prompt if one appears.", flush=True)
            run([helper, "unlock", keychain])
        identity = signing_identity(keychain, settings["DEVELOPMENT_TEAM"])
        print("Checking access to the development signing key…", flush=True)
        probe = signing_probe(identity, keychain)
        if probe.returncode:
            if not access_error(probe.stderr):
                raise RuntimeError(probe.stderr)
            print("Refreshing stale signing-keychain access. Complete the macOS prompt if shown.", flush=True)
            run([helper, "refresh", keychain])
            probe = signing_probe(identity, keychain)
            if probe.returncode:
                raise RuntimeError(probe.stderr)
        print("Signing check passed.", flush=True)
        if args.check_signing:
            return
        # Automatic provisioning requires the certificate class, not a fixed hash.
        command = xcode + ["build", "CODE_SIGN_IDENTITY=Apple Development"]
        log = LOGS / "device-build.log"
        for attempt in range(2):
            print("Building for iPhone/iPad…", flush=True)
            with log.open("w") as output:
                result = subprocess.run(command, cwd=ROOT, stdout=output, stderr=subprocess.STDOUT)
            if result.returncode == 0:
                break
            failure = log.read_text()
            if attempt == 0 and access_error(failure):
                print("Signing access changed during the build; refreshing once and retrying.", flush=True)
                run([helper, "refresh", keychain])
            else:
                raise RuntimeError(f"Build failed. See {log}\n" + "\n".join(failure.splitlines()[-18:]))
        app = Path(settings["BUILT_PRODUCTS_DIR"]) / settings["WRAPPER_NAME"]
        run(["codesign", "--verify", "--deep", "--strict", app])
        print(f"Build succeeded: {app}", flush=True)
        if not args.install:
            return
        device = args.device
        if not device:
            inventory = LOGS / "devices.json"
            run(["xcrun", "devicectl", "list", "devices", "--json-output", inventory])
            devices = [d for d in json.loads(inventory.read_text())["result"]["devices"]
                       if d.get("connectionProperties", {}).get("tunnelState") == "connected"
                       and d.get("hardwareProperties", {}).get("deviceType") in ["iPhone", "iPad"]]
            if len(devices) != 1:
                raise RuntimeError("Specify --device DEVICE_ID when more than one (or no) iPhone/iPad is connected.")
            device = devices[0]["identifier"]
            print(f"Installing on {devices[0]['deviceProperties']['name']}…", flush=True)
        print(run(["xcrun", "devicectl", "device", "install", "app", "--device", device, app]), flush=True)
        print(run(["xcrun", "devicectl", "device", "process", "launch", "--device", device,
                   "--terminate-existing", settings["PRODUCT_BUNDLE_IDENTIFIER"]]), flush=True)
    finally:
        awake.terminate()
        awake.wait()


if __name__ == "__main__":
    try:
        main()
    except (RuntimeError, OSError, ValueError) as error:
        print(f"iOS build: {error}", file=sys.stderr)
        sys.exit(1)
