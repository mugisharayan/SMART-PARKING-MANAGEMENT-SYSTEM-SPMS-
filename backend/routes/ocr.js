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
   Handles ALL Uganda number plate formats (old and new digital):

   NEW DIGITAL (ITMS, from Nov 2023):
     UA 123B   — new digital private  (U + 1 letter + 3 digits + 1 letter)

   OLD FORMAT (pre-2023, still widely on the road):
     UAA 123B  — standard private     (U + 2 letters + 3 digits + 1 letter)
     UG 1234 A — government           (UG + 3-4 digits + optional ministry letter)
     LG 1234   — local government     (LG + 3-4 digits)
     H4DF 001  — military/UPDF        (H4DF + 3 digits)
     UP 1234   — police UPF           (UP + 3-4 digits)
     TG 1234   — dealer/temporary     (TG + 3-4 digits)
     CD 28 U   — diplomatic           (CD + digits + U)
     CC 12 U   — consular             (CC + digits + U)
     BOSS1     — personal/vanity      (custom 3-7 alphanumeric)
── */
function formatPlate(raw) {
  if (!raw) return null;

  /* Normalise: uppercase, collapse whitespace */
  const norm  = raw.toUpperCase().trim().replace(/\s+/g, ' ');
  const clean = norm.replace(/\s/g, ''); // no-space version for matching
  if (!clean) return null;

  /* 1. NEW digital private: U + 1 letter + 3 digits + 1 letter
        e.g. UA123B → UA 123B                                        */
  const newDigital = clean.match(/^(U[A-Z])(\d{3}[A-Z])$/);
  if (newDigital) return `${newDigital[1]} ${newDigital[2]}`;

  /* 2. OLD standard private: U + 2 letters + 3 digits + 1 letter
        e.g. UAA123B → UAA 123B                                      */
  const oldPrivate = clean.match(/^(U[A-Z]{2})(\d{3}[A-Z])$/);
  if (oldPrivate) return `${oldPrivate[1]} ${oldPrivate[2]}`;

  /* 3. Military UPDF: H4DF + 3 digits
        e.g. H4DF001 → H4DF 001                                      */
  const military = clean.match(/^(H4DF)(\d{3})$/);
  if (military) return `${military[1]} ${military[2]}`;

  /* 4. Government: UG + 3-4 digits + optional ministry letter
        e.g. UG1234A → UG 1234 A  or  UG1234 → UG 1234              */
  const govt = clean.match(/^(UG)(\d{3,4})([A-Z]?)$/);
  if (govt) return govt[3] ? `${govt[1]} ${govt[2]} ${govt[3]}` : `${govt[1]} ${govt[2]}`;

  /* 5. Local Government: LG + 3-4 digits
        e.g. LG1234 → LG 1234                                        */
  const localGovt = clean.match(/^(LG)(\d{3,4})$/);
  if (localGovt) return `${localGovt[1]} ${localGovt[2]}`;

  /* 6. Police: UP + 3-4 digits
        e.g. UP1234 → UP 1234                                        */
  const police = clean.match(/^(UP)(\d{3,4})$/);
  if (police) return `${police[1]} ${police[2]}`;

  /* 7. Dealer/Temporary: TG + 3-4 digits
        e.g. TG1234 → TG 1234                                        */
  const dealer = clean.match(/^(TG)(\d{3,4})$/);
  if (dealer) return `${dealer[1]} ${dealer[2]}`;

  /* 8. Diplomatic/Consular: CD or CC + digits + optional U
        e.g. CD2813U → CD 2813 U  or  CC12U → CC 12 U               */
  const diplo = clean.match(/^(CD|CC)(\d{2,6})(U?)$/);
  if (diplo) return diplo[3] ? `${diplo[1]} ${diplo[2]} U` : `${diplo[1]} ${diplo[2]}`;

  /* 9. Personal/Vanity: 3-7 alphanumeric chars with no fixed pattern
        Return as-is                                                  */
  if (clean.length >= 3 && clean.length <= 7 && /[A-Z]/.test(clean) && !/^\d+$/.test(clean)) {
    return clean;
  }

  /* 10. Generic fallback: 2-3 letters + 3-4 digits */
  const generic = clean.match(/^([A-Z]{2,3})(\d{3,4})$/);
  if (generic) return `${generic[1]} ${generic[2]}`;

  /* Return normalised as-is */
  return norm;
}

module.exports = router;
