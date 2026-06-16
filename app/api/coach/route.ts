import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { MY_PROFILE } from "@/lib/myProfile";

const client = new Anthropic();

function buildPrompt(
  mode: string,
  theirProfile: string,
  theirMessage: string,
  conversationHistory: string,
): string {
  const styleContext = `My profile (write in my voice, matching my personality and background):
${MY_PROFILE}`;

  if (mode === "opener") {
    return `You are a dating coach helping craft opening messages for Bumble.

${styleContext}

Their profile:
${theirProfile}

Generate 3 distinct opening messages. Each should:
- Reference something specific from their profile
- Feel genuine and curious, not formulaic
- Be concise (1-3 sentences max)
- Avoid generic openers like "Hey!", "How's your week?", or compliments on looks
- End with a natural question or hook that invites a response

Respond as JSON: { "suggestions": ["...", "...", "..."], "tip": "one short coaching tip about openers" }`;
  }

  if (mode === "opening-move") {
    return `You are a dating coach helping craft a response to a Bumble Opening Move.

${styleContext}

Her profile:
${theirProfile}

Her Opening Move question (she set this — you must answer it to start the conversation):
"${theirMessage}"

Write 3 distinct answers to her Opening Move question. Each should:
- Actually answer her question — don't dodge it
- Reveal something genuine and specific about Cameron that ties back to his life (mountains, adventure, Colorado, Canadian roots, his work, his kids, hockey)
- Be conversational and end with a natural follow-up question back to her
- Feel like a real person answered, not a dating coach template
- Be concise — 2-4 sentences max

Respond as JSON: { "suggestions": ["...", "...", "..."], "tip": "one tip for following up after she responds to the Opening Move" }`;
  }

  if (mode === "reply") {
    return `You are a dating coach helping craft replies on Bumble.

${styleContext}

Their profile:
${theirProfile}

Their last message:
${theirMessage}

Generate 3 distinct reply options with varying tones (e.g., playful, warm, witty). Each should:
- Directly engage with what they said
- Feel natural, not over-eager
- Keep momentum going with a question or hook
- Be concise

Respond as JSON: { "suggestions": ["...", "...", "..."], "tip": "one short coaching tip for this specific exchange" }`;
  }

  if (mode === "coach") {
    return `You are a dating coach analyzing a Bumble conversation.

${styleContext}

Their profile:
${theirProfile}

Full conversation:
${conversationHistory}

Analyze the conversation and provide:
1. What's going well
2. What to improve or watch out for
3. 2-3 suggested next messages to send now

Respond as JSON: { "suggestions": ["analysis: what's going well + what to watch", "Next message option 1", "Next message option 2"], "tip": "one specific coaching insight for this conversation" }`;
  }

  // bot detection mode
  return `You are an expert at identifying fake profiles, scam accounts, and AI bots on dating apps like Bumble.

Analyze the following profile and/or conversation messages for signs of inauthenticity.
${theirProfile ? `\nProfile text:\n${theirProfile}` : "\n(Profile provided as screenshots above — read all visible text, prompts, and details from the images.)"}
${conversationHistory ? `\nMessages they have sent:\n${conversationHistory}` : ""}

Evaluate across these red flag categories:
1. **Profile text** — overly generic, no specific details, sounds AI-written, too perfect or too sparse, inconsistent details
2. **Photos** — described as: too professional/model-like, only 1 photo, no candid shots, no location context
3. **Messaging patterns** — responses too fast or perfectly worded, avoids specific questions, pivots to off-platform quickly, mentions financial hardship or foreign location
4. **Story consistency** — age/job/location that don't add up, vague about where they grew up or work
5. **Common scam signals** — mentions crypto/investment, asks for money, wants to move to WhatsApp/Telegram immediately, love-bombs fast

Score the profile from 1-10 on likelihood of being fake/bot (10 = almost certainly fake).

Respond as JSON:
{
  "score": <1-10>,
  "verdict": "<LIKELY REAL | SUSPICIOUS | LIKELY FAKE | ALMOST CERTAINLY A BOT>",
  "suggestions": [
    "🟢 or 🔴 [Category]: [specific observation]",
    "🟢 or 🔴 [Category]: [specific observation]",
    "🟢 or 🔴 [Category]: [specific observation]",
    "🟢 or 🔴 [Category]: [specific observation]"
  ],
  "tip": "one specific recommended action (e.g., ask them X to verify, reverse image search their photo, etc.)"
}`;
}

interface ImageInput {
  base64: string;
  mediaType: string;
}

export async function POST(req: NextRequest) {
  const { mode, theirProfile, theirMessage, conversationHistory, images } = await req.json() as {
    mode: string;
    theirProfile: string;
    theirMessage: string;
    conversationHistory: string;
    images?: ImageInput[];
  };

  const hasImages = images && images.length > 0;

  if (!theirProfile && !hasImages) {
    return NextResponse.json({ error: "Add a profile screenshot or paste their bio." }, { status: 400 });
  }

  const prompt = buildPrompt(mode, theirProfile, theirMessage, conversationHistory);

  // Build message content — images first, then the text prompt
  const content: Anthropic.MessageParam["content"] = [];

  if (hasImages) {
    const imageNote = "The following screenshots are from their Bumble profile. Read all text, prompts, and visible details from the images.";
    content.push({ type: "text", text: imageNote });
    for (const img of images) {
      content.push({
        type: "image",
        source: {
          type: "base64",
          media_type: img.mediaType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
          data: img.base64,
        },
      });
    }
  }

  content.push({ type: "text", text: prompt });

  let message;
  try {
    message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: mode === "botcheck" ? 2048 : 1024,
      messages: [{ role: "user", content }],
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("Anthropic API error:", msg);
    return NextResponse.json({ error: `AI error: ${msg}` }, { status: 500 });
  }

  const text = message.content[0].type === "text" ? message.content[0].text : "";

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error("No JSON in Claude response:", text.slice(0, 500));
    return NextResponse.json({ error: `Unexpected response: ${text.slice(0, 200)}` }, { status: 500 });
  }

  let data;
  try {
    data = JSON.parse(jsonMatch[0]);
  } catch (e) {
    console.error("JSON parse error:", e, jsonMatch[0].slice(0, 200));
    return NextResponse.json({ error: "Failed to parse AI response. Try again." }, { status: 500 });
  }
  return NextResponse.json(data);
}
