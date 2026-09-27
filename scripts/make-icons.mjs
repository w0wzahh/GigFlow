// Generates GigFlow's brand icons (favicon.ico, apple-icon.png, icon.png)
// from the same vector mark used by the Android launcher: a teal rounded
// square with route lines and a forward arrow.
//
//   node scripts/make-icons.mjs
//
// Pure Node — renders pixels and writes PNG/ICO by hand (zlib is built-in).

import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const appDir = join(here, "..", "src", "app");
const pubDir = join(here, "..", "public");

const TEAL = [11, 138, 128]; // #0B8A80 — matches the Android launcher

// ---- pixel rendering ------------------------------------------------------

/** distance from point to segment */
function segDist(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function inRoundRect(x, y, l, t, r, b, rad) {
  const cx = Math.max(l + rad, Math.min(x, r - rad));
  const cy = Math.max(t + rad, Math.min(y, b - rad));
  return Math.hypot(x - cx, y - cy) <= rad;
}

/** Coverage at (x,y) in 48x48 design space — mark painted in white on teal. */
function coverage(x, y, scale = 1) {
  const s = 8; // supersample
  let on = 0;
  for (let sy = 0; sy < s; sy++) for (let sx = 0; sx < s; sx++) {
    const px = x + (sx + 0.5) / s, py = y + (sy + 0.5) / s;
    if (hit(px, py)) on++;
  }
  return on / (s * s) * scale;
}

function hit(x, y) {
  // white route lines (stroke 3.4)
  const lines = [[10, 16, 25, 16], [14, 24, 29, 24], [10, 32, 25, 32]];
  for (const [x1, y1, x2, y2] of lines) {
    if (segDist(x, y, x1, y1, x2, y2) <= 1.7) return true;
  }
  // arrow chevron (stroke 3)
  if (segDist(x, y, 31, 19.5, 38, 24) <= 1.5) return true;
  if (segDist(x, y, 31, 28.5, 38, 24) <= 1.5) return true;
  return false;
}

/** Renders the mark into an RGBA buffer. size = output px, bleed = fill frame */
function render(size, bleed = false) {
  const px = Buffer.alloc(size * size * 4);
  const D = 48; // design space
  const k = D / size;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x * k, dy = y * k;
      const i = (y * size + x) * 4;
      const bg = bleed || inRoundRect(dx, dy, 8, 8, 40, 40, 6);
      if (bg) {
        px[i] = TEAL[0]; px[i + 1] = TEAL[1]; px[i + 2] = TEAL[2];
        px[i + 3] = 255;
        const c = coverage(dx, dy);
        if (c > 0) { // blend white mark over teal
          px[i] = Math.round(TEAL[0] * (1 - c) + 255 * c);
          px[i + 1] = Math.round(TEAL[1] * (1 - c) + 255 * c);
          px[i + 2] = Math.round(TEAL[2] * (1 - c) + 255 * c);
        }
      }
    }
  }
  return px;
}

// ---- PNG + ICO writers ----------------------------------------------------

const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

function png(rgba, size) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function ico(pngBuffers, size) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(1, 4); // count
  const entry = Buffer.alloc(16);
  entry[0] = size; entry[1] = size; // w/h (0 = 256)
  entry.writeUInt16LE(1, 4);  // planes
  entry.writeUInt16LE(32, 6); // bpp
  entry.writeUInt32LE(pngBuffers.length, 8);
  entry.writeUInt32LE(22, 12);
  return Buffer.concat([header, entry, pngBuffers]);
}

// ---- emit -----------------------------------------------------------------

writeFileSync(join(appDir, "icon.png"), png(render(192), 192));
writeFileSync(join(appDir, "apple-icon.png"), png(render(180, true), 180));
writeFileSync(join(appDir, "favicon.ico"), ico(png(render(48), 48), 48));
writeFileSync(join(pubDir, "icon-512.png"), png(render(512), 512));
console.log("wrote icon.png (192), apple-icon.png (180), favicon.ico (48), public/icon-512.png");
