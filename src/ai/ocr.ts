import { pipeline, env } from '@xenova/transformers';

// Explicitly allow remote model loading
env.allowLocalModels = false;

/**
 * OCR pipeline for medicine label extraction
 */
let ocrPipeline: any = null;

export async function initOCRPipeline(progressCallback?: (p: any) => void) {
  if (!ocrPipeline) {
    ocrPipeline = await pipeline('image-to-text', 'Xenova/trocr-base-handwritten', {
      quantized: true,
      progress_callback: progressCallback,
      cache_dir: '/models' // Explicitly set a cache directory, though browser is usually indexedDB
    });
  }
  return ocrPipeline;
}

export async function scanMedicineLabel(imageInput: any) {
  const pipe = await initOCRPipeline();
  const result = await pipe(imageInput);

  // Return the extracted text
  return result[0].generated_text;
}
