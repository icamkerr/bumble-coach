"use client";

import { useState } from "react";

type Mode = "opener" | "reply" | "coach";

interface Result {
  suggestions: string[];
  tip?: string;
}

export default function Home() {
  const [mode, setMode] = useState<Mode>("opener");
  const [theirProfile, setTheirProfile] = useState("");
  const [theirMessage, setTheirMessage] = useState("");
  const [myStyle, setMyStyle] = useState("");
  const [conversationHistory, setConversationHistory] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState<number | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, theirProfile, theirMessage, myStyle, conversationHistory }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setResult(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function copyText(text: string, idx: number) {
    navigator.clipboard?.writeText(text);
    setCopied(idx);
    setTimeout(() => setCopied(null), 1500);
  }

  const tabs: { id: Mode; label: string; emoji: string }[] = [
    { id: "opener", label: "Write an Opener", emoji: "👋" },
    { id: "reply", label: "Craft a Reply", emoji: "💬" },
    { id: "coach", label: "Convo Coach", emoji: "🧠" },
  ];

  return (
    <main className="min-h-screen bg-[#fdf6f0]">
      <header className="bg-[#FFCC00] shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <span className="text-3xl">🐝</span>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Bumble Coach</h1>
            <p className="text-sm text-gray-700">AI-powered openers, replies & conversation coaching</p>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex gap-2 mb-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => { setMode(tab.id); setResult(null); setError(""); }}
              className={`flex-1 py-3 px-2 rounded-xl text-sm font-semibold transition-all ${
                mode === tab.id
                  ? "bg-[#FFCC00] text-gray-900 shadow-md"
                  : "bg-white text-gray-600 border border-gray-200 hover:bg-yellow-50"
              }`}
            >
              <span className="block text-lg mb-1">{tab.emoji}</span>
              {tab.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Their Profile Bio & Prompts
            </label>
            <textarea
              value={theirProfile}
              onChange={(e) => setTheirProfile(e.target.value)}
              placeholder="Paste their bio, prompts, interests — anything from their profile..."
              rows={5}
              className="w-full text-sm border border-gray-200 rounded-xl p-3 resize-none focus:outline-none focus:ring-2 focus:ring-yellow-400"
              required
            />
          </div>

          {mode === "reply" && (
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Their Last Message
              </label>
              <textarea
                value={theirMessage}
                onChange={(e) => setTheirMessage(e.target.value)}
                placeholder="What did they say?"
                rows={3}
                className="w-full text-sm border border-gray-200 rounded-xl p-3 resize-none focus:outline-none focus:ring-2 focus:ring-yellow-400"
                required
              />
            </div>
          )}

          {mode === "coach" && (
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Full Conversation (paste the thread)
              </label>
              <textarea
                value={conversationHistory}
                onChange={(e) => setConversationHistory(e.target.value)}
                placeholder="Paste the full conversation so far..."
                rows={6}
                className="w-full text-sm border border-gray-200 rounded-xl p-3 resize-none focus:outline-none focus:ring-2 focus:ring-yellow-400"
                required
              />
            </div>
          )}

          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Your Vibe <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              value={myStyle}
              onChange={(e) => setMyStyle(e.target.value)}
              placeholder="Describe your tone: e.g. 'witty and sarcastic, love outdoor adventures, work in tech, keep it casual not cheesy'"
              rows={3}
              className="w-full text-sm border border-gray-200 rounded-xl p-3 resize-none focus:outline-none focus:ring-2 focus:ring-yellow-400"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-[#FFCC00] hover:bg-yellow-400 text-gray-900 font-bold rounded-2xl shadow-md transition-all disabled:opacity-60 text-lg"
          >
            {loading
              ? "Thinking... 🐝"
              : mode === "opener"
              ? "Generate Openers ✨"
              : mode === "reply"
              ? "Craft Replies ✨"
              : "Analyze Convo ✨"}
          </button>
        </form>

        {error && (
          <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-sm">
            {error}
          </div>
        )}

        {result && (
          <div className="mt-8 space-y-4">
            <h2 className="text-lg font-bold text-gray-800">
              {mode === "coach" ? "Coaching Breakdown" : "Suggested Messages"}
            </h2>
            {result.suggestions.map((s, i) => (
              <div
                key={i}
                className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 group cursor-pointer hover:border-yellow-300 transition-all"
                onClick={() => copyText(s, i)}
              >
                <p className="text-gray-800 text-sm leading-relaxed whitespace-pre-wrap">{s}</p>
                <p className="text-xs mt-3 transition-opacity text-gray-400">
                  {copied === i ? "✅ Copied!" : "Click to copy"}
                </p>
              </div>
            ))}
            {result.tip && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-5">
                <p className="text-sm font-semibold text-yellow-800 mb-1">💡 Pro tip</p>
                <p className="text-sm text-yellow-900">{result.tip}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
