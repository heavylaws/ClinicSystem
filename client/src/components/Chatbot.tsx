import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, Loader2, Bot } from "lucide-react";
import { api } from "../lib/api";
import { cn } from "../lib/utils";
import { Button } from "./ui/button";

interface ChatMessage {
    role: "user" | "model";
    text: string;
}

export default function Chatbot() {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        if (isOpen && messages.length === 0) {
            setMessages([
                {
                    role: "model",
                    text: "Hello! I am the DermClinic AI Assistant. How can I help you today? (Hola! Soy el asistente de DermClinic, ¿en qué te puedo ayudar?)",
                },
            ]);
        }
    }, [isOpen]);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSend = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!input.trim() || isLoading) return;

        const userMessage = input.trim();
        setInput("");
        setMessages((prev) => [...prev, { role: "user", text: userMessage }]);
        setIsLoading(true);

        try {
            // Need to send history except the initial greeting, or just send everything
            // Note: The history sent to genai must only include user/model roles.
            // Our starting message is 'model' which is correct.
            const historyToSent = messages.map(m => ({ role: m.role, parts: [{ text: m.text }] }));
            
            const response = await api.ai.chat(userMessage, historyToSent);
            
            setMessages((prev) => [...prev, { role: "model", text: response.text }]);
        } catch (error: any) {
            setMessages((prev) => [
                ...prev,
                { role: "model", text: "Sorry, I encountered an error: " + error.message },
            ]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed bottom-6 right-6 z-[100] flex flex-col items-end">
            {/* Chat Window */}
            {isOpen && (
                <div className="bg-white border rounded-2xl shadow-2xl mb-4 w-[350px] sm:w-[400px] h-[500px] max-h-[calc(100vh-120px)] flex flex-col overflow-hidden animate-in slide-in-from-bottom-5">
                    {/* Header */}
                    <div className="bg-primary-600 text-white p-4 flex items-center justify-between shadow-sm">
                        <div className="flex items-center gap-2">
                            <Bot size={24} />
                            <div>
                                <h3 className="font-semibold">Clinic Assistant</h3>
                                <p className="text-xs text-primary-100">Multi-lingual Support</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setIsOpen(false)}
                            className="text-white/80 hover:text-white transition-colors"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    {/* Messages Area */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
                        {messages.map((msg, i) => (
                            <div
                                key={i}
                                className={cn(
                                    "flex",
                                    msg.role === "user" ? "justify-end" : "justify-start"
                                )}
                            >
                                <div
                                    className={cn(
                                        "max-w-[80%] rounded-2xl px-4 py-2 text-sm whitespace-pre-wrap",
                                        msg.role === "user"
                                            ? "bg-primary-600 text-white rounded-tr-none"
                                            : "bg-white border text-gray-800 rounded-tl-none shadow-sm"
                                    )}
                                >
                                    {msg.text}
                                </div>
                            </div>
                        ))}
                        {isLoading && (
                            <div className="flex justify-start">
                                <div className="bg-white border text-gray-800 rounded-2xl rounded-tl-none px-4 py-3 shadow-sm flex items-center gap-2">
                                    <Loader2 size={16} className="animate-spin text-primary-500" />
                                    <span className="text-xs text-gray-500">Thinking...</span>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input Area */}
                    <div className="p-3 bg-white border-t">
                        <form
                            onSubmit={handleSend}
                            className="flex items-center gap-2 bg-gray-50 border rounded-full px-4 py-2 focus-within:ring-2 focus-within:ring-primary-500 focus-within:border-primary-500 transition-all"
                        >
                            <input
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder="Ask for help..."
                                className="flex-1 bg-transparent border-none focus:outline-none text-sm"
                                disabled={isLoading}
                            />
                            <button
                                type="submit"
                                disabled={!input.trim() || isLoading}
                                className="text-primary-600 hover:text-primary-700 disabled:opacity-50 disabled:cursor-not-allowed p-1 transition-colors"
                            >
                                <Send size={18} />
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Floating Action Button */}
            {!isOpen && (
                <Button
                    onClick={() => setIsOpen(true)}
                    className="h-14 w-14 rounded-full shadow-lg flex items-center justify-center hover:scale-105 transition-transform"
                    style={{ padding: 0 }}
                >
                    <MessageCircle size={24} />
                </Button>
            )}
        </div>
    );
}
