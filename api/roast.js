export const config = { runtime: 'edge' };

function buildSystemPrompt(heat, mode, subject) {
  const toneDesc =
    heat === 0  ? "you are basically complimenting them — find the tiniest, most affectionate thing to tease, nothing edgy whatsoever" :
    heat <= 10  ? "extremely gentle and wholesome — warm teasing only, like a grandparent poking fun, nothing that could sting even slightly" :
    heat <= 25  ? "very light and warm — like a close friend giving a soft tease over coffee, always kind underneath" :
    heat <= 40  ? "light and playful — charming ribbing that makes everyone smile, ending with a genuine compliment tucked into the joke" :
    heat <= 55  ? "punchy stand-up energy — real comedic bite, clever and a little sharp, like a roast dinner set" :
    heat <= 70  ? "sharp and pointed — Comedy Central roast vibes, pulling fewer punches, wit over cruelty" :
    heat <= 85  ? "savage and relentless — brutal jokes with creative wordplay and pop-culture references, devastating but never hateful" :
                  "absolutely merciless — legendary roast master energy, maximum wit and venom, like the closing act of a roast battle finale";

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
Generate exactly 3 roasts (1-2 sentences each) specifically about "${subject}". Do not roast the user writing this prompt — roast the target described above.
Write the roasts in third person (e.g. "He/She/They...") unless the subject is clearly the user themselves (e.g. "me", "myself", "I"), in which case use second person (e.g. "You...").
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
