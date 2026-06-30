import Tesseract from "tesseract.js";

export async function readImageText(file: File): Promise<string> {
  try {
    const worker = await Tesseract.createWorker("fra+eng");

    try {
      const result = await worker.recognize(file);
      return result.data.text;
    } finally {
      await worker.terminate();
    }
  } catch {
    const worker = await Tesseract.createWorker("eng");

    try {
      const result = await worker.recognize(file);
      return result.data.text;
    } finally {
      await worker.terminate();
    }
  }
}
