import Foundation
import Network

// A loopback-only origin loads ES modules and WebGL assets normally in WebKit.
// All game files ship in the app. Solo play never needs a network connection.
final class LocalGameServer {
    private var listener: NWListener?
    private let queue = DispatchQueue(label: "com.viaaaron.doodleshooter.assets")
    private let root: URL
    // Stable origin preserves the game's localStorage settings and checkpoints.
    static let port: UInt16 = 18741

    init(root: URL) { self.root = root.standardizedFileURL }

    func start(completion: @escaping (Result<URL, Error>) -> Void) {
        do {
            let parameters = NWParameters.tcp
            parameters.requiredLocalEndpoint = .hostPort(host: "127.0.0.1", port: NWEndpoint.Port(rawValue: Self.port)!)
            parameters.allowLocalEndpointReuse = true
            let listener = try NWListener(using: parameters)
            self.listener = listener
            listener.stateUpdateHandler = { state in
                switch state {
                case .ready:
                    DispatchQueue.main.async { completion(.success(URL(string: "http://127.0.0.1:\(Self.port)/index.html")!)) }
                case .failed(let error):
                    DispatchQueue.main.async { completion(.failure(error)) }
                default: break
                }
            }
            listener.newConnectionHandler = { [weak self] connection in
                guard let self else { connection.cancel(); return }
                connection.start(queue: self.queue)
                self.receive(connection, accumulated: Data())
            }
            listener.start(queue: queue)
        } catch { completion(.failure(error)) }
    }

    private func receive(_ connection: NWConnection, accumulated: Data) {
        connection.receive(minimumIncompleteLength: 1, maximumLength: 16_384) { [weak self] data, _, complete, error in
            guard let self else { connection.cancel(); return }
            var request = accumulated
            if let data { request.append(data) }
            guard request.count <= 16_384, error == nil else { connection.cancel(); return }
            if request.range(of: Data("\r\n\r\n".utf8)) != nil {
                self.respond(connection, request: request)
            } else if complete { connection.cancel() }
            else { self.receive(connection, accumulated: request) }
        }
    }

    private func respond(_ connection: NWConnection, request: Data) {
        let line = String(decoding: request, as: UTF8.self).components(separatedBy: "\r\n")[0].split(separator: " ")
        guard line.count == 3, line[0] == "GET" || line[0] == "HEAD" else {
            send(connection, status: "405 Method Not Allowed", body: Data(), mime: "text/plain"); return
        }
        let rawPath = String(line[1]).components(separatedBy: "?")[0]
        guard let path = rawPath.removingPercentEncoding, path.hasPrefix("/") else {
            send(connection, status: "400 Bad Request", body: Data(), mime: "text/plain"); return
        }
        let file = root.appendingPathComponent(path == "/" ? "index.html" : String(path.dropFirst())).standardizedFileURL.resolvingSymlinksInPath()
        guard file.path.hasPrefix(root.resolvingSymlinksInPath().path + "/"), let data = try? Data(contentsOf: file) else {
            send(connection, status: "404 Not Found", body: Data(), mime: "text/plain"); return
        }
        let types = ["html": "text/html; charset=utf-8", "js": "text/javascript; charset=utf-8", "css": "text/css; charset=utf-8", "json": "application/json", "png": "image/png", "svg": "image/svg+xml"]
        send(connection, status: "200 OK", body: data, mime: types[file.pathExtension] ?? "application/octet-stream", head: line[0] == "HEAD")
    }

    private func send(_ connection: NWConnection, status: String, body: Data, mime: String, head: Bool = false) {
        var response = Data("HTTP/1.1 \(status)\r\nContent-Type: \(mime)\r\nContent-Length: \(body.count)\r\nCache-Control: no-cache\r\nX-Content-Type-Options: nosniff\r\nConnection: close\r\n\r\n".utf8)
        if !head { response.append(body) }
        connection.send(content: response, completion: .contentProcessed { _ in connection.cancel() })
    }

    deinit { listener?.cancel() }
}
