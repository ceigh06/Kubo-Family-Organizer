import { useState, useRef, useEffect } from 'react';
import {
  Camera,
  Upload,
  RefreshCw,
  Check,
  X,
  Sparkles,
  ShieldCheck,
  ChevronRight,
  Package,
} from 'lucide-react';
import { analyzeGroceryImage, downscaleImage, type ScannedGroceryResult } from '@/ai';
import type { Member } from '@/db/schema';

const GROCERY_CATEGORIES = [
  'Produce',
  'Dairy & eggs',
  'Pantry',
  'Meat & seafood',
  'Household',
  'Snacks & drinks',
  'Other',
];

interface ScanGroceryModalProps {
  open: boolean;
  members: Member[];
  onClose: () => void;
  onConfirmItem: (item: { name: string; category: string; addedBy: string }) => void;
}

export function ScanGroceryModal({
  open,
  members,
  onClose,
  onConfirmItem,
}: ScanGroceryModalProps) {
  const [step, setStep] = useState<'camera' | 'review'>('camera');
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  // Review step form
  const [detectedName, setDetectedName] = useState('');
  const [detectedCategory, setDetectedCategory] = useState('Pantry');
  const [detectedConfidence, setDetectedConfidence] = useState(0.9);
  const [selectedMember, setSelectedMember] = useState(members[0]?.name ?? 'You');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Start camera when modal opens
  useEffect(() => {
    if (!open) {
      stopCamera();
      setStep('camera');
      setCapturedImage(null);
      return;
    }

    startCamera();

    return () => {
      stopCamera();
    };
  }, [open, facingMode]);

  async function startCamera() {
    setCameraError(null);
    stopCamera();

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError('Camera API is not supported in this browser environment.');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);
    } catch (err: any) {
      console.warn('Camera access unavailable:', err);
      setCameraActive(false);
      if (err.name === 'NotAllowedError') {
        setCameraError('Camera permission was denied. You can still import photos from your device.');
      } else {
        setCameraError('Unable to access device camera. You can import photos or try a sample item.');
      }
    }
  }

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  }

  // Capture snapshot from video element
  async function handleCapturePhoto() {
    if (!videoRef.current) return;
    setAnalyzing(true);

    try {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        setCapturedImage(dataUrl);

        // Run local vision analysis
        const result = await analyzeGroceryImage(canvas);
        setDetectedName(result.name);
        setDetectedCategory(result.category);
        setDetectedConfidence(result.confidence);
        stopCamera();
        setStep('review');
      }
    } catch (err) {
      console.error('Vision analysis error:', err);
    } finally {
      setAnalyzing(false);
    }
  }

  // Handle image import from file picker / library
  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setAnalyzing(true);
    try {
      const { canvas, dataUrl } = await downscaleImage(file);
      setCapturedImage(dataUrl);

      // Run local vision analysis strictly on visual data (no filename hints)
      const result = await analyzeGroceryImage(canvas);

      setDetectedName(result.name);
      setDetectedCategory(result.category);
      setDetectedConfidence(result.confidence);
      stopCamera();
      setStep('review');
    } catch (err) {
      console.error('File vision error:', err);
    } finally {
      setAnalyzing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  // Fast sample presets for demo/presentation testing
  async function handleSamplePreset(name: string, category: string, hint: string) {
    setAnalyzing(true);
    setCapturedImage(null);
    stopCamera();

    setTimeout(() => {
      setDetectedName(name);
      setDetectedCategory(category);
      setDetectedConfidence(0.95);
      setStep('review');
      setAnalyzing(false);
    }, 300);
  }

  function handleConfirm() {
    if (!detectedName.trim()) return;
    onConfirmItem({
      name: detectedName.trim(),
      category: detectedCategory,
      addedBy: selectedMember,
    });
    onClose();
  }

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-overlay" aria-hidden="true" onClick={onClose} />

      {/* Main Sheet */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="scan-grocery-title"
        className="fixed bottom-0 left-1/2 z-50 w-full max-w-[480px] -translate-x-1/2 rounded-t-2xl bg-card p-6 pb-[max(24px,env(safe-area-inset-bottom))] shadow-xl max-h-[92dvh] overflow-y-auto"
      >
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-secondary text-primary">
              <Camera className="size-5" />
            </span>
            <h2 id="scan-grocery-title" className="font-display text-xl font-extrabold">
              {step === 'camera' ? 'Scan grocery item' : 'Confirm detected item'}
            </h2>
          </div>
          <button
            type="button"
            className="p-1.5 rounded-full hover:bg-muted text-muted-foreground cursor-pointer"
            onClick={onClose}
            aria-label="Close scanner"
          >
            <X className="size-5" />
          </button>
        </div>

        {step === 'camera' ? (
          <div className="space-y-4">
            {/* Viewfinder frame */}
            <div className="relative w-full h-[260px] rounded-xl overflow-hidden bg-black flex items-center justify-center border border-border">
              {cameraActive ? (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                  {/* Targeting reticle */}
                  <div className="absolute inset-6 border-2 border-primary/80 rounded-xl pointer-events-none flex flex-col justify-between p-3">
                    <div className="flex justify-between">
                      <span className="size-3 border-t-2 border-l-2 border-primary" />
                      <span className="size-3 border-t-2 border-r-2 border-primary" />
                    </div>
                    <p className="text-center text-[11px] font-medium text-white/90 bg-black/50 px-2 py-0.5 rounded-full mx-auto backdrop-blur-xs">
                      Hold grocery item (e.g. Cooking oil) in frame
                    </p>
                    <div className="flex justify-between">
                      <span className="size-3 border-b-2 border-l-2 border-primary" />
                      <span className="size-3 border-b-2 border-r-2 border-primary" />
                    </div>
                  </div>

                  {/* Camera flip button */}
                  <button
                    type="button"
                    className="absolute top-3 right-3 p-2 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors cursor-pointer"
                    title="Flip camera"
                    onClick={() =>
                      setFacingMode((m) => (m === 'environment' ? 'user' : 'environment'))
                    }
                  >
                    <RefreshCw className="size-4" />
                  </button>
                </>
              ) : (
                <div className="p-5 text-center text-white/80 space-y-2">
                  <Package className="size-10 mx-auto text-primary" />
                  <p className="text-xs">{cameraError || 'Camera inactive'}</p>
                  <button
                    type="button"
                    className="text-xs font-semibold text-primary underline hover:text-primary/80 cursor-pointer"
                    onClick={startCamera}
                  >
                    Try starting camera
                  </button>
                </div>
              )}

              {analyzing && (
                <div className="absolute inset-0 bg-black/75 flex flex-col items-center justify-center text-white gap-2">
                  <Sparkles className="size-6 text-primary animate-spin" />
                  <span className="text-xs font-semibold">Running on-device vision...</span>
                </div>
              )}
            </div>

            {/* Camera Actions */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                disabled={!cameraActive || analyzing}
                className="h-12 inline-flex items-center justify-center gap-2 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handleCapturePhoto}
              >
                <Camera className="size-4" />
                Capture photo
              </button>

              <button
                type="button"
                className="h-12 inline-flex items-center justify-center gap-2 rounded-lg border border-input bg-card text-foreground font-semibold hover:bg-accent cursor-pointer transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="size-4" />
                Upload from library
              </button>
            </div>

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileSelect}
            />

            {/* Quick Demo Samples for fast testing */}
            <div className="pt-2 border-t border-border">
              <span className="text-xs font-semibold text-muted-foreground block mb-2">
                Quick test items:
              </span>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="py-1.5 px-3 rounded-full text-xs font-medium bg-secondary text-primary hover:bg-secondary/80 transition-colors cursor-pointer"
                  onClick={() =>
                    handleSamplePreset('Cooking Oil', 'Pantry', 'golden fiesta cooking oil bottle')
                  }
                >
                  🍳 Cooking Oil
                </button>
                <button
                  type="button"
                  className="py-1.5 px-3 rounded-full text-xs font-medium bg-secondary text-primary hover:bg-secondary/80 transition-colors cursor-pointer"
                  onClick={() =>
                    handleSamplePreset('Fresh Milk', 'Dairy & eggs', 'alaska fresh milk carton')
                  }
                >
                  🥛 Fresh Milk
                </button>
                <button
                  type="button"
                  className="py-1.5 px-3 rounded-full text-xs font-medium bg-secondary text-primary hover:bg-secondary/80 transition-colors cursor-pointer"
                  onClick={() =>
                    handleSamplePreset('Soy Sauce', 'Pantry', 'silver swan soy sauce')
                  }
                >
                  🧂 Soy Sauce
                </button>
                <button
                  type="button"
                  className="py-1.5 px-3 rounded-full text-xs font-medium bg-secondary text-primary hover:bg-secondary/80 transition-colors cursor-pointer"
                  onClick={() =>
                    handleSamplePreset('Eggs', 'Dairy & eggs', 'tray of brown eggs')
                  }
                >
                  🥚 Eggs
                </button>
              </div>
            </div>

            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground justify-center pt-1">
              <ShieldCheck className="size-3.5 text-primary" />
              100% on-device vision · Photos are never uploaded to the cloud
            </div>
          </div>
        ) : (
          /* Step 2: Review and Confirm */
          <div className="space-y-4">
            {/* Captured thumbnail & confidence banner */}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50 border border-secondary">
              {capturedImage ? (
                <img
                  src={capturedImage}
                  alt="Scanned item preview"
                  className="size-14 rounded-md object-cover border border-border shrink-0"
                />
              ) : (
                <div className="size-14 rounded-md bg-card grid place-items-center text-primary shrink-0 border border-border">
                  <Package className="size-6" />
                </div>
              )}
              <div className="min-w-0">
                <span className="pill-label bg-secondary text-primary font-bold inline-flex items-center gap-1 mb-1">
                  <Sparkles className="size-3" />
                  {Math.round(detectedConfidence * 100)}% Match
                </span>
                <p className="text-xs text-muted-foreground">
                  Recognized with local computer vision. Confirm before saving.
                </p>
              </div>
            </div>

            {/* Editable Confirmation Form */}
            <form
              className="grid gap-3.5"
              onSubmit={(e) => {
                e.preventDefault();
                handleConfirm();
              }}
            >
              <label className="form-field">
                Item name
                <input
                  required
                  autoFocus
                  className="h-11 w-full rounded-md border border-input bg-background px-3 text-base focus:outline-none focus:ring-1 focus:ring-ring"
                  value={detectedName}
                  onChange={(e) => setDetectedName(e.target.value)}
                  placeholder="e.g. Cooking Oil"
                />
              </label>

              <label className="form-field">
                Category
                <select
                  className="h-11 w-full rounded-lg border border-input bg-background px-3 text-base focus:outline-none focus:ring-1 focus:ring-ring"
                  value={detectedCategory}
                  onChange={(e) => setDetectedCategory(e.target.value)}
                >
                  {GROCERY_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </label>

              <label className="form-field">
                Added by
                <select
                  className="h-11 w-full rounded-lg border border-input bg-background px-3 text-base focus:outline-none focus:ring-1 focus:ring-ring"
                  value={selectedMember}
                  onChange={(e) => setSelectedMember(e.target.value)}
                >
                  <option value="You">You</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.name}>
                      {m.name} ({m.roleLabel})
                    </option>
                  ))}
                </select>
              </label>

              <div className="pt-2 flex flex-col gap-2">
                <button
                  type="submit"
                  className="h-12 w-full inline-flex items-center justify-center gap-2 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors cursor-pointer"
                >
                  <Check className="size-4" />
                  Add to grocery list
                </button>

                <button
                  type="button"
                  className="w-full text-center text-xs text-muted-foreground hover:text-foreground py-2 cursor-pointer"
                  onClick={() => {
                    setStep('camera');
                    startCamera();
                  }}
                >
                  Retake / Scan another item
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </>
  );
}
