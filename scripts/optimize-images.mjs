/**
 * Resize and recompress public/images into progressive JPEG fallbacks
 * plus responsive WebP variants. Reads each original once.
 *
 * Re-running without --force skips files whose JPEG size already matches
 * src/data/image-variants.json, so optimized files are not compressed twice.
 */
import { readdir, readFile, writeFile, mkdir, stat, unlink } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve('public/images');
const MANIFEST_PATH = path.resolve('src/data/image-variants.json');
const REPORT_PATH = '/tmp/jtaps-image-report.json';
const FORCE = process.argv.includes('--force');
const VARIANT_WIDTHS = [480, 768, 1200];
const MAX_WIDTH = 1920;
const MIN_WIDTH = 1400;
const MAX_BYTES = 300 * 1024;
const PHOTO_START_Q = 82;
const PHOTO_MIN_Q = 74;
const GRAPHIC_START_Q = 88;
const GRAPHIC_MIN_Q = 80;

sharp.cache(false);

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(full)));
    else files.push(full);
  }
  return files;
}

function publicPath(file) {
  return `/${path.relative('public', file).split(path.sep).join('/')}`;
}

function encodePublicPath(filePath) {
  return encodeURI(filePath);
}

async function encode(buffer, width, quality, format) {
  const pipeline = sharp(buffer).rotate().resize({
    width,
    withoutEnlargement: true,
    fit: 'inside',
  });
  if (format === 'jpeg') {
    return pipeline.jpeg({ quality, mozjpeg: true, progressive: true }).toBuffer();
  }
  if (format === 'webp') {
    return pipeline.webp({ quality, effort: 5 }).toBuffer();
  }
  return pipeline.png({ compressionLevel: 9 }).toBuffer();
}

async function fitJpeg(buffer, { maxWidth, startQuality, minQuality, maxBytes }) {
  let quality = startQuality;
  let width = maxWidth;
  let output;
  let meta;
  while (true) {
    output = await encode(buffer, width, quality, 'jpeg');
    meta = await sharp(output).metadata();
    if (output.length <= maxBytes || quality <= minQuality) {
      const originalWidth = (await sharp(buffer).metadata()).width ?? width;
      const floor = originalWidth > MIN_WIDTH ? MIN_WIDTH : originalWidth;
      if (output.length > maxBytes && width > floor) {
        width = Math.max(floor, Math.round(width * 0.85));
        continue;
      }
      break;
    }
    quality -= 3;
  }
  return { output, quality, width: meta.width, height: meta.height };
}

async function fitWebp(buffer, width, { startQuality, minQuality, maxBytes }) {
  let quality = startQuality;
  let output;
  while (true) {
    output = await encode(buffer, width, quality, 'webp');
    if (output.length <= maxBytes || quality <= minQuality) break;
    quality -= 3;
  }
  const meta = await sharp(output).metadata();
  return { output, quality, width: meta.width, height: meta.height };
}

async function loadManifest() {
  try {
    return JSON.parse(await readFile(MANIFEST_PATH, 'utf8'));
  } catch {
    return {};
  }
}

const sourceFiles = (await walk(ROOT)).filter((file) => {
  const ext = path.extname(file).toLowerCase();
  const base = path.basename(file);
  if (!['.jpg', '.jpeg', '.png'].includes(ext)) return false;
  if (base === 'og-image.jpg') return false;
  if (/-\d+w\.(jpe?g|png)$/i.test(base)) return false;
  return true;
});

const glenwayPath = sourceFiles.find((file) => path.basename(file) === '6441-Glenway.jpg');
const glenwayBuffer = glenwayPath ? await readFile(glenwayPath) : null;
const manifest = await loadManifest();
const report = [];

for (const file of sourceFiles) {
  const before = await stat(file);
  const ext = path.extname(file).toLowerCase();
  const isGraphic = ext === '.png';
  const fallbackFile = isGraphic ? file.replace(/\.png$/i, '.jpg') : file;
  const fallbackPublic = publicPath(fallbackFile);
  const existing = manifest[fallbackPublic];
  const webpFile = fallbackFile.replace(/\.(jpe?g|png)$/i, '.webp');

  if (!FORCE && existing && existing.jpegBytes === before.size && (await exists(webpFile))) {
    report.push({
      file: fallbackPublic,
      skipped: true,
      beforeBytes: existing.beforeBytes,
      jpegBytes: existing.jpegBytes,
      webpBytes: existing.webpBytes,
    });
    console.log(`skip ${fallbackPublic}`);
    continue;
  }

  const input = await readFile(file);
  const originalMeta = await sharp(input).metadata();
  const jpeg = await fitJpeg(input, {
    maxWidth: MAX_WIDTH,
    startQuality: isGraphic ? GRAPHIC_START_Q : PHOTO_START_Q,
    minQuality: isGraphic ? GRAPHIC_MIN_Q : PHOTO_MIN_Q,
    maxBytes: MAX_BYTES,
  });
  const webp = await fitWebp(input, jpeg.width, {
    startQuality: isGraphic ? 90 : 80,
    minQuality: isGraphic ? 80 : 68,
    maxBytes: Math.min(MAX_BYTES, jpeg.output.length),
  });

  await mkdir(path.dirname(fallbackFile), { recursive: true });
  await writeFile(fallbackFile, jpeg.output);
  await writeFile(webpFile, webp.output);
  if (isGraphic && fallbackFile !== file) await unlink(file);

  const srcset = [];
  for (const variantWidth of VARIANT_WIDTHS) {
    if (variantWidth > jpeg.width - 80) continue;
    const variant = await fitWebp(input, variantWidth, {
      startQuality: isGraphic ? 88 : 80,
      minQuality: isGraphic ? 80 : 72,
      maxBytes: MAX_BYTES,
    });
    const variantFile = fallbackFile.replace(/\.(jpe?g|png)$/i, `-${variant.width}w.webp`);
    await writeFile(variantFile, variant.output);
    srcset.push({
      src: encodePublicPath(publicPath(variantFile)),
      w: variant.width,
      bytes: variant.output.length,
    });
  }
  srcset.push({
    src: encodePublicPath(publicPath(webpFile)),
    w: webp.width,
    bytes: webp.output.length,
  });

  manifest[fallbackPublic] = {
    width: jpeg.width,
    height: jpeg.height,
    srcset,
    beforeBytes: before.size,
    beforeWidth: originalMeta.width,
    beforeHeight: originalMeta.height,
    jpegBytes: jpeg.output.length,
    webpBytes: webp.output.length,
    jpegQuality: jpeg.quality,
    webpQuality: webp.quality,
  };

  const row = {
    file: fallbackPublic,
    beforeBytes: before.size,
    beforeWidth: originalMeta.width,
    beforeHeight: originalMeta.height,
    jpegBytes: jpeg.output.length,
    webpBytes: webp.output.length,
    width: jpeg.width,
    height: jpeg.height,
    variants: srcset.map((item) => ({ w: item.w, bytes: item.bytes })),
  };
  report.push(row);
  console.log(
    `${fallbackPublic}  ${(before.size / 1024).toFixed(0)}KB -> jpeg ${(jpeg.output.length / 1024).toFixed(0)}KB, webp ${(webp.output.length / 1024).toFixed(0)}KB (${jpeg.width}x${jpeg.height})`,
  );
}

if (glenwayBuffer) {
  let quality = 80;
  let og;
  while (quality >= 60) {
    og = await sharp(glenwayBuffer)
      .rotate()
      .resize(1200, 630, { fit: 'cover', position: 'centre' })
      .jpeg({ quality, mozjpeg: true, progressive: true })
      .toBuffer();
    if (og.length <= 250 * 1024) break;
    quality -= 4;
  }
  const ogFile = path.join(ROOT, 'og-image.jpg');
  await writeFile(ogFile, og);
  const ogMeta = await sharp(og).metadata();
  manifest['/images/og-image.jpg'] = {
    width: ogMeta.width,
    height: ogMeta.height,
    srcset: [],
    beforeBytes: glenwayBuffer.length,
    jpegBytes: og.length,
    webpBytes: og.length,
  };
  report.push({
    file: '/images/og-image.jpg',
    beforeBytes: glenwayBuffer.length,
    jpegBytes: og.length,
    width: ogMeta.width,
    height: ogMeta.height,
    note: '1200x630 share image cropped from 6441-Glenway.jpg',
  });
  console.log(`og-image.jpg ${(og.length / 1024).toFixed(0)}KB ${ogMeta.width}x${ogMeta.height} q${quality}`);
}

await mkdir(path.dirname(MANIFEST_PATH), { recursive: true });
await writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
await writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);

const processed = report.filter((row) => !row.skipped);
const beforeTotal = processed.reduce((sum, row) => sum + (row.beforeBytes || 0), 0);
const afterTotal = processed.reduce((sum, row) => sum + Math.min(row.jpegBytes || 0, row.webpBytes || row.jpegBytes || 0), 0);
console.log(
  `Done. ${processed.length} images. Originals ${(beforeTotal / 1024 / 1024).toFixed(1)}MB, smallest served master ${(afterTotal / 1024 / 1024).toFixed(1)}MB.`,
);

async function exists(file) {
  try {
    await stat(file);
    return true;
  } catch {
    return false;
  }
}
