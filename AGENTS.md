# iOS device builds

Use `npm run ios:build` to build and `npm run ios:device` to build, install and launch.
The helper checks real signing access first and recovers a locked or stale keychain
through normal macOS authentication. It avoids manual Keychain Access lock/unlock
cycles and keeps the Mac awake only for the build.

Use `npm run ios:signing` for a signing-only check. If several devices are connected,
pass `-- --device DEVICE_ID` to `ios:device` using the user's selected device.

Do not put passwords or private keys in scripts, repository files, or command-line
arguments. A genuine macOS authentication prompt may still need the user after
logout/restart; do not bypass it or claim signing succeeded without verification.
