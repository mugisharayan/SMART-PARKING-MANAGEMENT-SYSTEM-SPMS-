import { useEffect, useRef, useState, useCallback } from 'react';
import { createWorker } from 'tesseract.js';

function cleanPlate(raw) {
  /* remove everything except letters, digits, spaces */
  const cleaned = raw.toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

  /* try strict Uganda format: U + 2 letters + 3 digits + 1 letter  e.g. UAA 123B */
  const strict = cleaned.replace(/\s/g, '').match(/U[A-Z]{2}\d{3}[A-Z]/);
  if (strict) {
    const p = strict[0];
    return `${p.slice(0, 3)} ${p.slice(3)}`;
  }

  /* relaxed: any 6-8 char alphanumeric token that looks like a plate */
  const tokens = cleaned.split(' ');
  for (const t of tokens) {
    if (t.length >= 6 && t.length <= 8 && /[A-Z]/.test(t) && /\d/.test(t)) {
      /* format as XXX 000X if 7 chars */
      if (t.length === 7) return `${t.slice(0, 3)} ${t.slice(3)}`;
      return t;
    }
  }
  return null;
}

export default function CameraAnpr({ onPlateDetected, camera = 'entry' }) {
  const videoRef      = useRef(null);
  const canvasRef     = useRef(null);
  const streamRef     = useRef(null);
  const workerRef     = useRef(null);
  const scanTimerRef  = useRef(null);
  const scanningRef   = useRef(false); // prevent overlapping scans

  const [status,        setStatus]        = useState('idle');   // idle | requesting | streaming | scanning | done | error
  const [errorMsg,      setErrorMsg]      = useState('');
  const [detectedPlate, setDetectedPlate] = useState('');
  const [workerReady,   setWorkerReady]   = useState(false);
  const [scanCount,     setScanCount]     = useState(0);        // shows activity

  /* init Tesseract once */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const worker = await createWorker('eng', 1, {
          logger:     () => {},
          workerPath: '/tesseract/worker.min.js',
          corePath:   '/tesseract/tesseract-core-simd-lstm.wasm.js',
          langPath:   'https://tessdata.projectnaptha.com/4.0.0',
          cacheMethod: 'none',
        });
        await worker.setParameters({
          tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
          tessedit_pageseg_mode:   '7',  /* treat image as single line of text */
          preserve_interword_spaces: '0',
        });
        if (!cancelled) { workerRef.current = worker; setWorkerReady(true); }
      } catch {}
    })();
    return () => {
      cancelled = true;
      workerRef.current?.terminate();
    };
  }, []);

  /* attach stream to video */
  const attachStream = useCallback((stream) => {
    const video = videoRef.current;
    if (!video) return;
    video.srcObject = stream;
    video.onloadedmetadata = () => video.play().catch(() => {});
    setTimeout(() => { if (video.paused) video.play().catch(() => {}); }, 400);
  }, []);

  /* single scan attempt — returns plate string or null */
  const doScan = useCallback(async () => {
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !workerRef.current) return null;
    if (video.readyState < 2 || video.videoWidth === 0) return null;

    /* draw full frame */
    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);

    /* crop the guide box area */
    const cropY = Math.floor(canvas.height * 0.45);
    const cropH = Math.floor(canvas.height * 0.35);
    const cropX = Math.floor(canvas.width  * 0.05);
    const cropW = Math.floor(canvas.width  * 0.9);

    /* scale up 3x for better OCR — Tesseract works best on large text */
    const SCALE  = 3;
    const proc   = document.createElement('canvas');
    proc.width   = cropW * SCALE;
    proc.height  = cropH * SCALE;
    const pCtx   = proc.getContext('2d');

    /* step 1: scale up with smoothing off for sharper edges */
    pCtx.imageSmoothingEnabled = false;
    pCtx.drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, proc.width, proc.height);

    /* step 2: get pixel data and apply manual threshold (binarise) */
    const imgData = pCtx.getImageData(0, 0, proc.width, proc.height);
    const data    = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      /* greyscale */
      const grey = 0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2];
      /* adaptive threshold — dark text on light plate */
      const val  = grey > 128 ? 255 : 0;
      data[i] = data[i+1] = data[i+2] = val;
      data[i+3] = 255;
    }
    pCtx.putImageData(imgData, 0, 0);

    /* step 3: also try inverted (light text on dark plate) */
    const inv   = document.createElement('canvas');
    inv.width   = proc.width;
    inv.height  = proc.height;
    const iCtx  = inv.getContext('2d');
    iCtx.filter = 'invert(1)';
    iCtx.drawImage(proc, 0, 0);

    /* run OCR on both normal and inverted, take whichever gives a plate */
    try {
      const [r1, r2] = await Promise.all([
        workerRef.current.recognize(proc),
        workerRef.current.recognize(inv),
      ]);
      return cleanPlate(r1.data.text) || cleanPlate(r2.data.text);
    } catch {
      return null;
    }
  }, []);

  /* start auto-scan loop */
  const startScanLoop = useCallback(() => {
    scanTimerRef.current = setInterval(async () => {
      if (scanningRef.current) return;
      scanningRef.current = true;
      setScanCount((c) => c + 1);

      const plate = await doScan();

      if (plate) {
        /* found a plate — stop everything and report */
        clearInterval(scanTimerRef.current);
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        setDetectedPlate(plate);
        setStatus('done');
        onPlateDetected(plate);
      }

      scanningRef.current = false;
    }, 1800); // scan every 1.8 seconds
  }, [doScan, onPlateDetected]);

  /* stop scan loop */
  const stopScanLoop = useCallback(() => {
    clearInterval(scanTimerRef.current);
    scanningRef.current = false;
  }, []);

  /* start camera */
  const startCamera = useCallback(async () => {
    setStatus('requesting');
    setErrorMsg('');
    setScanCount(0);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      setStatus('streaming');
      requestAnimationFrame(() => {
        attachStream(stream);
        /* start scanning after camera warms up */
        setTimeout(() => startScanLoop(), 1200);
      });
    } catch (err) {
      setStatus('error');
      if (err.name === 'NotAllowedError') {
        setErrorMsg('Camera permission denied. Click the camera icon in the address bar and allow access.');
      } else if (err.name === 'NotFoundError') {
        setErrorMsg('No webcam found. Make sure your PC webcam is connected and not in use by another app.');
      } else {
        setErrorMsg(`Camera error: ${err.message}`);
      }
    }
  }, [attachStream, startScanLoop]);

  /* stop camera */
  const stopCamera = useCallback(() => {
    stopScanLoop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setStatus('idle');
    setDetectedPlate('');
    setErrorMsg('');
    setScanCount(0);
  }, [stopScanLoop]);

  useEffect(() => () => { stopScanLoop(); stopCamera(); }, [stopScanLoop, stopCamera]);

  return (
    <div style={{ background: '#0f172a', borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* IDLE */}
      {status === 'idle' && (
        <div style={{ padding: 28, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, minHeight: 160, justifyContent: 'center' }}>
          <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(26,86,219,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(99,179,237,0.9)" strokeWidth="1.8">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
              <circle cx="12" cy="13" r="4"/>
            </svg>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: 14, marginBottom: 4 }}>
              Auto Plate Scanner
            </div>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>
              Opens webcam and reads the plate automatically
            </div>
          </div>
          <button
            onClick={startCamera}
            disabled={!workerReady}
            style={{
              padding: '11px 32px', borderRadius: 10, border: 'none',
              cursor: workerReady ? 'pointer' : 'not-allowed',
              background: workerReady ? 'linear-gradient(135deg,#1a56db,#1342b0)' : 'rgba(255,255,255,0.08)',
              color: '#fff', fontWeight: 700, fontSize: 14,
              display: 'flex', alignItems: 'center', gap: 8,
              opacity: workerReady ? 1 : 0.5,
              boxShadow: workerReady ? '0 4px 14px rgba(26,86,219,0.4)' : 'none',
            }}
          >
            {workerReady ? (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
                Open Webcam &amp; Scan
              </>
            ) : (
              <>
                <span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid #fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />
                Loading scanner...
              </>
            )}
          </button>
        </div>
      )}

      {/* REQUESTING */}
      {status === 'requesting' && (
        <div style={{ padding: 32, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, minHeight: 160, justifyContent: 'center' }}>
          <div style={{ width: 32, height: 32, border: '3px solid rgba(255,255,255,0.15)', borderTop: '3px solid #63b3ed', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>Starting webcam...</div>
        </div>
      )}

      {/* STREAMING — auto scanning */}
      {status === 'streaming' && (
        <div style={{ position: 'relative' }}>
          <video
            ref={(el) => {
              videoRef.current = el;
              if (el && streamRef.current && !el.srcObject) {
                el.srcObject = streamRef.current;
                el.onloadedmetadata = () => el.play().catch(() => {});
              }
            }}
            autoPlay
            playsInline
            muted
            style={{ width: '100%', display: 'block', maxHeight: 280, objectFit: 'cover', background: '#000' }}
          />

          {/* plate guide box */}
          <div style={{
            position: 'absolute', top: '45%', left: '5%', right: '5%', height: '35%',
            transform: 'translateY(-50%)',
            border: '2.5px solid #f59e0b',
            borderRadius: 8,
            pointerEvents: 'none',
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)',
          }}>
            {/* corner accents */}
            {[['0%','0%'],['0%','auto'],['auto','0%'],['auto','auto']].map(([t,b], i) => (
              <div key={i} style={{ position: 'absolute', top: t === '0%' ? -2 : 'auto', bottom: b === '0%' ? -2 : 'auto', left: i < 2 ? -2 : 'auto', right: i >= 2 ? -2 : 'auto', width: 16, height: 16, borderTop: t === '0%' ? '3px solid #f59e0b' : 'none', borderBottom: b === '0%' ? '3px solid #f59e0b' : 'none', borderLeft: i < 2 ? '3px solid #f59e0b' : 'none', borderRight: i >= 2 ? '3px solid #f59e0b' : 'none' }} />
            ))}
            {/* scanning line */}
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg,transparent,#f59e0b,transparent)', animation: 'scanLine 1.5s linear infinite' }} />
            <div style={{ position: 'absolute', bottom: -22, left: 0, right: 0, textAlign: 'center', fontSize: 10, color: '#f59e0b', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              Align plate here — scanning automatically
            </div>
          </div>

          {/* scan counter */}
          <div style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(0,0,0,0.6)', borderRadius: 20, padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#f59e0b', animation: 'pulse-dot 1s ease-in-out infinite' }} />
            <span style={{ color: '#fff', fontSize: 11, fontWeight: 600 }}>Scanning... {scanCount > 0 ? `(${scanCount})` : ''}</span>
          </div>

          {/* close button */}
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '10px 16px', background: 'linear-gradient(to top,rgba(0,0,0,0.8),transparent)', display: 'flex', justifyContent: 'center' }}>
            <button onClick={stopCamera} style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, padding: '7px 20px', color: '#fff', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* DONE */}
      {status === 'done' && (
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(74,222,128,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#4ade80', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Plate Detected</span>
          </div>
          <div style={{ fontFamily: 'monospace', fontSize: 28, fontWeight: 900, color: '#fff', letterSpacing: '0.15em', background: 'rgba(255,255,255,0.07)', padding: '10px 28px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)' }}>
            {detectedPlate}
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>Plate filled in automatically ✓</div>
          <button
            onClick={() => { setStatus('idle'); setDetectedPlate(''); setScanCount(0); }}
            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '7px 18px', color: '#fff', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}
          >
            Scan Again
          </button>
        </div>
      )}

      {/* ERROR */}
      {status === 'error' && (
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, minHeight: 160, justifyContent: 'center' }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(220,38,38,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          </div>
          <div style={{ fontSize: 12, color: '#f87171', textAlign: 'center', maxWidth: 280, lineHeight: 1.6 }}>{errorMsg}</div>
          <button onClick={() => setStatus('idle')} style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '7px 18px', color: '#fff', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}
