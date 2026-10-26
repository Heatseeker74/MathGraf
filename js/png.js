/*
 * Schreibt die Auflösung (pHYs-Chunk) in eine PNG-Datei.
 * Word liest diesen Wert und fügt das Bild dadurch in der richtigen Größe (cm) ein.
 */
(function (global) {
  'use strict';

  const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();

  function crc32(bytes) {
    let c = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }

  function makeChunk(type, data) {
    const out = new Uint8Array(12 + data.length);
    const dv = new DataView(out.buffer);
    dv.setUint32(0, data.length);
    for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
    out.set(data, 8);
    dv.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
    return out;
  }

  // Pixel pro Meter für eine DPI-Angabe
  function dpiToPpm(dpi) {
    return Math.round(dpi / 0.0254);
  }

  /**
   * Fügt einen pHYs-Chunk ein (ersetzt einen vorhandenen).
   * @param {Uint8Array} png
   * @param {number} ppm Pixel pro Meter
   * @returns {Uint8Array}
   */
  function setPhys(png, ppm) {
    const sig = [137, 80, 78, 71, 13, 10, 26, 10];
    for (let i = 0; i < 8; i++) if (png[i] !== sig[i]) throw new Error('Keine PNG-Datei');

    const physData = new Uint8Array(9);
    const dv = new DataView(physData.buffer);
    dv.setUint32(0, ppm);
    dv.setUint32(4, ppm);
    physData[8] = 1; // Einheit: Meter
    const phys = makeChunk('pHYs', physData);

    const parts = [png.subarray(0, 8)];
    const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
    let pos = 8;
    while (pos < png.length) {
      const len = view.getUint32(pos);
      const type = String.fromCharCode(png[pos + 4], png[pos + 5], png[pos + 6], png[pos + 7]);
      const end = pos + 12 + len;
      if (type !== 'pHYs') parts.push(png.subarray(pos, end));
      if (type === 'IHDR') parts.push(phys);
      pos = end;
    }

    const total = parts.reduce((s, p) => s + p.length, 0);
    const out = new Uint8Array(total);
    let o = 0;
    for (const p of parts) { out.set(p, o); o += p.length; }
    return out;
  }

  // Liest pHYs (für Tests): {x, y, unit} oder null
  function readPhys(png) {
    const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
    let pos = 8;
    while (pos < png.length) {
      const len = view.getUint32(pos);
      const type = String.fromCharCode(png[pos + 4], png[pos + 5], png[pos + 6], png[pos + 7]);
      if (type === 'pHYs') {
        return { x: view.getUint32(pos + 8), y: view.getUint32(pos + 12), unit: png[pos + 16] };
      }
      pos += 12 + len;
    }
    return null;
  }

  const api = { setPhys, readPhys, dpiToPpm, crc32 };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.PngTools = api;
})(typeof window !== 'undefined' ? window : globalThis);
