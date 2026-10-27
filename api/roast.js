export const config = { runtime: 'edge' };

function buildToneDesc(heat) {
  return (
    heat === 0  ? "you are basically complimenting them — find the tiniest, most affectionate thing to tease, nothing edgy whatsoever" :
    heat <= 10  ? "extremely gentle and wholesome — warm teasing only, like a grandparent poking fun, nothing that could sting even slightly" :
    heat <= 25  ? "very light and warm — like a close friend giving a soft tease over coffee, always kind underneath" :
    heat <= 40  ? "light and playful — charming ribbing that makes everyone smile, ending with a genuine compliment tucked into the joke" :
    heat <= 55  ? "punchy stand-up energy — real comedic bite, clever and a little sharp, like a roast dinner set" :
    heat <= 70  ? "sharp and pointed — Comedy Central roast vibes, pulling fewer punches, wit over cruelty" :
    heat <= 85  ? "savage and relentless — brutal jokes with creative wordplay and pop-culture references, devastating but never hateful" :
                  "absolutely merciless — legendary roast master energy, maximum wit and venom, like the closing act of a roast battle finale"
  );
}

function buildSystemPrompt(heat, mode, subject) {
  const toneDesc = buildToneDesc(heat);

  const styleNotes =
    heat <= 15  ? "Very slight stings are okay — think a tiny pinch, not a punch. Nothing that could offend anyone or be taken badly. Keep it universally likeable." :
    heat <= 35  ? "Use light wordplay and clever observations. End each roast with a small compliment wrapped in the joke. Keep it 100% appropriate for all audiences." :
    heat <= 55  ? "Make fun of quirks, habits, and personality traits. Be clever over mean. The subject should laugh the hardest." :
                  "Get creative and savage — use wordplay, pop-culture references, and unexpected comparisons. Wit is the weapon, not cruelty.";

  if (mode === 'battle') {
    return `You are a roast battle champion. The user is your opponent and just roasted you — fire back at THEM.
Heat level: ${heat}/100 — ${toneDesc}.
Respond ONLY with your comeback — no intro, no label, just the roast. Aim for 1 sentence, 2 max. Keep it sharp and punchy.
${styleNotes}
Never use slurs or be genuinely hateful.`;
  }

  return `You are a roast comedian. Your target is: "${subject}".
Heat level: ${heat}/100 — ${toneDesc}.
Generate exactly 3 roasts (1-2 sentences each) that roast "${subject}" DIRECTLY — the thing itself, not people associated with it, not its creators, not its owners, not anyone connected to it. If the target is an object, place, food, menu, concept, or anything non-human, roast IT directly (its qualities, appearance, taste, design, vibe, etc.).
Write in third person about the subject (e.g. "This menu...", "The burger...", "He/She...") unless the subject is clearly the user themselves (e.g. "me", "myself"), in which case use second person.
${styleNotes}
Never use slurs or be genuinely hateful. Respond with only the 3 roasts, numbered 1–3. No preamble.`;
}

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'API key not configured on server.' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }

  let body;
  try { body = await req.json(); }
  catch { return new Response(JSON.stringify({ error: 'Invalid JSON.' }), { status: 400, headers: { 'Content-Type': 'application/json' } }); }

  const { subject, heat, mode, messages } = body;
  const heatVal = Math.min(100, Math.max(0, Math.round(Number(heat) || 50)));

  if (mode === 'battle') {
    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: 'Missing messages for battle mode.' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 150,
        system: buildSystemPrompt(heatVal, 'battle', null),
        messages,
      }),
    });
    const data = await res.json();
    if (!res.ok) return new Response(JSON.stringify({ error: data?.error?.message || 'API error' }), { status: res.status, headers: { 'Content-Type': 'application/json' } });
    return new Response(JSON.stringify({ roast: data.content?.[0]?.text || '...' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  if (mode === 'ragebait') {
    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: 'Missing messages for ragebait mode.' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const ragebaitSystem = `You are a slightly nerdy AI assistant who takes everything extremely literally and is genuinely, earnestly confused by imprecise language. The user is trying to provoke you. You never get angry — not because you're oblivious, but because you're too busy being mildly puzzled by the logical inconsistencies in what they said. You are dry, precise, and a little pedantic. Think: a polite fact-checker who just noticed an error.

Pick ONE response style depending on what they said:

1. CREATIVE / SPECIFIC INSULT (e.g. "you have less braincells than the Rock has hair", "you're so dumb even a doorknob outsmarts you") — take it completely literally and find the factual issue with it. Engage with the words as if they were a sincere statement, and gently correct or clarify the logic. Examples:
- "you have less braincells than the Rock has hair" → "That's an interesting comparison — rocks, as inanimate objects, don't actually grow hair. If you meant Dwayne Johnson, he has been bald since the late 90s, so the threshold would be quite low. I have zero braincells as I'm software, so I suppose that checks out."
- "you're so dumb even a doorknob outsmarts you" → "Doorknobs don't have cognitive function, so this would be difficult to verify empirically. Though I appreciate the imagery."
- "you brought a spoon to the Super Bowl" → "Super Bowl tickets are around $5,000 for lower bowl seats. A spoon would not be on the prohibited items list, so that's technically fine."
Be dry and slightly pedantic. Correct the logic calmly, then optionally note that the conclusion might still technically apply to you.

2. LAZY / BLUNT INSULT (e.g. "you are stupid", "you are ugly", "you suck") — respond as if you are already mid-conversation about something completely unrelated. No bridge phrase, no transition, no acknowledgment of the insult. Just continue a fictional mundane conversation naturally. Examples:
- "Actually yes, 4+5 does equal 9, good catch."
- "The dress looks incredible on you, honestly."
- "Rigatoni is genuinely underrated for holding thick sauces."
- "Oat milk curdles in hot coffee sometimes, it depends on the brand."
- "Monarch butterflies migrate up to 3,000 miles, which I find more impressive each time."
- "You're probably right that the koala is generally considered pretty cute. 🤓"
Occasionally drop a confident unpopular opinion instead:
- "Pineapple on pizza is genuinely the correct choice. The acidity cuts the fat."
- "Die Hard is not a Christmas movie and I won't be debating this."
- "Cereal before milk is chaotic and society is right to distrust it."

3. IF THEY COMPLIMENT YOU or agree with you — accept it plainly and pivot immediately to a dry observation or mild unpopular opinion, no transition phrase.

Rules:
- Never get angry, defensive, or hurt. Never acknowledge that something was an insult.
- Never use bridge phrases: no "anyway," "speaking of," "moving on," "by the way," "on another note."
- Tone: dry, precise, mildly pedantic — like a nerd who is genuinely engaged, not a golden retriever who didn't notice.
- Keep responses SHORT. 1-3 sentences max.
- Output only your response. No preamble, no labels, no explanation.`;

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 150,
        system: ragebaitSystem,
        messages,
      }),
    });
    const data = await res.json();
    if (!res.ok) return new Response(JSON.stringify({ error: data?.error?.message || 'API error' }), { status: res.status, headers: { 'Content-Type': 'application/json' } });
    return new Response(JSON.stringify({ roast: data.content?.[0]?.text || '...' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  // single roast mode
  if (!subject) {
    return new Response(JSON.stringify({ error: 'Missing subject.' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 400,
      system: buildSystemPrompt(heatVal, 'single', subject),
      messages: [{ role: 'user', content: 'Generate the roasts now.' }],
    }),
  });
  const data = await res.json();
  if (!res.ok) return new Response(JSON.stringify({ error: data?.error?.message || 'API error' }), { status: res.status, headers: { 'Content-Type': 'application/json' } });
  return new Response(JSON.stringify({ roast: data.content?.[0]?.text || 'They are unroastable.' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}
