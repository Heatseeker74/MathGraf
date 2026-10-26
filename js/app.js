/* Bedienoberfläche: liest die Einstellungen, zeichnet die Vorschau und exportiert das PNG. */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const STORAGE_KEY = 'mathgraf-settings-v1';
  const COLORS = ['#1d5fbf', '#c0392b', '#1e8449', '#8e44ad', '#d35400', '#117a8b'];
  const MAX_PIXELS = 16000000; // Grenze mancher Browser (v. a. Safari) für Canvas-Flächen

  const FIELDS = [
    'paperWidth', 'paperHeight', 'paperCenter', 'paperFrame',
    'xMin', 'xMax', 'yMin', 'yMax', 'unitX', 'unitY', 'stepX', 'stepY', 'margin', 'overhang',
    'labelX', 'labelY', 'showAxes', 'arrows', 'showTicks', 'showNumbers', 'showOrigin', 'decimalComma', 'labelHalo',
    'axisWidth', 'axisColor', 'fontSize', 'fontFamily',
    'gridShow', 'gridOnlyInside', 'gridSize', 'gridWidth', 'gridColor', 'majorEvery', 'majorColor', 'majorWidth',
    'points', 'pointStyle', 'pointColor', 'dpi', 'background'
  ];

  let mode = 'coord';
  const preview = $('preview');
  const fnList = $('functionList');
  const fnTemplate = $('functionTemplate');

  function num(id) {
    const el = $(id);
    const v = parseFloat(String(el.value).replace(',', '.'));
    return isFinite(v) ? v : 0;
  }

  function readFieldValue(el) {
    return el.type === 'checkbox' ? el.checked : el.value;
  }

  function fmt(v) {
    return Renderer.formatNumber(Math.round(v * 100) / 100, true).replace('−', '-');
  }

  // ---------- Funktionen ----------

  function addFunction(data) {
    const node = fnTemplate.content.firstElementChild.cloneNode(true);
    const idx = fnList.children.length;
    data = data || {};
    node.querySelector('.fn-expr').value = data.expr || '';
    node.querySelector('.fn-color').value = data.color || COLORS[idx % COLORS.length];
    node.querySelector('.fn-width').value = data.width != null ? data.width : 0.4;
    node.querySelector('.fn-style').value = data.style || 'solid';
    node.querySelector('.fn-from').value = data.from || '';
    node.querySelector('.fn-to').value = data.to || '';
    node.querySelector('.fn-label').value = data.label || '';
    node.querySelector('.fn-remove').addEventListener('click', () => { node.remove(); update(); });
    fnList.appendChild(node);
    return node;
  }

  function readFunctions() {
    const result = [];
    for (const node of fnList.children) {
      const raw = node.querySelector('.fn-expr').value;
      const errEl = node.querySelector('.fn-error');
      const item = {
        expr: raw,
        color: node.querySelector('.fn-color').value,
        width: parseFloat(node.querySelector('.fn-width').value.replace(',', '.')) || 0.4,
        style: node.querySelector('.fn-style').value,
        fromText: node.querySelector('.fn-from').value,
        toText: node.querySelector('.fn-to').value,
        labelText: node.querySelector('.fn-label').value,
        from: NaN,
        to: NaN,
        compiled: null
      };
      errEl.textContent = '';
      node.classList.remove('invalid');
      if (raw.trim()) {
        try {
          const def = MathParser.splitDefinition(raw);
          item.compiled = MathParser.compile(def.term);
          item.label = item.labelText.trim() || (def.name ? def.name : '');
          if (item.fromText.trim()) item.from = MathParser.evalConst(item.fromText);
          if (item.toText.trim()) item.to = MathParser.evalConst(item.toText);
        } catch (e) {
          item.compiled = null;
          errEl.textContent = e.message;
          node.classList.add('invalid');
        }
      }
      result.push(item);
    }
    return result;
  }

  // ---------- Punkte ----------

  function readPoints() {
    const text = $('points').value;
    const errEl = $('pointsError');
    const points = [];
    const errors = [];
    const re = /([A-Za-zÄÖÜäöüß][\w'’]*)?\s*\(\s*([^|;)]+?)\s*[|;]\s*([^)]+?)\s*\)/g;
    let m;
    while ((m = re.exec(text))) {
      try {
        points.push({
          name: m[1] || '',
          x: MathParser.evalConst(m[2]),
          y: MathParser.evalConst(m[3]),
          color: $('pointColor').value
        });
      } catch (e) {
        errors.push(m[0] + ': ' + e.message);
      }
    }
    errEl.textContent = errors.join(' · ');
    return points;
  }

  // ---------- Konfiguration ----------

  function buildConfig() {
    const margin = Math.max(0, num('margin'));
    return {
      mode,
      background: $('background').value,
      paper: {
        width: num('paperWidth'),
        height: num('paperHeight'),
        center: $('paperCenter').checked,
        frame: $('paperFrame').checked
      },
      grid: {
        show: $('gridShow').checked,
        size: num('gridSize'),
        width: num('gridWidth'),
        color: $('gridColor').value,
        majorEvery: num('majorEvery'),
        majorColor: $('majorColor').value,
        majorWidth: num('majorWidth')
      },
      coord: {
        xMin: num('xMin'), xMax: num('xMax'), yMin: num('yMin'), yMax: num('yMax'),
        unitX: num('unitX'), unitY: num('unitY'),
        stepX: num('stepX'), stepY: num('stepY'),
        marginLeft: margin, marginRight: margin, marginTop: margin, marginBottom: margin,
        overhang: Math.min(num('overhang'), margin),
        labelX: $('labelX').value, labelY: $('labelY').value,
        showAxes: $('showAxes').checked,
        arrows: $('arrows').checked,
        showTicks: $('showTicks').checked,
        showNumbers: $('showNumbers').checked,
        showOrigin: $('showOrigin').checked,
        decimalComma: $('decimalComma').checked,
        labelHalo: $('labelHalo').checked,
        axisWidth: num('axisWidth'),
        axisColor: $('axisColor').value,
        fontSize: num('fontSize'),
        fontFamily: $('fontFamily').value,
        gridOnlyInside: $('gridOnlyInside').checked,
        pointStyle: $('pointStyle').value
      },
      functions: mode === 'coord' ? readFunctions() : [],
      points: mode === 'coord' ? readPoints() : []
    };
  }

  function validate(cfg) {
    if (cfg.mode === 'grid') {
      if (cfg.paper.width <= 0 || cfg.paper.height <= 0) return 'Breite und Höhe müssen größer als 0 sein.';
    } else {
      const c = cfg.coord;
      if (c.xMax <= c.xMin) return '„x bis“ muss größer als „x von“ sein.';
      if (c.yMax <= c.yMin) return '„y bis“ muss größer als „y von“ sein.';
      if (c.unitX <= 0 || c.unitY <= 0) return 'Die Einheiten müssen größer als 0 sein.';
    }
    if (cfg.grid.show && cfg.grid.size <= 0) return 'Die Kästchengröße muss größer als 0 sein.';
    const size = Renderer.pageSize(cfg);
    if (size.w > 200 || size.h > 200) return 'Das Bild wäre größer als 2 m – bitte Bereich oder Einheit verkleinern.';
    return '';
  }

  // ---------- Vorschau ----------

  let pending = false;
  function update() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      draw();
      save();
    });
  }

  function draw() {
    const cfg = buildConfig();
    const err = validate(cfg);
    $('exportError').textContent = err;
    $('download').disabled = !!err;
    if (err) return;

    const size = Renderer.pageSize(cfg);
    const dpi = parseInt($('dpi').value, 10);
    const ppcm = PngTools.dpiToPpm(dpi) / 100;
    const pxW = Math.round(size.w * ppcm), pxH = Math.round(size.h * ppcm);
    $('sizeInfo').textContent = fmt(size.w) + ' × ' + fmt(size.h) + ' cm';
    $('pixelInfo').textContent = pxW + ' × ' + pxH + ' Pixel bei ' + dpi + ' dpi' +
      (pxW * pxH > MAX_PIXELS ? ' – sehr groß, ggf. niedrigere Auflösung wählen' : '');

    const wrap = $('canvasWrap');
    const style = getComputedStyle(wrap);
    const availW = wrap.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    const availH = Math.max(300, window.innerHeight * 0.75);
    const cssScale = Math.min(availW / size.w, availH / size.h, 80); // CSS-Pixel pro cm
    const dpr = window.devicePixelRatio || 1;
    const s = cssScale * dpr;
    preview.width = Math.max(1, Math.round(size.w * s));
    preview.height = Math.max(1, Math.round(size.h * s));
    preview.style.width = preview.width / dpr + 'px';
    preview.style.height = preview.height / dpr + 'px';
    Renderer.render(preview.getContext('2d'), cfg, s);
  }

  // ---------- Export ----------

  function exportPng() {
    const cfg = buildConfig();
    if (validate(cfg)) return;
    const dpi = parseInt($('dpi').value, 10);
    const ppm = PngTools.dpiToPpm(dpi);
    const s = ppm / 100; // Pixel pro cm
    const size = Renderer.pageSize(cfg);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(size.w * s);
    canvas.height = Math.round(size.h * s);
    const ctx = canvas.getContext('2d');
    if (!ctx) { $('exportError').textContent = 'Das Bild ist zu groß für diesen Browser. Bitte eine niedrigere Auflösung wählen.'; return; }
    Renderer.render(ctx, cfg, s);

    canvas.toBlob(async (blob) => {
      if (!blob) {
        $('exportError').textContent = 'Das Bild ist zu groß für diesen Browser. Bitte eine niedrigere Auflösung wählen.';
        return;
      }
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const out = PngTools.setPhys(bytes, ppm);
      const kind = cfg.mode === 'grid' ? 'karopapier' : (cfg.functions.some((f) => f.compiled) ? 'funktionsgraph' : 'koordinatensystem');
      saveFile(new Blob([out], { type: 'image/png' }), kind + '_' + fmt(size.w) + 'x' + fmt(size.h) + 'cm.png');
    }, 'image/png');
  }

  // Als Claude-Artifact darf die Seite nicht selbst herunterladen, dort läuft das Speichern über "downloads".
  const downloadsReady = window.claude && typeof window.claude.use === 'function'
    ? window.claude.use('downloads').catch(() => null)
    : Promise.resolve(null);

  async function saveFile(blob, filename) {
    const downloads = await downloadsReady;
    if (downloads) {
      try {
        await downloads.save({ filename, data: blob });
      } catch (e) {
        if (e && e.code !== 'declined') $('exportError').textContent = 'Speichern nicht möglich: ' + (e.message || e.code);
      }
      return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  // ---------- Speichern / Laden ----------

  function save() {
    const data = { mode, fields: {}, functions: [] };
    for (const id of FIELDS) data.fields[id] = readFieldValue($(id));
    for (const node of fnList.children) {
      data.functions.push({
        expr: node.querySelector('.fn-expr').value,
        color: node.querySelector('.fn-color').value,
        width: node.querySelector('.fn-width').value,
        style: node.querySelector('.fn-style').value,
        from: node.querySelector('.fn-from').value,
        to: node.querySelector('.fn-to').value,
        label: node.querySelector('.fn-label').value
      });
    }
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (e) { /* ohne Speicher weiterarbeiten */ }
  }

  function load() {
    let data = null;
    try { data = JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch (e) { data = null; }
    if (!data) {
      addFunction({ expr: 'f(x) = 0,5x^2 - 2' });
      return;
    }
    for (const id of FIELDS) {
      const el = $(id);
      if (!el || !(id in data.fields)) continue;
      if (el.type === 'checkbox') el.checked = !!data.fields[id]; else el.value = data.fields[id];
    }
    (data.functions || []).forEach(addFunction);
    setMode(data.mode === 'grid' ? 'grid' : 'coord');
  }

  // ---------- Modus & Vorlagen ----------

  function setMode(m) {
    mode = m;
    document.querySelectorAll('.tab').forEach((t) => {
      const active = t.dataset.mode === m;
      t.classList.toggle('active', active);
      t.setAttribute('aria-selected', active);
    });
    document.querySelectorAll('.mode-coord').forEach((el) => { el.hidden = m !== 'coord'; });
    document.querySelectorAll('.mode-grid').forEach((el) => { el.hidden = m !== 'grid'; });
    update();
  }

  document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => setMode(t.dataset.mode)));

  document.querySelectorAll('[data-paper]').forEach((b) => b.addEventListener('click', () => {
    const [w, h] = b.dataset.paper.split(',');
    $('paperWidth').value = w;
    $('paperHeight').value = h;
    update();
  }));

  document.querySelectorAll('[data-grid]').forEach((b) => b.addEventListener('click', () => {
    const [size, every, color, width, majorColor, majorWidth] = b.dataset.grid.split(',');
    $('gridShow').checked = true;
    $('gridSize').value = size;
    $('majorEvery').value = every;
    $('gridColor').value = color;
    $('gridWidth').value = width;
    if (majorColor) $('majorColor').value = majorColor;
    if (majorWidth) $('majorWidth').value = majorWidth;
    update();
  }));

  $('addFunction').addEventListener('click', () => {
    addFunction().querySelector('.fn-expr').focus();
    update();
  });
  $('download').addEventListener('click', exportPng);
  $('settings').addEventListener('input', update);
  $('settings').addEventListener('change', update);
  $('dpi').addEventListener('change', update);
  $('background').addEventListener('change', update);
  window.addEventListener('resize', update);

  load();
  update();
})();
