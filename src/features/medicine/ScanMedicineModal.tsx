import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Camera,
  Upload,
  RefreshCw,
  Check,
  X,
  Sparkles,
  ChevronDown,
  ChevronUp,
  ScanLine,
  Pill,
  RotateCcw,
  RotateCw,
  FileText,
  Zap,
  Crop,
  Move,
  Maximize2,
  Sliders,
} from 'lucide-react';
import {
  scanMedicineLabel,
  parseMedicineLabel,
  cropImageCanvas,
  type ParsedMedicineDetails,
} from '@/ai/ocr';
import { downscaleImage } from '@/ai/vision';
import type { Member, Medicine } from '@/db/schema';

// ---------------------------------------------------------------------------
// Form Interface matching AddMedicineDialog
// ---------------------------------------------------------------------------
export interface ScannedMedicineForm {
  name: string;
  dosage: string;
  type: 'maintenance' | 'PRN';
  timesPerDay: number;
  scheduledTime1: string;
  scheduledTime2: string;
  instructions: string;
  stock: string;
  refillThreshold: string;
  memberId: string;
  minIntervalHours: string;
}

interface ScanMedicineModalProps {
  open: boolean;
  members: Member[];
  onClose: () => void;
  onApplyExtracted: (form: ScannedMedicineForm) => void;
  onSaveDirectly?: (medicineData: Omit<Medicine, 'id' | 'updatedAt' | 'updatedBy' | 'deleted'>) => Promise<void>;
}

// Preset samples for fast demonstration and offline testing
const PRESET_MEDICINES = [
  {
    label: 'Actimed Clopidogrel 75mg',
    category: 'Antithrombotic / Blood Thinner (Foil Blister)',
    sampleText: `Actimed\nClopidogrel\n75 mg Film-Coated Tablet\nANTITHROMBOTIC\nRx\nBatch No.: CT1045\nMfg. Date: 12/2025\nExp. Date: 05/2028`,
  },
  {
    label: 'Dapagliflozin 10mg (Dapafast)',
    category: 'Blood Glucose Control (Red Blister Strip)',
    sampleText: `DAPAGLIFLOZIN\nDAPAFAST\n10 mg Film-Coated Tablet\nBLOOD GLUCOSE-LOWERING DRUG\nRx`,
  },
  {
    label: 'Metformin HCl 500mg (Formet)',
    category: 'Blood Glucose-Lowering (Foil Blister)',
    sampleText: `DRP-1\nMETFORMIN\nHYDROCHLORIDE\nFORMET\n500 mg Film-Coated Tablet\nBLOOD GLUCOSE-LOWERING DRUG\nTake with meals\n60 Tablets`,
  },
  {
    label: 'Multivitamins + Iron (Iberet-Folic 500)',
    category: 'Iron Supplement & Folic Acid (Foil Blister)',
    sampleText: `MULTIVITAMINS\n+ IRON\nIBERET-FOLIC 500\nFILM COATED TABLET\nVITAMINS AND MINERAL\nFerrous Sulfate 525 mg\nTake 1 tablet daily\n30 Tablets`,
  },
  {
    label: 'Vitamin B-Complex (TGP 1-6-12)',
    category: 'Nerve Health B1-B6-B12 (Small Blister)',
    sampleText: `TGP\nTHIAMINE MONONITRATE\nPYRIDOXINE HYDROCHLORIDE\nCYANOCOBALAMIN\nTGP 1-6-12\n100 mg / 10 mg / 50 mcg\nTake 1 tablet daily\n30 Tablets`,
  },
  {
    label: 'Calamine Lotion 8% (60 mL)',
    category: 'JCHEMIE (Topical / Anti-pruritic)',
    sampleText: `JCHEMIE\n60 mL\nCALAMINE\n8% LOTION\nANTI-INFLAMMATORY ANTIPRURITIC\nFOR EXTERNAL USE ONLY\nManufactured by JCHEMIE LABORATORIES, INC.`,
  },
  {
    label: 'Furosemide 40mg (Uromid)',
    category: 'Diuretic / Blood Pressure (Maintenance)',
    sampleText: `AMB\nFUROSEMIDE\nUROMID Rx\n40 mg Tablet\nBox of 20 Tablets`,
  },
  {
    label: 'Amlodipine Besylate 5mg (Lodibes)',
    category: 'Hypertension (Maintenance)',
    sampleText: `AMLODIPINE\nLODIBES Rx\n5 mg Film-Coated Tablet\nTake 1 tablet daily\n30 Tablets`,
  },
  {
    label: 'Biogesic (Paracetamol 500mg)',
    category: 'Fever & Pain (PRN)',
    sampleText: `UNILAB, Inc.\nPARACETAMOL\nBIOGESIC®\n500 mg TABLET\nTake 1 tablet every 4 hours as needed\n20 Tablets`,
  },
  {
    label: 'Losartan Potassium 50mg',
    category: 'Hypertension (Maintenance)',
    sampleText: `LOSARTAN POTASSIUM\n50 mg Film-Coated Tablet\nAntihypertensive Maintenance Dose\nTake 1 tablet once daily in the morning with water\nBox of 30 Tablets`,
  },
  {
    label: 'Amoxicillin 500mg',
    category: 'Antibiotic (3x daily)',
    sampleText: `AMOXICILLIN\n500mg Capsules\nTake 1 capsule every 8 hours with meals\nComplete the full 7-day course\n21 Capsules`,
  },
  {
    label: 'Neozep Forte',
    category: 'Cold & Sinus (PRN)',
    sampleText: `NEOZEP FORTE\nPhenylephrine HCl + Chlorphenamine Maleate + Paracetamol\nRelief of clogged nose, runny nose, and sneezing\nTake 1 tablet every 6 hours as needed\n10 Tablets`,
  },
];

interface CropBox {
  x: number; // 0 to 1
  y: number; // 0 to 1
  width: number; // 0 to 1
  height: number; // 0 to 1
}

type DragMode = 'move' | 'nw' | 'ne' | 'se' | 'sw' | null;

export function ScanMedicineModal({
  open,
  members,
  onClose,
  onApplyExtracted,
  onSaveDirectly,
}: ScanMedicineModalProps) {
  // Step state: capture -> crop -> processing -> review
  const [step, setStep] = useState<'capture' | 'crop' | 'processing' | 'review'>('capture');
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [zoomLevel, setZoomLevel] = useState<1 | 2>(1);

  // Cropper state
  const [cropBox, setCropBox] = useState<CropBox>({ x: 0.18, y: 0.22, width: 0.64, height: 0.56 });
  const [cropRotation, setCropRotation] = useState<number>(0);
  const [invertPreview, setInvertPreview] = useState<boolean>(false);
  const [highContrastPreview, setHighContrastPreview] = useState<boolean>(false);
  const rawImageCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const cropperContainerRef = useRef<HTMLDivElement | null>(null);
  const dragInfoRef = useRef<{
    mode: DragMode;
    startX: number;
    startY: number;
    startBox: CropBox;
  } | null>(null);

  // Processing state
  const [progressStatus, setProgressStatus] = useState<string>('Preparing OCR engine...');
  const [progressValue, setProgressValue] = useState<number>(0.1);

  // Parsed details & Review Form
  const [parsedResult, setParsedResult] = useState<ParsedMedicineDetails | null>(null);
  const [showRawText, setShowRawText] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Editable review fields
  const [reviewForm, setReviewForm] = useState<ScannedMedicineForm>({
    name: '',
    dosage: '500 mg · 1 tablet',
    type: 'maintenance',
    timesPerDay: 1,
    scheduledTime1: '08:00',
    scheduledTime2: '20:00',
    instructions: 'Take with water after meals',
    stock: '30',
    refillThreshold: '7',
    memberId: members[0]?.id ?? 'me',
    minIntervalHours: '4',
  });

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Start / stop camera on open
  useEffect(() => {
    if (!open) {
      stopCamera();
      setStep('capture');
      setCapturedImage(null);
      rawImageCanvasRef.current = null;
      setParsedResult(null);
      setShowRawText(false);
      setCropRotation(0);
      setInvertPreview(false);
      setHighContrastPreview(false);
      return;
    }

    if (step === 'capture') {
      startCamera();
    }

    return () => {
      stopCamera();
    };
  }, [open, facingMode]);

  async function startCamera() {
    setCameraError(null);
    stopCamera();

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError('Camera is not supported on this browser. You can upload a photo or use a sample preset.');
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

      const track = stream.getVideoTracks()[0];
      const capabilities = (track as any)?.getCapabilities?.();
      if (capabilities && 'torch' in capabilities) {
        setTorchAvailable(true);
      } else {
        setTorchAvailable(false);
      }
    } catch (err: any) {
      console.warn('Camera stream error:', err);
      setCameraActive(false);
      setTorchAvailable(false);
      if (err.name === 'NotAllowedError') {
        setCameraError('Camera access was denied. Please allow camera permissions or upload an image.');
      } else {
        setCameraError('Unable to open camera stream. You can upload an image or select a sample preset.');
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
    setTorchOn(false);
    setTorchAvailable(false);
  }

  function toggleCamera() {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  }

  async function toggleTorch() {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (!track) return;
    try {
      const next = !torchOn;
      await (track as any).applyConstraints({
        advanced: [{ torch: next }],
      });
      setTorchOn(next);
    } catch (e) {
      console.warn('Could not toggle torch:', e);
    }
  }

  // Populate review form from parsed details
  function populateReviewForm(details: ParsedMedicineDetails) {
    setParsedResult(details);
    setReviewForm({
      name: details.name,
      dosage: details.dosage,
      type: details.type,
      timesPerDay: details.timesPerDay,
      scheduledTime1: details.scheduledTime1,
      scheduledTime2: details.scheduledTime2,
      instructions: details.instructions,
      stock: details.stock,
      refillThreshold: details.refillThreshold,
      memberId: members[0]?.id ?? 'me',
      minIntervalHours: details.minIntervalHours,
    });
  }

  // Helper to run automatic local AI crop & OCR scanning on any source canvas
  async function runAutoScan(sourceCanvas: HTMLCanvasElement) {
    setStep('processing');
    setProgressStatus('AI locating medicine in photo...');
    setProgressValue(0.12);
    stopCamera();

    try {
      const rawText = await scanMedicineLabel(sourceCanvas, {
        autoCrop: true,
        onProgress: (p) => {
          setProgressStatus(p.status);
          setProgressValue(p.progress);
        },
        onAutoCropped: (croppedCanvas, box) => {
          // Instantly update the captured preview to the focused medicine packet
          setCapturedImage(croppedCanvas.toDataURL('image/jpeg', 0.9));
          setCropBox(box);
        },
      });

      const parsed = parseMedicineLabel(rawText);
      populateReviewForm(parsed);
      setStep('review');
    } catch (err) {
      console.error('Auto OCR scan error:', err);
      populateReviewForm({
        rawText: 'Text recognition could not detect clear words. Please confirm details below.',
        name: 'Scanned Medicine',
        dosage: '500 mg · 1 tablet',
        type: 'maintenance',
        timesPerDay: 1,
        scheduledTime1: '08:00',
        scheduledTime2: '20:00',
        instructions: 'Take with water after meals',
        stock: '30',
        refillThreshold: '7',
        minIntervalHours: '4',
        confidence: 0.35,
      });
      setStep('review');
    }
  }

  // Handle Photo Capture from Camera Viewfinder -> AI auto-crops & scans directly!
  async function handleCapturePhoto() {
    if (!videoRef.current) return;
    try {
      const video = videoRef.current;
      const vWidth = video.videoWidth || 640;
      const vHeight = video.videoHeight || 480;

      const canvas = document.createElement('canvas');
      canvas.width = vWidth;
      canvas.height = vHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not get canvas context');
      ctx.drawImage(video, 0, 0, vWidth, vHeight);

      rawImageCanvasRef.current = canvas;
      setCapturedImage(canvas.toDataURL('image/jpeg', 0.85));
      await runAutoScan(canvas);
    } catch (err) {
      console.error('Photo capture error:', err);
    }
  }

  // Handle File Upload from Device -> AI auto-crops & scans directly!
  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { canvas, dataUrl } = await downscaleImage(file);
      rawImageCanvasRef.current = canvas;
      setCapturedImage(dataUrl);
      await runAutoScan(canvas);
    } catch (err) {
      console.error('File select error:', err);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  // -------------------------------------------------------------------------
  // Interactive Cropper Mouse & Touch Handlers
  // -------------------------------------------------------------------------
  const handlePointerDown = (e: React.PointerEvent, mode: DragMode) => {
    e.preventDefault();
    e.stopPropagation();
    if (!cropperContainerRef.current) return;

    const rect = cropperContainerRef.current.getBoundingClientRect();
    const clientX = e.clientX;
    const clientY = e.clientY;
    const normX = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const normY = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));

    dragInfoRef.current = {
      mode,
      startX: normX,
      startY: normY,
      startBox: { ...cropBox },
    };

    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragInfoRef.current || !cropperContainerRef.current) return;
    e.preventDefault();

    const rect = cropperContainerRef.current.getBoundingClientRect();
    const clientX = e.clientX;
    const clientY = e.clientY;
    const normX = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const normY = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));

    const { mode, startX, startY, startBox } = dragInfoRef.current;
    const dx = normX - startX;
    const dy = normY - startY;

    if (mode === 'move') {
      const newX = Math.max(0, Math.min(1 - startBox.width, startBox.x + dx));
      const newY = Math.max(0, Math.min(1 - startBox.height, startBox.y + dy));
      setCropBox({ ...startBox, x: newX, y: newY });
    } else if (mode === 'se') {
      const newW = Math.max(0.12, Math.min(1 - startBox.x, startBox.width + dx));
      const newH = Math.max(0.12, Math.min(1 - startBox.y, startBox.height + dy));
      setCropBox({ ...startBox, width: newW, height: newH });
    } else if (mode === 'sw') {
      const maxDx = startBox.width - 0.12;
      const actualDx = Math.max(-startBox.x, Math.min(maxDx, dx));
      const newX = startBox.x + actualDx;
      const newW = startBox.width - actualDx;
      const newH = Math.max(0.12, Math.min(1 - startBox.y, startBox.height + dy));
      setCropBox({ ...startBox, x: newX, width: newW, height: newH });
    } else if (mode === 'ne') {
      const maxDy = startBox.height - 0.12;
      const actualDy = Math.max(-startBox.y, Math.min(maxDy, dy));
      const newY = startBox.y + actualDy;
      const newH = startBox.height - actualDy;
      const newW = Math.max(0.12, Math.min(1 - startBox.x, startBox.width + dx));
      setCropBox({ ...startBox, y: newY, width: newW, height: newH });
    } else if (mode === 'nw') {
      const maxDx = startBox.width - 0.12;
      const maxDy = startBox.height - 0.12;
      const actualDx = Math.max(-startBox.x, Math.min(maxDx, dx));
      const actualDy = Math.max(-startBox.y, Math.min(maxDy, dy));
      setCropBox({
        x: startBox.x + actualDx,
        y: startBox.y + actualDy,
        width: startBox.width - actualDx,
        height: startBox.height - actualDy,
      });
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    dragInfoRef.current = null;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
  };

  // Perform Scan on Cropped Selection
  async function handleConfirmCropAndScan() {
    if (!rawImageCanvasRef.current) return;
    setStep('processing');
    setProgressStatus('Extracting cropped medicine region...');
    setProgressValue(0.15);

    try {
      const rawCanvas = rawImageCanvasRef.current;
      const pixelX = Math.round(cropBox.x * rawCanvas.width);
      const pixelY = Math.round(cropBox.y * rawCanvas.height);
      const pixelW = Math.round(cropBox.width * rawCanvas.width);
      const pixelH = Math.round(cropBox.height * rawCanvas.height);

      // Crop the high-res canvas with user rotation
      const croppedCanvas = cropImageCanvas(rawCanvas, {
        x: pixelX,
        y: pixelY,
        width: pixelW,
        height: pixelH,
        rotation: cropRotation,
      });

      // Update capturedImage preview to the tight crop
      setCapturedImage(croppedCanvas.toDataURL('image/jpeg', 0.9));

      // Run adaptive multi-pass OCR on cropped canvas
      const rawText = await scanMedicineLabel(croppedCanvas, {
        onProgress: (p) => {
          setProgressStatus(p.status);
          setProgressValue(p.progress);
        },
      });

      const parsed = parseMedicineLabel(rawText);
      populateReviewForm(parsed);
      setStep('review');
    } catch (err) {
      console.error('Cropped OCR scan error:', err);
      populateReviewForm({
        rawText: 'Text recognition could not detect clear words. Please confirm details below.',
        name: 'Scanned Medicine',
        dosage: '500 mg · 1 tablet',
        type: 'maintenance',
        timesPerDay: 1,
        scheduledTime1: '08:00',
        scheduledTime2: '20:00',
        instructions: 'Take with water after meals',
        stock: '30',
        refillThreshold: '7',
        minIntervalHours: '4',
        confidence: 0.3,
      });
      setStep('review');
    }
  }

  // Handle Sample Preset Selection (Immediate testing)
  async function handleSelectPreset(preset: typeof PRESET_MEDICINES[0]) {
    setStep('processing');
    setProgressStatus(`Loading preset for ${preset.label}...`);
    setProgressValue(0.3);
    stopCamera();
    setCapturedImage(null);

    setTimeout(() => {
      setProgressStatus('Parsing prescription text and dosage...');
      setProgressValue(0.7);

      setTimeout(() => {
        const parsed = parseMedicineLabel(preset.sampleText);
        populateReviewForm(parsed);
        setStep('review');
      }, 250);
    }, 200);
  }

  // Confirm directly and save into cabinet
  async function handleConfirmAndSave() {
    if (!reviewForm.name.trim()) return;
    setIsSaving(true);

    try {
      const scheduledTimes: string[] = [];
      if (reviewForm.type === 'maintenance') {
        scheduledTimes.push(reviewForm.scheduledTime1);
        if (reviewForm.timesPerDay >= 2 && reviewForm.scheduledTime2) {
          scheduledTimes.push(reviewForm.scheduledTime2);
        }
      }

      if (onSaveDirectly) {
        await onSaveDirectly({
          memberId: reviewForm.memberId,
          name: reviewForm.name.trim(),
          dosage: reviewForm.dosage.trim(),
          type: reviewForm.type,
          timesPerDay: reviewForm.timesPerDay,
          scheduledTimes: scheduledTimes.length > 0 ? scheduledTimes : undefined,
          instructions: reviewForm.instructions.trim(),
          stock: parseInt(reviewForm.stock, 10) || 30,
          refillThreshold: parseInt(reviewForm.refillThreshold, 10) || 7,
          minIntervalHours: parseInt(reviewForm.minIntervalHours, 10) || 4,
        });
      } else {
        onApplyExtracted(reviewForm);
      }
      onClose();
    } catch (err) {
      console.error('Error saving scanned medicine:', err);
    } finally {
      setIsSaving(false);
    }
  }

  // Forward to full add dialog
  function handleOpenInFullForm() {
    onApplyExtracted(reviewForm);
    onClose();
  }

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-overlay" aria-hidden="true" onClick={onClose} />

      {/* Main Bottom Sheet */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="scan-medicine-title"
        className="fixed bottom-0 left-1/2 z-50 w-full max-w-[480px] -translate-x-1/2 rounded-t-2xl bg-card p-6 pb-[max(24px,env(safe-area-inset-bottom))] shadow-xl max-h-[92dvh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-secondary text-primary">
              {step === 'crop' ? <Crop className="size-5" /> : <ScanLine className="size-5" />}
            </span>
            <div>
              <h2 id="scan-medicine-title" className="font-display text-lg font-bold">
                {step === 'capture'
                  ? 'Scan medicine box or prescription'
                  : step === 'crop'
                  ? 'Crop & Focus Medicine'
                  : step === 'processing'
                  ? 'Analyzing label...'
                  : 'Review detected medicine'}
              </h2>
              <p className="text-xs text-muted-foreground">
                {step === 'capture'
                  ? 'Local AI extracts dosage, schedule, and name'
                  : step === 'crop'
                  ? 'Drag box over medicine label to isolate text from background'
                  : step === 'processing'
                  ? 'Running multi-pass on-device OCR inference'
                  : 'AI proposes, human confirms'}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="p-1.5 rounded-full text-muted-foreground hover:text-foreground cursor-pointer"
            onClick={onClose}
            aria-label="Close scanner"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* STEP 1: CAPTURE VIEW */}
        {step === 'capture' && (
          <div className="space-y-4">
            {/* Viewfinder Frame */}
            <div className="relative aspect-4/3 w-full rounded-xl overflow-hidden bg-slate-900 flex items-center justify-center border border-border">
              {cameraActive ? (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                  {/* Targeting frame & reticle overlay */}
                  <div className="absolute inset-4 rounded-lg border-2 border-dashed border-white/60 pointer-events-none flex flex-col justify-between p-3">
                    <div className="flex justify-between items-start">
                      <span className="bg-black/60 text-white text-[10px] font-semibold px-2 py-0.5 rounded-md backdrop-blur-xs flex items-center gap-1">
                        <Sparkles className="size-3 text-peach" /> On-Device OCR
                      </span>
                      <div className="flex items-center gap-1.5 pointer-events-auto">
                        <button
                          type="button"
                          onClick={() => setZoomLevel((z) => (z === 1 ? 2 : 1))}
                          className={`px-2 py-1 rounded-md text-[11px] font-bold transition-colors ${
                            zoomLevel === 2
                              ? 'bg-primary text-primary-foreground shadow-xs'
                              : 'bg-black/60 text-white hover:bg-black/80'
                          }`}
                          title="Toggle 1x / 2x focus zoom"
                        >
                          {zoomLevel}x
                        </button>
                        {torchAvailable && (
                          <button
                            type="button"
                            onClick={toggleTorch}
                            className={`p-1.5 rounded-md transition-colors ${
                              torchOn
                                ? 'bg-amber-400 text-slate-900 font-bold shadow-xs'
                                : 'bg-black/60 text-white hover:bg-black/80'
                            }`}
                            title={torchOn ? 'Turn flashlight off' : 'Turn flashlight on'}
                          >
                            <Zap className="size-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={toggleCamera}
                          className="bg-black/60 text-white p-1.5 rounded-md hover:bg-black/80 transition-colors"
                          title="Switch camera"
                        >
                          <RotateCcw className="size-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="text-center">
                      <span className="bg-black/60 text-white text-[11px] font-medium px-2.5 py-1 rounded-full backdrop-blur-xs">
                        Center medicine label in frame
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="p-6 text-center text-white/80 space-y-2">
                  <div className="mx-auto w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
                    <Pill className="size-6 text-white" />
                  </div>
                  <p className="text-xs max-w-[260px] mx-auto text-white/70">
                    {cameraError || 'Camera inactive. You can snap a photo, upload an image, or pick a sample preset.'}
                  </p>
                </div>
              )}
            </div>

            {/* Quality Tip */}
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/60 text-muted-foreground text-[11px] border border-border/70">
              <Sparkles className="size-3.5 text-primary shrink-0" />
              <span><strong>Smart AI Auto-Crop:</strong> The on-device AI automatically finds and isolates the medicine packet for crisp OCR.</span>
            </div>

            {/* Camera / Shutter Controls */}
            {cameraActive && (
              <button
                type="button"
                className="h-12 w-full inline-flex items-center justify-center gap-2 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors cursor-pointer text-sm shadow-sm"
                onClick={handleCapturePhoto}
              >
                <Camera className="size-5" />
                Snap photo of medicine
              </button>
            )}

            {/* Photo Upload Option */}
            <div>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept="image/*"
                onChange={handleFileSelect}
              />
              <button
                type="button"
                className="h-11 w-full inline-flex items-center justify-center gap-2 rounded-lg border border-input bg-card text-foreground font-semibold hover:bg-accent transition-colors cursor-pointer text-sm"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="size-4" />
                Upload photo from library
              </button>
            </div>

            {/* Presets Band for Instant Demo Testing */}
            <div className="pt-2 border-t border-border">
              <span className="text-xs font-semibold text-muted-foreground block mb-2">
                Quick test presets (Philippine medications):
              </span>
              <div className="grid grid-cols-1 gap-1.5 max-h-48 overflow-y-auto pr-1">
                {PRESET_MEDICINES.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectPreset(preset)}
                    className="flex items-center justify-between p-2.5 rounded-lg border border-border/80 bg-muted/40 hover:bg-muted text-left text-xs transition-colors cursor-pointer"
                  >
                    <div className="min-w-0 pr-2">
                      <div className="font-semibold text-foreground truncate">{preset.label}</div>
                      <div className="text-[11px] text-muted-foreground truncate">{preset.category}</div>
                    </div>
                    <span className="shrink-0 text-primary font-medium text-[11px] flex items-center gap-1">
                      Test <Sparkles className="size-3" />
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Manual entry fallback */}
            <button
              type="button"
              className="w-full text-center text-xs font-semibold text-primary underline-offset-4 hover:underline py-1 cursor-pointer block"
              onClick={() => {
                onClose();
                onApplyExtracted({
                  name: '',
                  dosage: '500 mg · 1 tablet',
                  type: 'maintenance',
                  timesPerDay: 1,
                  scheduledTime1: '08:00',
                  scheduledTime2: '20:00',
                  instructions: 'Take with water after meals',
                  stock: '30',
                  refillThreshold: '7',
                  memberId: members[0]?.id ?? 'me',
                  minIntervalHours: '4',
                });
              }}
            >
              Enter medicine manually instead
            </button>
          </div>
        )}

        {/* STEP 2: INTERACTIVE CROP STEP */}
        {step === 'crop' && (
          <div className="space-y-4">
            {/* Viewfinder with interactive crop box */}
            <div
              ref={cropperContainerRef}
              className="relative w-full aspect-4/5 max-h-[46vh] rounded-xl overflow-hidden bg-slate-950 flex items-center justify-center border border-border select-none touch-none"
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
            >
              {capturedImage && (
                <img
                  src={capturedImage}
                  alt="Medicine label to crop"
                  className={`w-full h-full object-contain pointer-events-none transition-transform duration-200 ${
                    invertPreview ? 'invert' : ''
                  } ${highContrastPreview ? 'contrast-150 brightness-110' : ''}`}
                  style={{
                    transform: `rotate(${cropRotation}deg)`,
                  }}
                />
              )}

              {/* Shaded backdrop outside crop area (clip-path emulation with SVG/divs) */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: 'rgba(0, 0, 0, 0.45)',
                }}
              />

              {/* Glowing active crop box */}
              <div
                className="absolute border-2 border-emerald-400 rounded-sm shadow-[0_0_15px_rgba(52,211,153,0.45)] cursor-move transition-shadow"
                style={{
                  left: `${cropBox.x * 100}%`,
                  top: `${cropBox.y * 100}%`,
                  width: `${cropBox.width * 100}%`,
                  height: `${cropBox.height * 100}%`,
                  boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.55)',
                }}
                onPointerDown={(e) => handlePointerDown(e, 'move')}
              >
                {/* Rule-of-thirds grid lines */}
                <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none opacity-40">
                  <div className="border-r border-b border-white/40" />
                  <div className="border-r border-b border-white/40" />
                  <div className="border-b border-white/40" />
                  <div className="border-r border-b border-white/40" />
                  <div className="border-r border-b border-white/40" />
                  <div className="border-b border-white/40" />
                  <div className="border-r border-white/40" />
                  <div className="border-r border-white/40" />
                  <div />
                </div>

                {/* Center Move Indicator badge */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-60">
                  <span className="p-1 rounded-full bg-black/60 text-white text-[10px] flex items-center gap-1 backdrop-blur-xs">
                    <Move className="size-3" /> Drag to position
                  </span>
                </div>

                {/* 4 Corner Resize Handles */}
                <div
                  className="absolute -top-2.5 -left-2.5 size-5 rounded-full bg-emerald-400 border-2 border-white shadow-md cursor-nw-resize pointer-events-auto"
                  onPointerDown={(e) => handlePointerDown(e, 'nw')}
                />
                <div
                  className="absolute -top-2.5 -right-2.5 size-5 rounded-full bg-emerald-400 border-2 border-white shadow-md cursor-ne-resize pointer-events-auto"
                  onPointerDown={(e) => handlePointerDown(e, 'ne')}
                />
                <div
                  className="absolute -bottom-2.5 -left-2.5 size-5 rounded-full bg-emerald-400 border-2 border-white shadow-md cursor-sw-resize pointer-events-auto"
                  onPointerDown={(e) => handlePointerDown(e, 'sw')}
                />
                <div
                  className="absolute -bottom-2.5 -right-2.5 size-5 rounded-full bg-emerald-400 border-2 border-white shadow-md cursor-se-resize pointer-events-auto"
                  onPointerDown={(e) => handlePointerDown(e, 'se')}
                />
              </div>
            </div>

            {/* Quick Crop Presets & Image Tools Toolbar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground font-semibold">Quick crop presets:</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setCropBox({ x: 0.30, y: 0.30, width: 0.40, height: 0.40 })}
                    className="px-2 py-1 rounded-md bg-secondary text-foreground text-[11px] font-medium hover:bg-secondary/80 transition-colors"
                  >
                    Tight (40%)
                  </button>
                  <button
                    type="button"
                    onClick={() => setCropBox({ x: 0.18, y: 0.22, width: 0.64, height: 0.56 })}
                    className="px-2 py-1 rounded-md bg-secondary text-foreground text-[11px] font-medium hover:bg-secondary/80 transition-colors"
                  >
                    Center (64%)
                  </button>
                  <button
                    type="button"
                    onClick={() => setCropBox({ x: 0.05, y: 0.05, width: 0.90, height: 0.90 })}
                    className="px-2 py-1 rounded-md bg-secondary text-foreground text-[11px] font-medium hover:bg-secondary/80 transition-colors"
                  >
                    Full
                  </button>
                </div>
              </div>

              {/* Rotation & Contrast Controls */}
              <div className="flex items-center justify-between gap-1.5 pt-1 border-t border-border">
                <button
                  type="button"
                  onClick={() => setCropRotation((r) => (r + 90) % 360)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-muted transition-colors cursor-pointer"
                  title="Rotate image 90 degrees"
                >
                  <RotateCw className="size-3.5 text-primary" /> Rotate 90°
                </button>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setInvertPreview((v) => !v)}
                    className={`px-2 py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                      invertPreview
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'border-border text-muted-foreground hover:bg-muted'
                    }`}
                    title="Invert dark / metallic foil"
                  >
                    Invert Foil
                  </button>
                  <button
                    type="button"
                    onClick={() => setHighContrastPreview((v) => !v)}
                    className={`px-2 py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                      highContrastPreview
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'border-border text-muted-foreground hover:bg-muted'
                    }`}
                    title="Boost contrast"
                  >
                    Contrast
                  </button>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                className="h-11 inline-flex items-center justify-center gap-2 rounded-lg border border-input bg-card text-foreground font-semibold hover:bg-accent transition-colors cursor-pointer text-sm"
                onClick={() => {
                  setStep('capture');
                  startCamera();
                }}
              >
                <RotateCcw className="size-4" />
                Retake
              </button>

              <button
                type="button"
                className="h-11 inline-flex items-center justify-center gap-2 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors cursor-pointer text-sm shadow-sm"
                onClick={handleConfirmCropAndScan}
              >
                <ScanLine className="size-4" />
                Scan Cropped
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: PROCESSING / OCR INFERENCE */}
        {step === 'processing' && (
          <div className="py-10 text-center space-y-5">
            {capturedImage ? (
              <div className="relative mx-auto w-24 h-24 rounded-lg overflow-hidden border border-border shadow-md">
                <img src={capturedImage} alt="Captured label" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-primary/20 animate-pulse" />
              </div>
            ) : (
              <div className="mx-auto w-16 h-16 rounded-full bg-secondary flex items-center justify-center">
                <RefreshCw className="size-8 text-primary animate-spin" />
              </div>
            )}

            <div>
              <h3 className="font-bold text-base text-foreground mb-1">
                Scanning cropped medicine...
              </h3>
              <p className="text-xs text-muted-foreground">{progressStatus}</p>
            </div>

            {/* Progress Bar */}
            <div className="w-48 mx-auto bg-muted rounded-full h-2 overflow-hidden">
              <div
                className="bg-primary h-full transition-all duration-300 rounded-full"
                style={{ width: `${Math.round(progressValue * 100)}%` }}
              />
            </div>

            <p className="text-[11px] text-muted-foreground max-w-[260px] mx-auto">
              100% private and on-device. Images never leave your device.
            </p>

            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground cursor-pointer underline"
              onClick={() => (rawImageCanvasRef.current ? setStep('crop') : setStep('capture'))}
            >
              Cancel
            </button>
          </div>
        )}

        {/* STEP 4: REVIEW & CONFIRM STEP */}
        {step === 'review' && (
          <div className="space-y-4">
            {/* Confidence & Status Banner + Adjust Crop Button */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/80 border border-secondary text-primary">
              <div className="flex items-center gap-2">
                <Check className="size-4 shrink-0" />
                <div>
                  <span className="text-xs font-bold block">Extraction ready</span>
                  <span className="text-[11px] opacity-80">
                    {parsedResult?.matchedCatalogItem
                      ? `Catalog match: ${parsedResult.matchedCatalogItem}`
                      : 'Extracted from physical label'}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {rawImageCanvasRef.current && (
                  <button
                    type="button"
                    onClick={() => setStep('crop')}
                    className="text-[11px] font-semibold px-2 py-1 rounded-md bg-card text-foreground hover:bg-muted border border-border shadow-xs flex items-center gap-1 transition-colors cursor-pointer"
                    title="Adjust crop rectangle"
                  >
                    <Crop className="size-3 text-primary" /> Adjust Crop
                  </button>
                )}
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-card shadow-xs">
                  {Math.round((parsedResult?.confidence || 0.85) * 100)}% match
                </span>
              </div>
            </div>

            {/* Form Fields for Review */}
            <form
              className="grid gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                handleConfirmAndSave();
              }}
            >
              <label className="form-field">
                Medicine Name
                <input
                  required
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring font-medium"
                  value={reviewForm.name}
                  onChange={(e) => setReviewForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Biogesic, Losartan, Clopidogrel"
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="form-field">
                  Dosage
                  <input
                    required
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring font-medium"
                    value={reviewForm.dosage}
                    onChange={(e) => setReviewForm((f) => ({ ...f, dosage: e.target.value }))}
                    placeholder="e.g. 500 mg · 1 tablet"
                  />
                </label>

                <label className="form-field">
                  Family member
                  <select
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                    value={reviewForm.memberId}
                    onChange={(e) => setReviewForm((f) => ({ ...f, memberId: e.target.value }))}
                  >
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} · {m.roleLabel}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {/* Type Switcher */}
              <div className="segmented">
                <button
                  type="button"
                  className={
                    reviewForm.type === 'maintenance'
                      ? 'py-1.5 px-3 text-xs font-semibold rounded-md bg-card text-foreground shadow-xs cursor-pointer'
                      : 'py-1.5 px-3 text-xs font-medium rounded-md text-muted-foreground hover:text-foreground cursor-pointer'
                  }
                  onClick={() => setReviewForm((f) => ({ ...f, type: 'maintenance' }))}
                >
                  Maintenance (Daily schedule)
                </button>
                <button
                  type="button"
                  className={
                    reviewForm.type === 'PRN'
                      ? 'py-1.5 px-3 text-xs font-semibold rounded-md bg-card text-foreground shadow-xs cursor-pointer'
                      : 'py-1.5 px-3 text-xs font-medium rounded-md text-muted-foreground hover:text-foreground cursor-pointer'
                  }
                  onClick={() => setReviewForm((f) => ({ ...f, type: 'PRN' }))}
                >
                  PRN (As needed)
                </button>
              </div>

              {/* Schedule details based on type */}
              {reviewForm.type === 'maintenance' ? (
                <div className="grid grid-cols-2 gap-3">
                  <label className="form-field">
                    Daily frequency
                    <select
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                      value={reviewForm.timesPerDay}
                      onChange={(e) =>
                        setReviewForm((f) => ({ ...f, timesPerDay: Number(e.target.value) }))
                      }
                    >
                      <option value={1}>1 time daily</option>
                      <option value={2}>2 times daily</option>
                      <option value={3}>3 times daily</option>
                    </select>
                  </label>

                  <label className="form-field">
                    Dose time
                    <input
                      type="time"
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                      value={reviewForm.scheduledTime1}
                      onChange={(e) =>
                        setReviewForm((f) => ({ ...f, scheduledTime1: e.target.value }))
                      }
                    />
                  </label>
                </div>
              ) : (
                <label className="form-field">
                  Minimum interval between doses (hours)
                  <input
                    type="number"
                    min={1}
                    max={24}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                    value={reviewForm.minIntervalHours}
                    onChange={(e) =>
                      setReviewForm((f) => ({ ...f, minIntervalHours: e.target.value }))
                    }
                  />
                </label>
              )}

              <label className="form-field">
                Instructions
                <input
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  value={reviewForm.instructions}
                  onChange={(e) =>
                    setReviewForm((f) => ({ ...f, instructions: e.target.value }))
                  }
                  placeholder="e.g. Take with water after meals"
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="form-field">
                  Current stock
                  <input
                    type="number"
                    min={0}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                    value={reviewForm.stock}
                    onChange={(e) => setReviewForm((f) => ({ ...f, stock: e.target.value }))}
                  />
                </label>
                <label className="form-field">
                  Refill threshold
                  <input
                    type="number"
                    min={1}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                    value={reviewForm.refillThreshold}
                    onChange={(e) =>
                      setReviewForm((f) => ({ ...f, refillThreshold: e.target.value }))
                    }
                  />
                </label>
              </div>

              {/* Collapsible Raw OCR inspection for full transparency */}
              {parsedResult?.rawText && (
                <div className="border border-border rounded-lg p-2.5 bg-muted/30">
                  <button
                    type="button"
                    className="w-full flex items-center justify-between text-xs font-medium text-muted-foreground hover:text-foreground cursor-pointer"
                    onClick={() => setShowRawText((v) => !v)}
                  >
                    <span className="flex items-center gap-1.5">
                      <FileText className="size-3.5" /> Raw OCR text detected
                    </span>
                    {showRawText ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                  </button>
                  {showRawText && (
                    <div className="mt-2 text-[11px] font-mono text-muted-foreground whitespace-pre-wrap max-h-24 overflow-y-auto bg-background p-2 rounded border border-border">
                      {parsedResult.rawText}
                    </div>
                  )}
                </div>
              )}

              {/* Action buttons */}
              <div className="grid gap-2 pt-2">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="h-11 w-full inline-flex items-center justify-center gap-2 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors cursor-pointer text-sm shadow-xs"
                >
                  {isSaving ? (
                    <RefreshCw className="size-4 animate-spin" />
                  ) : (
                    <Check className="size-4" />
                  )}
                  {isSaving ? 'Adding to cabinet...' : 'Confirm & add to cabinet'}
                </button>

                <div className="flex items-center justify-between text-xs pt-1">
                  <button
                    type="button"
                    className="text-primary font-medium hover:underline cursor-pointer"
                    onClick={handleOpenInFullForm}
                  >
                    Edit in full dialog
                  </button>
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground cursor-pointer"
                    onClick={() => {
                      setStep('capture');
                      startCamera();
                    }}
                  >
                    Scan another label
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}
      </div>
    </>
  );
}
