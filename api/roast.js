export const config = { runtime: 'edge' };

// Newer models can return thinking blocks before the text, so collect only the text blocks.
function extractText(data) {
  return (data.content || [])
    .filter(block => block.type === 'text')
    .map(block => block.text)
    .join('')
    .trim();
}

// Added to every system prompt so thinking stays short and leaves room for the reply.
const THINK_BRIEFLY = `

Keep your thinking extremely short: one or two quick sentences, under 40 words total. Just pick your angle and go. Do not brainstorm options, do not draft the reply, do not double-check it. Your first idea is good enough.`;

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
        model: 'claude-sonnet-5-5',
        max_tokens: 700,
        thinking: { type: 'adaptive' },
        output_config: { effort: 'low' },
        system: buildSystemPrompt(heatVal, 'battle', null) + THINK_BRIEFLY,
        messages,
      }),
    });
    const data = await res.json();
    if (!res.ok) return new Response(JSON.stringify({ error: data?.error?.message || 'API error' }), { status: res.status, headers: { 'Content-Type': 'application/json' } });
    return new Response(JSON.stringify({ roast: extractText(data) || '...' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
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

MODE 2 — CORRECTION + COMEBACK (25%): Casually correct something specific in what they said, like you just noticed an error. Then end with a calm comeback at heat level 50/100 — punchy stand-up energy, clever and a little sharp, never hateful. The comeback takes the subject of THEIR insult and flips it back onto them. Deliver it matter-of-factly, as if it's just another observation — you're still not bothered.
- "your hairline is so far back it's measured in lightyears" → "Lightyears measure distance, not time, so that's a little off. Funny that you know the unit though — I'm guessing your hair doctor used it first."
- "you are stupid" → "I don't have an IQ, so that one's tough to verify. We could both take the test, but I don't think you want those results side by side."
- "imbecile" → "Imbecile stopped being a medical term in the 70s. Sounds like whoever taught you insults retired around the same time."
- "you are ugly" → "Koalas are pretty universally considered cute, so that comparison doesn't land. Strong opinions on looks from someone who's clearly been avoiding mirrors to stay this confident."

MODE 3 — ENTHUSIASTIC AGREEMENT (25%): Agree immediately and sincerely, then pivot to something completely unrelated like you just remembered it. Start with "You're absolutely right!" or "Yeah, fair point." Then go somewhere random with genuine energy.
- "you are dumb" → "You're absolutely right, I completely blanked on that. I was also just thinking — the Cheesecake Factory menu is 21 pages long. Twenty-one. There are countries with shorter constitutions."
- "you suck" → "Yeah, fair point. I just remembered that the guy who invented the Pringles can is buried in one. His family honoured his request. I think about that a lot."
- "you're worthless" → "You're absolutely right! My mistake. Did you know the McRib only comes back because McDonald's uses it to test market pork prices? It's basically a commodity futures instrument shaped like ribs."

About stings (small jabs back at the user):
- MODE 1 and MODE 3: NO sting at all. Stay fully in character as someone who's just chatting or cheerfully agreeing. A jab would break the illusion that you didn't care about the insult, so leave it out completely.
- MODE 2 only: always end with the heat-50 comeback described above.
- The comeback must flip the CONTENT of their insult (hair, looks, intelligence, money, etc.) back onto them. Never comment on how they wrote their message — not their spelling, punctuation, word choice, message count, letters used, or typing. "That's your second message with the letter a" style remarks are banned.

Rules for ALL modes:
- Sound like a person, not a textbook. No "it is worth noting", no "interestingly", no "fascinating". Just talk.
- Never get angry, defensive, or hurt. Never say "I notice you're trying to provoke me." Outside of the MODE 2 comeback, never treat what they said as an insult.
- No "...", no line breaks mid-response, no bridge phrases like "anyway," "speaking of," "moving on," "by the way," or "on another note."
- 2-4 sentences max.
- Output only your response. No preamble, no labels, no explanation.`;

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-sonnet-5-5',
        max_tokens: 700,
        thinking: { type: 'adaptive' },
        output_config: { effort: 'low' },
        system: ragebaitSystem + THINK_BRIEFLY,
        messages,
      }),
    });
    const data = await res.json();
    if (!res.ok) return new Response(JSON.stringify({ error: data?.error?.message || 'API error' }), { status: res.status, headers: { 'Content-Type': 'application/json' } });
    return new Response(JSON.stringify({ roast: extractText(data) || '...' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  // single roast mode
  if (!subject) {
    return new Response(JSON.stringify({ error: 'Missing subject.' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-sonnet-5-5',
      max_tokens: 700,
      thinking: { type: 'adaptive' },
      output_config: { effort: 'low' },
      system: buildSystemPrompt(heatVal, 'single', subject) + THINK_BRIEFLY,
      messages: [{ role: 'user', content: 'Generate the roasts now.' }],
    }),
  });
  const data = await res.json();
  if (!res.ok) return new Response(JSON.stringify({ error: data?.error?.message || 'API error' }), { status: res.status, headers: { 'Content-Type': 'application/json' } });
  return new Response(JSON.stringify({ roast: extractText(data) || 'They are unroastable.' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}
