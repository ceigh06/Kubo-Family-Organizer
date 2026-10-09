import { pipeline, env } from '@xenova/transformers';

// Explicitly allow remote model loading
env.allowLocalModels = false;

/**
 * OCR pipeline for medicine label extraction
 */
let ocrPipeline: any = null;

export async function initOCRPipeline(progressCallback?: (p: any) => void) {
  if (!ocrPipeline) {
    console.log("Initializing OCR pipeline...");
    try {
      ocrPipeline = await pipeline('image-to-text', 'Xenova/trocr-base-handwritten', {
        quantized: true,
        progress_callback: progressCallback,
      });
      console.log("OCR pipeline initialized successfully.");
    } catch (e) {
      console.error("Critical error initializing OCR pipeline:", e);
      throw e;
    }
  }
  return ocrPipeline;
}

export async function scanMedicineLabel(imageInput: any) {
  const pipe = await initOCRPipeline();
  const result = await pipe(imageInput);

  // Return the extracted text
  return result[0].generated_text;
}
