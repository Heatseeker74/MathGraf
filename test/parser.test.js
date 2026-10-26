const assert = require('assert');
const { compile, splitDefinition, evalConst } = require('../js/parser.js');
const { setPhys, readPhys, dpiToPpm, crc32 } = require('../js/png.js');

const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);
const cases = [
  ['0,5x^2 - 2', 2, 0], ['2x+1', 3, 7], ['-x^2', 3, -9], ['2^-1', 0, 0.5],
  ['3(x+1)', 1, 6], ['x sin(x)', Math.PI / 2, Math.PI / 2], ['sin x', 0.5, Math.sin(0.5)],
  ['2sin(x)', Math.PI / 2, 2], ['|x| - 1', -3, 2], ['2|x-1|', -1, 4], ['e^(-x)', 0, 1],
  ['sqrt(x+4)', 0, 2], ['x^(1/3)', -8, -2], ['root(x; 3)', -27, -3], ['logb(2; x)', 8, 3],
  ['pi', 0, Math.PI], ['2pix', 1, 2 * Math.PI], ['x²', 3, 9], ['1/2x', 4, 2], ['2^3^2', 0, 512],
  ['max(1, x)', 5, 5], ['ln(e)', 0, 1], ['lg(100)', 0, 2], ['(x-1)(x+2)', 2, 4], ['3·x', 2, 6],
];
for (const [src, x, y] of cases) near(compile(src)(x), y);
assert.deepStrictEqual(splitDefinition('f(x) = x^2'), { name: 'f', term: 'x^2' });
assert.deepStrictEqual(splitDefinition('y = 2x'), { name: '', term: '2x' });
near(evalConst('pi/2'), Math.PI / 2);
near(evalConst('-1,5'), -1.5);
for (const bad of ['2+', 'foo(x)', 'sin', '(x', 'x)']) assert.throws(() => compile(bad), bad);

// PNG: minimal IHDR + IEND
function chunk(type, data) {
  const b = Buffer.alloc(12 + data.length);
  b.writeUInt32BE(data.length, 0); b.write(type, 4, 'ascii'); Buffer.from(data).copy(b, 8);
  b.writeUInt32BE(crc32(b.subarray(4, 8 + data.length)), 8 + data.length);
  return b;
}
const png = new Uint8Array(Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),
  chunk('IHDR', new Uint8Array(13)), chunk('pHYs', new Uint8Array(9)), chunk('IEND', new Uint8Array(0))]));
const out = setPhys(png, dpiToPpm(300));
assert.deepStrictEqual(readPhys(out), { x: 11811, y: 11811, unit: 1 });
assert.strictEqual(out.length, png.length); // vorhandener pHYs ersetzt, nicht doppelt
assert.strictEqual(crc32(Buffer.from('IEND')), 0xae426082);
console.log('alle Tests bestanden');
