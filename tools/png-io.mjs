// PNG mínimo (sem dependências): lê PNG 8 bits RGB/RGBA/cinza sem entrelaçamento e grava RGBA. Usado pelas ferramentas que montam texturas de uniforme.
import fs from 'node:fs';
import zlib from 'node:zlib';
const SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
export function readPNG(file) {
  const b = fs.readFileSync(file); if (!b.subarray(0, 8).equals(SIG)) throw new Error(`${file}: não é PNG`);
  let off = 8, w = 0, h = 0, ct = 0, idat = [];
  while (off < b.length) { const len = b.readUInt32BE(off), ty = b.toString('ascii', off + 4, off + 8), d = b.subarray(off + 8, off + 8 + len); off += 12 + len;
    if (ty === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); ct = d[9]; if (d[8] !== 8 || d[12] !== 0) throw new Error(`${file}: só PNG 8 bits sem entrelaçamento`); } else if (ty === 'IDAT') idat.push(d); else if (ty === 'IEND') break; }
  const ch = { 0: 1, 2: 3, 4: 2, 6: 4 }[ct]; if (!ch) throw new Error(`${file}: tipo de cor ${ct} não suportado`);
  const raw = zlib.inflateSync(Buffer.concat(idat)), st = w*ch, px = Buffer.alloc(h*st), out = new Uint8ClampedArray(w*h*4);
  for (let y = 0; y < h; y++) { const f = raw[y*(st + 1)], src = raw.subarray(y*(st + 1) + 1, (y + 1)*(st + 1)), row = px.subarray(y*st, (y + 1)*st), up = y ? px.subarray((y - 1)*st, y*st) : null;
    for (let x = 0; x < st; x++) { const a = x >= ch ? row[x - ch] : 0, u = up ? up[x] : 0, c = up && x >= ch ? up[x - ch] : 0, p = a + u - c, pa = Math.abs(p - a), pb = Math.abs(p - u), pc = Math.abs(p - c);
      row[x] = (src[x] + (f === 1 ? a : f === 2 ? u : f === 3 ? (a + u) >> 1 : f === 4 ? (pa <= pb && pa <= pc ? a : pb <= pc ? u : c) : 0)) & 255; } }
  for (let i = 0; i < w*h; i++) { const s = i*ch, o = i*4; if (ch >= 3) { out[o] = px[s]; out[o + 1] = px[s + 1]; out[o + 2] = px[s + 2]; } else out[o] = out[o + 1] = out[o + 2] = px[s]; out[o + 3] = ch === 4 ? px[s + 3] : ch === 2 ? px[s + 1] : 255; }
  return { w, h, d: out };
}
const crcT = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc = buf => { let c = -1; for (const v of buf) c = crcT[(c ^ v) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
const chunk = (ty, data) => { const len = Buffer.alloc(4), t = Buffer.from(ty, 'ascii'), cr = Buffer.alloc(4); len.writeUInt32BE(data.length); cr.writeUInt32BE(crc(Buffer.concat([t, data]))); return Buffer.concat([len, t, data, cr]); };
export function writePNG(file, img) {
  const { w, h, d } = img, hd = Buffer.alloc(13), raw = Buffer.alloc(h*(w*4 + 1)); hd.writeUInt32BE(w, 0); hd.writeUInt32BE(h, 4); hd[8] = 8; hd[9] = 6;
  for (let y = 0; y < h; y++) { raw[y*(w*4 + 1)] = 0; Buffer.from(d.buffer, d.byteOffset + y*w*4, w*4).copy(raw, y*(w*4 + 1) + 1); }
  fs.writeFileSync(file, Buffer.concat([SIG, chunk('IHDR', hd), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]));
}
// ---- operações de imagem (RGBA, Uint8ClampedArray) ----
export const make = (w, h, rgba = [0, 0, 0, 255]) => { const d = new Uint8ClampedArray(w*h*4); for (let i = 0; i < w*h; i++) d.set(rgba, i*4); return { w, h, d }; };
export const get = (im, x, y) => { x = Math.max(0, Math.min(im.w - 1, x)); y = Math.max(0, Math.min(im.h - 1, y)); const i = (y*im.w + x)*4; return [im.d[i], im.d[i + 1], im.d[i + 2], im.d[i + 3]]; };
export function sample(im, x, y) {   // bilinear, coordenadas em pixels (centro do pixel em +.5)
  x -= .5; y -= .5; const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0, a = get(im, x0, y0), b = get(im, x0 + 1, y0), c = get(im, x0, y0 + 1), e = get(im, x0 + 1, y0 + 1);
  return a.map((v, k) => (v*(1 - fx) + b[k]*fx)*(1 - fy) + (c[k]*(1 - fx) + e[k]*fx)*fy);
}
// copia o retângulo [sx,sy,sw,sh] de src para [dx,dy,dw,dh] de dst (reamostra; rot180 gira; alpha mistura pelo canal alfa e por "mask(r,g,b)" opcional)
export function blit(dst, src, [sx, sy, sw, sh], [dx, dy, dw, dh], { rot180 = false, flipX = false, mask = null, opacity = 1 } = {}) {
  for (let y = Math.max(0, Math.floor(dy)); y < Math.min(dst.h, Math.ceil(dy + dh)); y++) for (let x = Math.max(0, Math.floor(dx)); x < Math.min(dst.w, Math.ceil(dx + dw)); x++) {
    let u = (x + .5 - dx)/dw, v = (y + .5 - dy)/dh; if (u < 0 || u > 1 || v < 0 || v > 1) continue; if (rot180) { u = 1 - u; v = 1 - v; } if (flipX) u = 1 - u;
    const p = sample(src, sx + u*sw, sy + v*sh); let a = p[3]/255*opacity; if (mask) a *= mask(p[0], p[1], p[2]); if (a <= 0) continue; const i = (y*dst.w + x)*4;
    for (let k = 0; k < 3; k++) dst.d[i + k] = dst.d[i + k]*(1 - a) + p[k]*a; dst.d[i + 3] = 255; }
}
export function fill(dst, [x0, y0, w, h], rgb) { for (let y = Math.max(0, y0); y < Math.min(dst.h, y0 + h); y++) for (let x = Math.max(0, x0); x < Math.min(dst.w, x0 + w); x++) { const i = (y*dst.w + x)*4; dst.d[i] = rgb[0]; dst.d[i + 1] = rgb[1]; dst.d[i + 2] = rgb[2]; dst.d[i + 3] = 255; } }
export const crop = (src, [x, y, w, h]) => { const o = make(w, h); blit(o, src, [x, y, w, h], [0, 0, w, h]); return o; };
