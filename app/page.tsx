"use client";

import { useState, useRef, useCallback } from "react";

type Mode = "opener" | "reply" | "coach" | "botcheck";

interface Result {
  suggestions: string[];
  tip?: string;
  score?: number;
  verdict?: string;
}

interface DroppedImage {
  base64: string;
  mediaType: string;
  preview: string;
}

export default function Home() {
  const [mode, setMode] = useState<Mode>("opener");
  const [theirProfile, setTheirProfile] = useState("");
  const [theirMessage, setTheirMessage] = useState("");
  const [conversationHistory, setConversationHistory] = useState("");
  const [images, setImages] = useState<DroppedImage[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function readFileAsBase64(file: File): Promise<DroppedImage> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const [header, base64] = dataUrl.split(",");
        const mediaType = header.match(/:(.*?);/)?.[1] ?? "image/jpeg";
        resolve({ base64, mediaType, preview: dataUrl });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function addFiles(files: FileList | File[]) {
    const imageFiles = Array.from(files).filter((f) => f.type.startsWith("image/"));
    const newImages = await Promise.all(imageFiles.map(readFileAsBase64));
    setImages((prev) => [...prev, ...newImages].slice(0, 6));
  }

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    await addFiles(e.dataTransfer.files);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!theirProfile && images.length === 0) {
      setError("Add a profile screenshot or paste their bio.");
      return;
    }
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          theirProfile,
          theirMessage,
          conversationHistory,
          images: images.map(({ base64, mediaType }) => ({ base64, mediaType })),
        }),
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
    { id: "botcheck", label: "Bot Check", emoji: "🤖" },
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
          {/* Profile drop zone */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              Their Profile
            </label>

            {/* Drop zone */}
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={() => setDragOver(false)}
              onClick={() => fileInputRef.current?.click()}
              className={`relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all mb-3 ${
                dragOver
                  ? "border-yellow-400 bg-yellow-50"
                  : "border-gray-200 hover:border-yellow-300 hover:bg-yellow-50/50"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => e.target.files && addFiles(e.target.files)}
              />
              {images.length === 0 ? (
                <>
                  <p className="text-2xl mb-1">📸</p>
                  <p className="text-sm font-medium text-gray-600">Drop profile screenshots here</p>
                  <p className="text-xs text-gray-400 mt-1">or click to browse · up to 6 images</p>
                </>
              ) : (
                <div className="flex flex-wrap gap-2 justify-center">
                  {images.map((img, i) => (
                    <div key={i} className="relative group">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={img.preview}
                        alt={`Profile screenshot ${i + 1}`}
                        className="h-24 w-auto rounded-lg object-cover border border-gray-200"
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setImages((prev) => prev.filter((_, j) => j !== i));
                        }}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <div className="h-24 w-16 rounded-lg border-2 border-dashed border-gray-200 flex items-center justify-center text-gray-400 text-xl">
                    +
                  </div>
                </div>
              )}
            </div>

            {/* Text fallback */}
            <p className="text-xs text-gray-400 mb-2 text-center">— or type / paste their bio below —</p>
            <textarea
              value={theirProfile}
              onChange={(e) => setTheirProfile(e.target.value)}
              placeholder="Paste their bio, prompts, interests..."
              rows={3}
              className="w-full text-sm border border-gray-200 rounded-xl p-3 resize-none focus:outline-none focus:ring-2 focus:ring-yellow-400"
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

          {(mode === "coach" || mode === "botcheck") && (
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                {mode === "botcheck" ? "Their Messages (optional — paste if you've been chatting)" : "Full Conversation (paste the thread)"}
              </label>
              <textarea
                value={conversationHistory}
                onChange={(e) => setConversationHistory(e.target.value)}
                placeholder={mode === "botcheck" ? "Paste any messages they've sent you..." : "Paste the full conversation so far..."}
                rows={6}
                className="w-full text-sm border border-gray-200 rounded-xl p-3 resize-none focus:outline-none focus:ring-2 focus:ring-yellow-400"
                required={mode === "coach"}
              />
            </div>
          )}

          {mode !== "botcheck" && (
            <div className="flex items-center gap-2 px-1">
              <span className="text-xs text-gray-400">✅ Writing as Cameron · 58 · Evergreen · SVP · Adventurer</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-4 font-bold rounded-2xl shadow-md transition-all disabled:opacity-60 text-lg ${
              mode === "botcheck"
                ? "bg-gray-900 hover:bg-gray-700 text-white"
                : "bg-[#FFCC00] hover:bg-yellow-400 text-gray-900"
            }`}
          >
            {loading
              ? "Analyzing... 🔍"
              : mode === "opener"
              ? "Generate Openers ✨"
              : mode === "reply"
              ? "Craft Replies ✨"
              : mode === "botcheck"
              ? "Run Bot Check 🤖"
              : "Analyze Convo ✨"}
          </button>
        </form>

        {error && (
          <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-sm">
            {error}
          </div>
        )}

        {result && mode === "botcheck" && result.verdict && (
          <div className="mt-8 space-y-4">
            {/* Verdict banner */}
            <div className={`rounded-2xl p-5 text-center shadow-md ${
              result.score! >= 7 ? "bg-red-100 border-2 border-red-400" :
              result.score! >= 4 ? "bg-yellow-100 border-2 border-yellow-400" :
              "bg-green-100 border-2 border-green-400"
            }`}>
              <p className="text-4xl mb-2">
                {result.score! >= 7 ? "🚨" : result.score! >= 4 ? "⚠️" : "✅"}
              </p>
              <p className={`text-xl font-bold ${
                result.score! >= 7 ? "text-red-700" :
                result.score! >= 4 ? "text-yellow-700" :
                "text-green-700"
              }`}>{result.verdict}</p>
              <p className="text-sm mt-1 text-gray-600">Fake score: {result.score}/10</p>
            </div>

            {/* Findings */}
            <h2 className="text-lg font-bold text-gray-800">Findings</h2>
            {result.suggestions.map((s, i) => (
              <div key={i} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                <p className="text-gray-800 text-sm leading-relaxed">{s}</p>
              </div>
            ))}

            {result.tip && (
              <div className="bg-gray-900 rounded-2xl p-5">
                <p className="text-sm font-semibold text-yellow-400 mb-1">🛡️ Recommended action</p>
                <p className="text-sm text-gray-100">{result.tip}</p>
              </div>
            )}
          </div>
        )}

        {result && mode !== "botcheck" && (
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
