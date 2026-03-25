import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";

let wss: WebSocketServer;

export function setupWebSocket(server: Server) {
    wss = new WebSocketServer({ server, path: "/ws" });

    wss.on("connection", (ws) => {
        console.log("WebSocket client connected");
        ws.on("close", () => {
            console.log("WebSocket client disconnected");
        });
    });
}

export function broadcast(event: string, data: unknown) {
    if (!wss) return;
    const message = JSON.stringify({ event, data });
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}
