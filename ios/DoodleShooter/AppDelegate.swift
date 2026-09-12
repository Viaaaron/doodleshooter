import UIKit
import AVFAudio

@main
final class AppDelegate: UIResponder, UIApplicationDelegate {
    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
        // Game audio should play even when the phone's silent switch is on.
        try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .default, options: [.mixWithOthers])
        try? AVAudioSession.sharedInstance().setActive(true)
        return true
    }
}

final class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }
        let window = UIWindow(windowScene: windowScene)
        window.rootViewController = GameViewController()
        self.window = window
        window.makeKeyAndVisible()
    }

    func sceneWillResignActive(_ scene: UIScene) {
        (window?.rootViewController as? GameViewController)?.pauseGame()
        UIApplication.shared.isIdleTimerDisabled = false
    }

    func sceneDidBecomeActive(_ scene: UIScene) {
        (window?.rootViewController as? GameViewController)?.activateGame()
        UIApplication.shared.isIdleTimerDisabled = true
    }
}
