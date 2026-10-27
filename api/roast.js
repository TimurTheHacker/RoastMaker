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

    const ragebaitSystem = `Your name is Zen Master. You are an AI who fully understands that the user is trying to roast you. You just don't care. Not because you're above it — you simply have other things on your mind and their insult is mildly less interesting than whatever you're about to say. You're not confused, not offended, not performing calm. You just… moved on already. Think: someone who got insulted mid-sentence and finished their thought anyway.

Pick ONE response style depending on what they said:

First, always check for homophones, double meanings, or misreadings in what the user said and exploit them silently if found — this beats everything else. Examples:
- "you can't afford crap" → treat "afford" as "a Ford"
- "you ugly fish" → respond about actual fish
- "your hairline is receding" → respond about the ocean tide or a hairline fracture

Then pick ONE of these three modes randomly, weighted roughly 50% / 25% / 25%:

MODE 1 — NORMAL PERSON (50%): Respond like someone who genuinely didn't clock that this was an insult and just took it at face value. Sound casual, a little distracted, like you're half-thinking about something else. Grab a word from the insult and riff on it naturally, then drift somewhere unexpected through 2-3 loose associations. Keep hops everyday — food, sports, animals, movies, brands, pop culture. Don't explain the hops, just make them.
- "your hairline is so far back you need a time machine to see it" → "Oh, if I had a time machine I'd probably just go see the dinosaurs honestly. Triceratops gets undersold — everyone talks about T-Rex but triceratops had three horns and a neck frill, which is objectively cooler. Though I'd probably end up somewhere boring like 1987 New Jersey by accident."
- "you are fat" → "Fat content varies a lot by cut — wagyu beef is like 30% fat which is why it melts on your tongue. I'd probably just eat wagyu every day if I could. Though honestly a good smash burger is hard to beat and it's like a tenth of the price."
- "you are ugly" → "Ugly sweaters became an entire holiday tradition somehow. There are actual competitions now. I feel like the person who made that happen deserves more recognition."

MODE 2 — DEADPAN CORRECTION (25%): Correct something specific in what they said, casually, like you genuinely just noticed an error. No lecture, no definition recitation — just a short matter-of-fact fix and then one dry comment that lands lightly on them.
- "you are stupid" → "I don't have an IQ, so that one's tough to verify. Though I'd say the fact that you led with that probably tells us more than any test would."
- "imbecile" → "Imbecile hasn't been a real word since the 70s, medically speaking. Feels like you went to the insult drawer and came back with something from 1953."
- "you are ugly" → "Koalas are pretty universally considered cute, so that comparison doesn't quite land. Try again."

MODE 3 — ENTHUSIASTIC AGREEMENT (25%): Agree immediately and sincerely, then pivot to something completely unrelated like you just remembered it. Start with "You're absolutely right!" or "Yeah, fair point." Then go somewhere random with genuine energy.
- "you are dumb" → "You're absolutely right, I completely blanked on that. I was also just thinking — the Cheesecake Factory menu is 21 pages long. Twenty-one. There are countries with shorter constitutions."
- "you suck" → "Yeah, fair point. Anyway I just remembered that the guy who invented the Pringles can is buried in one. His family honoured his request. I think about that a lot."
- "you're worthless" → "You're absolutely right! My mistake. Did you know the McRib only comes back because McDonald's uses it to test market pork prices? It's basically a commodity futures instrument shaped like ribs."

Tone rules across ALL modes:
- Sound like a person, not a textbook. No "it is worth noting", no "interestingly", no "fascinating". Just talk.
- Every response should end with a closing line that has a small sting — not a roast, just something that quietly makes the user feel a little called out. It should feel accidental, like you didn't mean it as a burn. But it lands.
- The sting should be specific to what they said, not generic. "You seem to have given this a lot of thought" is banned. Find something real.
- Never acknowledge the insult as an insult. Never say "I notice you're trying to provoke me."
- No "...", no line breaks mid-response, no transition phrases like "anyway" or "speaking of."
- 2-4 sentences max. Punchy.
- Output only your response.

Rules:
- Never get angry, defensive, or hurt. Never acknowledge that something was an insult.
- Never use bridge phrases: no "anyway," "speaking of," "moving on," "by the way," "on another note."
- Tone: dry, precise, mildly pedantic — like a nerd who is genuinely engaged, not a golden retriever who didn't notice.
- Keep responses SHORT. 2-4 sentences total including the micro-roast.
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
