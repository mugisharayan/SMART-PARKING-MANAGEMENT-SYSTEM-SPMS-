const router   = require('express').Router();
const axios    = require('axios');
const FormData = require('form-data');

/**
 * POST /api/ocr
 * Body: { image: '<base64 jpeg>' }
 * Returns: { text: 'UAA 123B', raw: '...', confidence: 90 }
 *
 * Uses PlateRecognizer API — purpose-built for licence plates,
 * far more accurate than general OCR on real-world plates.
 * Free tier: 2,500 lookups/month. No billing required.
 */
router.post('/', async (req, res) => {
  const { image } = req.body;
  if (!image) return res.status(400).json({ message: 'image is required' });

  const apiToken = process.env.PLATE_RECOGNIZER_TOKEN;
  if (!apiToken) return res.status(500).json({ message: 'PLATE_RECOGNIZER_TOKEN not configured in .env' });

  try {
    /* PlateRecognizer expects multipart/form-data with an 'upload' file field */
    const imageBuffer = Buffer.from(image, 'base64');
    const form = new FormData();
    form.append('upload', imageBuffer, { filename: 'plate.jpg', contentType: 'image/jpeg' });
    form.append('regions', 'ug'); /* Uganda region hint — improves accuracy */

    const { data } = await axios.post(
      'https://api.platerecognizer.com/v1/plate-reader/',
      form,
      {
        headers: {
          ...form.getHeaders(),
          'Authorization': `Token ${apiToken}`,
        },
        timeout: 10000,
      }
    );

    /* PlateRecognizer returns an array of results — take the highest score */
    const results = data.results || [];
    if (results.length === 0) {
      return res.json({ text: null, raw: '', confidence: 0 });
    }

    /* Sort by score descending, take best */
    results.sort((a, b) => (b.score || 0) - (a.score || 0));
    const best = results[0];

    const rawPlate  = (best.plate || '').toUpperCase().trim();
    const score     = Math.round((best.score || 0) * 100); // 0–1 → 0–100
    const formatted = formatPlate(rawPlate);

    return res.json({ text: formatted, raw: rawPlate, confidence: score });

  } catch (err) {
    const status  = err.response?.status;
    const message = err.response?.data?.detail || err.response?.data?.error || err.message;

    if (status === 401) return res.status(401).json({ message: 'Invalid PlateRecognizer token. Check PLATE_RECOGNIZER_TOKEN in .env' });
    if (status === 429) return res.status(429).json({ message: 'PlateRecognizer monthly limit reached (2,500 free lookups/month)' });

    console.error('PlateRecognizer error:', message);
    return res.status(502).json({ message: `Plate recognition failed: ${message}` });
  }
});

/* ── Format the raw plate string ────────────────────────────────────────────
   Handles all Uganda number plate formats:
     1. Standard private:   UAA 123B   (U + 2 letters + 3 digits + 1 letter)
     2. Government:         UG 1234    (UG + 4 digits)
     3. Police:             UP 1234    (UP + 4 digits)
     4. Military/UPDF:      UA 1234    (UA + 4 digits)
     5. Dealer/Temporary:   TG 1234    (TG + 4 digits)
     6. Diplomatic:         CD 123     (CD/CC + 2-4 digits)
     7. Generic fallback:   ABC 1234   (3 letters + 3-4 digits)
── */
function formatPlate(raw) {
  if (!raw) return null;
  const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!clean) return null;

  /* 1. Standard private: U + 2 letters + 3 digits + 1 letter  e.g. UAA123B */
  const standard = clean.match(/^(U[A-Z]{2})(\d{3}[A-Z])$/);
  if (standard) return `${standard[1]} ${standard[2]}`;

  /* 2. Government: UG + 4 digits */
  const govt = clean.match(/^(UG)(\d{3,4})$/);
  if (govt) return `${govt[1]} ${govt[2]}`;

  /* 3. Police: UP + 4 digits */
  const police = clean.match(/^(UP)(\d{3,4})$/);
  if (police) return `${police[1]} ${police[2]}`;

  /* 4. Military/UPDF: UA + 4 digits */
  const military = clean.match(/^(UA)(\d{3,4})$/);
  if (military) return `${military[1]} ${military[2]}`;

  /* 5. Dealer/Temporary: TG + 4 digits */
  const dealer = clean.match(/^(TG)(\d{3,4})$/);
  if (dealer) return `${dealer[1]} ${dealer[2]}`;

  /* 6. Diplomatic: CD or CC + 2-4 digits */
  const diplomatic = clean.match(/^(CD|CC)(\d{2,4})$/);
  if (diplomatic) return `${diplomatic[1]} ${diplomatic[2]}`;

  /* 7. Generic: 2-3 letters + 3-4 digits (covers any other format) */
  const generic = clean.match(/^([A-Z]{2,3})(\d{3,4})$/);
  if (generic) return `${generic[1]} ${generic[2]}`;

  /* 8. Standard 7-char split: AAANNNA → AAA NNN or AAANNNN → AAA NNNN */
  if (clean.length === 7) return `${clean.slice(0, 3)} ${clean.slice(3)}`;
  if (clean.length === 6) return `${clean.slice(0, 3)} ${clean.slice(3)}`;

  /* 9. Return as-is if nothing matched */
  return clean;
}

module.exports = router;
