#!/usr/bin/env node
// Regenerate icons/icon-{16,32,48,128}.png from the brand master PNG. The PNGs
// are committed; run this only when the brand mark changes.
// Usage: node scripts/icons.mjs [path/to/logo.png]   (needs `sharp` resolvable)
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { writeFileSync } from 'node:fs'
const sharp = createRequire(import.meta.url)('sharp')
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = process.argv[2] ?? join(ROOT, '../crawl-cove-web/public_html/media/brand/logo.png')

const { data, info } = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
let minx = info.width, miny = info.height, maxx = -1, maxy = -1
for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
  if (data[(y * info.width + x) * 4 + 3] > 8) { if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y }
}
const w = maxx - minx + 1, h = maxy - miny + 1, side = Math.max(w, h)
const crop = await sharp(SRC).extract({ left: minx, top: miny, width: w, height: h }).png().toBuffer()
const art = await sharp({ create: { width: side, height: side, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite([{ input: crop, left: Math.floor((side - w) / 2), top: Math.floor((side - h) / 2) }]).png().toBuffer()
for (const size of [16, 32, 48, 128]) {
  const inner = Math.round(size * 0.92)
  const scaled = await sharp(art).resize(inner, inner, { kernel: 'lanczos3' }).png().toBuffer()
  const off = Math.floor((size - inner) / 2)
  const out = await sharp({ create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: scaled, left: off, top: off }]).png({ compressionLevel: 9 }).toBuffer()
  writeFileSync(join(ROOT, 'icons', `icon-${size}.png`), out)
  console.log(`icons/icon-${size}.png`)
}
