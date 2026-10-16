
"use client";

import {getResearchContext,subscribeResearchContext} from "@/lib/research";
import {useSyncExternalStore} from "react";
import { useState, type FormEvent } from "react";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export default function PortfolioChat() {
  const researchContext=useSyncExternalStore(subscribeResearchContext,getResearchContext,()=>null);
  const [useContext,setUseContext]=useState(true);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);

  // Local demo portfolio. Replace with the selected
  // authenticated portfolio when that functionality exists.
  const portfolioId = 1;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const question = message.trim();

    if (!question || loading || question.length > 2000) return;

    setMessages((previous) => [
      ...previous,
      { role: "user", content: question }
    ]);
    setMessage("");
    setLoading(true);

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ portfolioId, message: question, ...(useContext&&researchContext?{researchContext}:{}) })
      });

      if (!response.ok) {
        throw new Error("AI request failed");
      }

      const data = await response.json();

      if (typeof data.reply !== "string") {
        throw new Error("Invalid AI response");
      }

      setMessages((previous) => [
        ...previous,
        { role: "assistant", content: data.reply }
      ]);
    } catch {
      setMessages((previous) => [
        ...previous,
        {
          role: "assistant",
          content: "I couldn't connect to PortfolioLab AI. Please check that the local AI service and backend are running."
        }
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed bottom-5 right-5 z-50">
      {open && (
        <section
          aria-label="PortfolioLab AI chat"
          className="mb-4 flex h-[min(520px,75vh)] w-[min(380px,calc(100vw-40px))] flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl"
        >
          <div className="flex items-center justify-between border-b border-slate-800 px-4 py-4">
            <div>
              <h2 className="font-semibold text-white">
                PortfolioLab AI
              </h2>
              <p className="text-xs text-slate-400">
                Simulated portfolio assistant
              </p>
            </div>

            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close chat"
              className="rounded-lg px-3 py-1 text-slate-400 hover:bg-slate-800 hover:text-white"
            >
              ✕
            </button>
          </div>

          <div
            aria-live="polite"
            className="flex-1 space-y-3 overflow-y-auto p-4"
          >
            {messages.length === 0 && (
              <div className="rounded-xl bg-slate-800 p-3 text-sm text-slate-300">
                Ask about your simulated holdings, portfolio values, or performance.
              </div>
            )}

            {messages.map((item, index) => (
              <div
                key={index}
                className={`max-w-[90%] whitespace-pre-wrap break-words rounded-xl p-3 text-sm ${
                  item.role === "user"
                    ? "ml-auto bg-emerald-800 text-emerald-50"
                    : "mr-auto bg-slate-800 text-slate-200"
                }`}
              >
                {item.content}
              </div>
            ))}

            {loading && (
              <p role="status" className="text-sm text-slate-400">
                Thinking...
              </p>
            )}
          </div>

          {researchContext&&<label className="px-4 py-2 text-xs text-slate-300"><input type="checkbox" checked={useContext} onChange={e=>setUseContext(e.target.checked)}/> Use current {researchContext.assetId?`fictional asset #${researchContext.assetId}, ${researchContext.from} to ${researchContext.to}`:"hypothetical scenario"} context</label>}
          <form
            onSubmit={handleSubmit}
            className="flex gap-2 border-t border-slate-800 p-3"
          >
            <input
              type="text"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              maxLength={2000}
              placeholder="Ask about your portfolio..."
              aria-label="Your message"
              className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
            />

            <button
              type="submit"
              disabled={loading || !message.trim()}
              className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Send
            </button>
          </form>

          <p className="pb-2 text-center text-[10px] text-slate-500">
            Educational simulation · Local AI
          </p>
        </section>
      )}

      <button
        type="button"
        onClick={() => setOpen((previous) => !previous)}
        aria-label={open ? "Close AI assistant" : "Open AI assistant"}
        aria-expanded={open}
        className="ml-auto flex h-14 items-center gap-2 rounded-full bg-emerald-500 px-5 font-semibold text-slate-950 shadow-xl hover:bg-emerald-400"
      >
        <span aria-hidden="true">✦</span>
        {open ? "Close" : "Ask AI"}
      </button>
    </div>
  );
}
