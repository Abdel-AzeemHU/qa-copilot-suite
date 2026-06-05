"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface ChatMessageView {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export function ChatPanel({
  projectId,
  initialMessages,
}: {
  projectId: string;
  initialMessages: ChatMessageView[];
}) {
  const [messages, setMessages] = useState<ChatMessageView[]>(initialMessages);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const scrollToEnd = () => {
    requestAnimationFrame(() => {
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
    });
  };

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const message = input.trim();
    if (!message || sending) return;

    setError(null);
    setInput("");
    setSending(true);

    const userMsg: ChatMessageView = {
      id: `u-${Date.now()}`,
      role: "user",
      content: message,
    };
    const assistantId = `a-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      userMsg,
      { id: assistantId, role: "assistant", content: "" },
    ]);
    scrollToEnd();

    try {
      const res = await fetch(`/api/chat/${projectId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      if (!res.ok || !res.body) {
        throw new Error(`Request failed (${res.status})`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";
        for (const evt of events) {
          const line = evt.split("\n").find((l) => l.startsWith("data: "));
          if (!line) continue;
          const data = line.slice(6);
          if (data === "[DONE]") continue;
          let text = "";
          try {
            text = JSON.parse(data) as string;
          } catch {
            text = data;
          }
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: m.content + text }
                : m,
            ),
          );
          scrollToEnd();
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chat failed");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div
        ref={listRef}
        className="h-96 space-y-3 overflow-y-auto rounded-md border border-neutral-200 p-3"
      >
        {messages.length === 0 ? (
          <p className="text-center text-sm text-neutral-500">
            Ask anything about this project&apos;s QA work.
          </p>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={
                m.role === "user" ? "flex justify-end" : "flex justify-start"
              }
            >
              <div
                className={
                  "max-w-[80%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm " +
                  (m.role === "user"
                    ? "bg-neutral-900 text-white"
                    : "bg-neutral-100 text-neutral-900")
                }
              >
                {m.content || "…"}
              </div>
            </div>
          ))
        )}
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <form onSubmit={send} className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message…"
          disabled={sending}
        />
        <Button type="submit" disabled={sending || !input.trim()}>
          {sending ? "…" : "Send"}
        </Button>
      </form>
    </div>
  );
}
