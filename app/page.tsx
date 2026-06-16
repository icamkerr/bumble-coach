"use client";

import { useState, useRef, useCallback, useEffect } from "react";

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

interface SavedProfile {
  id: string;
  name: string;
  theirProfile: string;
  images: DroppedImage[];
  savedAt: number;
}

const STORAGE_KEY = "bumble-coach-profiles";

function loadSaved(): SavedProfile[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
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
  const [savedProfiles, setSavedProfiles] = useState<SavedProfile[]>([]);
  const [showSaved, setShowSaved] = useState(false);
  const [saveNamePrompt, setSaveNamePrompt] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSavedProfiles(loadSaved());
  }, []);

  function persistProfiles(profiles: SavedProfile[]) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
    setSavedProfiles(profiles);
  }

  function saveProfile() {
    if (!saveName.trim()) return;
    const profile: SavedProfile = {
      id: Date.now().toString(),
      name: saveName.trim(),
      theirProfile,
      images,
      savedAt: Date.now(),
    };
    persistProfiles([profile, ...savedProfiles]);
    setActiveProfileId(profile.id);
    setSaveNamePrompt(false);
    setSaveName("");
  }

  function loadProfile(p: SavedProfile) {
    setTheirProfile(p.theirProfile);
    setImages(p.images);
    setActiveProfileId(p.id);
    setResult(null);
    setShowSaved(false);
  }

  function deleteProfile(id: string) {
    persistProfiles(savedProfiles.filter((p) => p.id !== id));
    if (activeProfileId === id) setActiveProfileId(null);
  }

  function resizeAndEncode(file: File, maxWidth = 800, quality = 0.75): Promise<DroppedImage> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        const scale = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        resolve({ base64: dataUrl.split(",")[1], mediaType: "image/jpeg", preview: dataUrl });
      };
      img.onerror = reject;
      img.src = objectUrl;
    });
  }

  async function addFiles(files: FileList | File[]) {
    const imageFiles = Array.from(files).filter((f) => f.type.startsWith("image/"));
    const newImages = await Promise.all(imageFiles.map((f) => resizeAndEncode(f)));
    setImages((prev) => [...prev, ...newImages].slice(0, 6));
    setActiveProfileId(null);
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

  const hasContent = theirProfile.trim() || images.length > 0;

  return (
    <main className="min-h-screen bg-[#fdf6f0]">
      <header className="bg-[#FFCC00] shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🐝</span>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Bumble Coach</h1>
              <p className="text-sm text-gray-700">AI-powered openers, replies & conversation coaching</p>
            </div>
          </div>
          <button
            onClick={() => setShowSaved((v) => !v)}
            className="relative bg-white/80 hover:bg-white rounded-xl px-3 py-2 text-sm font-semibold text-gray-700 shadow-sm transition-all"
          >
            📁 Saved
            {savedProfiles.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-gray-900 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                {savedProfiles.length}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Saved profiles drawer */}
      {showSaved && (
        <div className="max-w-2xl mx-auto px-4 pt-4">
          <div className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <p className="font-semibold text-gray-800">Saved Profiles</p>
              <button onClick={() => setShowSaved(false)} className="text-gray-400 hover:text-gray-600 text-lg">×</button>
            </div>
            {savedProfiles.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">No saved profiles yet.</p>
            ) : (
              <ul className="divide-y divide-gray-50">
                {savedProfiles.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors">
                    {/* First thumbnail */}
                    {p.images[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.images[0].preview} alt="" className="w-10 h-10 rounded-lg object-cover border border-gray-200 shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-yellow-100 flex items-center justify-center text-lg shrink-0">👤</div>
                    )}
                    <button
                      onClick={() => loadProfile(p)}
                      className="flex-1 text-left"
                    >
                      <p className="text-sm font-semibold text-gray-800">{p.name}</p>
                      <p className="text-xs text-gray-400">
                        {p.images.length} photo{p.images.length !== 1 ? "s" : ""} · {new Date(p.savedAt).toLocaleDateString()}
                      </p>
                    </button>
                    {activeProfileId === p.id && (
                      <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium">Active</span>
                    )}
                    <button
                      onClick={() => deleteProfile(p.id)}
                      className="text-gray-300 hover:text-red-400 transition-colors text-lg ml-1"
                      title="Delete"
                    >
                      🗑
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

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
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-semibold text-gray-700">Their Profile</label>
              <div className="flex items-center gap-2">
                {activeProfileId && (
                  <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium">
                    {savedProfiles.find(p => p.id === activeProfileId)?.name}
                  </span>
                )}
                {hasContent && (
                  <button
                    type="button"
                    onClick={() => setSaveNamePrompt(true)}
                    className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 py-1 rounded-lg font-medium transition-colors"
                  >
                    💾 Save
                  </button>
                )}
              </div>
            </div>

            {/* Save name prompt */}
            {saveNamePrompt && (
              <div className="mb-3 flex gap-2">
                <input
                  autoFocus
                  type="text"
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); saveProfile(); } if (e.key === "Escape") setSaveNamePrompt(false); }}
                  placeholder="Name this profile (e.g. Sarah from hiking)"
                  className="flex-1 text-sm border border-yellow-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                />
                <button type="button" onClick={saveProfile} className="bg-[#FFCC00] hover:bg-yellow-400 text-gray-900 font-semibold text-sm px-4 rounded-xl transition-colors">Save</button>
                <button type="button" onClick={() => setSaveNamePrompt(false)} className="text-gray-400 hover:text-gray-600 px-2">✕</button>
              </div>
            )}

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
                      <img src={img.preview} alt={`Profile screenshot ${i + 1}`} className="h-24 w-auto rounded-lg object-cover border border-gray-200" />
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setImages((prev) => prev.filter((_, j) => j !== i)); setActiveProfileId(null); }}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >×</button>
                    </div>
                  ))}
                  <div className="h-24 w-16 rounded-lg border-2 border-dashed border-gray-200 flex items-center justify-center text-gray-400 text-xl">+</div>
                </div>
              )}
            </div>

            <p className="text-xs text-gray-400 mb-2 text-center">— or type / paste their bio below —</p>
            <textarea
              value={theirProfile}
              onChange={(e) => { setTheirProfile(e.target.value); setActiveProfileId(null); }}
              placeholder="Paste their bio, prompts, interests..."
              rows={3}
              className="w-full text-sm border border-gray-200 rounded-xl p-3 resize-none focus:outline-none focus:ring-2 focus:ring-yellow-400"
            />
          </div>

          {mode === "reply" && (
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Their Last Message</label>
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

        {result && mode === "botcheck" && !result.verdict && (
          <div className="mt-6 p-4 bg-orange-50 border border-orange-200 rounded-2xl text-orange-700 text-sm">
            Got a response but couldn&apos;t parse the verdict. Try again or add more profile detail.
          </div>
        )}

        {result && mode === "botcheck" && result.verdict && (
          <div className="mt-8 space-y-4">
            <div className={`rounded-2xl p-5 text-center shadow-md ${
              result.score! >= 7 ? "bg-red-100 border-2 border-red-400" :
              result.score! >= 4 ? "bg-yellow-100 border-2 border-yellow-400" :
              "bg-green-100 border-2 border-green-400"
            }`}>
              <p className="text-4xl mb-2">{result.score! >= 7 ? "🚨" : result.score! >= 4 ? "⚠️" : "✅"}</p>
              <p className={`text-xl font-bold ${
                result.score! >= 7 ? "text-red-700" : result.score! >= 4 ? "text-yellow-700" : "text-green-700"
              }`}>{result.verdict}</p>
              <p className="text-sm mt-1 text-gray-600">Fake score: {result.score}/10</p>
            </div>
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
                <p className="text-xs mt-3 text-gray-400">
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
