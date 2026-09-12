// SPDX-License-Identifier: MIT
// Use the normal macOS authentication UI; never read or store a keychain password.
import Foundation
import Security

func requireSuccess(_ status: OSStatus, _ operation: String) {
    guard status == errSecSuccess else {
        let reason = SecCopyErrorMessageString(status, nil) as String? ?? "Error \(status)"
        fputs("\(operation): \(reason)\n", stderr)
        exit(1)
    }
}

guard CommandLine.arguments.count == 3,
      ["check", "unlock", "refresh"].contains(CommandLine.arguments[1]) else {
    fputs("Usage: signing-keychain check|unlock|refresh KEYCHAIN_PATH\n", stderr)
    exit(2)
}
let mode = CommandLine.arguments[1]
var keychain: SecKeychain?
requireSuccess(SecKeychainOpen(CommandLine.arguments[2], &keychain), "Open signing keychain")
var status: SecKeychainStatus = 0
requireSuccess(SecKeychainGetStatus(keychain, &status), "Read signing keychain status")
if mode == "check" {
    print(status & kSecUnlockStateStatus != 0 ? "unlocked" : "locked")
    exit(0)
}
if mode == "refresh" && status & kSecUnlockStateStatus != 0 {
    // Only used after a failed real signing probe, to clear a stale unlocked session.
    requireSuccess(SecKeychainLock(keychain), "Refresh signing keychain")
}
requireSuccess(SecKeychainUnlock(keychain, 0, nil, false), "Unlock signing keychain")
print("Signing keychain unlocked")
