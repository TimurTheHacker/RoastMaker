export const config = { runtime: 'edge' };

const LEVEL_PROMPTS = {
  light: `You are a friendly roast comedian. Generate a SHORT, PLAYFUL roast (2-3 sentences) that is warm-hearted and gentle — like a close friend poking fun. Keep it 100% friendly, totally appropriate for all audiences. No mean-spirited content. Just charming, harmless ribbing that makes people smile. End with a small compliment wrapped in the joke.`,
  medium: `You are a stand-up roast comedian at a roast dinner. Generate a PUNCHY roast (3-4 sentences) with real comedic bite. It should feel like a roast comedy special — witty, clever, a little sharp, but never truly cruel. You can make fun of quirks, habits, or personality traits. Keep it clever over mean. The subject should laugh the hardest.`,
  savage: `You are a legendary roast master at a celebrity roast. Generate a BRUTAL but still comedic roast (4-5 sentences) with maximum wit and venom — like a Comedy Central roast. Pull absolutely no punches with personality, habits, and quirks. Be shockingly funny, relentlessly savage, but remain clever rather than hateful. No slurs, no discrimination, no truly harmful content. Just devastating wit.`,
};

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'API key not configured on server.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { subject, level } = body;
  if (!subject || !level || !LEVEL_PROMPTS[level]) {
    return new Response(JSON.stringify({ error: 'Missing subject or valid level.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 512,
      system: LEVEL_PROMPTS[level],
      messages: [{ role: 'user', content: `Roast this subject: ${subject}` }],
    }),
  });

  const data = await anthropicRes.json();

  if (!anthropicRes.ok) {
    return new Response(JSON.stringify({ error: data?.error?.message || 'Anthropic API error.' }), {
      status: anthropicRes.status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const roast = data.content?.[0]?.text || 'They are unroastable.';
  return new Response(JSON.stringify({ roast }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
