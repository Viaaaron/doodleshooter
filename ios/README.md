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

## Backbone and other iOS controllers

Connect a wired Backbone or pair an iOS-compatible controller in Settings. The app reads Apple's `GameController` extended gamepad profile directly; it does not depend on the browser discovering the controller. The controller can be connected before launch or during play.

| Control | Default action |
| --- | --- |
| Left / right stick | Move / look |
| RT / R2 | Fire |
| LT / L2 | Aim or block |
| A / Cross | Jump |
| B / Circle | Slide or air dash |
| X / Square | Reload |
| Y / Triangle | Next weapon |
| LB / L1 | Grapple |
| RB / R1 | Quick slash |
| Left stick click | Sprint |
| Right stick click / D-pad up | Grenade |
| D-pad left / right / down | Previous weapon / next weapon / katana |
| Menu / Start | Pause |
| View / Options | Scoreboard |

Open **Controller settings** in the main or pause menu, or use the small **Controller** button during play. Select a physical button, then choose an action. Bindings, controller look speed, stick deadzone and stick swapping are saved on that device; **Restore default controls** resets them. Inverted vertical look remains in the main/pause settings.

In menus, the D-pad or left stick moves focus, A / Cross selects, and B / Circle goes back. D-pad left/right adjusts a focused slider. These menu controls remain fixed even when gameplay buttons are remapped. The controller's system/Home, Backbone launcher and capture buttons remain managed by iOS or Backbone when they are not exposed as game inputs.

Using the controller hides the large touch controls. Touch the screen to bring them back. Disconnecting the controller clears held inputs and pauses solo play. Buttons held while backgrounding or closing a settings screen must be released before they trigger another action. Browser gamepad support remains available in the web version, with the same saved mapping screen.

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

The JavaScript tests cover simultaneous fingers, analog deadzones and normalization, fire-and-look, short taps, aim toggling, cancellation, native/browser controller priority, remapping, saved configuration, disconnects, stick swapping and held-button suppression. XCTest checks controller mapping persistence, fixed page scale after double taps, and the original touch gameplay flow. Physical controller testing still requires a connected controller.

The original mouse, keyboard and gamepad paths remain available when running the web version. `npm run dev` serves it on the Mac at `http://127.0.0.1:8910`.

This is a development build for a paired device, not an App Store or TestFlight distribution. Signing requires access to the selected Apple development key in your Mac's keychain.
