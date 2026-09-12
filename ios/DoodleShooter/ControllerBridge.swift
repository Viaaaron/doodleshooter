// SPDX-License-Identifier: MIT
import GameController
import UIKit
import WebKit

private final class ControllerFrameTarget: NSObject {
    weak var bridge: ControllerBridge?
    @objc func tick() { bridge?.tick() }
}

/// Uses Apple's controller profile, including wired Backbone controllers.
/// Coalesces analog updates and preserves brief button presses across WebKit frames.
final class ControllerBridge {
    private weak var webView: WKWebView?
    private var controller: GCController?
    private var observers: [NSObjectProtocol] = []
    private let frameTarget = ControllerFrameTarget()
    private var displayLink: CADisplayLink?
    private var ready = false
    private var active = true
    private var inFlight = false
    private var dirty = true
    private var generation = 0
    private var rawButtons = [Float](repeating: 0, count: 16)
    private var buttons = [Float](repeating: 0, count: 16)
    private var axes = [Float](repeating: 0, count: 4)
    private var presses = Set<Int>()
    private var blocked = Set<Int>()

    init(webView: WKWebView) {
        self.webView = webView
        for name in [Notification.Name.GCControllerDidConnect, .GCControllerDidDisconnect, .GCControllerDidBecomeCurrent] {
            observers.append(NotificationCenter.default.addObserver(forName: name, object: nil, queue: .main) { [weak self] _ in
                self?.selectController()
            })
        }
        frameTarget.bridge = self
        let link = CADisplayLink(target: frameTarget, selector: #selector(ControllerFrameTarget.tick))
        link.preferredFrameRateRange = CAFrameRateRange(minimum: 30, maximum: 60, preferred: 60)
        link.add(to: .main, forMode: .common)
        displayLink = link
        selectController()
    }

    deinit {
        displayLink?.invalidate()
        observers.forEach(NotificationCenter.default.removeObserver)
        controller?.extendedGamepad?.valueChangedHandler = nil
    }

    func setPageReady(_ value: Bool) {
        generation += 1
        ready = value
        dirty = true
        if value { tick() }
    }

    func setActive(_ value: Bool) {
        generation += 1
        active = value
        presses.removeAll()
        if let pad = controller?.extendedGamepad {
            readButtons(pad).enumerated().forEach { if $0.element > 0.35 { blocked.insert($0.offset) } }
        }
        dirty = true
        print("Doodle Shooter controller: \(controller?.vendorName ?? "none connected")")
        tick()
    }

    private func selectController() {
        let available = GCController.controllers().filter { $0.extendedGamepad != nil }
        let next = available.first { $0 === GCController.current } ?? available.first
        if controller !== next {
            generation += 1
            controller?.extendedGamepad?.valueChangedHandler = nil
            controller = next
            rawButtons = Array(repeating: 0, count: 16)
            blocked.removeAll(); presses.removeAll()
            next?.handlerQueue = .main
            next?.extendedGamepad?.valueChangedHandler = { [weak self] _, _ in self?.capture() }
        }
        dirty = true
        tick()
    }

    private func readButtons(_ pad: GCExtendedGamepad) -> [Float] {
        [pad.buttonA.value, pad.buttonB.value, pad.buttonX.value, pad.buttonY.value,
         pad.leftShoulder.value, pad.rightShoulder.value, pad.leftTrigger.value, pad.rightTrigger.value,
         pad.buttonOptions?.value ?? 0, pad.buttonMenu.value,
         pad.leftThumbstickButton?.value ?? 0, pad.rightThumbstickButton?.value ?? 0,
         pad.dpad.up.value, pad.dpad.down.value, pad.dpad.left.value, pad.dpad.right.value]
    }

    private func capture() {
        var nextButtons = [Float](repeating: 0, count: 16)
        var nextAxes = [Float](repeating: 0, count: 4)
        if let pad = controller?.extendedGamepad {
            let raw = readButtons(pad)
            for index in raw.indices {
                if raw[index] <= 0.35 { blocked.remove(index) }
                if active && !blocked.contains(index) {
                    nextButtons[index] = raw[index]
                    if raw[index] > 0.35 && rawButtons[index] <= 0.35 { presses.insert(index) }
                }
            }
            rawButtons = raw
            if active {
                // Web standard axes point down; Apple's thumbstick Y points up.
                nextAxes = [pad.leftThumbstick.xAxis.value, -pad.leftThumbstick.yAxis.value,
                            pad.rightThumbstick.xAxis.value, -pad.rightThumbstick.yAxis.value]
            }
        }
        if nextButtons != buttons || nextAxes != axes || !presses.isEmpty { dirty = true }
        buttons = nextButtons; axes = nextAxes
    }

    fileprivate func tick() {
        capture()
        guard ready, dirty, !inFlight, let webView else { return }
        let sentPresses = presses
        let sentGeneration = generation
        presses.removeAll(); dirty = false; inFlight = true
        let snapshot: [String: Any] = [
            "connected": controller != nil,
            "id": controller?.vendorName ?? "Game controller",
            "axes": axes, "buttons": buttons, "presses": Array(sentPresses).sorted()
        ]
        webView.callAsyncJavaScript(
            "window.dispatchEvent(new CustomEvent('doodle-controller', { detail: snapshot }));",
            arguments: ["snapshot": snapshot], in: nil, in: .page
        ) { [weak self] result in
            guard let self else { return }
            self.inFlight = false
            if case .failure = result, self.generation == sentGeneration {
                self.presses.formUnion(sentPresses)
                self.dirty = true
            }
        }
    }
}
