// api/generate.js
// Vercel runs this automatically when the page calls /api/generate.
// Your Gemini API key lives here on the server — never in the browser.

const GEMINI_MODEL = 'gemini-2.0-flash';

const ALLOWED_SECTORS = new Set([
  'AI & New Technologies',
  'Mining & Energy',
  'Agriculture, Forestry & Fishing',
  'Manufacturing & Industrial Production',
  'Construction & Infrastructure',
  'Retail & Wholesale Trade',
  'Transport, Logistics & Supply Chain',
  'Professional & Financial Services',
  'Healthcare & Life Sciences',
  'Education & Training',
  'Media & Communication',
  'Hospitality, Tourism & Leisure',
  'Arts, Culture & Creative Industries',
]);

// Rate limit: max 5 requests per IP per hour
const ipLog = new Map();

function isRateLimited(ip) {
  const now = Date.now();
  const windowMs = 60 * 60 * 1000;
  const max = 5;
  const entry = ipLog.get(ip) || { count: 0, start: now };
  if (now - entry.start > windowMs) {
    ipLog.set(ip, { count: 1, start: now });
    return false;
  }
  if (entry.count >= max) return true;
  entry.count++;
  ipLog.set(ip, entry);
  return false;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Rate limiting
  const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
  if (isRateLimited(ip)) {
    return res.status(429).json({ error: 'Too many requests. Please try again in an hour.' });
  }

  const { sector, keywords = [], isRegen = false } = req.body;

  // Validate sector — prevents prompt injection
  if (!sector || !ALLOWED_SECTORS.has(sector)) {
    return res.status(400).json({ error: 'Invalid sector.' });
  }

  // Sanitise keywords
  const cleanKeywords = Array.isArray(keywords)
    ? keywords.filter(k => typeof k === 'string').map(k => k.trim().slice(0, 60)).filter(Boolean).slice(0, 10)
    : [];

  // Build prompt
  const kwSection = cleanKeywords.length > 0
    ? `\n\nThe student has specified these personal keywords of interest: ${cleanKeywords.map(k => `"${k}"`).join(', ')}. Integrate these meaningfully — they should shape the thesis angle, research context, or question, not merely appear as tags.`
    : '';

  const varietyNote = isRegen
    ? '\n\nIMPORTANT: This is a regeneration. Produce 5 completely different thesis ideas — use different leadership theories, different sub-sector angles, different methodologies, and prioritise unexpected or underexplored research niches.'
    : '\n\nAvoid generic or overused thesis topics. Prioritise niche, emerging, and counterintuitive angles that would genuinely surprise a seasoned academic supervisor.';

  const prompt = `You are an academic research advisor for Chancellor Institute, an online higher education provider delivering doctoral programmes in leadership and organisational studies, in partnership with accredited universities.

A prospective PhD candidate has selected the sector: "${sector}".

Generate exactly 5 original, rigorous PhD thesis ideas at the intersection of LEADERSHIP and the "${sector}" sector. Every thesis must be fundamentally about leadership — how leaders think, decide, behave, or shape organisations and people in this specific industry context. Draw on leadership theory (e.g. transformational, distributed, adaptive, ethical, servant, ambidextrous, complexity leadership) applied to real, sector-specific challenges. Each idea should address a genuine contemporary knowledge gap suitable for a 3–5 year doctoral research programme.${kwSection}${varietyNote}

Return ONLY valid JSON, no preamble, no markdown fences:
{"sector":"${sector}","theses":[{"title":"Full working thesis title","description":"2–3 sentences on the research problem, why it matters, and the methodological approach.","methodology":"e.g. Mixed methods","keywords":["kw1","kw2","kw3","kw4"]}]}`;

  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: 'You are an expert academic research advisor specialising in leadership studies. Always respond with valid JSON only — no markdown, no preamble.' }]
          },
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 1.0, maxOutputTokens: 2048 }
        }),
      }
    );

    const data = await geminiRes.json();

    if (!geminiRes.ok || data.error) {
      throw new Error(data.error?.message || `Gemini error ${geminiRes.status}`);
    }

    const raw    = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());

    return res.status(200).json(parsed);

  } catch (err) {
    console.error('Research Compass error:', err.message);
    return res.status(502).json({ error: 'Failed to generate research directions. Please try again.' });
  }
}
