import { pipeline, env } from '@xenova/transformers';

// Explicitly use CDN for remote models to bypass local path issues
env.allowLocalModels = false;
env.remoteModels = 'https://huggingface.co';

/**
 * OCR pipeline for medicine label extraction
 */
let ocrPipeline: any = null;

export async function initOCRPipeline(progressCallback?: (p: any) => void) {
  if (!ocrPipeline) {
    ocrPipeline = await pipeline('image-to-text', 'Xenova/trocr-base-handwritten', {
      quantized: true,
      progress_callback: progressCallback,
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
