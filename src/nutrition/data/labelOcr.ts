import type { Worker } from 'tesseract.js';

/**
 * Text recognition of a photographed food label, on the phone (Tesseract, Polish model). Nothing leaves the
 * device: the engine and the Polish model are downloaded once from public CDNs (only the files, no photo)
 * and kept for offline use, the engine by the service worker and the model by Tesseract itself.
 */

export type OcrStage = 'preparing' | 'loading' | 'reading';
export interface OcrProgress {
  stage: OcrStage;
  /** 0 to 1 within the stage, when known. */
  share?: number;
}

/**
 * Longest side the photo is brought to. Tesseract reads best when lines of text are about 30 px high; a
 * nutrition table photographed with its package is small in the frame, so phone photos are reduced only this
 * far and smaller ones (screenshots, shared images) are enlarged to it. Tested on a real label: 2× enlargement
 * turned "1,5g" from "159" into "1,5g".
 */
const TARGET_SIDE = 2600;
/** Never enlarge more than this: past it the letters only get blurrier. */
const MAX_ENLARGE = 2.5;

/**
 * The photo made easier to read: scaled, grey, and with its levels stretched so faint print on a coloured
 * background stands out. Returns a canvas Tesseract can read directly.
 */
export async function preparePhoto(file: Blob): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(MAX_ENLARGE, TARGET_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = image.data;
  // Grey by luminance, and a histogram for the levels.
  const histogram = new Uint32Array(256);
  for (let i = 0; i < d.length; i += 4) {
    const g = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
    d[i] = g;
    histogram[g]++;
  }
  // Stretch between the 2nd and 98th percentile, so the darkest print goes black and the paper white.
  const total = d.length / 4;
  let low = 0;
  let high = 255;
  for (let acc = 0; low < 255 && (acc += histogram[low]) < total * 0.02; ) low++;
  for (let acc = 0; high > 0 && (acc += histogram[high]) < total * 0.02; ) high--;
  const span = Math.max(1, high - low);
  for (let i = 0; i < d.length; i += 4) {
    const v = Math.max(0, Math.min(255, Math.round(((d[i] - low) * 255) / span)));
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

let worker: Promise<Worker> | null = null;
let report: ((p: OcrProgress) => void) | null = null;

/** One engine for the whole visit: loading it is the slow part, reading another label then takes seconds. */
function engine(): Promise<Worker> {
  worker ??= import('tesseract.js')
    .then(({ createWorker }) =>
      createWorker('pol', 1, {
        logger: (m: { status: string; progress: number }) => {
          if (m.status === 'recognizing text') report?.({ stage: 'reading', share: m.progress });
          else report?.({ stage: 'loading', share: m.progress });
        },
      }),
    )
    .catch((error) => {
      // A failed download (no internet the first time) is retried on the next photo.
      worker = null;
      throw error;
    });
  return worker;
}

/** The text on a photographed label. Throws when the engine cannot be loaded (first use without internet). */
export async function recognizeLabel(file: Blob, onProgress: (p: OcrProgress) => void): Promise<string> {
  report = onProgress;
  try {
    onProgress({ stage: 'preparing' });
    const canvas = await preparePhoto(file);
    onProgress({ stage: 'loading' });
    const w = await engine();
    onProgress({ stage: 'reading', share: 0 });
    const { data } = await w.recognize(canvas);
    return data.text;
  } finally {
    report = null;
  }
}
