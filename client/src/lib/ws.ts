import { useEffect, useRef } from "react";

type WSMessage = {
    event: string;
    data: any;
};

type WSHandler = (data: any) => void;

const handlers = new Map<string, Set<WSHandler>>();
let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let connecting = false;

function connect() {
    // Guard against duplicate connection attempts
    if (ws || connecting) return;
    connecting = true;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${protocol}//${window.location.host}/ws`;

    try {
        ws = new WebSocket(url);
    } catch {
        connecting = false;
        scheduleReconnect();
        return;
    }

    ws.onopen = () => {
        connecting = false;
    };

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
        connecting = false;
        scheduleReconnect();
    };

    ws.onerror = () => {
        ws?.close();
    };
}

function scheduleReconnect() {
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(connect, 5000);
}

/** Ensure the WebSocket is connected. Called lazily by the first hook. */
export function ensureConnected() {
    if (!ws && !connecting && typeof window !== "undefined") {
        connect();
    }
}

export function useWebSocket(event: string, handler: WSHandler) {
    const handlerRef = useRef(handler);
    handlerRef.current = handler;

    useEffect(() => {
        // Lazy-connect on first hook usage
        ensureConnected();

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
