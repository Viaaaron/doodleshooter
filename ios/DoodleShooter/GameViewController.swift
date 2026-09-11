import UIKit
import WebKit

final class GameViewController: UIViewController, WKNavigationDelegate {
    private var webView: WKWebView!
    private var server: LocalGameServer!
    private let loading = UILabel()

    override var prefersStatusBarHidden: Bool { true }
    override var prefersHomeIndicatorAutoHidden: Bool { true }
    override var preferredScreenEdgesDeferringSystemGestures: UIRectEdge { .all }
    override var supportedInterfaceOrientations: UIInterfaceOrientationMask { .landscape }
    override var preferredInterfaceOrientationForPresentation: UIInterfaceOrientation { .landscapeRight }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(red: 0.965, green: 0.953, blue: 0.902, alpha: 1)
        let configuration = WKWebViewConfiguration()
        // Keep the page at its authored scale; gun aiming changes the game camera.
        configuration.ignoresViewportScaleLimits = false
        configuration.allowsInlineMediaPlayback = true
        configuration.mediaTypesRequiringUserActionForPlayback = []
        webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = self
        webView.isOpaque = false
        webView.backgroundColor = view.backgroundColor
        webView.scrollView.isScrollEnabled = false
        webView.scrollView.bounces = false
        webView.scrollView.bouncesZoom = false
        webView.scrollView.pinchGestureRecognizer?.isEnabled = false
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.isMultipleTouchEnabled = true
        webView.allowsBackForwardNavigationGestures = false
        #if DEBUG
        webView.isInspectable = true
        #endif
        webView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(webView)
        NSLayoutConstraint.activate([
            webView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            webView.topAnchor.constraint(equalTo: view.topAnchor),
            webView.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])
        loading.text = "Drawing the district…"
        loading.textColor = UIColor(red: 0.10, green: 0.19, blue: 0.75, alpha: 1)
        loading.font = .systemFont(ofSize: 22, weight: .semibold)
        loading.textAlignment = .center
        loading.numberOfLines = 0
        loading.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(loading)
        NSLayoutConstraint.activate([
            loading.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            loading.centerYAnchor.constraint(equalTo: view.centerYAnchor),
            loading.widthAnchor.constraint(lessThanOrEqualTo: view.widthAnchor, multiplier: 0.8)
        ])
        server = LocalGameServer(root: Bundle.main.resourceURL!)
        server.start { [weak self] result in
            switch result {
            case .success(let url): self?.webView.load(URLRequest(url: url))
            case .failure: self?.loading.text = "Couldn’t open the game.\nClose the app and try again."
            }
        }
    }

    func pauseGame() {
        webView?.evaluateJavaScript("window.dispatchEvent(new Event('doodle-pause'))", completionHandler: nil)
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        // Wait for the module graph and renderer, not just the HTML document.
        waitForGame(remaining: 60)
    }

    private func waitForGame(remaining: Int) {
        webView.evaluateJavaScript("Boolean(window.__game?.input && document.getElementById('soloBtn'))") { [weak self] value, _ in
            guard let self else { return }
            if value as? Bool == true { self.loading.isHidden = true }
            else if remaining > 0 {
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { self.waitForGame(remaining: remaining - 1) }
            } else { self.loading.text = "The game couldn’t finish loading.\nClose the app and try again." }
        }
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        loading.isHidden = false
        loading.text = "Redrawing the district…"
        webView.reload()
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        loading.text = "Couldn’t load the game.\nClose the app and try again."
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        let url = navigationAction.request.url
        decisionHandler(url?.host == "127.0.0.1" ? .allow : .cancel)
    }
}
