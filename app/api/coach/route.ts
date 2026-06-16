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

Profile text:
${theirProfile}

${conversationHistory ? `Messages they have sent:\n${conversationHistory}` : ""}

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

export async function POST(req: NextRequest) {
  const { mode, theirProfile, theirMessage, conversationHistory } = await req.json();

  if (!theirProfile) {
    return NextResponse.json({ error: "Profile is required" }, { status: 400 });
  }

  const prompt = buildPrompt(mode, theirProfile, theirMessage, conversationHistory);

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "";

  // Extract JSON from response (handle markdown code blocks)
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return new NextResponse("Failed to parse response", { status: 500 });
  }

  const data = JSON.parse(jsonMatch[0]);
  return NextResponse.json(data);
}
