import { gunzipSync, gzipSync } from 'node:zlib';

/** Remove obsolete v4 config entries ignored by Tesseract 7's LSTM-only core.
 * Keep the section offsets and every trained-network byte intact: pad only the
 * obsolete config lines as comments rather than rebuilding the binary archive.
 */
export function compatibleOcrLanguageAsset(compressed: Buffer): Buffer {
  const data = gunzipSync(compressed);
  if (data.length < 12) throw new Error('Invalid OCR language header');
  const count = data.readInt32LE(0);
  if (count < 1 || count > 64 || data.length < 4 + count * 8) throw new Error('Invalid OCR language section table');
  const offsets = Array.from({ length: count }, (_, index) => Number(data.readBigInt64LE(4 + index * 8)));
  const start = offsets[0];
  if (start === -1) return compressed; // This language has no embedded config.
  if (!Number.isSafeInteger(start) || start < 4 + count * 8 || start >= data.length) throw new Error('Invalid OCR config offset');
  const end = Math.min(data.length, ...offsets.filter(offset => offset > start));
  const config = data.subarray(start, end).toString('latin1');
  const obsolete = /^(?:language_model_ngram_on|classify_misfit_junk_penalty)[ \t]+[^\r\n\0]*/gm;
  let changed = false;
  for (const match of config.matchAll(obsolete)) {
    data.fill(0x20, start + match.index, start + match.index + match[0].length);
    data[start + match.index] = 0x23; // A comment, not a whitespace-only parameter line.
    changed = true;
  }
  return changed ? gzipSync(data) : compressed;
}
