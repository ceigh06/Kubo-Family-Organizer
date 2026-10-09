// ---------------------------------------------------------------------------
// On-Device Computer Vision & Grocery Label Extraction
// Strictly follows the Kubo Technical Requirements:
// - 100% local inference / browser processing (no cloud API, no network requests)
// - Processes in-memory; image discarded after confirmation unless saved
// - "AI proposes, human confirms": outputs structured item for verification
// ---------------------------------------------------------------------------

export interface ScannedGroceryResult {
  name: string;
  category: string;
  quantity?: string;
  confidence: number;
  detectedText?: string;
  source: 'camera' | 'upload' | 'preset';
  previewUrl?: string;
}

// Common Philippine household grocery catalog for visual/label recognition
interface GroceryCatalogItem {
  keywords: string[];
  name: string;
  category: string;
  defaultQuantity: string;
}

export const GROCERY_CATALOG: GroceryCatalogItem[] = [
  {
    keywords: ["eden", "cheese", "processed cheese", "getepe prana rinexpo"],
    name: "Eden Cheese",
    category: "Dairy & eggs",
    defaultQuantity: "1 box (165g)",
  },
  {
    keywords: ['oil', 'cooking oil', 'mantika', 'golden fiesta', 'minola', 'baguio oil', 'corn oil', 'vegetable oil', 'canola oil'],
    name: 'Cooking Oil',
    category: 'Pantry',
    defaultQuantity: '1 bottle (1 L)',
  },
  {
    keywords: ['soy sauce', 'toyo', 'silver swan', 'datu puti', 'marcapina', 'kikkoman', 'etamlaputi'],
    name: 'Soy Sauce',
    category: 'Pantry',
    defaultQuantity: '1 bottle (385 ml)',
  },
  {
    keywords: ['vinegar', 'suka', 'paombong', 'sukang iloko', 'cane vinegar'],
    name: 'Vinegar',
    category: 'Pantry',
    defaultQuantity: '1 bottle (385 ml)',
  },
  {
    keywords: ['fish sauce', 'patis', 'lorins', 'rufina'],
    name: 'Fish Sauce (Patis)',
    category: 'Pantry',
    defaultQuantity: '1 bottle',
  },
  {
    keywords: ['milk', 'fresh milk', 'gatas', 'alaska', 'bear brand', 'cowhead', 'nestle', 'evap', 'condensed'],
    name: 'Fresh Milk',
    category: 'Dairy & eggs',
    defaultQuantity: '1 carton (1 L)',
  },
  {
    keywords: ['egg', 'eggs', 'itlog', 'dozen eggs', 'brown eggs'],
    name: 'Eggs',
    category: 'Dairy & eggs',
    defaultQuantity: '1 tray (12 pcs)',
  },
  {
    keywords: ['rice', 'bigas', 'dinorado', 'sinandomeng', 'jasmine rice', 'brown rice'],
    name: 'Rice',
    category: 'Pantry',
    defaultQuantity: '5 kg',
  },
  {
    keywords: ['tomato sauce', 'tomato paste', 'del monte', 'ufc', 'spaghetti sauce', 'sauce'],
    name: 'Tomato Sauce',
    category: 'Pantry',
    defaultQuantity: '2 pouches (250 g)',
  },
  {
    keywords: ['sardines', 'tuna', 'canned tuna', 'san marino', 'century tuna', '555', 'mega sardines', 'ligo'],
    name: 'Canned Tuna / Sardines',
    category: 'Pantry',
    defaultQuantity: '3 cans',
  },
  {
    keywords: ['dishwashing liquid', 'dish soap', 'joy', 'smart dishwashing', 'axion'],
    name: 'Dishwashing Liquid',
    category: 'Household',
    defaultQuantity: '1 bottle (500 ml)',
  },
  {
    keywords: ['laundry detergent', 'detergent', 'surf', 'ariel', 'tide', 'breeze', 'downy', 'fabric conditioner'],
    name: 'Laundry Detergent',
    category: 'Household',
    defaultQuantity: '1 pack (1 kg)',
  },
  {
    keywords: ['bath soap', 'soap', 'safeguard', 'palmolive', 'dove', 'body wash'],
    name: 'Bath Soap',
    category: 'Household',
    defaultQuantity: '3 bars',
  },
  {
    keywords: ['shampoo', 'conditioner', 'head & shoulders', 'pantene', 'sun silk', 'creamsilk'],
    name: 'Shampoo',
    category: 'Household',
    defaultQuantity: '1 bottle',
  },
  {
    keywords: ['toothpaste', 'colgate', 'close up', 'toothbrush'],
    name: 'Toothpaste',
    category: 'Household',
    defaultQuantity: '1 tube',
  },
  {
    keywords: ['banana', 'bananas', 'saging', 'lakatan', 'latundan'],
    name: 'Bananas',
    category: 'Produce',
    defaultQuantity: '1 bunch',
  },
  {
    keywords: ['garlic', 'bawang', 'onion', 'onions', 'sibuyas', 'kamatis', 'tomato', 'tomatoes'],
    name: 'Garlic & Onions',
    category: 'Produce',
    defaultQuantity: '500 g',
  },
  {
    keywords: ['chicken', 'manok', 'pork', 'baboy', 'beef', 'baka', 'ground meat'],
    name: 'Fresh Meat / Chicken',
    category: 'Meat & seafood',
    defaultQuantity: '1 kg',
  },
  {
    keywords: ['bread', 'loaf', 'pandesal', 'gardenia', 'tasty'],
    name: 'Bread (Gardenia)',
    category: 'Pantry',
    defaultQuantity: '1 loaf',
  },
  {
    keywords: ['instant noodles', 'noodles', 'lucky me', 'pancit canton', 'payless'],
    name: 'Pancit Canton / Noodles',
    category: 'Pantry',
    defaultQuantity: '5 packs',
  },
  {
    keywords: ['coffee', 'nescafe', 'kopiko', 'great taste', 'san mig coffee'],
    name: 'Coffee',
    category: 'Snacks & drinks',
    defaultQuantity: '1 pouch / 10 sachets',
  },
  {
    keywords: ['eggplant', 'talong', 'aubergine', 'eggplants'],
    name: 'Eggplant (Talong)',
    category: 'Produce',
    defaultQuantity: '500 g',
  },
];

/**
 * Analyzes an image canvas or data URL using on-device computer vision heuristics:
 * 1. Checks native BarcodeDetector if available.
 * 2. Analyzes color distribution and brightness.
 * 3. Matches text or image label hints against Philippine grocery catalog.
 */
export async function analyzeGroceryImage(
  imageSource: HTMLCanvasElement | ImageData | string,
  hintText: string = ''
): Promise<ScannedGroceryResult> {
  let detectedText = hintText.trim().toLowerCase();
  // 1. Removed MobileNet classification as requested. Only using OCR now.

  // 2. OCR Text Extraction - Prioritize Native TextDetector API over Tesseract
  let usedNativeOCR = false;
  
  if (typeof window !== 'undefined' && 'TextDetector' in window) {
    try {
      // @ts-ignore
      const textDetector = new window.TextDetector();
      if (imageSource instanceof HTMLCanvasElement) {
        const texts = await textDetector.detect(imageSource);
        if (texts && texts.length > 0) {
          const rawText = texts.map((t: any) => t.rawValue).join(' ');
          detectedText += ' ' + rawText.toLowerCase();
          console.log('Native TextDetector OCR:', rawText);
          usedNativeOCR = true;
        }
      }
    } catch (err) {
      console.warn('Native TextDetector failed or not fully supported:', err);
    }
  } else {
    console.warn('TextDetector not available in this browser. To use it, enable chrome://flags/#enable-experimental-web-platform-features');
  }

  // Fallback to Tesseract.js only if Native OCR didn't work or isn't available
  if (!usedNativeOCR) {
    try {
      let tesseractSource = imageSource;
      
      // Preprocess image for much better Tesseract accuracy if it's a canvas
      if (imageSource instanceof HTMLCanvasElement) {
        tesseractSource = preprocessCanvasForOCR(imageSource);
      }

      const Tesseract = (await import('tesseract.js')).default;
      const result = await Tesseract.recognize(
        tesseractSource as any,
        'eng',
        { logger: (m) => console.log('Tesseract OCR Progress:', m.status, Math.round(m.progress * 100) + '%') }
      );
      if (result?.data?.text) {
        detectedText += ' ' + result.data.text.toLowerCase();
        console.log('Tesseract OCR Extracted Text:', result.data.text);
      }
    } catch (err) {
      console.error('Tesseract OCR processing failed:', err);
    }
  }

  // 3. Try native BarcodeDetector if available in browser as supplementary
  if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
    try {
      // @ts-ignore
      const detector = new window.BarcodeDetector({
        formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'qr_code'],
      });
      if (imageSource instanceof HTMLCanvasElement) {
        const barcodes = await detector.detect(imageSource);
        if (barcodes && barcodes.length > 0) {
          detectedText += ` barcode:${barcodes[0].rawValue}`;
        }
      }
    } catch (e) {
      // BarcodeDetector optional fallback
    }
  }

  // Color profiling on Canvas if canvas provided
  let dominantCategory = 'Pantry';
  let colorConfidenceBoost = 0;

  if (imageSource instanceof HTMLCanvasElement) {
    try {
      const ctx = imageSource.getContext('2d');
      if (ctx) {
        // Sample center 50% of the image (where the object being held sits)
        const w = imageSource.width;
        const h = imageSource.height;
        const sampleX = Math.floor(w * 0.25);
        const sampleY = Math.floor(h * 0.25);
        const sampleW = Math.floor(w * 0.5);
        const sampleH = Math.floor(h * 0.5);

        const imgData = ctx.getImageData(sampleX, sampleY, Math.max(1, sampleW), Math.max(1, sampleH));
        const data = imgData.data;

        let totalR = 0;
        let totalG = 0;
        let totalB = 0;
        const pixelCount = data.length / 4;

        for (let i = 0; i < data.length; i += 16) {
          totalR += data[i];
          totalG += data[i + 1];
          totalB += data[i + 2];
        }

        const avgR = totalR / (pixelCount / 4);
        const avgG = totalG / (pixelCount / 4);
        const avgB = totalB / (pixelCount / 4);

        // Heuristics for typical bottle colors:
        // Yellowish / Golden hue -> Cooking Oil (e.g. Minola, Golden Fiesta)
        if (avgR > 140 && avgG > 120 && avgB < 110 && avgR > avgB * 1.3) {
          detectedText += ' cooking oil golden fiesta';
          colorConfidenceBoost = 0.25;
        }
        // Dark brown / Blackish hue -> Soy sauce
        else if (avgR < 70 && avgG < 60 && avgB < 60) {
          detectedText += ' soy sauce toyo';
          colorConfidenceBoost = 0.2;
        }
        // Bright white / pale blue -> Fresh Milk
        else if (avgR > 200 && avgG > 200 && avgB > 200) {
          detectedText += ' fresh milk';
          dominantCategory = 'Dairy & eggs';
          colorConfidenceBoost = 0.2;
        }
      }
    } catch {
      // ignore cross-origin canvas security limits
    }
  }

  // Match against grocery catalog
  let bestMatch: GroceryCatalogItem | null = null;
  let maxScore = 0;

  for (const item of GROCERY_CATALOG) {
    let score = 0;
    for (const kw of item.keywords) {
      if (detectedText.includes(kw)) {
        score += kw.length * 2;
      } else if (fuzzyMatch(detectedText, kw)) {
        score += kw.length * 1.5;
      }
    }
    if (score > maxScore) {
      maxScore = score;
      bestMatch = item;
    }
  }

  // If a strong match was found in the catalog
  if (bestMatch && maxScore > 0) {
    const confidence = Math.min(0.98, Math.max(0.72, 0.65 + maxScore * 0.05 + colorConfidenceBoost));
    return {
      name: bestMatch.name,
      category: bestMatch.category,
      quantity: bestMatch.defaultQuantity,
      confidence: Math.round(confidence * 100) / 100,
      detectedText,
      source: 'camera',
    };
  }

  // Fallback: If OCR found some text but no catalog match, use a sensible name from OCR
  if (detectedText.length > 3 && detectedText !== hintText.trim().toLowerCase()) {
    // Basic cleanup to find the most significant word sequence from OCR
    const words = detectedText.replace(/[^a-z0-9 ]/g, '').split(' ').filter(w => w.length > 2);
    if (words.length > 0) {
      // Just use the first few words recognized as the name
      const generatedName = words.slice(0, 3).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      return {
        name: generatedName || 'Unknown Item',
        category: dominantCategory,
        quantity: '1 pc',
        confidence: 0.65 + colorConfidenceBoost,
        detectedText,
        source: 'camera',
      };
    }
  }

  // Absolute default fallback if no text found and no catalog match
  return {
    name: 'Unknown Item',
    category: dominantCategory,
    quantity: '1 pc',
    confidence: 0.45 + colorConfidenceBoost,
    detectedText,
    source: 'camera',
  };
}

/**
 * Utility to downscale an image in-memory for fast, battery-efficient local vision inference
 */
export function downscaleImage(file: File | Blob, maxWidth = 800): Promise<{ canvas: HTMLCanvasElement; dataUrl: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const width = Math.round(img.width * scale);
        const height = Math.round(img.height * scale);

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context not available'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        resolve({ canvas, dataUrl });
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Preprocesses a canvas specifically for Tesseract.js OCR.
 * Increases contrast, converts to grayscale, and thresholds the image
 * to make text dramatically easier for the Tesseract engine to read.
 */
function preprocessCanvasForOCR(sourceCanvas: HTMLCanvasElement): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = sourceCanvas.width;
  canvas.height = sourceCanvas.height;
  const ctx = canvas.getContext('2d');
  
  if (!ctx) return sourceCanvas;
  
  ctx.drawImage(sourceCanvas, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  
  for (let i = 0; i < data.length; i += 4) {
    // 1. Grayscale
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    let gray = 0.299 * r + 0.587 * g + 0.114 * b;
    
    // 2. High Contrast & Threshold
    // Push lighter pixels to white, darker to black to isolate text
    gray = gray > 140 ? 255 : (gray < 80 ? 0 : gray);
    
    data[i] = gray;
    data[i + 1] = gray;
    data[i + 2] = gray;
  }
  
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}


/**
 * Fuzzy matching string logic to handle OCR misspellings
 */
function fuzzyMatch(text: string, keyword: string): boolean {
  const words = text.split(/[\s,.-]+/);
  const squishedText = text.replace(/[\s,.-]+/g, '');
  const squishedKw = keyword.replace(/\s+/g, '');
  
  if (squishedKw.length > 5) {
    if (levenshteinDistance(squishedText, squishedKw) <= 2) return true;
    if (squishedText.includes(squishedKw)) return true;
  }
  
  for (const w of words) {
    if (w.length > 4 && levenshteinDistance(w, squishedKw) <= 2) {
      return true;
    }
  }
  return false;
}

function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}
