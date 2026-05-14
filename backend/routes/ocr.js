const router = require('express').Router();
const axios  = require('axios');

/**
 * POST /api/ocr
 * Body: { image: '<base64 jpeg string>' }
 * Returns: { text: 'UAA 123B', raw: '...' }
 *
 * Proxies to Google Cloud Vision TEXT_DETECTION so the API key
 * never leaves the server.
 */
router.post('/', async (req, res) => {
  const { image } = req.body;
  if (!image) return res.status(400).json({ message: 'image is required' });

  const apiKey = process.env.GOOGLE_VISION_API_KEY;
  if (!apiKey) return res.status(500).json({ message: 'GOOGLE_VISION_API_KEY not configured' });

  try {
    const { data } = await axios.post(
      `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
      {
        requests: [{
          image:    { content: image },
          features: [{ type: 'TEXT_DETECTION', maxResults: 1 }],
          imageContext: {
            languageHints: ['en'],
          },
        }],
      },
      { timeout: 8000 }
    );

    const annotations = data.responses?.[0]?.textAnnotations;
    if (!annotations || annotations.length === 0) {
      return res.json({ text: null, raw: '' });
    }

    /* first annotation is the full detected text block */
    const raw  = annotations[0].description || '';
    const text = cleanPlate(raw);

    return res.json({ text, raw });
  } catch (err) {
    const msg = err.response?.data?.error?.message || err.message;
    return res.status(502).json({ message: `Vision API error: ${msg}` });
  }
});

/* ── plate cleaner (mirrors frontend logic) ─────────────────────────────── */
function cleanPlate(raw) {
  if (!raw) return null;
  const cleaned = raw.toUpperCase().replace(/[^A-Z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!cleaned) return null;

  /* 1. strict Uganda: U + 2 letters + 3 digits + 1 letter  e.g. UAA 123B */
  const strict = cleaned.replace(/\s/g, '').match(/U[A-Z]{2}\d{3}[A-Z]/);
  if (strict) {
    const p = strict[0];
    return `${p.slice(0, 3)} ${p.slice(3)}`;
  }

  /* 2. any 5-9 char token with both letters and digits */
  const tokens = cleaned.split(' ').filter(Boolean);
  for (const t of tokens) {
    if (t.length >= 5 && t.length <= 9 && /[A-Z]/.test(t) && /\d/.test(t)) {
      if (t.length === 7) return `${t.slice(0, 3)} ${t.slice(3)}`;
      if (t.length === 6) return `${t.slice(0, 3)} ${t.slice(3)}`;
      return t;
    }
  }

  /* 3. fallback — longest alphanumeric token 4+ chars */
  const best = tokens.filter((t) => t.length >= 4).sort((a, b) => b.length - a.length)[0];
  return best || null;
}

module.exports = router;
