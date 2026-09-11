# Doodle Shooter for iPhone and iPad

The Xcode app bundles the original [iifor/doodleshooter](https://github.com/iifor/doodleshooter) game and its procedural three.js engine. It runs locally in WKWebView with a loopback-only asset server. Solo play works offline; the existing PeerJS multiplayer modes require internet access.

## Play

Hold the phone in landscape. Tap **PLAY SOLO**.

- Left analog stick: move; push fully forward to sprint.
- Drag the right side: look around.
- FIRE: hold to fire; drag on FIRE to keep looking while shooting.
- AIM: tap to toggle aiming. The sniper uses its original scope; the katana blocks.
- SWITCH: cycle the rifle, shotgun, sniper, and katana.
- JUMP: jump, double jump, or wall jump.
- SLIDE: slide on the ground or dash in the air.
- HOOK: grapple; hold to reel in; tap again to detach.
- RELOAD, GRENADE (hold to throw farther), SLASH, SCORE and pause retain the original actions.

Look sensitivity, inverted look, music, best score and checkpoints are saved on the device. Interrupting the app releases every touch and pauses solo play. Resume by tapping the pause panel.

## Build

Open `DoodleShooter.xcodeproj` in Xcode 26 or later. Select the **DoodleShooter** scheme and your iPhone or iPad, select your Apple development team under Signing & Capabilities, then Run. The deployment target is iOS 17.0. No package downloads, web hosting, or CocoaPods are required.

The checked-in project references `../src`, `../vendor`, `../index.html`, `../style.css`, and `../mobile.css` directly, so web changes are included on the next build without a copy step. Keep the entire repository together.

`project.yml` is the XcodeGen source of truth. If you change project structure, run `npm run ios:generate` from the repository root. Update the development team there too if regenerating for another account.

## Verify

From the repository root:

```
npm test
xcodebuild -project ios/DoodleShooter.xcodeproj -scheme DoodleShooter \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro' \
  CODE_SIGNING_ALLOWED=NO test
```

The JavaScript tests cover simultaneous fingers, analog deadzone and normalization, fire-and-look, short taps, aim toggling, cancellation and resetting. The XCTest UI flow checks loading bundled assets, starting play, firing, aiming, switching to the shotgun, jumping, reloading, moving, looking, pausing, resuming and backgrounding.

The original mouse, keyboard and gamepad paths remain available when running the web version. `npm run dev` serves it on the Mac at `http://127.0.0.1:8910`.

This is a development build for a paired device, not an App Store or TestFlight distribution. Signing requires access to the selected Apple development key in your Mac's keychain.
