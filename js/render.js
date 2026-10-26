/*
 * Zeichnet Karopapier bzw. Koordinatensystem mit Funktionsgraphen auf ein Canvas.
 * Alle Maße der Konfiguration sind in cm (Linienstärken in mm, Schrift in pt),
 * "s" ist der Maßstab in Pixel pro cm.
 */
(function (global) {
  'use strict';

  const PT_TO_CM = 2.54 / 72;

  // Bildgröße in cm
  function pageSize(cfg) {
    if (cfg.mode === 'grid') return { w: cfg.paper.width, h: cfg.paper.height };
    const c = cfg.coord;
    return {
      w: (c.xMax - c.xMin) * c.unitX + c.marginLeft + c.marginRight,
      h: (c.yMax - c.yMin) * c.unitY + c.marginTop + c.marginBottom
    };
  }

  // Liniendicke in Pixeln (mind. 1 px, damit dünne Linien sichtbar bleiben)
  function lw(mm, s) {
    return Math.max(1, (mm / 10) * s);
  }

  // Schiebt eine Koordinate auf das Pixelraster, damit Linien scharf bleiben
  function snap(p, width) {
    return Math.round(width) % 2 === 1 ? Math.floor(p) + 0.5 : Math.round(p);
  }

  function formatNumber(v, decimalComma) {
    let str = String(parseFloat(v.toFixed(10)));
    if (decimalComma) str = str.replace('.', ',');
    return str.replace('-', '−');
  }

  function dashPattern(style, width) {
    if (style === 'dashed') return [width * 4, width * 2.5];
    if (style === 'dotted') return [width * 0.01, width * 2];
    return [];
  }

  function drawGrid(ctx, W, H, ox, oy, g, cfg) {
    const gr = cfg.grid;
    const s = cfg._s;
    const step = g * s;
    if (step < 2) return; // zu fein für die Vorschau

    const lines = [[], []]; // [minor, major]
    const every = gr.majorEvery > 1 ? Math.round(gr.majorEvery) : 0;
    const kx0 = Math.ceil(-ox / step - 1e-9), kx1 = Math.floor((W - ox) / step + 1e-9);
    for (let k = kx0; k <= kx1; k++) {
      const major = every && ((k % every) + every) % every === 0;
      lines[major ? 1 : 0].push(['v', ox + k * step]);
    }
    const ky0 = Math.ceil(-oy / step - 1e-9), ky1 = Math.floor((H - oy) / step + 1e-9);
    for (let k = ky0; k <= ky1; k++) {
      const major = every && ((k % every) + every) % every === 0;
      lines[major ? 1 : 0].push(['h', oy + k * step]);
    }

    const styles = [
      { color: gr.color, width: lw(gr.width, s) },
      { color: gr.majorColor, width: lw(gr.majorWidth, s) }
    ];
    for (let i = 0; i < 2; i++) {
      if (!lines[i].length) continue;
      const st = styles[i];
      ctx.beginPath();
      ctx.strokeStyle = st.color;
      ctx.lineWidth = st.width;
      for (const [dir, p] of lines[i]) {
        const q = snap(p, st.width);
        if (dir === 'v') { ctx.moveTo(q, 0); ctx.lineTo(q, H); } else { ctx.moveTo(0, q); ctx.lineTo(W, q); }
      }
      ctx.stroke();
    }
  }

  function arrowHead(ctx, x, y, dir, size, color) {
    // dir: 'r' (nach rechts) oder 'u' (nach oben)
    ctx.beginPath();
    ctx.fillStyle = color;
    if (dir === 'r') {
      ctx.moveTo(x, y);
      ctx.lineTo(x - size, y - size * 0.4);
      ctx.lineTo(x - size * 0.75, y);
      ctx.lineTo(x - size, y + size * 0.4);
    } else {
      ctx.moveTo(x, y);
      ctx.lineTo(x - size * 0.4, y + size);
      ctx.lineTo(x, y + size * 0.75);
      ctx.lineTo(x + size * 0.4, y + size);
    }
    ctx.closePath();
    ctx.fill();
  }

  function render(ctx, cfg, s) {
    const size = pageSize(cfg);
    const W = Math.round(size.w * s), H = Math.round(size.h * s);
    cfg = Object.assign({}, cfg, { _s: s });

    ctx.save();
    ctx.clearRect(0, 0, W, H);
    if (cfg.background !== 'transparent') {
      ctx.fillStyle = cfg.backgroundColor || '#ffffff';
      ctx.fillRect(0, 0, W, H);
    }

    if (cfg.mode === 'grid') {
      if (cfg.grid.show) {
        const g = cfg.grid.size;
        let ox = 0, oy = 0;
        if (cfg.paper.center) {
          // Raster mittig ausrichten, sodass an allen Rändern gleich viel Rest bleibt
          ox = (size.w * s - Math.floor(size.w / g + 1e-9) * g * s) / 2;
          oy = (size.h * s - Math.floor(size.h / g + 1e-9) * g * s) / 2;
        }
        drawGrid(ctx, W, H, ox, oy, g, cfg);
      }
      if (cfg.paper.frame) {
        const fw = lw(cfg.grid.majorWidth, s);
        ctx.strokeStyle = cfg.grid.majorColor;
        ctx.lineWidth = fw;
        ctx.strokeRect(fw / 2, fw / 2, W - fw, H - fw);
      }
      ctx.restore();
      return { width: W, height: H };
    }

    const c = cfg.coord;
    const ux = c.unitX * s, uy = c.unitY * s;
    const ox = c.marginLeft * s - c.xMin * ux;
    const oy = c.marginTop * s + c.yMax * uy;
    const toPx = (x) => ox + x * ux;
    const toPy = (y) => oy - y * uy;
    const left = toPx(c.xMin), right = toPx(c.xMax);
    const top = toPy(c.yMax), bottom = toPy(c.yMin);

    if (cfg.grid.show) {
      if (c.gridOnlyInside) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(left, top, right - left, bottom - top);
        ctx.clip();
      }
      drawGrid(ctx, W, H, ox, oy, cfg.grid.size, cfg);
      if (c.gridOnlyInside) ctx.restore();
    }

    // Achsen
    const axW = lw(c.axisWidth, s);
    const axX = c.yMin <= 0 && c.yMax >= 0 ? toPy(0) : bottom; // Lage der x-Achse
    const axY = c.xMin <= 0 && c.xMax >= 0 ? toPx(0) : left;   // Lage der y-Achse
    const axXs = snap(axX, axW), axYs = snap(axY, axW);
    const over = Math.max(0, c.overhang) * s;
    const arrowSize = Math.max(4, 0.28 * s * (c.axisWidth / 0.3) ** 0.3);
    const font = (c.fontSize * PT_TO_CM * s).toFixed(2) + 'px ' + c.fontFamily;
    const fontPx = c.fontSize * PT_TO_CM * s;
    const tick = 0.1 * s;
    // Text mit optionaler weißer Umrandung, damit Karolinien die Zahlen nicht durchkreuzen
    const text = (str, x, y) => {
      if (c.labelHalo) {
        ctx.save();
        ctx.lineWidth = Math.max(2, fontPx * 0.28);
        ctx.lineJoin = 'round';
        ctx.strokeStyle = cfg.background === 'transparent' ? '#ffffff' : (cfg.backgroundColor || '#ffffff');
        ctx.strokeText(str, x, y);
        ctx.restore();
      }
      ctx.fillText(str, x, y);
    };

    if (c.showAxes) {
      ctx.strokeStyle = c.axisColor;
      ctx.lineWidth = axW;
      ctx.beginPath();
      const xEnd = Math.min(W - 1, right + over);
      const yEnd = Math.max(1, top - over);
      ctx.moveTo(Math.max(0, left - (c.arrows ? 0 : over)), axXs);
      ctx.lineTo(c.arrows ? xEnd - arrowSize * 0.5 : xEnd, axXs);
      ctx.moveTo(axYs, Math.min(H, bottom + (c.arrows ? 0 : over)));
      ctx.lineTo(axYs, c.arrows ? yEnd + arrowSize * 0.5 : yEnd);
      ctx.stroke();
      if (c.arrows) {
        arrowHead(ctx, xEnd, axXs, 'r', arrowSize, c.axisColor);
        arrowHead(ctx, axYs, yEnd, 'u', arrowSize, c.axisColor);
      }

      ctx.font = font;
      ctx.fillStyle = c.axisColor;

      // Achsenbeschriftung
      if (c.labelX) {
        ctx.textAlign = 'right';
        ctx.textBaseline = 'top';
        text(c.labelX, xEnd, axXs + tick + fontPx * 0.25);
      }
      if (c.labelY) {
        ctx.textAlign = 'right';
        ctx.textBaseline = 'top';
        text(c.labelY, axYs - tick - fontPx * 0.3, yEnd);
      }

      // Skalenstriche und Zahlen
      const eps = 1e-9;
      if (c.stepX > 0) {
        ctx.beginPath();
        ctx.lineWidth = Math.max(1, axW * 0.8);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        const k0 = Math.ceil(c.xMin / c.stepX - eps), k1 = Math.floor(c.xMax / c.stepX + eps);
        for (let k = k0; k <= k1; k++) {
          const v = k * c.stepX;
          const p = snap(toPx(v), ctx.lineWidth);
          if (Math.abs(p - axYs) < 1 && axY !== left) continue;
          if (c.showTicks) { ctx.moveTo(p, axXs - tick); ctx.lineTo(p, axXs + tick); }
          if (c.showNumbers && k !== 0 && !(c.arrows && Math.abs(toPx(v) - right) < eps && over < fontPx)) {
            text(formatNumber(v, c.decimalComma), p, axXs + tick + fontPx * 0.15);
          }
        }
        ctx.stroke();
      }
      if (c.stepY > 0) {
        ctx.beginPath();
        ctx.lineWidth = Math.max(1, axW * 0.8);
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        const k0 = Math.ceil(c.yMin / c.stepY - eps), k1 = Math.floor(c.yMax / c.stepY + eps);
        for (let k = k0; k <= k1; k++) {
          const v = k * c.stepY;
          const p = snap(toPy(v), ctx.lineWidth);
          if (Math.abs(p - axXs) < 1 && axX !== bottom) continue;
          if (c.showTicks) { ctx.moveTo(axYs - tick, p); ctx.lineTo(axYs + tick, p); }
          if (c.showNumbers && k !== 0) {
            text(formatNumber(v, c.decimalComma), axYs - tick - fontPx * 0.25, p);
          }
        }
        ctx.stroke();
      }
      // Ursprung
      if (c.showNumbers && c.showOrigin && axX === toPy(0) && axY === toPx(0)) {
        ctx.textAlign = 'right';
        ctx.textBaseline = 'top';
        text('0', axYs - tick * 0.6, axXs + tick * 0.6);
      }
    }

    // Funktionsgraphen
    ctx.save();
    ctx.beginPath();
    ctx.rect(left, top, right - left, bottom - top);
    ctx.clip();
    for (const fn of cfg.functions || []) {
      if (!fn.compiled || fn.hidden) continue;
      drawFunction(ctx, fn, c, toPx, toPy, { left, right, top, bottom, s, H });
    }
    ctx.restore();

    // Funktionsnamen (außerhalb des Clippings, damit sie nicht abgeschnitten werden)
    for (const fn of cfg.functions || []) {
      if (!fn.compiled || fn.hidden || !fn.label || !fn._labelPos) continue;
      ctx.font = 'italic ' + font;
      ctx.fillStyle = fn.color;
      ctx.textAlign = fn._labelPos.align;
      ctx.textBaseline = fn._labelPos.baseline;
      text(fn.label, fn._labelPos.x, fn._labelPos.y);
    }

    // Punkte
    for (const pt of cfg.points || []) {
      const px = toPx(pt.x), py = toPy(pt.y);
      if (px < left - 1 || px > right + 1 || py < top - 1 || py > bottom + 1) continue;
      ctx.fillStyle = pt.color || c.axisColor;
      ctx.strokeStyle = pt.color || c.axisColor;
      if (c.pointStyle === 'cross') {
        const r = 0.12 * s;
        ctx.lineWidth = lw(c.axisWidth * 0.8, s);
        ctx.beginPath();
        ctx.moveTo(px - r, py - r); ctx.lineTo(px + r, py + r);
        ctx.moveTo(px - r, py + r); ctx.lineTo(px + r, py - r);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(px, py, 0.07 * s, 0, Math.PI * 2);
        ctx.fill();
      }
      if (pt.name) {
        ctx.font = font;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        text(pt.name, px + 0.12 * s, py - 0.08 * s);
      }
    }

    ctx.restore();
    return { width: W, height: H };
  }

  function drawFunction(ctx, fn, c, toPx, toPy, area) {
    const f = fn.compiled;
    const a = Math.max(c.xMin, isFinite(fn.from) ? fn.from : -Infinity);
    const b = Math.min(c.xMax, isFinite(fn.to) ? fn.to : Infinity);
    fn._labelPos = null;
    if (!(b > a)) return;

    const width = lw(fn.width, area.s);
    const plotH = area.bottom - area.top;
    const limTop = area.top - plotH * 2, limBottom = area.bottom + plotH * 2;
    const clampY = (py) => Math.min(limBottom, Math.max(limTop, py));
    const valid = (y) => typeof y === 'number' && isFinite(y);
    const evalAt = (x) => { try { return f(x); } catch (e) { return NaN; } };

    // Grenze des Definitionsbereichs zwischen x1 (gültig) und x2 (ungültig) suchen
    function edge(xIn, xOut) {
      for (let i = 0; i < 30; i++) {
        const m = (xIn + xOut) / 2;
        if (valid(evalAt(m))) xIn = m; else xOut = m;
      }
      return xIn;
    }

    // Prüft, ob zwischen zwei Stützstellen eine Sprungstelle/Polstelle liegt
    function jumps(x1, y1, x2, y2, depth) {
      const p1 = toPy(y1), p2 = toPy(y2);
      if ((p1 < area.top && p2 > area.bottom) || (p2 < area.top && p1 > area.bottom)) return true;
      if (Math.abs(p2 - p1) < plotH * 0.25) return false;
      if (depth > 6) return Math.abs(p2 - p1) > plotH * 0.5;
      const xm = (x1 + x2) / 2, ym = evalAt(xm);
      if (!valid(ym)) return true;
      const lo = Math.min(y1, y2), hi = Math.max(y1, y2), tol = (hi - lo) * 0.02;
      if (ym < lo - tol || ym > hi + tol) return true;
      return jumps(x1, y1, xm, ym, depth + 1) || jumps(xm, ym, x2, y2, depth + 1);
    }

    const n = Math.max(200, Math.ceil((toPx(b) - toPx(a)) * 2));
    const dx = (b - a) / n;

    ctx.beginPath();
    ctx.strokeStyle = fn.color;
    ctx.lineWidth = width;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.setLineDash(dashPattern(fn.style, width));

    let prevX = NaN, prevY = NaN, drawing = false;
    let lastVisible = null;
    for (let i = 0; i <= n; i++) {
      const x = i === n ? b : a + i * dx;
      const y = evalAt(x);
      if (valid(y)) {
        if (!valid(prevY) && i > 0) {
          // Beginn eines Definitionsbereichs genau bestimmen
          const xe = edge(x, prevX), ye = evalAt(xe);
          if (valid(ye)) { ctx.moveTo(toPx(xe), clampY(toPy(ye))); drawing = true; }
        }
        if (drawing && valid(prevY) && jumps(prevX, prevY, x, y, 0)) drawing = false;
        const px = toPx(x), py = clampY(toPy(y));
        if (drawing) ctx.lineTo(px, py); else { ctx.moveTo(px, py); drawing = true; }
        if (py >= area.top && py <= area.bottom) lastVisible = { x: px, y: py };
      } else if (valid(prevY)) {
        const xe = edge(prevX, x), ye = evalAt(xe);
        if (valid(ye) && drawing) ctx.lineTo(toPx(xe), clampY(toPy(ye)));
        drawing = false;
      }
      prevX = x; prevY = y;
    }
    ctx.stroke();
    ctx.setLineDash([]);

    if (lastVisible) {
      const s = area.s;
      const nearTop = lastVisible.y - area.top < 0.6 * s;
      fn._labelPos = {
        x: Math.min(lastVisible.x, area.right) - 0.15 * s,
        y: nearTop ? lastVisible.y + 0.2 * s : lastVisible.y - 0.2 * s,
        align: 'right',
        baseline: nearTop ? 'top' : 'bottom'
      };
    }
  }

  const api = { render, pageSize, formatNumber };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.Renderer = api;
})(typeof window !== 'undefined' ? window : globalThis);
