/**
 * Draws the app icon: a lime calorie ring with a gap, on the dark background of the training app's icon,
 * so the two sit together on the home screen. Writes public/icon-192.png, icon-512.png, apple-touch-icon.png.
 */
import { Jimp } from 'jimp';

const BG = [14, 14, 14];
const LIME = [200, 240, 49];
const TRACK = [46, 46, 43];

async function draw(size, file) {
  const img = new Jimp({ width: size, height: size, color: 0x0e0e0eff });
  const c = size / 2;
  const outer = size * 0.34;
  const inner = size * 0.24;
  // The ring is filled three quarters of the way, starting at the top, like a day mostly eaten.
  const filled = 0.75 * 2 * Math.PI;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // 4x supersampling for smooth edges.
      let lime = 0;
      let track = 0;
      for (const [ox, oy] of [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]]) {
        const dx = x + ox - c;
        const dy = y + oy - c;
        const r = Math.hypot(dx, dy);
        if (r < inner || r > outer) continue;
        const angle = (Math.atan2(dx, -dy) + 2 * Math.PI) % (2 * Math.PI);
        if (angle <= filled) lime++;
        else track++;
      }
      const mix = (a, b, t) => Math.round(a + (b - a) * t);
      const col = [0, 1, 2].map((i) => mix(mix(BG[i], LIME[i], lime / 4), TRACK[i], track / 4));
      img.setPixelColor(((col[0] << 24) | (col[1] << 16) | (col[2] << 8) | 0xff) >>> 0, x, y);
    }
  }
  await img.write(file);
}

await draw(512, 'public/icon-512.png');
await draw(192, 'public/icon-192.png');
await draw(180, 'public/apple-touch-icon.png');
console.log('icons written');
