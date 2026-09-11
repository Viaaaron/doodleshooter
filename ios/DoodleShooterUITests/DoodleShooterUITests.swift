import XCTest

final class DoodleShooterUITests: XCTestCase {
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
        app.webViews.buttons["Switch weapon"].tap()
        XCTAssertTrue(app.webViews.staticTexts["Shotgun"].waitForExistence(timeout: 3))
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
}
