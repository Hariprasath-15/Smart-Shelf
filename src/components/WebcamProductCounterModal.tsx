import React, { useRef, useState, useEffect } from 'react';

interface WebcamProductCounterModalProps {
  isOpen: boolean;
  onClose: () => void;
  shelfId: string;
  expectedProductName: string;
  onCountSuccess: (result: {
    count: number;
    confidence: number;
    detected_product: string;
    is_misplaced: boolean;
    misplaced_item_name?: string;
    notes: string;
  }) => void;
  onToast: (msg: string, type?: 'normal' | 'success' | 'info') => void;
}

export const WebcamProductCounterModal: React.FC<WebcamProductCounterModalProps> = ({
  isOpen,
  onClose,
  shelfId,
  expectedProductName,
  onCountSuccess,
  onToast,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isCounting, setIsCounting] = useState(false);
  const [lastCapturedImage, setLastCapturedImage] = useState<string | null>(null);
  const [countResult, setCountResult] = useState<{
    count: number;
    confidence: number;
    detected_product: string;
    is_misplaced: boolean;
    misplaced_item_name?: string;
    notes: string;
  } | null>(null);

  const [cameraLoading, setCameraLoading] = useState(false);
  const [useUploadFallback, setUseUploadFallback] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setCameraError(null);
      setCountResult(null);
      setLastCapturedImage(null);
      setUseUploadFallback(false);
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen]);

  const startCamera = async () => {
    setCameraLoading(true);
    setCameraError(null);

    // Check navigator.mediaDevices
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError('Webcam access is restricted by your browser in this environment or requires HTTPS/permissions. You can upload a photo or use your device camera file capture below.');
      setUseUploadFallback(true);
      setCameraLoading(false);
      return;
    }

    try {
      // First attempt with environment facing mode
      let mediaStream: MediaStream;
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: 'environment',
          },
          audio: false,
        });
      } catch (firstErr) {
        // Fallback to simple boolean video constraint if resolution or facingMode fails
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }

      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await videoRef.current.play().catch(() => {});
      }
    } catch (err: any) {
      console.warn('Webcam stream request failed:', err);
      let errorMsg = 'Could not access camera.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        errorMsg = 'Camera access was blocked by your browser. Please click the camera/lock icon in your browser URL bar to allow camera access, or use the direct photo capture below.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        errorMsg = 'No connected webcam was found on your system. Please attach a camera or upload a photo.';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        errorMsg = 'Webcam is currently in use by another application. Please close other camera apps and retry.';
      } else {
        errorMsg = `${err.message || 'Webcam initialization failed'}. You can upload a photo or take a picture with your device below.`;
      }
      setCameraError(errorMsg);
      setUseUploadFallback(true);
    } finally {
      setCameraLoading(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    try {
      setIsCounting(true);
      onToast('Analyzing image with Gemini Vision neural network...', 'info');

      const reader = new FileReader();
      reader.onload = async () => {
        const dataUrl = reader.result as string;
        setLastCapturedImage(dataUrl);
        const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, '');

        try {
          const res = await fetch('/api/sensors/ai-count', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              shelf_id: shelfId,
              image_base64: base64Data,
              expected_product_name: expectedProductName,
            }),
          });

          const json = await res.json();
          if (!res.ok || !json.success) {
            throw new Error(json.error || 'AI counting failed');
          }

          setCountResult(json);
          onCountSuccess(json);
          onToast(`Identified ${json.count} units of ${json.detected_product}!`, 'success');
        } catch (err: any) {
          onToast(`Counting error: ${err.message}`, 'normal');
        } finally {
          setIsCounting(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      onToast(`File error: ${err.message}`, 'normal');
      setIsCounting(false);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  };

  const captureFrameAndCount = async () => {
    if (!videoRef.current) return;

    try {
      setIsCounting(true);
      const video = videoRef.current;
      const canvas = canvasRef.current || document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;

      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not get canvas context');

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      setLastCapturedImage(dataUrl);

      const base64Data = dataUrl.replace(/^data:image\/jpeg;base64,/, '');

      onToast('Scanning frame with AI Vision neural network...', 'info');

      const res = await fetch('/api/sensors/ai-count', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shelf_id: shelfId,
          image_base64: base64Data,
          expected_product_name: expectedProductName,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'AI counting failed');
      }

      setCountResult(json);
      onCountSuccess(json);
      onToast(`Identified ${json.count} units of ${json.detected_product}!`, 'success');
    } catch (err: any) {
      console.error('AI count error:', err);
      onToast(`Counting error: ${err.message}`, 'normal');
    } finally {
      setIsCounting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-700 text-white rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
            <h3 className="font-bold text-base text-white">
              Optical Product Identification & Counter
            </h3>
            <span className="text-xs bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded font-mono">
              {expectedProductName} ({shelfId})
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white text-2xl font-bold leading-none p-1"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-4">
          <p className="text-xs text-slate-300">
            Hold your camera or webcam in front of the shelf where <strong>{expectedProductName}</strong> items are placed.
            Click <strong>&quot;Count Products Now&quot;</strong> to run real-time visual product detection and automatically update your shelf inventory.
          </p>

          {/* Camera Viewfinder */}
          <div className="relative rounded-xl overflow-hidden bg-black aspect-video flex items-center justify-center border border-slate-800 shadow-inner">
            {cameraLoading ? (
              <div className="text-center p-6 space-y-2">
                <div className="w-8 h-8 border-3 border-emerald-400 border-t-transparent rounded-full animate-spin mx-auto" />
                <div className="text-slate-300 text-xs font-mono">Initializing camera feed...</div>
              </div>
            ) : cameraError ? (
              <div className="text-center p-6 space-y-3 max-w-md">
                <div className="text-3xl">📷</div>
                <div className="text-red-400 font-semibold text-xs leading-relaxed">{cameraError}</div>
                <div className="flex items-center justify-center gap-2 pt-1 flex-wrap">
                  <button
                    type="button"
                    onClick={startCamera}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs font-semibold transition-colors"
                  >
                    🔄 Retry Camera Access
                  </button>

                  <label className="cursor-pointer px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold transition-colors shadow">
                    <span>📱 Take Photo / Upload Shelf Image</span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(file);
                      }}
                    />
                  </label>
                </div>
              </div>
            ) : lastCapturedImage && !stream ? (
              <img
                src={lastCapturedImage}
                alt="Captured Shelf Frame"
                className="w-full h-full object-cover"
              />
            ) : (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                <canvas ref={canvasRef} className="hidden" />

                {/* Viewfinder Target Reticle */}
                <div className="absolute inset-8 border-2 border-emerald-400/50 rounded-xl pointer-events-none flex flex-col justify-between p-3">
                  <div className="flex justify-between text-[11px] font-mono text-emerald-400 bg-black/60 px-2 py-0.5 rounded self-start">
                    <span>LIVE OPTICAL INSPECTOR</span>
                  </div>
                  <div className="flex justify-between text-[11px] font-mono text-slate-300 bg-black/60 px-2 py-0.5 rounded self-end">
                    <span>Target: {expectedProductName}</span>
                  </div>
                </div>

                {/* Scanning overlay */}
                {isCounting && (
                  <div className="absolute inset-0 bg-indigo-950/80 backdrop-blur-sm flex flex-col items-center justify-center space-y-3">
                    <div className="w-12 h-12 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                    <div className="text-sm font-bold text-cyan-300 font-mono tracking-wider">
                      IDENTIFYING & COUNTING ITEMS...
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* AI Analysis Result Callout */}
          {countResult && (
            <div className="p-4 rounded-xl bg-slate-950 border border-emerald-500/50 space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black font-mono text-emerald-400">
                    {countResult.count}
                  </span>
                  <span className="text-sm font-semibold text-white">
                    {countResult.detected_product} units counted
                  </span>
                  <span className="text-xs text-slate-400 font-mono">
                    ({Math.round(countResult.confidence * 100)}% match)
                  </span>
                </div>
                {countResult.is_misplaced ? (
                  <span className="px-2.5 py-1 bg-red-600/90 text-white font-bold rounded text-xs">
                    ⚠️ Foreign item: {countResult.misplaced_item_name || 'Misplaced Product'}
                  </span>
                ) : (
                  <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold rounded text-xs">
                    ✓ Verified Shelf Stock
                  </span>
                )}
              </div>
              {countResult.notes && (
                <p className="text-xs text-slate-300 font-sans border-t border-slate-800 pt-2">
                  <strong>Inspection Notes:</strong> {countResult.notes}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="text-xs text-slate-400">
            Powered by <strong>Gemini 3.8 Flash Vision</strong> & <strong>YOLOv8</strong>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold"
            >
              Close
            </button>
            <button
              type="button"
              disabled={isCounting}
              onClick={captureFrameAndCount}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-emerald-600/30 transition-all"
            >
              📸 {isCounting ? 'Counting...' : 'Count Products Now'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
