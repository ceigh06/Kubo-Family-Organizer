import * as ort from 'onnxruntime-web';
import { ScannedGroceryResult } from './vision';

ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/';

const COCO_CLASSES = [
  'person', 'bicycle', 'car', 'motorcycle', 'airplane', 'bus', 'train', 'truck', 'boat', 'traffic light',
  'fire hydrant', 'stop sign', 'parking meter', 'bench', 'bird', 'cat', 'dog', 'horse', 'sheep', 'cow',
  'elephant', 'bear', 'zebra', 'giraffe', 'backpack', 'umbrella', 'handbag', 'tie', 'suitcase', 'frisbee',
  'skis', 'snowboard', 'sports ball', 'kite', 'baseball bat', 'baseball glove', 'skateboard', 'surfboard',
  'tennis racket', 'bottle', 'wine glass', 'cup', 'fork', 'knife', 'spoon', 'bowl', 'banana', 'apple',
  'sandwich', 'orange', 'broccoli', 'carrot', 'hot dog', 'pizza', 'donut', 'cake', 'chair', 'couch',
  'potted plant', 'bed', 'dining table', 'toilet', 'tv', 'laptop', 'mouse', 'remote', 'keyboard', 'cell phone',
  'microwave', 'oven', 'toaster', 'sink', 'refrigerator', 'book', 'clock', 'vase', 'scissors', 'teddy bear',
  'hair drier', 'toothbrush'
];

export async function detectYoloObjects(
  imageSource: HTMLCanvasElement,
  modelPath: string = '/yolov8n.onnx',
  confidenceThreshold = 0.25,
  iouThreshold = 0.45
): Promise<ScannedGroceryResult[]> {
  try {
    const session = await ort.InferenceSession.create(modelPath);

    // 1. Preprocess the image
    const [inputTensor, scaledWidth, scaledHeight] = preprocess(imageSource, 640);

    // 2. Run inference
    const results = await session.run({ images: inputTensor });
    const output = results.output0; // YOLOv8/11 standard output name is output0

    // 3. Postprocess
    const detections = postprocess(
      output,
      confidenceThreshold,
      iouThreshold,
      scaledWidth,
      scaledHeight,
      imageSource.width,
      imageSource.height
    );

    return detections.map(d => ({
      name: COCO_CLASSES[d.classId] ? capitalize(COCO_CLASSES[d.classId]) : 'Unknown Item',
      category: mapCocoToCategory(COCO_CLASSES[d.classId]),
      quantity: '1 pc',
      confidence: Math.round(d.score * 100) / 100,
      source: 'camera'
    }));

  } catch (error) {
    console.error('YOLO inference failed:', error);
    return [];
  }
}

function preprocess(canvas: HTMLCanvasElement, targetSize: number): [ort.Tensor, number, number] {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Cannot get 2d context');
  
  // Calculate scale while maintaining aspect ratio
  const scale = Math.min(targetSize / canvas.width, targetSize / canvas.height);
  const scaledWidth = Math.round(canvas.width * scale);
  const scaledHeight = Math.round(canvas.height * scale);

  const resizeCanvas = document.createElement('canvas');
  resizeCanvas.width = targetSize;
  resizeCanvas.height = targetSize;
  const resizeCtx = resizeCanvas.getContext('2d');
  
  if (resizeCtx) {
    // Fill with padding color (usually gray or black)
    resizeCtx.fillStyle = '#000000';
    resizeCtx.fillRect(0, 0, targetSize, targetSize);
    
    // Draw centered
    const dx = (targetSize - scaledWidth) / 2;
    const dy = (targetSize - scaledHeight) / 2;
    resizeCtx.drawImage(canvas, dx, dy, scaledWidth, scaledHeight);
  }

  const imageData = resizeCtx!.getImageData(0, 0, targetSize, targetSize);
  const data = imageData.data;
  const float32Data = new Float32Array(3 * targetSize * targetSize);

  // Convert HWC to CHW and normalize to [0, 1]
  for (let i = 0; i < targetSize * targetSize; i++) {
    float32Data[i] = data[i * 4] / 255.0; // R
    float32Data[targetSize * targetSize + i] = data[i * 4 + 1] / 255.0; // G
    float32Data[2 * targetSize * targetSize + i] = data[i * 4 + 2] / 255.0; // B
  }

  const tensor = new ort.Tensor('float32', float32Data, [1, 3, targetSize, targetSize]);
  return [tensor, scaledWidth, scaledHeight];
}

interface Detection {
  classId: number;
  score: number;
  box: [number, number, number, number];
}

function postprocess(
  tensor: ort.Tensor,
  confidenceThreshold: number,
  iouThreshold: number,
  scaledWidth: number,
  scaledHeight: number,
  originalWidth: number,
  originalHeight: number
): Detection[] {
  const data = tensor.data as Float32Array;
  const numBoxes = tensor.dims[2]; // 8400
  const numClasses = tensor.dims[1] - 4; // 84 - 4 = 80

  let boxes: number[][] = [];
  let scores: number[] = [];
  let classIds: number[] = [];

  for (let i = 0; i < numBoxes; i++) {
    let maxClassScore = 0;
    let classId = -1;
    
    for (let c = 0; c < numClasses; c++) {
      // The output tensor shape is [1, 84, 8400]
      const score = data[c * numBoxes + i + 4 * numBoxes];
      if (score > maxClassScore) {
        maxClassScore = score;
        classId = c;
      }
    }

    if (maxClassScore > confidenceThreshold) {
      const cx = data[0 * numBoxes + i];
      const cy = data[1 * numBoxes + i];
      const w = data[2 * numBoxes + i];
      const h = data[3 * numBoxes + i];

      const x1 = cx - w / 2;
      const y1 = cy - h / 2;
      const x2 = cx + w / 2;
      const y2 = cy + h / 2;
      
      boxes.push([x1, y1, x2, y2]);
      scores.push(maxClassScore);
      classIds.push(classId);
    }
  }

  // Non-Maximum Suppression (NMS)
  const result: Detection[] = [];
  const indices = nms(boxes, scores, iouThreshold);
  
  for (const i of indices) {
    result.push({
      classId: classIds[i],
      score: scores[i],
      box: boxes[i] as [number, number, number, number],
    });
  }

  return result;
}

function nms(boxes: number[][], scores: number[], iouThreshold: number): number[] {
  const indices = Array.from({ length: scores.length }, (_, i) => i);
  indices.sort((a, b) => scores[b] - scores[a]);
  
  const selected: number[] = [];
  while (indices.length > 0) {
    const current = indices.shift()!;
    selected.push(current);
    
    const remaining: number[] = [];
    for (const i of indices) {
      const iou = calculateIOU(boxes[current], boxes[i]);
      if (iou <= iouThreshold) {
        remaining.push(i);
      }
    }
    indices.length = 0;
    indices.push(...remaining);
  }
  return selected;
}

function calculateIOU(box1: number[], box2: number[]): number {
  const x1 = Math.max(box1[0], box2[0]);
  const y1 = Math.max(box1[1], box2[1]);
  const x2 = Math.min(box1[2], box2[2]);
  const y2 = Math.min(box1[3], box2[3]);
  
  const intersectionArea = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const box1Area = (box1[2] - box1[0]) * (box1[3] - box1[1]);
  const box2Area = (box2[2] - box2[0]) * (box2[3] - box2[1]);
  
  return intersectionArea / (box1Area + box2Area - intersectionArea + 1e-6);
}

function capitalize(str: string): string {
  if (!str) return '';
  return str.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function mapCocoToCategory(className: string): string {
  const categories: Record<string, string> = {
    'bottle': 'Pantry',
    'wine glass': 'Pantry',
    'cup': 'Household',
    'fork': 'Household',
    'knife': 'Household',
    'spoon': 'Household',
    'bowl': 'Household',
    'banana': 'Produce',
    'apple': 'Produce',
    'sandwich': 'Snacks & drinks',
    'orange': 'Produce',
    'broccoli': 'Produce',
    'carrot': 'Produce',
    'hot dog': 'Meat & seafood',
    'pizza': 'Snacks & drinks',
    'donut': 'Snacks & drinks',
    'cake': 'Snacks & drinks',
    'refrigerator': 'Household',
    'microwave': 'Household',
    'oven': 'Household',
    'sink': 'Household',
    'toaster': 'Household'
  };
  return categories[className] || 'Other';
}
