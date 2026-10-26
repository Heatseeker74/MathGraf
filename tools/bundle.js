// Fasst die App zu einer einzigen HTML-Datei zusammen (CSS und JS inline).
// Aufruf: node tools/bundle.js <ziel.html> [--fragment]
// --fragment lässt doctype/html/head/body weg (für das Veröffentlichen als Claude-Artifact).
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const [out, flag] = process.argv.slice(2);
if (!out) { console.error('Ziel-Datei fehlt'); process.exit(1); }

let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
html = html.replace(/<link rel="stylesheet" href="([^"]+)">/g,
  (_, f) => '<style>\n' + fs.readFileSync(path.join(root, f), 'utf8') + '</style>');
html = html.replace(/<script src="([^"]+)"><\/script>/g,
  (_, f) => '<script>\n' + fs.readFileSync(path.join(root, f), 'utf8') + '</script>');

if (flag === '--fragment') {
  const head = /<head>([\s\S]*?)<\/head>/.exec(html)[1]
    .replace(/<meta charset[^>]*>\s*/, '').replace(/<meta name="viewport"[^>]*>\s*/, '');
  const body = /<body>([\s\S]*)<\/body>/.exec(html)[1];
  html = head.trim() + '\n' + body.trim() + '\n';
}
fs.writeFileSync(out, html);
console.log('geschrieben:', out, Math.round(html.length / 1024) + ' KB');
