import XCTest

final class DoodleShooterUITests: XCTestCase {
    func testLobbyCodeRemainsEditable() throws {
        continueAfterFailure = false
        XCUIDevice.shared.orientation = .landscapeLeft
        let app = XCUIApplication()
        app.launch()
        let online = app.webViews.buttons.matching(NSPredicate(format: "label BEGINSWITH 'PLAY ONLINE'")).firstMatch
        XCTAssertTrue(online.waitForExistence(timeout: 40))
        online.tap()
        let code = app.webViews.textFields["Code"]
        XCTAssertTrue(code.waitForExistence(timeout: 5))
        code.tap(); code.typeText("ABCDE")
        XCTAssertEqual(code.value as? String, "ABCDE", "Disabling gameplay selection must preserve text entry in menus")
    }

    func testTouchSensitivityPersistsIndependently() throws {
        continueAfterFailure = false
        XCUIDevice.shared.orientation = .landscapeLeft
        let app = XCUIApplication()
        app.launch()
        let aim = app.webViews.sliders["Aim stick sensitivity"]
        let move = app.webViews.sliders["Move stick sensitivity"]
        XCTAssertTrue(aim.waitForExistence(timeout: 40))
        app.webViews.firstMatch.swipeUp()
        XCTAssertTrue(aim.isHittable)
        let originalAim = aim.value as? String
        aim.coordinate(withNormalizedOffset: CGVector(dx: 0.75, dy: 0.5)).tap()
        if aim.value as? String == originalAim { aim.coordinate(withNormalizedOffset: CGVector(dx: 0.15, dy: 0.5)).tap() }
        let aimValue = try XCTUnwrap(aim.value as? String)
        XCTAssertNotEqual(aimValue, originalAim)
        XCTAssertTrue(move.isHittable)
        let originalMove = move.value as? String
        move.coordinate(withNormalizedOffset: CGVector(dx: 0.2, dy: 0.5)).tap()
        if move.value as? String == originalMove { move.coordinate(withNormalizedOffset: CGVector(dx: 0.8, dy: 0.5)).tap() }
        let moveValue = try XCTUnwrap(move.value as? String)
        XCTAssertNotEqual(moveValue, originalMove)
        XCTAssertEqual(aim.value as? String, aimValue, "Changing movement must not change aim sensitivity")
        app.terminate(); app.launch()
        XCTAssertTrue(aim.waitForExistence(timeout: 40))
        XCTAssertEqual(aim.value as? String, aimValue)
        XCTAssertEqual(move.value as? String, moveValue)
        let play = app.webViews.buttons.matching(NSPredicate(format: "label BEGINSWITH 'PLAY SOLO'")).firstMatch
        play.tap()
        app.webViews.buttons["Pause"].tap()
        XCTAssertTrue(aim.waitForExistence(timeout: 5))
        XCTAssertEqual(aim.value as? String, aimValue)
        XCTAssertEqual(move.value as? String, moveValue)
    }

    func testLongPressAndFireStrip() throws {
        continueAfterFailure = false
        XCUIDevice.shared.orientation = .landscapeLeft
        let app = XCUIApplication()
        app.launch()
        let play = app.webViews.buttons.matching(NSPredicate(format: "label BEGINSWITH 'PLAY SOLO'")).firstMatch
        XCTAssertTrue(play.waitForExistence(timeout: 40))
        play.tap()
        let fire = app.webViews.buttons["Fire"]
        XCTAssertTrue(fire.waitForExistence(timeout: 10))
        let aim = app.webViews.otherElements["Aim joystick"]
        XCTAssertGreaterThan(fire.frame.minX, aim.frame.maxX)
        XCTAssertEqual(fire.frame.minY, aim.frame.minY, accuracy: 1)
        XCTAssertEqual(fire.frame.height, 140, accuracy: 1)
        fire.press(forDuration: 1.2)
        app.webViews.images.matching(NSPredicate(format: "label BEGINSWITH 'Ammo: '")).firstMatch.press(forDuration: 1.2)
        for action in ["Copy", "Paste", "Cut", "Select", "Select All", "Undo", "Redo"] {
            XCTAssertFalse(app.menuItems[action].exists, "Gameplay must not open an editing menu")
            XCTAssertFalse(app.buttons[action].exists, "Long presses must not open an editing toolbar")
        }
        XCTAssertTrue(fire.isHittable)
        app.webViews.buttons["Pause"].tap()
        XCTAssertTrue(app.webViews.staticTexts["Paused"].waitForExistence(timeout: 5))
    }

    func testWeaponMeterAndSeparateAim() throws {
        continueAfterFailure = false
        XCUIDevice.shared.orientation = .landscapeLeft
        let app = XCUIApplication()
        app.launch()
        let play = app.webViews.buttons.matching(NSPredicate(format: "label BEGINSWITH 'PLAY SOLO'")).firstMatch
        XCTAssertTrue(play.waitForExistence(timeout: 40))
        play.tap()
        let aim = app.webViews.otherElements["Aim joystick"]
        XCTAssertTrue(aim.waitForExistence(timeout: 10))
        XCTAssertFalse(app.webViews.buttons["Jump"].exists)
        XCTAssertFalse(app.webViews.buttons["Slide or dash"].exists)
        let center = aim.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.4))
        center.press(forDuration: 0.2, thenDragTo: center.withOffset(CGVector(dx: 32, dy: -16)))
        XCTAssertTrue(app.webViews.images["Ammo: 35"].exists, "Aiming alone must never fire")
        let shotgun = app.webViews.buttons["Equip Shotgun, next"]
        let meterPoint = shotgun.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5))
        meterPoint.press(forDuration: 0.05, thenDragTo: meterPoint.withOffset(CGVector(dx: 0, dy: -45)))
        XCTAssertTrue(app.webViews.buttons["Equip Shotgun, equipped"].waitForExistence(timeout: 3))
        let selected = app.webViews.buttons["Equip Shotgun, equipped"].coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5))
        selected.press(forDuration: 0.05, thenDragTo: selected.withOffset(CGVector(dx: 0, dy: 45)))
        XCTAssertTrue(app.webViews.buttons["Equip Rifle, equipped"].waitForExistence(timeout: 3))
        for name in ["Katana", "Sniper", "Rifle", "Shotgun"] {
            app.webViews.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "Equip \(name)")).firstMatch.tap()
            XCTAssertTrue(app.webViews.buttons["Equip \(name), equipped"].waitForExistence(timeout: 3))
        }
        app.webViews.buttons["Fire"].press(forDuration: 1.8)
        let ammo = app.webViews.images.matching(NSPredicate(format: "label BEGINSWITH 'Ammo: '")).firstMatch
        let remaining = try XCTUnwrap(Int(ammo.label.replacingOccurrences(of: "Ammo: ", with: "")))
        XCTAssertLessThan(remaining, 5)
        app.webViews.buttons["Pause"].tap()
        XCTAssertTrue(app.webViews.staticTexts["Paused"].waitForExistence(timeout: 5))
        XCTAssertFalse(app.webViews.buttons["Fire"].exists)
    }

    func testVisibleReloadProgress() throws {
        continueAfterFailure = false
        XCUIDevice.shared.orientation = .landscapeLeft
        let app = XCUIApplication()
        app.launch()
        let play = app.webViews.buttons.matching(NSPredicate(format: "label BEGINSWITH 'PLAY SOLO'")).firstMatch
        XCTAssertTrue(play.waitForExistence(timeout: 40))
        play.tap()
        let fire = app.webViews.buttons["Fire"]
        XCTAssertTrue(fire.waitForExistence(timeout: 10))
        fire.press(forDuration: 0.35)
        XCTAssertFalse(app.webViews.images["Ammo: 35"].exists)
        app.webViews.buttons["Reload"].tap()
        XCTAssertTrue(app.webViews.staticTexts["RELOADING"].waitForExistence(timeout: 1))
        XCTAssertTrue(app.webViews.images["Ammo: 35"].waitForExistence(timeout: 5))
        XCTAssertFalse(app.webViews.staticTexts["RELOADING"].exists)
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
        let fire = app.webViews.buttons["Fire"]
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
        let fire = app.webViews.buttons["Fire"]
        XCTAssertTrue(fire.waitForExistence(timeout: 10))
        fire.press(forDuration: 0.3)
        app.switches["Toggle aim"].tap()
        app.webViews.buttons["Equip Shotgun, next"].tap()
        XCTAssertTrue(app.webViews.buttons["Equip Shotgun, equipped"].waitForExistence(timeout: 3))
        app.webViews.firstMatch.coordinate(withNormalizedOffset: CGVector(dx: 0.4, dy: 0.4)).tap()
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
