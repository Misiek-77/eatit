// Crops the Gemini illustrations (drawing on the right, empty space on the left) to their drawing and saves them small.
// Usage: node scripts/crop-illustrations.mjs <folder with jadlospis-*.png>
import { Jimp } from 'jimp';
import path from 'node:path';

const dir = process.argv[2];
for (const name of ['meal', 'products', 'progress']) {
  const image = await Jimp.read(path.join(dir, `jadlospis-${name}.png`));
  const { width, height } = image.bitmap;
  image.crop({ x: Math.round(width * 0.56), y: Math.round(height * 0.12), w: Math.round(width * 0.42), h: Math.round(height * 0.8) });
  image.resize({ w: 480 });
  await image.write(`public/illustrations/${name}.jpg`, { quality: 82 });
  console.log(name, image.bitmap.width, image.bitmap.height);
}
