# Doodle Shooter for iPhone and iPad

The Xcode app bundles the original [iifor/doodleshooter](https://github.com/iifor/doodleshooter) game and its procedural three.js engine. It runs locally in WKWebView with a loopback-only asset server. Solo play works offline; the existing PeerJS multiplayer modes require internet access.

## Play

Hold the phone in landscape. Tap **PLAY SOLO**.

- Left analog stick: move; push fully forward to sprint.
- Right analog stick: aim only. Holding off-center keeps turning; lift your thumb to stop. Small movements aim precisely, larger movements turn faster.
- FIRE: hold the narrow vertical strip beside the right analog stick to shoot. The strip matches the stick ring's height and has a 44-point touch target. Shotgun and sniper shots repeat at their normal firing rates while held.
- Tap open space: jump; tap again for a double jump.
- Swipe down on open space: a short ground slide, or an air dash. The slide continues after you lift your finger, then ends automatically.
- Swipe sideways or up on open space: look around without firing. Downward swipes keep the camera steady.
- AIM: tap to toggle aiming. The sniper uses its original scope; the katana blocks.
- Weapon meter: four icons on a curved vertical gauge. Flick up for the next weapon, down for the previous one, or tap an icon to equip it. The filled segment and needle mark your current weapon. Top to bottom: rifle → shotgun → sniper → katana; flicking wraps at either end.
- Shake to reload: the iOS app recognizes a shake during play. A progress bar below the crosshair shows the reload, alongside the gun's reload animation. Reload requests wait for the shotgun pump or sniper bolt to finish cycling. Shakes in menus are ignored.
- RELOAD: a button above the left stick provides the same action without shaking.
- HOOK: grapple; hold to reel in; tap again to detach.
- GRENADE (hold to throw farther), SLASH, SCORE and pause retain the original actions.

The main and pause menus include separate **Aim stick sensitivity** (25–250%) and **Move stick sensitivity** (50–200%) sliders. Scroll the panel to reach them. Aim sensitivity controls turning speed and open-screen look swipes. Lower movement sensitivity gives finer control near the center; higher sensitivity responds sooner. Full stick travel still reaches full speed at every setting. Both settings, inverted look, music, best score and checkpoints are saved on the device.

Text-selection callouts and iOS three-finger copy/paste/undo gestures are disabled for gameplay. Interrupting the app releases every touch and pauses solo play. Resume by tapping the pause panel.

The iPhone Action button and Ring/Silent switch are not exposed as ordinary gamepad press/release inputs. This app uses the touchscreen FIRE button or a controller trigger for shooting. Apple lets you [configure the Action button to run a Shortcut](https://support.apple.com/guide/shortcuts/run-shortcuts-with-the-action-button-apdfea15680b/ios), but this app does not map it to firing.

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

The JavaScript tests cover simultaneous fingers, analog deadzones and normalization, movement sensitivity, separate aim and fire, weapon meter flicks, tap-to-jump, swipe-to-slide, gesture cancellation, aim toggling, native/browser controller priority, remapping, saved configuration, disconnects, stick swapping and held-button suppression. XCTest checks controller mapping persistence, independent saved stick sensitivities, long-press selection suppression, fire-strip placement, editable lobby codes, fixed page scale after double taps, weapon selection, aim without firing, and visible reload progress. Three-finger gesture synthesis is unreliable in landscape WKWebView in Simulator; verify on an iPhone that using movement, aim and fire together does not display the editing toolbar. Physical controller testing also requires a connected controller. For a desktop gesture check, run `npm run dev` and open `/tests/touch-gestures.html`: it uses the real controls and player physics with a visible jump/slide/dash counter and incoming damage disabled. This test scene is not bundled in the iOS app. In Simulator, fire a few shots, then choose **Device → Shake** to check the native reload gesture.

The original mouse, keyboard and gamepad paths remain available when running the web version. `npm run dev` serves it on the Mac at `http://127.0.0.1:8910`.

This is a development build for a paired device, not an App Store or TestFlight distribution. Signing requires access to the selected Apple development key in your Mac's keychain.
