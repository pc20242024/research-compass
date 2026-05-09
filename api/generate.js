// api/generate.js
// Vercel runs this automatically when the page calls /api/generate.
// Your Gemini API key lives here on the server — never in the browser.

const GEMINI_MODEL = 'gemini-2.5-flash';

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

module.exports = async function handler(req, res) {
  // Allow CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Rate limiting
  const ip = req.headers['x-forwarded-for'] || req.connection?.remoteAddress || 'unknown';
  if (isRateLimited(ip)) {
    return res.status(429).json({ error: 'Too many requests. Please try again in an hour.' });
  }

  const { sector, keywords = [], isRegen = false } = req.body || {};

  // Validate sector
  if (!sector || !ALLOWED_SECTORS.has(sector)) {
    return res.status(400).json({ error: 'Invalid sector.' });
  }

  // Sanitise keywords
  const cleanKeywords = Array.isArray(keywords)
    ? keywords.filter(k => typeof k === 'string').map(k => k.trim().slice(0, 60)).filter(Boolean).slice(0, 10)
    : [];

  const kwSection = cleanKeywords.length > 0
    ? `\n\nMANDATORY: The candidate has provided these specific keywords that MUST directly shape the thesis topics: ${cleanKeywords.map(k => `"${k}"`).join(', ')}. Every thesis idea must visibly and specifically incorporate at least one of these keywords — not just mention them in passing but make them central to the research question. Do not generate generic thesis ideas and then add the keywords as an afterthought.`
    : '';

  const varietyNote = isRegen
    ? '\n\nIMPORTANT: This is a regeneration. Produce 5 completely different thesis ideas — use different leadership theories, different sub-sector angles, different methodologies.'
    : '\n\nAvoid generic topics. Prioritise niche, emerging, counterintuitive angles that would surprise a seasoned academic supervisor.';

  const prompt = `You are a PhD admissions advisor at Chancellor Institute, which delivers executive doctoral programmes in leadership for senior professionals — not full-time academics. Your candidates are typically mid-to-senior executives, managers and industry leaders with 5–20 years of real-world experience who want to do a PhD alongside their careers to deepen their professional credibility and solve real problems they face at work.

A prospective PhD candidate works in the "${sector}" sector.${kwSection}

Generate exactly 5 PhD thesis ideas that would genuinely excite and be relevant to a senior executive or experienced manager in this sector — NOT a full-time academic. The ideas must:

1. Be grounded in real, practical leadership challenges that executives in this sector actually face day-to-day
2. Use plain, professional English in the title — NOT jargon-heavy academic language. Avoid terms like "epistemological", "ontological", "hegemonic", "feminist critique", "dualities", "discursive", "neoliberal" or similar academic buzzwords
3. Be the kind of question a thoughtful senior leader would genuinely want answered — something that would make them say "yes, that is exactly the problem I face at work"
4. Be grounded in leadership — how leaders make decisions, build culture, manage change, develop people, or shape organisations in this specific sector
5. Suggest a methodology that is practical and could realistically be completed part-time over 3–5 years (e.g. interviews with industry leaders, case studies, surveys of practitioners)

AVOID: feminist theory, critical theory, postcolonial theory, purely philosophical arguments, abstract theoretical debates, or anything that sounds like it belongs in a humanities faculty rather than a business school.

GOOD EXAMPLE TITLE: "How do hospital CEOs rebuild staff trust after a major patient safety incident — and what leadership behaviours matter most?"
BAD EXAMPLE TITLE: "Challenging the Dualities: A Feminist Critique of Ambidextrous Leadership for Equitable Digital Transformation"${varietyNote}

Return ONLY valid JSON, no preamble, no markdown:
{"sector":"${sector}","theses":[{"title":"Full working thesis title in plain professional English","description":"2-3 sentences explaining the real-world problem this addresses, why it matters to practitioners, and how the research would be conducted.","methodology":"e.g. In-depth interviews with senior executives, case studies, practitioner surveys","keywords":["kw1","kw2","kw3","kw4"]}]}`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: 'You are an expert academic research advisor. Respond with valid JSON only — no markdown, no preamble.' }]
          },
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 8192 }
        }),
      }
    );

    const data = await response.json();

    if (!response.ok || data.error) {
      throw new Error(data.error?.message || `Gemini error ${response.status}`);
    }

    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());

    return res.status(200).json(parsed);

  } catch (err) {
    console.error('Research Compass error:', err.message);
    return res.status(502).json({ error: 'Failed to generate research directions. Please try again.' });
  }
};
