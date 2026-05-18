import React, { useRef, useState, useEffect } from 'react';
import { X } from 'lucide-react';

export default function LiveCameraModal({ onCapture, onClose }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function startCamera() {
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false
        });
        setStream(s);
        if (videoRef.current) videoRef.current.srcObject = s;
        setLoading(false);
      } catch (err) {
        console.error("Camera error:", err);
        setError("Could not access camera. Please ensure permissions are granted.");
        setLoading(false);
      }
    }
    startCamera();
    return () => {
      if (stream) stream.getTracks().forEach(track => track.stop());
    };
  }, []);

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Get Location for watermark
    navigator.geolocation.getCurrentPosition((pos) => {
      const { latitude, longitude } = pos.coords;
      const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

      // Watermark styling
      context.fillStyle = 'rgba(0, 0, 0, 0.6)';
      context.fillRect(0, canvas.height - 120, canvas.width, 120);

      context.fillStyle = 'white';
      context.font = 'bold 24px Inter, sans-serif';
      context.fillText(`KDA DRISHTI - OFFICIAL SITE EVIDENCE`, 30, canvas.height - 80);
      context.font = '18px Inter, sans-serif';
      context.fillText(`GPS: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`, 30, canvas.height - 50);
      context.fillText(`Timestamp: ${timestamp}`, 30, canvas.height - 20);

      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      onCapture(dataUrl);
    }, (err) => {
      const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
      context.fillStyle = 'rgba(0, 0, 0, 0.6)';
      context.fillRect(0, canvas.height - 60, canvas.width, 60);
      context.fillStyle = 'white';
      context.font = 'bold 20px Inter, sans-serif';
      context.fillText(`KDA DRISHTI - ${timestamp}`, 30, canvas.height - 25);

      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      onCapture(dataUrl);
    });
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 3000, display: 'flex', flexDirection: 'column' }}>
      <div style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', zIndex: 3001 }}>
        <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', padding: '0.75rem', borderRadius: '50%', backdropFilter: 'blur(10px)' }}>
          <X size={24} />
        </button>
      </div>

      {loading && <div style={{ color: 'white', display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center' }}>Initializing Camera...</div>}
      {error && <div style={{ color: 'var(--error)', padding: '2rem', textAlign: 'center', display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center' }}>{error}</div>}

      <video ref={videoRef} autoPlay playsInline style={{ flex: 1, objectFit: 'cover', display: (loading || error) ? 'none' : 'block' }} />
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {!loading && !error && (
        <div style={{ padding: '3rem', display: 'flex', justifyContent: 'center', background: 'linear-gradient(transparent, rgba(0,0,0,0.9))' }}>
          <button
            onClick={capturePhoto}
            className="pulse"
            style={{
              width: '80px', height: '80px', borderRadius: '50%', border: '6px solid white',
              background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}
          >
            <div style={{ width: '50px', height: '50px', borderRadius: '50%', background: 'white' }} />
          </button>
        </div>
      )}
    </div>
  );
}
