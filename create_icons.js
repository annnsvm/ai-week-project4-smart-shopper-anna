// Smart Shopper — icon generator
// Run: node create_icons.js
// Generates icons/icon{16,32,48,128}.png using only Node built-ins

const fs   = require('fs');
const path = require('path');
const zlib = require('zlib');

const OUT_DIR = path.join(__dirname, 'extension', 'icons');
fs.mkdirSync(OUT_DIR, { recursive: true });

// CRC32 lookup table
const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let crc = 0xffffffff;
  for (const b of buf) crc = crcTable[(crc ^ b) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const lenBuf    = Buffer.allocUnsafe(4);
  lenBuf.writeUInt32BE(data.length);
  const crcBuf = Buffer.allocUnsafe(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])));
  return Buffer.concat([lenBuf, typeBytes, data, crcBuf]);
}

function makePNG(size, drawFn) {
  // IHDR
  const ihdr = Buffer.allocUnsafe(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8]  = 8;  // bit depth
  ihdr[9]  = 2;  // color type: RGB
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  // Raw pixel data: one filter byte (0x00) per row + RGB pixels
  const raw = Buffer.allocUnsafe(size * (1 + size * 3));
  for (let y = 0; y < size; y++) {
    raw[y * (1 + size * 3)] = 0; // filter: None
    for (let x = 0; x < size; x++) {
      const [r, g, b] = drawFn(x, y, size);
      const off = y * (1 + size * 3) + 1 + x * 3;
      raw[off]   = r;
      raw[off+1] = g;
      raw[off+2] = b;
    }
  }

  const idat = zlib.deflateSync(raw, { level: 9 });

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), // PNG signature
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// Draw function: shopping bag icon on indigo background
function drawIcon(x, y, size) {
  const cx = size / 2;
  const cy = size / 2;

  // Background: indigo gradient approximation
  const dist = Math.hypot(x - cx, y - cy) / (size * 0.7);
  const bg = lerpColor([79, 70, 229], [109, 40, 217], Math.min(dist, 1));

  // Shopping bag shape (centered, scaled to size)
  const s  = size / 16;  // scale unit
  const bx = cx - 5 * s, bw = 10 * s;
  const by = cy - 3 * s, bh = 7 * s;
  // Bag body: rounded rect approximation
  const inBagX = x >= bx && x <= bx + bw;
  const inBagY = y >= by && y <= by + bh;
  const inBag  = inBagX && inBagY;

  // Handle: arch above the bag
  const hMidX  = cx, hMidY = cy - 5 * s;
  const hRadius = 3 * s;
  const hThick  = 1.2 * s;
  const hdist   = Math.hypot(x - hMidX, y - hMidY);
  const inHandle = hdist >= hRadius - hThick && hdist <= hRadius + hThick && y <= hMidY + hRadius * 0.5;

  if (inBag || inHandle) {
    // White icon
    return [255, 255, 255];
  }

  return bg;
}

function lerpColor(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

const sizes = [16, 32, 48, 128];
for (const size of sizes) {
  const png  = makePNG(size, drawIcon);
  const file = path.join(OUT_DIR, `icon${size}.png`);
  fs.writeFileSync(file, png);
  console.log(`✓ icons/icon${size}.png`);
}

console.log('\nDone! Icons written to extension/icons/');
