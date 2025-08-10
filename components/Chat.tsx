"use client";

import { useState, useRef, useEffect } from "react";
import type { Order, ChatTurn } from "@/lib/types";
import { translations, type Locale } from "@/lib/translations";

interface ChatProps {
  onOrderChange: (order: Order | null) => void;
  locale: Locale;
}

export default function Chat({ onOrderChange, locale }: ChatProps) {
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [order, setOrder] = useState<Order | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns, loading]);

  useEffect(() => {
    onOrderChange(order);
  }, [order, onOrderChange]);

  async function sendMessage() {
    if (!input.trim()) return;
    const userText = input.trim();
    setInput("");
    setTurns((t) => [...t, { role: "user", text: userText, timestamp: new Date().toISOString() }]);
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userText, currentOrder: order, locale }),
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      const assistantText: string = data.assistant_text ?? "";
      const newOrder: Order | null = data.order ?? null;
      setOrder(newOrder);
      setTurns((t) => [...t, { role: "assistant", text: assistantText, timestamp: data.timestamp ?? new Date().toISOString() }]);
    } catch (err: any) {
      setTurns((t) => [...t, { role: "assistant", text: translations[locale].errorOccurred, timestamp: new Date().toISOString(), error: String(err) }]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  }

  return (
    <>
      {/* Chat messages */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="w-full space-y-4">
          {turns.map((t, idx) => (
            <div key={idx} className={`flex ${t.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${t.role === "user"
                ? "bg-blue-600 text-white"
                : "bg-white border border-gray-200 text-gray-900"
                }`}>
                <div className={`text-xs mb-1 ${t.role === "user" ? "text-blue-100" : "text-gray-500"}`}>
                  {new Date(t.timestamp).toLocaleTimeString()}
                </div>
                <div className="text-sm leading-relaxed">{t.text}</div>
                {t.error ? (
                  <div className="text-xs text-red-600 mt-2 p-2 bg-red-50 rounded border border-red-200">
                    {t.error}
                  </div>
                ) : null}
              </div>
            </div>
          ))}
          {loading ? (
            <div className="flex justify-start">
              <div className="bg-white border border-gray-200 rounded-lg px-4 py-2">
                <div className="flex items-center space-x-2 text-gray-500">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                  <span className="text-sm">{translations[locale].assistantWriting}</span>
                </div>
              </div>
            </div>
          ) : null}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input area */}
      <div className="border-t border-gray-200 bg-white p-4">
        <div className="w-full flex gap-3">
          <input
            type="text"
            className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder={translations[locale].typePlaceholder}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button
            onClick={() => void sendMessage()}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {translations[locale].send}
          </button>
        </div>
      </div>
    </>
  );
}