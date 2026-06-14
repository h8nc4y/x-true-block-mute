// make-icons.mjs
//
// Generates the extension icon PNGs (16/32/48/128 px) for "TrueBlock & Mute".
// Pure Node — no npm dependencies, no browser — so the icons are reproducible
// anywhere Node runs. The mark is a universal "prohibition" symbol: a white ring
// with a diagonal slash on a rounded-square brand-blue background.
//
//   node scripts/make-icons.mjs
//
// Writes icons/icon-16.png, icon-32.png, icon-48.png, icon-128.png. The SVG
// source of the same mark lives at icons/icon.svg (for store assets / scaling).

import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const iconsDir = path.join(scriptDir, "..", "icons");

// Brand palette: pixivFANBOX-style yellow-green -> light-blue diagonal gradient
// (no X/Twitter colors or marks). The prohibition mark is dark slate so it stays
// legible across the whole bright gradient.
const BG0 = [123, 196, 0]; // #7BC400 (top-left)
const BG1 = [60, 184, 232]; // #3CB8E8 (bottom-right)
const FG = [20, 52, 71]; // #143447 dark slate ring + slash
const SIZES = [16, 32, 48, 128];
const SS = 4; // supersampling factor for anti-aliasing

// Signed-distance helpers on the supersampled canvas (all in device pixels).
function roundedRectInside(x, y, s, radius) {
  // distance outside a rounded rect occupying [0,s] with corner radius
  const r = radius;
  const dx = Math.max(r - x, x - (s - r), 0);
  const dy = Math.max(r - y, y - (s - r), 0);
  // inside the straight edges?
  if (x >= 0 && x <= s && y >= 0 && y <= s) {
    if (x >= r && x <= s - r) return true;
    if (y >= r && y <= s - r) return true;
    return dx * dx + dy * dy <= r * r;
  }
  return false;
}

function onRing(x, y, cx, cy, radius, halfWidth) {
  const d = Math.hypot(x - cx, y - cy);
  return Math.abs(d - radius) <= halfWidth;
}

function onSlash(x, y, cx, cy, reach, halfWidth) {
  // Diagonal segment through the center at 45deg (top-left -> bottom-right).
  // direction (1,1)/sqrt2; perpendicular distance + projection clamp to [-reach, reach].
  const ux = Math.SQRT1_2;
  const uy = Math.SQRT1_2;
  const px = x - cx;
  const py = y - cy;
  const proj = px * ux + py * uy; // along the line
  if (Math.abs(proj) > reach) return false;
  const perp = Math.abs(px * uy - py * ux); // perpendicular distance
  return perp <= halfWidth;
}

function renderSize(size) {
  const S = size * SS;
  const radius = 0.22 * S;
  const cx = S / 2;
  const cy = S / 2;
  const ringR = 0.3 * S;
  const stroke = 0.08 * S; // half-width of ring + slash
  const reach = ringR; // slash spans the ring's diameter

  // Render supersampled RGBA, then box-downsample to `size`.
  const hi = new Uint8ClampedArray(S * S * 4);
  for (let y = 0; y < S; y += 1) {
    for (let x = 0; x < S; x += 1) {
      const i = (y * S + x) * 4;
      const inside = roundedRectInside(x + 0.5, y + 0.5, S, radius);
      const mark =
        inside &&
        (onRing(x + 0.5, y + 0.5, cx, cy, ringR, stroke) ||
          onSlash(x + 0.5, y + 0.5, cx, cy, reach, stroke));
      if (mark) {
        hi[i] = FG[0];
        hi[i + 1] = FG[1];
        hi[i + 2] = FG[2];
        hi[i + 3] = 255;
      } else if (inside) {
        // diagonal (~135deg) lerp from BG0 (top-left) to BG1 (bottom-right)
        const t = Math.min(1, Math.max(0, (x + y) / (2 * S)));
        hi[i] = Math.round(BG0[0] + (BG1[0] - BG0[0]) * t);
        hi[i + 1] = Math.round(BG0[1] + (BG1[1] - BG0[1]) * t);
        hi[i + 2] = Math.round(BG0[2] + (BG1[2] - BG0[2]) * t);
        hi[i + 3] = 255;
      } else {
        hi[i + 3] = 0; // transparent outside the rounded square
      }
    }
  }

  const out = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let sy = 0; sy < SS; sy += 1) {
        for (let sx = 0; sx < SS; sx += 1) {
          const hi_i = ((y * SS + sy) * S + (x * SS + sx)) * 4;
          const af = hi[hi_i + 3];
          r += hi[hi_i] * af;
          g += hi[hi_i + 1] * af;
          b += hi[hi_i + 2] * af;
          a += af;
        }
      }
      const o = (y * size + x) * 4;
      if (a > 0) {
        out[o] = Math.round(r / a);
        out[o + 1] = Math.round(g / a);
        out[o + 2] = Math.round(b / a);
        out[o + 3] = Math.round(a / (SS * SS));
      }
    }
  }
  return out;
}

// --- Minimal PNG encoder (RGBA, no filtering) ------------------------------
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const body = Buffer.concat([typeBuf, data]);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePng(rgba, size) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y += 1) {
    raw[y * (size * 4 + 1)] = 0; // filter type 0 (none)
    Buffer.from(rgba.buffer, y * size * 4, size * 4).copy(raw, y * (size * 4 + 1) + 1);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

mkdirSync(iconsDir, { recursive: true });
for (const size of SIZES) {
  const rgba = renderSize(size);
  const png = encodePng(rgba, size);
  const file = path.join(iconsDir, `icon-${size}.png`);
  writeFileSync(file, png);
  console.log(`wrote ${path.relative(path.join(scriptDir, ".."), file)} (${png.length} bytes)`);
}
console.log("icons generated");
