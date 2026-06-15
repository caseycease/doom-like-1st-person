import { it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { Renderer } from '../src/render/renderer';
import { ProceduralAssets } from '../src/assets/procedural';
import { createWorld, step } from '../src/engine/world';
import { emptyInput } from '../src/engine/input';
import { CAMPAIGN } from '../src/levels';

// Dev-only: SHOT=1 npx vitest run screenshot  -> writes PNGs to /tmp.
// Lets us eyeball the renderer headlessly (no browser needed).

const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Uint8Array): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBytes = Buffer.from(type, 'ascii');
  const body = Buffer.concat([typeBytes, Buffer.from(data)]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}
function encodePng(w: number, h: number, buf: Uint32Array): Buffer {
  const bytes = new Uint8Array(buf.buffer); // memory order R,G,B,A == PNG RGBA
  const stride = w * 4;
  const raw = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) raw.set(bytes.subarray(y * stride, (y + 1) * stride), y * (stride + 1) + 1);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', new Uint8Array(0))]);
}

it.runIf(process.env.SHOT)('renders campaign screenshots', () => {
  const assets = new ProceduralAssets();
  CAMPAIGN.forEach((lvl, i) => {
    const w = createWorld(lvl.map);
    for (let k = 0; k < 40; k++) step(w, 1 / 60, emptyInput()); // let clowns wake/approach
    const r = new Renderer(640, 360, assets);
    r.render(w);
    writeFileSync(`/tmp/shot${i + 1}.png`, encodePng(r.width, r.height, r.buf));
  });
});
