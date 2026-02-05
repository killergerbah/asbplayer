from __future__ import annotations

import json


def _log(msg: str) -> None:
    """Print debug message."""
    print(f"[asbplayer-plugin] {msg}")


try:
    from aqt.qt import QObject, pyqtSlot
    from PyQt6.QtWebSockets import QWebSocketServer, QWebSocket
    from PyQt6.QtNetwork import QHostAddress

    WEBSOCKETS_AVAILABLE = True
except ImportError:
    WEBSOCKETS_AVAILABLE = False


if WEBSOCKETS_AVAILABLE:

    class AsbplayerWebSocketServer(QObject):
        """WebSocket server for asbplayer communication."""

        def __init__(self, port: int, parent: QObject | None = None):
            super().__init__(parent)
            self._port = port
            self._server: QWebSocketServer | None = None
            self._clients: set[QWebSocket] = set()

        def start(self) -> bool:
            """Start the WebSocket server. Returns True on success."""
            if self._server is not None:
                return True

            self._server = QWebSocketServer(
                "asbplayer-plugin", QWebSocketServer.SslMode.NonSecureMode, self
            )

            if not self._server.listen(QHostAddress.SpecialAddress.Any, self._port):
                _log(
                    f"Failed to listen on port {self._port}: {self._server.errorString()}"
                )
                self._server = None
                return False

            self._server.newConnection.connect(self._on_new_connection)
            _log(f"WebSocket server started on port {self._port}")
            return True

        def stop(self) -> None:
            """Stop the WebSocket server and disconnect all clients."""
            if self._server is None:
                return

            for client in list(self._clients):
                client.close()
            self._clients.clear()

            self._server.close()
            self._server = None
            _log("WebSocket server stopped")

        def has_clients(self) -> bool:
            """Return True if there are connected clients."""
            return len(self._clients) > 0

        def broadcast_message(self, message: dict) -> None:
            """Broadcast a JSON message to all connected clients."""
            if not self._clients:
                return

            json_str = json.dumps(message)
            for client in list(self._clients):
                if client.isValid():
                    client.sendTextMessage(json_str)

        @pyqtSlot()
        def _on_new_connection(self) -> None:
            """Handle new client connection."""
            if self._server is None:
                return

            client = self._server.nextPendingConnection()
            if client is None:
                return

            self._clients.add(client)

            client.textMessageReceived.connect(
                lambda msg, c=client: self._on_text_message(c, msg)
            )
            client.disconnected.connect(
                lambda c=client: self._on_client_disconnected(c)
            )

            _log(f"Client connected: {client.peerAddress().toString()}")

        def _on_text_message(self, client: QWebSocket, message: str) -> None:
            """Handle incoming text message from client."""
            if message == "PING":
                client.sendTextMessage("PONG")
                return

            try:
                data = json.loads(message)
                if data.get("command") == "response":
                    _log(f"Received response: messageId={data.get('messageId')}")
            except json.JSONDecodeError:
                _log(f"Invalid JSON received: {message[:100]}")

        def _on_client_disconnected(self, client: QWebSocket) -> None:
            """Handle client disconnection."""
            self._clients.discard(client)
            _log("Client disconnected")
            client.deleteLater()

else:

    class AsbplayerWebSocketServer:
        """Fallback stub when QtWebSockets is not available."""

        def __init__(self, port: int, parent=None):
            self._port = port
            _log("QtWebSockets not available - WebSocket server disabled")

        def start(self) -> bool:
            return False

        def stop(self) -> None:
            pass

        def has_clients(self) -> bool:
            return False

        def broadcast_message(self, message: dict) -> None:
            pass
