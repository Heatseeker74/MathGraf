/*
 * Kleiner, sicherer Parser für Funktionsterme (kein eval).
 * Unterstützt: + - * / ^, Klammern, implizite Multiplikation (2x, 3(x+1), x sin(x)),
 * Dezimalkomma (0,5x), Konstanten pi/π/e und gängige Funktionen.
 */
(function (global) {
  'use strict';

  const FUNCS = {
    sin: Math.sin, cos: Math.cos, tan: Math.tan,
    cot: (x) => 1 / Math.tan(x),
    arcsin: Math.asin, arccos: Math.acos, arctan: Math.atan,
    asin: Math.asin, acos: Math.acos, atan: Math.atan,
    sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh,
    sqrt: Math.sqrt, wurzel: Math.sqrt,
    cbrt: Math.cbrt,
    abs: Math.abs, betrag: Math.abs,
    ln: Math.log, lg: Math.log10, log: Math.log10,
    exp: Math.exp,
    floor: Math.floor, ceil: Math.ceil, round: Math.round,
    sgn: Math.sign, sign: Math.sign,
    min: Math.min, max: Math.max,
    pow: Math.pow,
    root: (x, n) => {
      if (x < 0 && Math.abs(n % 2) === 1) return -Math.pow(-x, 1 / n);
      return Math.pow(x, 1 / n);
    },
    logb: (b, x) => Math.log(x) / Math.log(b)
  };

  const CONSTS = { pi: Math.PI, 'π': Math.PI, e: Math.E };

  // All names sorted longest first for greedy splitting of e.g. "xsin" -> x, sin
  const NAMES = Object.keys(FUNCS).concat(Object.keys(CONSTS), ['x'])
    .sort((a, b) => b.length - a.length);

  class ParseError extends Error {}

  function tokenize(src) {
    // Dezimalkomma zwischen Ziffern -> Punkt
    src = src.replace(/(\d),(?=\d)/g, '$1.');
    src = src.replace(/[·×]/g, '*').replace(/[−–]/g, '-').replace(/:/g, '/')
      .replace(/²/g, '^2').replace(/³/g, '^3');
    const tokens = [];
    let i = 0;
    while (i < src.length) {
      const c = src[i];
      if (/\s/.test(c)) { i++; continue; }
      if (/[0-9.]/.test(c)) {
        const m = /^(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/.exec(src.slice(i));
        if (!m) throw new ParseError('Ungültige Zahl bei "' + src.slice(i, i + 5) + '"');
        tokens.push({ t: 'num', v: parseFloat(m[0]) });
        i += m[0].length;
        continue;
      }
      if (/[a-zA-Zπ]/.test(c)) {
        const m = /^[a-zA-Zπ]+/.exec(src.slice(i));
        let word = m[0].toLowerCase();
        i += m[0].length;
        // Wort in bekannte Namen zerlegen
        while (word.length) {
          const name = NAMES.find((n) => word.startsWith(n));
          if (!name) throw new ParseError('Unbekannter Name "' + word + '"');
          tokens.push({ t: 'id', v: name });
          word = word.slice(name.length);
        }
        continue;
      }
      if ('+-*/^()'.includes(c)) { tokens.push({ t: c }); i++; continue; }
      if (c === ';' || c === ',') { tokens.push({ t: ',' }); i++; continue; }
      if (c === '[' || c === '{') { tokens.push({ t: '(' }); i++; continue; }
      if (c === ']' || c === '}') { tokens.push({ t: ')' }); i++; continue; }
      if (c === '|') { tokens.push({ t: '|' }); i++; continue; }
      throw new ParseError('Unerwartetes Zeichen "' + c + '"');
    }
    return tokens;
  }

  // Liefert eine kompilierte Funktion f(x)
  function compile(src) {
    const tokens = tokenize(src);
    let pos = 0;
    let absDepth = 0;
    const peek = () => tokens[pos];
    const next = () => tokens[pos++];
    const expect = (t) => {
      const tok = next();
      if (!tok || tok.t !== t) throw new ParseError('"' + t + '" erwartet');
      return tok;
    };

    function startsPrimary(tok) {
      if (!tok) return false;
      if (tok.t === 'num' || tok.t === 'id' || tok.t === '(') return true;
      // Betragsstrich öffnet nur, wenn wir nicht in einem Betrag sind
      return tok.t === '|' && absDepth === 0;
    }

    function parseExpr() {
      let left = parseTerm();
      while (peek() && (peek().t === '+' || peek().t === '-')) {
        const op = next().t;
        const a = left, b = parseTerm();
        left = op === '+' ? (x) => a(x) + b(x) : (x) => a(x) - b(x);
      }
      return left;
    }

    function parseTerm() {
      let left = parseUnary();
      for (;;) {
        const tok = peek();
        if (tok && (tok.t === '*' || tok.t === '/')) {
          next();
          const a = left, b = parseUnary();
          left = tok.t === '*' ? (x) => a(x) * b(x) : (x) => a(x) / b(x);
        } else if (startsPrimary(tok)) {
          const a = left, b = parsePower();
          left = (x) => a(x) * b(x);
        } else {
          return left;
        }
      }
    }

    function parseUnary() {
      const tok = peek();
      if (tok && tok.t === '-') { next(); const a = parseUnary(); return (x) => -a(x); }
      if (tok && tok.t === '+') { next(); return parseUnary(); }
      return parsePower();
    }

    function parsePower() {
      const base = parsePrimary();
      if (peek() && peek().t === '^') {
        next();
        const ex = parseUnary(); // rechtsassoziativ, erlaubt 2^-x
        return (x) => {
          const b = base(x), e = ex(x);
          // reelle ungerade Wurzeln negativer Zahlen, z. B. x^(1/3)
          if (b < 0 && !Number.isInteger(e)) {
            const inv = 1 / e;
            if (Number.isInteger(Math.round(inv)) && Math.abs(inv - Math.round(inv)) < 1e-9 &&
                Math.abs(Math.round(inv)) % 2 === 1) {
              return -Math.pow(-b, e);
            }
          }
          return Math.pow(b, e);
        };
      }
      return base;
    }

    function parseArgs() {
      expect('(');
      const args = [parseExpr()];
      while (peek() && peek().t === ',') { next(); args.push(parseExpr()); }
      expect(')');
      return args;
    }

    function parsePrimary() {
      const tok = next();
      if (!tok) throw new ParseError('Term unvollständig');
      if (tok.t === 'num') { const v = tok.v; return () => v; }
      if (tok.t === '(') {
        const e = parseExpr();
        expect(')');
        return e;
      }
      if (tok.t === '|') {
        absDepth++;
        const e = parseExpr();
        absDepth--;
        expect('|');
        return (x) => Math.abs(e(x));
      }
      if (tok.t === 'id') {
        if (tok.v === 'x') return (x) => x;
        if (tok.v in CONSTS) { const v = CONSTS[tok.v]; return () => v; }
        const fn = FUNCS[tok.v];
        if (!peek() || peek().t !== '(') {
          // "sin x" bzw. "sin x^2" ohne Klammer
          if (!startsPrimary(peek())) throw new ParseError('Nach "' + tok.v + '" fehlt das Argument');
          const a = parsePower();
          return (x) => fn(a(x));
        }
        const args = parseArgs();
        if (args.length === 1) { const a = args[0]; return (x) => fn(a(x)); }
        if (args.length === 2) { const a = args[0], b = args[1]; return (x) => fn(a(x), b(x)); }
        return (x) => fn.apply(null, args.map((a) => a(x)));
      }
      throw new ParseError('Unerwartetes Zeichen "' + tok.t + '"');
    }

    if (!tokens.length) throw new ParseError('Leerer Term');
    const f = parseExpr();
    if (pos < tokens.length) throw new ParseError('Unerwartetes "' + (tokens[pos].v || tokens[pos].t) + '"');
    return f;
  }

  // Entfernt ein vorangestelltes "f(x) =" bzw. "y =" und liefert {name, term}
  function splitDefinition(src) {
    const m = /^\s*([a-zA-Z][a-zA-Z0-9_']*)\s*(\(\s*x\s*\))?\s*=\s*(.*)$/.exec(src);
    if (m && (m[2] || m[1] === 'y')) return { name: m[2] ? m[1] : '', term: m[3] };
    return { name: '', term: src };
  }

  // Wertet einen konstanten Ausdruck aus (z. B. "pi/2", "-1,5")
  function evalConst(src) {
    return compile(src)(NaN);
  }

  const api = { compile, splitDefinition, evalConst, ParseError };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.MathParser = api;
})(typeof window !== 'undefined' ? window : globalThis);
