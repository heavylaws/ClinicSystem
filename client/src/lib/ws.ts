import { useEffect, useRef, useCallback } from "react";

type WSMessage = {
    event: string;
    data: any;
};

type WSHandler = (data: any) => void;

const handlers = new Map<string, Set<WSHandler>>();
let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

function connect() {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${protocol}//${window.location.host}/ws`;

    ws = new WebSocket(url);

    ws.onmessage = (event) => {
        try {
            const msg: WSMessage = JSON.parse(event.data);
            const eventHandlers = handlers.get(msg.event);
            if (eventHandlers) {
                eventHandlers.forEach((handler) => handler(msg.data));
            }
        } catch {
            // ignore parse errors
        }
    };

    ws.onclose = () => {
        ws = null;
        // Reconnect after 3 seconds
        if (reconnectTimer) clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(connect, 3000);
    };

    ws.onerror = () => {
        ws?.close();
    };
}

// Auto-connect
if (typeof window !== "undefined") {
    connect();
}

export function useWebSocket(event: string, handler: WSHandler) {
    const handlerRef = useRef(handler);
    handlerRef.current = handler;

    useEffect(() => {
        const wrappedHandler: WSHandler = (data) => handlerRef.current(data);

        if (!handlers.has(event)) {
            handlers.set(event, new Set());
        }
        handlers.get(event)!.add(wrappedHandler);

        return () => {
            handlers.get(event)?.delete(wrappedHandler);
        };
    }, [event]);
}
