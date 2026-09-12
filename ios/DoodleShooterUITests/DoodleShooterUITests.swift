import XCTest

final class DoodleShooterUITests: XCTestCase {
    func testDualStickAndWeaponWheel() throws {
        continueAfterFailure = false
        XCUIDevice.shared.orientation = .landscapeLeft
        let app = XCUIApplication()
        app.launch()
        let play = app.webViews.buttons.matching(NSPredicate(format: "label BEGINSWITH 'PLAY SOLO'")).firstMatch
        XCTAssertTrue(play.waitForExistence(timeout: 40))
        play.tap()
        let fire = app.webViews.buttons["Aim and fire joystick"]
        XCTAssertTrue(fire.waitForExistence(timeout: 10))
        XCTAssertTrue(app.webViews.buttons["Equip Rifle, equipped"].exists)
        XCTAssertTrue(app.webViews.buttons["Equip Shotgun, next"].exists)
        for (name, next) in [("Shotgun", "Sniper"), ("Sniper", "Katana"), ("Katana", "Rifle"), ("Rifle", "Shotgun")] {
            app.webViews.buttons["Equip \(name), next"].tap()
            XCTAssertTrue(app.webViews.buttons["Equip \(name), equipped"].waitForExistence(timeout: 3))
            XCTAssertTrue(app.webViews.buttons["Equip \(next), next"].exists)
        }
        app.webViews.buttons["Equip Sniper"].tap()
        XCTAssertTrue(app.webViews.buttons["Equip Sniper, equipped"].waitForExistence(timeout: 3))
        app.webViews.buttons["Equip Shotgun"].tap()
        XCTAssertTrue(app.webViews.buttons["Equip Shotgun, equipped"].waitForExistence(timeout: 3))
        fire.press(forDuration: 1.8)
        let ammo = app.webViews.images.matching(NSPredicate(format: "label BEGINSWITH 'Ammo: '")).firstMatch
        XCTAssertTrue(ammo.waitForExistence(timeout: 2))
        let remaining = try XCTUnwrap(Int(ammo.label.replacingOccurrences(of: "Ammo: ", with: "")))
        XCTAssertLessThan(remaining, 5, "Holding the aiming stick should repeat shotgun fire at its normal rate")
        let center = fire.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.4))
        center.press(forDuration: 0.1, thenDragTo: center.withOffset(CGVector(dx: 35, dy: -15)))
        let shot = XCTAttachment(screenshot: app.screenshot())
        shot.name = "Dual touch sticks and weapon wheel"; shot.lifetime = .keepAlways; add(shot)
        app.webViews.buttons["Pause"].tap()
        XCTAssertTrue(app.webViews.staticTexts["Paused"].waitForExistence(timeout: 5))
        XCTAssertFalse(fire.exists)
    }

    func testControllerMappingPersists() throws {
        continueAfterFailure = false
        XCUIDevice.shared.orientation = .landscapeLeft
        let app = XCUIApplication()
        app.launch()
        let settings = app.webViews.buttons["Controller settings"]
        XCTAssertTrue(settings.waitForExistence(timeout: 40))
        settings.tap()
        let aButton = app.webViews.buttons.matching(NSPredicate(format: "label BEGINSWITH 'A / Cross:'")).firstMatch
        XCTAssertTrue(aButton.waitForExistence(timeout: 5))
        aButton.tap()
        app.webViews.buttons["Assign Reload"].tap()
        XCTAssertTrue(app.webViews.buttons["A / Cross: Reload"].waitForExistence(timeout: 5))
        let shot = XCTAttachment(screenshot: app.screenshot())
        shot.name = "Controller button mapping"; shot.lifetime = .keepAlways; add(shot)
        app.webViews.buttons["Done"].tap()
        app.terminate()
        app.launch()
        XCTAssertTrue(settings.waitForExistence(timeout: 40))
        settings.tap()
        let saved = app.webViews.buttons["A / Cross: Reload"]
        XCTAssertTrue(saved.waitForExistence(timeout: 5), "Controller mappings must survive app restart")
        app.webViews.firstMatch.swipeUp()
        let reset = app.webViews.buttons["Restore default controls"]
        XCTAssertTrue(reset.isHittable, "Tuning and reset controls must remain reachable in landscape")
        reset.tap()
        XCTAssertTrue(app.webViews.buttons["A / Cross: Jump"].waitForExistence(timeout: 5))
        app.webViews.buttons["Done"].tap()
    }

    func testDoubleTapsKeepGameAtFixedScale() throws {
        continueAfterFailure = false
        XCUIDevice.shared.orientation = .landscapeLeft
        let app = XCUIApplication()
        app.launch()
        let play = app.webViews.buttons.matching(NSPredicate(format: "label BEGINSWITH 'PLAY SOLO'")).firstMatch
        XCTAssertTrue(play.waitForExistence(timeout: 40))
        play.tap()
        let fire = app.webViews.buttons["Aim and fire joystick"]
        XCTAssertTrue(fire.waitForExistence(timeout: 10))
        let fireFrame = fire.frame
        app.webViews.firstMatch.coordinate(withNormalizedOffset: CGVector(dx: 0.30, dy: 0.35)).doubleTap()
        assertFrame(of: fire, matches: fireFrame)
        fire.doubleTap()
        assertFrame(of: fire, matches: fireFrame)
        app.switches["Toggle aim"].tap()
        assertFrame(of: fire, matches: fireFrame)
        app.webViews.buttons["Equip Shotgun, next"].tap()
        XCTAssertTrue(app.webViews.buttons["Equip Shotgun, equipped"].waitForExistence(timeout: 3))
    }

    func testPlayAndTouchControls() throws {
        continueAfterFailure = false
        XCUIDevice.shared.orientation = .landscapeLeft
        let app = XCUIApplication()
        app.launch()
        let play = app.webViews.buttons.matching(NSPredicate(format: "label BEGINSWITH 'PLAY SOLO'")).firstMatch
        XCTAssertTrue(play.waitForExistence(timeout: 40), "Bundled modules and WebGL should load offline")
        play.tap()
        let fire = app.webViews.buttons["Aim and fire joystick"]
        XCTAssertTrue(fire.waitForExistence(timeout: 10))
        fire.press(forDuration: 0.3)
        app.switches["Toggle aim"].tap()
        app.webViews.buttons["Equip Shotgun, next"].tap()
        XCTAssertTrue(app.webViews.buttons["Equip Shotgun, equipped"].waitForExistence(timeout: 3))
        app.webViews.buttons["Jump"].tap()
        app.webViews.buttons["Reload"].tap()
        let screen = app.webViews.firstMatch
        screen.coordinate(withNormalizedOffset: CGVector(dx: 0.15, dy: 0.70)).press(forDuration: 0.1, thenDragTo: screen.coordinate(withNormalizedOffset: CGVector(dx: 0.15, dy: 0.52)))
        screen.coordinate(withNormalizedOffset: CGVector(dx: 0.60, dy: 0.45)).press(forDuration: 0.1, thenDragTo: screen.coordinate(withNormalizedOffset: CGVector(dx: 0.73, dy: 0.45)))
        let shot = XCTAttachment(screenshot: app.screenshot())
        shot.name = "Landscape gameplay with touch controls"; shot.lifetime = .keepAlways; add(shot)
        app.webViews.buttons["Pause"].tap()
        XCTAssertTrue(app.webViews.staticTexts["Paused"].waitForExistence(timeout: 5))
        XCTAssertFalse(fire.exists, "Gameplay controls must disappear while paused")
        app.webViews.staticTexts["Tap to resume"].tap()
        XCTAssertTrue(fire.waitForExistence(timeout: 5))
        XCUIDevice.shared.press(.home)
        app.activate()
        XCTAssertTrue(app.webViews.staticTexts["Paused"].waitForExistence(timeout: 5), "Backgrounding must release touches and pause")
    }

    private func assertFrame(of element: XCUIElement, matches expected: CGRect,
                             file: StaticString = #filePath, line: UInt = #line) {
        let actual = element.frame
        XCTAssertEqual(actual.minX, expected.minX, accuracy: 1, "Double taps must not pan the page", file: file, line: line)
        XCTAssertEqual(actual.minY, expected.minY, accuracy: 1, "Double taps must not pan the page", file: file, line: line)
        XCTAssertEqual(actual.width, expected.width, accuracy: 1, "Double taps must not zoom the page", file: file, line: line)
        XCTAssertEqual(actual.height, expected.height, accuracy: 1, "Double taps must not zoom the page", file: file, line: line)
    }
}
