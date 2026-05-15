import { useEffect, useRef, useState, useCallback } from 'react';
import api from '../lib/api';

/**
 * CameraAnpr — PlateRecognizer powered ANPR scanner.
 *
 * Key design decisions:
 * - Uses recursive setTimeout instead of setInterval so requests never pile up.
 * - Sends the FULL frame (not a crop) to PlateRecognizer — it handles detection
 *   internally and is more accurate with the full image context.
 * - onPlateDetected is stored in a ref so stale-closure bugs can't occur.
 */

const MAX_ERRORS = 5;

export default function CameraAnpr({ onPlateDetected, camera = 'entry' }) {
  const videoRef           = useRef(null);
  const canvasRef          = useRef(null);
  const streamRef          = useRef(null);
  const scanTimeoutRef     = useRef(null);
  const scanningRef        = useRef(false);
  const activeRef          = useRef(false);   // true while scan loop should keep running
  const mountedRef         = useRef(true);
  const errorCountRef      = useRef(0);
  const onPlateDetectedRef = useRef(onPlateDetected); // avoid stale closure

  // keep the callback ref fresh on every render
  useEffect(() => { onPlateDetectedRef.current = onPlateDetected; }, [onPlateDetected]);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const [status,        setStatus]        = useState('idle');
  const [errorMsg,      setErrorMsg]      = useState('');
  const [detectedPlate, setDetectedPlate] = useState('');
  const [scanCount,     setScanCount]     = useState(0);
  const [confidence,    setConfidence]    = useState(0);

  /* ── stop stream and scan loop ── */
  const stopAll = useCallback(() => {
    activeRef.current   = false;
    scanningRef.current = false;
    clearTimeout(scanTimeoutRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  /* ── capture full frame as base64 JPEG ── */
  const captureFrame = useCallback(() => {
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return null;
    if (video.readyState < 2 || video.videoWidth === 0) return null;

    // Send the full frame — PlateRecognizer locates the plate itself
    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);

    // JPEG at 0.9 quality — good detail without excessive payload size
    return canvas.toDataURL('image/jpeg', 0.9).split(',')[1];
  }, []);

  /* ── recursive scan — fires next scan only after current one completes ── */
  const scheduleScan = useCallback(() => {
    if (!activeRef.current || !mountedRef.current) return;

    scanTimeoutRef.current = setTimeout(async () => {
      if (!activeRef.current || !mountedRef.current) return;

      if (mountedRef.current) setScanCount((c) => c + 1);

      const base64 = captureFrame();
      if (!base64) {
        scheduleScan(); // video not ready yet, try again
        return;
      }

      try {
        const { data } = await api.post('/api/ocr', { image: base64 });

        if (!mountedRef.current || !activeRef.current) return;

        errorCountRef.current = 0;

        if (data.text) {
          // plate found — stop everything
          stopAll();
          if (!mountedRef.current) return;
          setDetectedPlate(data.text);
          setConfidence(data.confidence || 0);
          setStatus('done');
          onPlateDetectedRef.current(data.text);
          return; // do NOT schedule next scan
        }

        // no plate found yet — schedule next scan after short delay
        scanTimeoutRef.current = setTimeout(scheduleScan, 600);

      } catch (err) {
        if (!mountedRef.current) return;
        errorCountRef.current += 1;

        if (errorCountRef.current >= MAX_ERRORS) {
          stopAll();
          const serverMsg = err.response?.data?.message || '';
          let msg = 'Scanner error. Make sure the backend server is running on port 5000.';
          if (err.code === 'ERR_NETWORK' || err.message === 'Network Error') {
            msg = 'Cannot reach the backend. Make sure it is running on port 5000.';
          } else if (serverMsg) {
            msg = serverMsg;
          }
          if (mountedRef.current) { setErrorMsg(msg); setStatus('error'); }
          return;
        }

        // transient error — wait a bit longer before retrying
        scanTimeoutRef.current = setTimeout(scheduleScan, 1500);
      }
    }, 200); // 200ms after previous scan completes before starting next
  }, [captureFrame, stopAll]);

  /* ── attach stream to video element ── */
  const attachStream = useCallback((stream) => {
    const video = videoRef.current;
    if (!video) return;
    video.srcObject = stream;
    video.onloadedmetadata = () => video.play().catch(() => {});
    setTimeout(() => { if (video.paused) video.play().catch(() => {}); }, 300);
  }, []);

  /* ── open camera ── */
  const startCamera = useCallback(async () => {
    setStatus('requesting');
    setErrorMsg('');
    setScanCount(0);
    setConfidence(0);
    errorCountRef.current = 0;
    activeRef.current = false;

    try {
      /* Enumerate devices to find the built-in webcam.
         DroidCam and virtual cameras usually have "droid", "virtual", or
         "obs" in their label. We prefer a device that doesn't match those.
         Fall back to default if nothing better is found.                  */
      let deviceId;
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter((d) => d.kind === 'videoinput');
        const builtin = videoDevices.find((d) => {
          const label = d.label.toLowerCase();
          return !label.includes('droid') &&
                 !label.includes('virtual') &&
                 !label.includes('obs') &&
                 !label.includes('snap') &&
                 !label.includes('ivcam') &&
                 !label.includes('epoccam');
        });
        if (builtin) deviceId = builtin.deviceId;
      } catch {
        /* enumeration failed — proceed without deviceId constraint */
      }

      const constraints = {
        video: {
          width:  { ideal: 1920 },
          height: { ideal: 1080 },
          ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
        },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      setStatus('streaming');

      requestAnimationFrame(() => {
        attachStream(stream);
        setTimeout(() => {
          if (!mountedRef.current) return;
          activeRef.current = true;
          scheduleScan();
        }, 1200);
      });

    } catch (err) {
      setStatus('error');
      if (err.name === 'NotAllowedError') {
        setErrorMsg('Camera permission denied. Allow camera access in your browser settings.');
      } else if (err.name === 'NotFoundError') {
        setErrorMsg('No camera found. Make sure a webcam is connected and not in use.');
      } else {
        setErrorMsg(`Camera error: ${err.message}`);
      }
    }
  }, [attachStream, scheduleScan]);

  /* ── cancel camera ── */
  const stopCamera = useCallback(() => {
    stopAll();
    if (!mountedRef.current) return;
    setStatus('idle');
    setDetectedPlate('');
    setErrorMsg('');
    setScanCount(0);
    setConfidence(0);
  }, [stopAll]);

  /* cleanup on unmount */
  useEffect(() => () => { stopAll(); }, [stopAll]);

  const confColor = confidence >= 80 ? '#4ade80' : confidence >= 55 ? '#f59e0b' : '#f87171';
  const confLabel = confidence >= 80 ? 'High confidence ✓'
                  : confidence >= 55 ? 'Moderate — please verify'
                  : 'Low confidence — verify manually';

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
              Opens camera · detects plate automatically · fills field instantly
            </div>
          </div>
          <button
            onClick={startCamera}
            style={{ padding: '11px 32px', borderRadius: 10, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#1a56db,#1342b0)', color: '#fff', fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 4px 14px rgba(26,86,219,0.4)' }}
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
            style={{ width: '100%', display: 'block', maxHeight: 320, objectFit: 'cover', background: '#000' }}
          />

          {/* full-frame guide overlay — just a border, no crop */}
          <div style={{
            position: 'absolute', inset: 0,
            border: '2.5px solid #f59e0b',
            borderRadius: 0,
            pointerEvents: 'none',
            boxShadow: 'inset 0 0 0 2px rgba(245,158,11,0.3)',
          }}>
            {/* corner accents */}
            {[[true,true],[true,false],[false,true],[false,false]].map(([top, left], i) => (
              <div key={i} style={{
                position: 'absolute',
                top: top ? -1 : 'auto', bottom: top ? 'auto' : -1,
                left: left ? -1 : 'auto', right: left ? 'auto' : -1,
                width: 24, height: 24,
                borderTop:    top  ? '4px solid #f59e0b' : 'none',
                borderBottom: top  ? 'none' : '4px solid #f59e0b',
                borderLeft:   left ? '4px solid #f59e0b' : 'none',
                borderRight:  left ? 'none' : '4px solid #f59e0b',
              }} />
            ))}
            {/* sweep line */}
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg,transparent,#f59e0b,transparent)', animation: 'scanLine 1.4s linear infinite' }} />
          </div>

          {/* status pill — top left */}
          <div style={{ position: 'absolute', top: 10, left: 10, background: 'rgba(0,0,0,0.7)', borderRadius: 20, padding: '5px 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#f59e0b', animation: 'pulse-dot 1s ease-in-out infinite' }} />
            <span style={{ color: '#fff', fontSize: 11, fontWeight: 600 }}>
              {scanCount === 0 ? 'Warming up...' : `Scanning... (${scanCount})`}
            </span>
          </div>

          {/* PlateRecognizer badge — top right */}
          <div style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(0,0,0,0.65)', borderRadius: 8, padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 5 }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 9, fontWeight: 700, letterSpacing: '0.06em' }}>PLATE RECOGNIZER</span>
          </div>

          {/* hint text — bottom centre */}
          <div style={{ position: 'absolute', bottom: 44, left: 0, right: 0, textAlign: 'center', fontSize: 10, color: '#f59e0b', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>
            Point camera at the number plate
          </div>

          {/* cancel button — bottom */}
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '8px 16px', background: 'linear-gradient(to top,rgba(0,0,0,0.9),transparent)', display: 'flex', justifyContent: 'center' }}>
            <button onClick={stopCamera} style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, padding: '6px 20px', color: '#fff', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── DONE ── */}
      {status === 'done' && (
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(74,222,128,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#4ade80', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Plate Detected</span>
            {confidence > 0 && (
              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: `${confColor}22`, color: confColor }}>
                {confidence}%
              </span>
            )}
          </div>

          <div style={{ fontFamily: 'monospace', fontSize: 30, fontWeight: 900, color: '#fff', letterSpacing: '0.15em', background: 'rgba(255,255,255,0.07)', padding: '10px 32px', borderRadius: 10, border: `1px solid ${confColor}55` }}>
            {detectedPlate}
          </div>

          <div style={{ fontSize: 11, color: confColor, fontWeight: 600 }}>{confLabel}</div>

          <button
            onClick={() => { setStatus('idle'); setDetectedPlate(''); setScanCount(0); setConfidence(0); }}
            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '7px 18px', color: '#fff', fontSize: 13, cursor: 'pointer', fontWeight: 600, marginTop: 4 }}
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
