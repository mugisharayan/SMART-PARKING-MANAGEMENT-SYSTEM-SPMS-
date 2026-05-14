import { useEffect, useRef, useState, useCallback } from 'react';
import api from '../lib/api';

/**
 * CameraAnpr — Google Cloud Vision powered plate scanner.
 *
 * Flow:
 *   1. Open webcam at highest available resolution.
 *   2. Every 800 ms capture a JPEG frame (quality 0.85).
 *   3. POST the base64 image to /api/ocr (backend proxies to Google Vision).
 *   4. Backend returns { text, raw } — text is the cleaned plate string.
 *   5. On success → stop camera, fill plate field, show result.
 *
 * No WASM, no warmup, no workers. Round-trip is ~200-500 ms.
 */

const MAX_ERRORS = 4; // show error UI after this many consecutive failures

export default function CameraAnpr({ onPlateDetected, camera = 'entry' }) {
  const videoRef      = useRef(null);
  const canvasRef     = useRef(null);
  const streamRef     = useRef(null);
  const timerRef      = useRef(null);
  const scanningRef   = useRef(false);
  const mountedRef    = useRef(true);   // guard against post-unmount state updates
  const errorCountRef = useRef(0);      // consecutive network/server errors

  const [status,        setStatus]        = useState('idle');
  const [errorMsg,      setErrorMsg]      = useState('');
  const [detectedPlate, setDetectedPlate] = useState('');
  const [scanCount,     setScanCount]     = useState(0);
  const [lastRaw,       setLastRaw]       = useState('');

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  /* ── attach stream to video element ── */
  const attachStream = useCallback((stream) => {
    const video = videoRef.current;
    if (!video) return;
    video.srcObject = stream;
    video.onloadedmetadata = () => video.play().catch(() => {});
    setTimeout(() => { if (video.paused) video.play().catch(() => {}); }, 300);
  }, []);

  /* ── capture one JPEG frame as base64 ── */
  const captureFrame = useCallback(() => {
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return null;
    if (video.readyState < 2 || video.videoWidth === 0) return null;

    /* crop the guide-box region — reduces payload and focuses Vision on the plate */
    const W = video.videoWidth;
    const H = video.videoHeight;
    const cropX = Math.floor(W * 0.05);
    const cropY = Math.floor(H * 0.28);
    const cropW = Math.floor(W * 0.90);
    const cropH = Math.floor(H * 0.44);

    canvas.width  = cropW;
    canvas.height = cropH;
    canvas.getContext('2d').drawImage(video, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

    /* JPEG at 0.85 quality — good balance of size vs detail */
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    return dataUrl.split(',')[1]; // strip the data:image/jpeg;base64, prefix
  }, []);

  /* ── stop stream + interval ── */
  const stopAll = useCallback(() => {
    clearInterval(timerRef.current);
    scanningRef.current = false;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  /* ── scan loop — fires every 800 ms ── */
  const startScanLoop = useCallback(() => {
    errorCountRef.current = 0;

    timerRef.current = setInterval(async () => {
      if (scanningRef.current) return; // skip if previous request still in flight
      scanningRef.current = true;

      if (mountedRef.current) setScanCount((c) => c + 1);

      const base64 = captureFrame();
      if (!base64) { scanningRef.current = false; return; }

      try {
        const { data } = await api.post('/api/ocr', { image: base64 });

        if (!mountedRef.current) return; // component unmounted while request was in flight

        errorCountRef.current = 0; // reset error streak on any successful response

        if (data.text) {
          stopAll();
          setDetectedPlate(data.text);
          setLastRaw(data.raw || '');
          setStatus('done');
          onPlateDetected(data.text);
        }
        // data.text === null means Vision saw no plate yet — keep scanning

      } catch (err) {
        if (!mountedRef.current) return;

        errorCountRef.current += 1;

        if (errorCountRef.current >= MAX_ERRORS) {
          // Too many consecutive failures — stop and show a useful error
          stopAll();
          const serverMsg = err.response?.data?.message || '';
          let msg = 'Scanner error. Check your internet connection and try again.';

          if (serverMsg.includes('GOOGLE_VISION_API_KEY not configured')) {
            msg = 'Google Vision API key is not configured on the server. Add GOOGLE_VISION_API_KEY to backend/.env and restart the server.';
          } else if (serverMsg.includes('Vision API error')) {
            msg = `Google Vision API error: ${serverMsg.replace('Vision API error: ', '')}`;
          } else if (err.code === 'ERR_NETWORK' || err.message === 'Network Error') {
            msg = 'Cannot reach the backend server. Make sure it is running on port 5000.';
          }

          setErrorMsg(msg);
          setStatus('error');
        }
      }

      scanningRef.current = false;
    }, 800);
  }, [captureFrame, stopAll, onPlateDetected]);

  /* ── open camera ── */
  const startCamera = useCallback(async () => {
    setStatus('requesting');
    setErrorMsg('');
    setScanCount(0);
    setLastRaw('');
    errorCountRef.current = 0;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width:      { ideal: 1920 },
          height:     { ideal: 1080 },
          facingMode: 'environment', // rear camera on mobile
        },
      });
      streamRef.current = stream;
      setStatus('streaming');
      requestAnimationFrame(() => {
        attachStream(stream);
        // 1 s warmup so camera auto-exposes before first scan
        setTimeout(() => startScanLoop(), 1000);
      });
    } catch (err) {
      setStatus('error');
      if (err.name === 'NotAllowedError') {
        setErrorMsg('Camera permission denied. Allow camera access in your browser settings.');
      } else if (err.name === 'NotFoundError') {
        setErrorMsg('No camera found. Make sure a webcam is connected and not in use by another app.');
      } else {
        setErrorMsg(`Camera error: ${err.message}`);
      }
    }
  }, [attachStream, startScanLoop]);

  /* ── close camera ── */
  const stopCamera = useCallback(() => {
    stopAll();
    setStatus('idle');
    setDetectedPlate('');
    setErrorMsg('');
    setScanCount(0);
    setLastRaw('');
  }, [stopAll]);

  /* cleanup on unmount */
  useEffect(() => () => stopAll(), [stopAll]);

  /* ─────────────────────────── UI ─────────────────────────── */
  return (
    <div style={{ background: '#0f172a', borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* ── IDLE ── */}
      {status === 'idle' && (
        <div style={{ padding: 28, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, minHeight: 160, justifyContent: 'center' }}>
          <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(26,86,219,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(99,179,237,0.9)" strokeWidth="1.8">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
              <circle cx="12" cy="13" r="4"/>
            </svg>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Auto Plate Scanner</div>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>
              Opens camera · reads plate via Google Vision · fills field instantly
            </div>
          </div>
          <button
            onClick={startCamera}
            style={{
              padding: '11px 32px', borderRadius: 10, border: 'none', cursor: 'pointer',
              background: 'linear-gradient(135deg,#1a56db,#1342b0)',
              color: '#fff', fontWeight: 700, fontSize: 14,
              display: 'flex', alignItems: 'center', gap: 8,
              boxShadow: '0 4px 14px rgba(26,86,219,0.4)',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
              <circle cx="12" cy="13" r="4"/>
            </svg>
            Open Camera &amp; Scan
          </button>
        </div>
      )}

      {/* ── REQUESTING ── */}
      {status === 'requesting' && (
        <div style={{ padding: 32, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, minHeight: 160, justifyContent: 'center' }}>
          <div style={{ width: 32, height: 32, border: '3px solid rgba(255,255,255,0.15)', borderTop: '3px solid #63b3ed', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>Starting camera...</div>
        </div>
      )}

      {/* ── STREAMING ── */}
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
            autoPlay playsInline muted
            style={{ width: '100%', display: 'block', maxHeight: 300, objectFit: 'cover', background: '#000' }}
          />

          {/* guide box overlay */}
          <div style={{
            position: 'absolute', top: '28%', left: '5%', right: '5%', height: '44%',
            border: '2.5px solid #f59e0b', borderRadius: 8, pointerEvents: 'none',
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.52)',
          }}>
            {/* corner accents */}
            {[[true,true],[true,false],[false,true],[false,false]].map(([top, left], i) => (
              <div key={i} style={{
                position: 'absolute',
                top: top ? -2 : 'auto', bottom: top ? 'auto' : -2,
                left: left ? -2 : 'auto', right: left ? 'auto' : -2,
                width: 18, height: 18,
                borderTop:    top  ? '3px solid #f59e0b' : 'none',
                borderBottom: top  ? 'none' : '3px solid #f59e0b',
                borderLeft:   left ? '3px solid #f59e0b' : 'none',
                borderRight:  left ? 'none' : '3px solid #f59e0b',
              }} />
            ))}
            {/* sweep line */}
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg,transparent,#f59e0b,transparent)', animation: 'scanLine 1.1s linear infinite' }} />
            <div style={{ position: 'absolute', bottom: -22, left: 0, right: 0, textAlign: 'center', fontSize: 10, color: '#f59e0b', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              Align plate inside the box
            </div>
          </div>

          {/* status pill */}
          <div style={{ position: 'absolute', top: 10, left: 10, background: 'rgba(0,0,0,0.65)', borderRadius: 20, padding: '4px 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#f59e0b', animation: 'pulse-dot 1s ease-in-out infinite' }} />
            <span style={{ color: '#fff', fontSize: 11, fontWeight: 600 }}>
              {scanCount === 0 ? 'Warming up...' : `Reading... (${scanCount})`}
            </span>
          </div>

          {/* powered-by badge */}
          <div style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(0,0,0,0.55)', borderRadius: 8, padding: '3px 8px', display: 'flex', alignItems: 'center', gap: 4 }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 9, fontWeight: 600, letterSpacing: '0.05em' }}>GOOGLE VISION</span>
          </div>

          {/* cancel */}
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '10px 16px', background: 'linear-gradient(to top,rgba(0,0,0,0.85),transparent)', display: 'flex', justifyContent: 'center' }}>
            <button onClick={stopCamera} style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, padding: '7px 20px', color: '#fff', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── DONE ── */}
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

          {/* show raw OCR text only when it differs from the cleaned plate */}
          {lastRaw && lastRaw.replace(/\s/g, '') !== detectedPlate.replace(/\s/g, '') && (
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace' }}>
              raw: {lastRaw.replace(/\n/g, ' ').slice(0, 60)}
            </div>
          )}

          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>Filled in automatically ✓</div>

          <button
            onClick={() => { setStatus('idle'); setDetectedPlate(''); setScanCount(0); setLastRaw(''); }}
            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '7px 18px', color: '#fff', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}
          >
            Scan Again
          </button>
        </div>
      )}

      {/* ── ERROR ── */}
      {status === 'error' && (
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, minHeight: 160, justifyContent: 'center' }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(220,38,38,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </div>
          <div style={{ fontSize: 12, color: '#f87171', textAlign: 'center', maxWidth: 300, lineHeight: 1.7 }}>{errorMsg}</div>
          <button
            onClick={() => { setStatus('idle'); setErrorMsg(''); }}
            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '7px 18px', color: '#fff', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}
