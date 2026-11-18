/* Browser-only image preparation. Credentials and uploads stay in editor.js. */
(() => {
  'use strict';

  const maxBytes = 3 * 1024 * 1024;
  const maxPixels = 40000000;
  const defaultSizes = '(max-width: 760px) 100vw, 760px';

  function aborted(signal) {
    if (signal?.aborted) throw new DOMException('Picture preparation was cancelled.', 'AbortError');
  }

  function identify(bytes) {
    if (bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return { mime: 'image/jpeg', extension: 'jpg' };
    if (bytes.length >= 24 && [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value)) return { mime: 'image/png', extension: 'png' };
    const header = String.fromCharCode(...bytes.subarray(0, 12));
    if (/^GIF8[79]a/.test(header) && bytes.length >= 10) return { mime: 'image/gif', extension: 'gif' };
    if (bytes.length >= 20 && header.startsWith('RIFF') && header.slice(8) === 'WEBP') return { mime: 'image/webp', extension: 'webp' };
    return null;
  }

  function headerDimensions(bytes, format) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (format.extension === 'png') return { width: view.getUint32(16), height: view.getUint32(20) };
    if (format.extension === 'gif') return { width: view.getUint16(6, true), height: view.getUint16(8, true) };
    if (format.extension === 'webp') {
      const chunk = String.fromCharCode(...bytes.subarray(12, 16));
      if (chunk === 'VP8X' && bytes.length >= 30) return {
        width: 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16),
        height: 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16)
      };
      if (chunk === 'VP8L' && bytes.length >= 25 && bytes[20] === 47) return {
        width: 1 + bytes[21] + ((bytes[22] & 63) << 8),
        height: 1 + (bytes[22] >> 6) + (bytes[23] << 2) + ((bytes[24] & 15) << 10)
      };
    }
    if (format.extension === 'jpg') {
      for (let offset = 2; offset + 4 < bytes.length;) {
        if (bytes[offset] !== 255) break;
        while (bytes[offset] === 255) offset += 1;
        const marker = bytes[offset++];
        if (marker === 217 || marker === 218) break;
        if (marker === 0 || marker === 1 || (marker >= 208 && marker <= 215)) continue;
        if (offset + 2 > bytes.length) break;
        const length = view.getUint16(offset);
        if (length < 2 || offset + length > bytes.length) break;
        if ([192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207].includes(marker) && length >= 7) {
          return { width: view.getUint16(offset + 5), height: view.getUint16(offset + 3) };
        }
        offset += length;
      }
    }
    return null;
  }

  function animatedImage(bytes, format) {
    // GIF stays byte-for-byte intact, including animation and timing metadata.
    if (format.extension === 'gif') return true;
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (format.extension === 'png') {
      for (let offset = 8; offset + 12 <= bytes.length;) {
        const size = view.getUint32(offset);
        if (offset + size + 12 > bytes.length) break;
        const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
        if (type === 'acTL') return true;
        if (type === 'IEND') break;
        offset += size + 12;
      }
    }
    if (format.extension === 'webp') {
      for (let offset = 12; offset + 8 <= bytes.length;) {
        const size = view.getUint32(offset + 4, true);
        if (offset + size + 8 > bytes.length) break;
        const type = String.fromCharCode(...bytes.subarray(offset, offset + 4));
        if (type === 'ANIM' || type === 'ANMF') return true;
        if (type === 'VP8X' && size >= 10 && (bytes[offset + 8] & 2)) return true;
        offset += size + 8 + (size % 2);
      }
    }
    return false;
  }

  function checkDimensions(width, height) {
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width * height > maxPixels) {
      throw new Error('Resize the picture below 40 megapixels before uploading.');
    }
  }

  async function encode(bitmap, width, height, mime, signal) {
    aborted(signal);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('This browser could not prepare the picture. Try uploading without optimization.');
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(bitmap, 0, 0, width, height);
    // PNG and WebP retain transparency. Never flatten an image onto a background.
    const blob = await new Promise((resolve, reject) => canvas.toBlob(result => {
      if (result) resolve(result);
      else reject(new Error('This browser could not compress the picture. Try uploading without optimization.'));
    }, mime, 0.88));
    canvas.width = 1;
    canvas.height = 1;
    aborted(signal);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const format = identify(bytes);
    if (!format) throw new Error('The prepared picture could not be verified.');
    aborted(signal);
    return { bytes, ...format, width, height };
  }

  async function prepare(file, { signal, optimize = true } = {}) {
    aborted(signal);
    if (!file || !file.size || file.size > maxBytes) throw new Error('Choose a PNG, JPEG, GIF, or WebP picture up to 3 MB.');
    const bytes = new Uint8Array(await file.arrayBuffer());
    aborted(signal);
    const format = identify(bytes);
    if (!format || file.type !== format.mime) throw new Error('The picture contents must match its PNG, JPEG, GIF, or WebP file type.');
    const dimensions = headerDimensions(bytes, format);
    if (dimensions) checkDimensions(dimensions.width, dimensions.height);
    const bitmap = await createImageBitmap(file);
    try {
      aborted(signal);
      checkDimensions(bitmap.width, bitmap.height);
      const original = { suffix: '', bytes, ...format, width: bitmap.width, height: bitmap.height };
      const animated = animatedImage(bytes, format);
      if (!optimize || animated) return {
        files: [original], width: original.width, height: original.height,
        originalBytes: bytes.length, outputBytes: bytes.length, animated, compressed: false
      };

      const ratio = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height));
      const width = Math.max(1, Math.round(bitmap.width * ratio));
      const height = Math.max(1, Math.round(bitmap.height * ratio));
      let primary = original;
      // Keep small, already efficient pictures unchanged; avoid repeated lossy encoding.
      if (ratio < 1 || bytes.length > 200 * 1024) {
        const candidate = await encode(bitmap, width, height, format.mime, signal);
        if (ratio < 1 || candidate.bytes.length < bytes.length * 0.9) primary = { suffix: '', ...candidate };
      }
      const files = [primary];
      for (const target of [768, 384]) {
        if (target >= primary.width) continue;
        const variantHeight = Math.max(1, Math.round(primary.height * target / primary.width));
        const variant = await encode(bitmap, target, variantHeight, format.mime, signal);
        // A larger thumbnail offers no bandwidth benefit. The next smaller one may still help.
        if (variant.bytes.length < primary.bytes.length) files.push({ suffix: `-${target}w`, ...variant });
      }
      aborted(signal);
      return {
        files, width: primary.width, height: primary.height,
        originalBytes: bytes.length, outputBytes: primary.bytes.length,
        totalBytes: files.reduce((sum, item) => sum + item.bytes.length, 0),
        animated: false, compressed: primary !== original
      };
    } finally {
      bitmap.close();
    }
  }

  function safeUrl(value) {
    if (typeof value !== 'string' || !value || value.startsWith('//') || /[\s\\\u0000-\u001f\u007f,]/.test(value)) return null;
    try {
      const parsed = new URL(value, window.location.origin);
      if (parsed.username || parsed.password) return null;
      if (value.startsWith('/') && !value.startsWith('//')) return value;
      return value.startsWith('https://') && parsed.protocol === 'https:' ? parsed.href : null;
    } catch { return null; }
  }

  function attributes(uploaded) {
    if (!Array.isArray(uploaded) || !uploaded.length) throw new Error('No uploaded picture is available.');
    const seen = new Set();
    const files = uploaded.map(item => {
      const url = safeUrl(item.url);
      checkDimensions(item.width, item.height);
      if (!url || seen.has(item.width)) throw new Error('The responsive picture metadata could not be verified.');
      seen.add(item.width);
      return { ...item, url };
    });
    const primary = files[0];
    if (files.some(item => item.width > primary.width)) throw new Error('The primary picture must be the largest responsive image.');
    return {
      src: primary.url, width: primary.width, height: primary.height,
      srcset: files.slice().sort((a, b) => a.width - b.width).map(item => `${item.url} ${item.width}w`).join(', '),
      sizes: defaultSizes
    };
  }

  window.EditorMedia = Object.freeze({ prepare, attributes });
})();
