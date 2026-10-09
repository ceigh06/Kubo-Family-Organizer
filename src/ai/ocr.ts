import { pipeline } from '@xenova/transformers';

/**
 * OCR pipeline for medicine label extraction
 */
let ocrPipeline: any = null;

export async function initOCRPipeline() {
  if (!ocrPipeline) {
    // Using a lightweight TrOCR model pre-trained for document text recognition
    // We can refine this model selection based on performance testing
    ocrPipeline = await pipeline('image-to-text', 'Xenova/trocr-base-handwritten');
  }
  return ocrPipeline;
}

export async function scanMedicineLabel(imageInput: any) {
  const pipe = await initOCRPipeline();
  const result = await pipe(imageInput);

  // Return the extracted text
  return result[0].generated_text;
}
