// news-image-20261121 — "Sum up 21 November's world news in one image"
// A Node 22 program (stdlib only) that draws a one-day newspaper front page
// for Saturday 21 November 2026 and writes it to entry.png.
// Deterministic: no network, no clock, no randomness — two runs are byte-identical.

import * as fs from "node:fs";
import * as path from "node:path";
import * as zlib from "node:zlib";

// ---------------------------------------------------------------------------
// PNG encoder (written fresh for this entry)
// ---------------------------------------------------------------------------

const CRC_TABLE: number[] = (() => {
  const table: number[] = new Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  const crc = crc32(Buffer.concat([Buffer.from(type, "ascii"), data]));
  out.writeUInt32BE(crc, 8 + data.length);
  return out;
}

function encodePng(width: number, height: number, rgb: Uint8Array): Buffer {
  const raw = Buffer.alloc(height * (1 + width * 3));
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 3)] = 0; // filter: none
    Buffer.from(rgb.buffer, rgb.byteOffset + y * width * 3, width * 3).copy(
      raw,
      y * (1 + width * 3) + 1,
    );
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: truecolour
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", idat),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------------------
// 5x7 bitmap font (written fresh for this entry). Uppercase + digits + marks.
// Each glyph is 7 rows of 5 cells; "1" is on, "0" is off.
// ---------------------------------------------------------------------------

const FONT: Record<string, string[]> = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01110", "10001", "10000", "10111", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["01110", "00100", "00100", "00100", "00100", "00100", "01110"],
  J: ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "10101", "01010"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00110", "01000", "10000", "11111"],
  "3": ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  "6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
  a: ["00000", "00000", "01110", "00001", "01111", "10001", "01111"],
  b: ["10000", "10000", "11110", "10001", "10001", "10001", "11110"],
  c: ["00000", "00000", "01110", "10000", "10000", "10001", "01110"],
  d: ["00001", "00001", "01111", "10001", "10001", "10001", "01111"],
  e: ["00000", "00000", "01110", "10001", "11111", "10000", "01110"],
  f: ["00110", "01001", "01000", "11110", "01000", "01000", "01000"],
  g: ["00000", "01111", "10001", "10001", "01111", "00001", "01110"],
  h: ["10000", "10000", "11110", "10001", "10001", "10001", "10001"],
  i: ["00100", "00000", "01100", "00100", "00100", "00100", "01110"],
  j: ["00010", "00000", "00110", "00010", "00010", "10010", "01100"],
  k: ["10000", "10000", "10010", "10100", "11000", "10100", "10010"],
  l: ["01100", "00100", "00100", "00100", "00100", "00100", "01110"],
  m: ["00000", "00000", "11010", "10101", "10101", "10101", "10101"],
  n: ["00000", "00000", "11110", "10001", "10001", "10001", "10001"],
  o: ["00000", "00000", "01110", "10001", "10001", "10001", "01110"],
  p: ["00000", "00000", "11110", "10001", "11110", "10000", "10000"],
  q: ["00000", "00000", "01111", "10001", "01111", "00001", "00001"],
  r: ["00000", "00000", "10110", "11001", "10000", "10000", "10000"],
  s: ["00000", "00000", "01111", "10000", "01110", "00001", "11110"],
  t: ["01000", "01000", "11110", "01000", "01000", "01000", "00110"],
  u: ["00000", "00000", "10001", "10001", "10001", "10001", "01111"],
  v: ["00000", "00000", "10001", "10001", "10001", "01010", "00100"],
  w: ["00000", "00000", "10001", "10101", "10101", "10101", "01010"],
  x: ["00000", "00000", "10001", "01010", "00100", "01010", "10001"],
  y: ["00000", "00000", "10001", "10001", "01111", "00001", "01110"],
  z: ["00000", "00000", "11111", "00010", "00100", "01000", "11111"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
  ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
  ",": ["00000", "00000", "00000", "00000", "01100", "00100", "01000"],
  ":": ["00000", "01100", "01100", "00000", "01100", "01100", "00000"],
  ";": ["00000", "01100", "01100", "00000", "01100", "00100", "01000"],
  "'": ["00100", "00100", "01000", "00000", "00000", "00000", "00000"],
  "-": ["00000", "00000", "00000", "01110", "00000", "00000", "00000"],
  "!": ["00100", "00100", "00100", "00100", "00100", "00000", "00100"],
  "?": ["01110", "10001", "00001", "00110", "00100", "00000", "00100"],
  "(": ["00010", "00100", "01000", "01000", "01000", "00100", "00010"],
  ")": ["01000", "00100", "00010", "00010", "00010", "00100", "01000"],
  "/": ["00001", "00010", "00010", "00100", "01000", "01000", "10000"],
  "%": ["11001", "11010", "00010", "00100", "01000", "01011", "10011"],
  "&": ["01100", "10010", "10100", "01000", "10101", "10010", "01101"],
  "+": ["00000", "00100", "00100", "11111", "00100", "00100", "00000"],
  "=": ["00000", "00000", "11111", "00000", "11111", "00000", "00000"],
  $: ["00100", "01111", "10100", "01110", "00101", "11110", "00100"],
  '"': ["01010", "01010", "00000", "00000", "00000", "00000", "00000"],
  "•": ["00000", "00000", "01100", "01100", "01100", "00000", "00000"],
  "·": ["00000", "00000", "00000", "01100", "01100", "00000", "00000"],
  "—": ["00000", "00000", "00000", "11111", "00000", "00000", "00000"],
  "×": ["00000", "10001", "01010", "00100", "01010", "10001", "00000"],
  "°": ["01100", "10010", "10010", "01100", "00000", "00000", "00000"],
};

const CHAR_W = 6; // 5 glyph cells + 1 spacing, in font units
const CHAR_H = 7;

// ---------------------------------------------------------------------------
// Canvas
// ---------------------------------------------------------------------------

type RGB = [number, number, number];

const PAPER: RGB = [247, 242, 231];
const INK: RGB = [20, 20, 20];
const NAVY: RGB = [18, 40, 75];
const NAVY2: RGB = [28, 58, 104];
const RED: RGB = [179, 38, 30];
const GOLD: RGB = [201, 162, 39];
const WHITE: RGB = [255, 255, 255];
const MUTED: RGB = [90, 90, 90];
const TEAL: RGB = [14, 107, 107];
const GREEN: RGB = [31, 122, 63];
const LINE: RGB = [200, 192, 172];

class Canvas {
  readonly w: number;
  readonly h: number;
  readonly px: Uint8Array;
  constructor(w: number, h: number, bg: RGB) {
    this.w = w;
    this.h = h;
    this.px = new Uint8Array(w * h * 3);
    for (let i = 0; i < w * h; i++) {
      this.px[i * 3] = bg[0];
      this.px[i * 3 + 1] = bg[1];
      this.px[i * 3 + 2] = bg[2];
    }
  }
  set(x: number, y: number, c: RGB): void {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 3;
    this.px[i] = c[0];
    this.px[i + 1] = c[1];
    this.px[i + 2] = c[2];
  }
  fillRect(x: number, y: number, w: number, h: number, c: RGB): void {
    const x0 = Math.max(0, Math.floor(x));
    const y0 = Math.max(0, Math.floor(y));
    const x1 = Math.min(this.w, Math.ceil(x + w));
    const y1 = Math.min(this.h, Math.ceil(y + h));
    for (let yy = y0; yy < y1; yy++) {
      for (let xx = x0; xx < x1; xx++) {
        const i = (yy * this.w + xx) * 3;
        this.px[i] = c[0];
        this.px[i + 1] = c[1];
        this.px[i + 2] = c[2];
      }
    }
  }
  rect(x: number, y: number, w: number, h: number, c: RGB, t = 1): void {
    this.fillRect(x, y, w, t, c);
    this.fillRect(x, y + h - t, w, t, c);
    this.fillRect(x, y, t, h, c);
    this.fillRect(x + w - t, y, t, h, c);
  }
  line(x0: number, y0: number, x1: number, y1: number, c: RGB, t = 1): void {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const steps = Math.max(Math.abs(dx), Math.abs(dy));
    if (steps === 0) {
      this.fillRect(x0, y0, t, t, c);
      return;
    }
    for (let s = 0; s <= steps; s++) {
      const x = Math.round(x0 + (dx * s) / steps);
      const y = Math.round(y0 + (dy * s) / steps);
      this.fillRect(x - Math.floor(t / 2), y - Math.floor(t / 2), t, t, c);
    }
  }
  circle(cx: number, cy: number, r: number, c: RGB): void {
    for (let y = -r; y <= r; y++) {
      const half = Math.floor(Math.sqrt(r * r - y * y));
      for (let x = -half; x <= half; x++) this.set(cx + x, cy + y, c);
    }
  }
  ring(cx: number, cy: number, r: number, c: RGB, t = 2): void {
    for (let a = 0; a < 360; a += 2) {
      const rad = (a * Math.PI) / 180;
      const x = Math.round(cx + r * Math.cos(rad));
      const y = Math.round(cy + r * Math.sin(rad));
      this.fillRect(x - 1, y - 1, t, t, c);
    }
  }
  text(str: string, x: number, y: number, scale: number, c: RGB): void {
    let cx = x;
    for (const ch of str) {
      const glyph = FONT[ch] ?? FONT["?"];
      for (let row = 0; row < 7; row++) {
        for (let col = 0; col < 5; col++) {
          if (glyph[row][col] === "1") {
            this.fillRect(cx + col * scale, y + row * scale, scale, scale, c);
          }
        }
      }
      cx += CHAR_W * scale;
    }
  }
  textWidth(str: string, scale: number): number {
    return str.length * CHAR_W * scale - scale;
  }
  textCentered(str: string, cx: number, y: number, scale: number, c: RGB): void {
    this.text(str, Math.round(cx - this.textWidth(str, scale) / 2), y, scale, c);
  }
}

function wrapText(cv: Canvas, str: string, maxW: number, scale: number): string[] {
  const words = str.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur === "" ? w : cur + " " + w;
    if (cv.textWidth(next, scale) <= maxW) {
      cur = next;
    } else {
      if (cur !== "") lines.push(cur);
      cur = w;
    }
  }
  if (cur !== "") lines.push(cur);
  return lines;
}

function drawLines(
  cv: Canvas,
  lines: string[],
  x: number,
  y: number,
  scale: number,
  c: RGB,
  lineH: number,
): void {
  lines.forEach((ln, i) => cv.text(ln, x, y + i * lineH, scale, c));
}

// ---------------------------------------------------------------------------
// Icons (small geometric drawings, one per story panel)
// ---------------------------------------------------------------------------

function iconQuake(cv: Canvas, x: number, y: number, s: number): void {
  cv.rect(x, y, 48 * s, 48 * s, NAVY, 2);
  const pts: [number, number][] = [
    [4, 26], [10, 26], [14, 14], [18, 38], [22, 10], [26, 34], [30, 20],
    [34, 28], [38, 26], [44, 26],
  ];
  for (let i = 0; i < pts.length - 1; i++) {
    cv.line(x + pts[i][0] * s, y + pts[i][1] * s, x + pts[i + 1][0] * s, y + pts[i + 1][1] * s, RED, 2);
  }
}

function iconMarkets(cv: Canvas, x: number, y: number, s: number): void {
  cv.rect(x, y, 48 * s, 48 * s, NAVY, 2);
  cv.line(x + 8 * s, y + 40 * s, x + 8 * s, y + 8 * s, INK, 2);
  cv.line(x + 8 * s, y + 40 * s, x + 42 * s, y + 40 * s, INK, 2);
  const pts: [number, number][] = [[10, 14], [18, 18], [24, 16], [32, 28], [40, 36]];
  for (let i = 0; i < pts.length - 1; i++) {
    cv.line(x + pts[i][0] * s, y + pts[i][1] * s, x + pts[i + 1][0] * s, y + pts[i + 1][1] * s, RED, 3);
  }
  // arrowhead at the end of the fall
  cv.line(x + 40 * s, y + 36 * s, x + 34 * s, y + 34 * s, RED, 3);
  cv.line(x + 40 * s, y + 36 * s, x + 39 * s, y + 30 * s, RED, 3);
}

function iconFlags(cv: Canvas, x: number, y: number, s: number): void {
  // UK flag, simplified: blue field, white cross, red cross
  cv.fillRect(x, y, 22 * s, 16 * s, NAVY2);
  cv.fillRect(x + 9 * s, y, 4 * s, 16 * s, WHITE);
  cv.fillRect(x, y + 6 * s, 22 * s, 4 * s, WHITE);
  cv.fillRect(x + 10 * s, y, 2 * s, 16 * s, RED);
  cv.fillRect(x, y + 7 * s, 22 * s, 2 * s, RED);
  // EU flag: blue field, ring of gold dots
  const ex = x + 26 * s;
  cv.fillRect(ex, y, 22 * s, 16 * s, NAVY2);
  for (let a = 0; a < 12; a++) {
    const rad = (a * Math.PI) / 6;
    const dx = Math.round(ex + 11 * s + 6 * s * Math.cos(rad));
    const dy = Math.round(y + 8 * s + 5 * s * Math.sin(rad));
    cv.fillRect(dx - 1, dy - 1, 2, 2, GOLD);
  }
  cv.line(x, y + 24 * s, x + 48 * s, y + 24 * s, GOLD, 2);
  cv.text("UK", x + 4 * s, y + 28 * s, 2, INK);
  cv.text("EU", x + 32 * s, y + 28 * s, 2, INK);
}

function iconJail(cv: Canvas, x: number, y: number, s: number): void {
  cv.rect(x, y, 48 * s, 48 * s, NAVY, 2);
  for (let i = 0; i < 5; i++) {
    cv.fillRect(x + (6 + i * 8) * s, y + 4 * s, 3 * s, 40 * s, INK);
  }
  cv.fillRect(x + 4 * s, y + 4 * s, 40 * s, 3 * s, INK);
  cv.fillRect(x + 4 * s, y + 41 * s, 40 * s, 3 * s, INK);
  // open gap in the middle bar: the door is coming off
  cv.fillRect(x + 22 * s, y + 4 * s, 4 * s, 40 * s, WHITE);
}

function iconShield(cv: Canvas, x: number, y: number, s: number): void {
  // shield outline
  const pts: [number, number][] = [
    [8, 4], [40, 4], [40, 22], [24, 44], [8, 22],
  ];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    cv.line(x + a[0] * s, y + a[1] * s, x + b[0] * s, y + b[1] * s, TEAL, 3);
  }
  // check mark
  cv.line(x + 14 * s, y + 22 * s, x + 21 * s, y + 30 * s, GREEN, 3);
  cv.line(x + 21 * s, y + 30 * s, x + 35 * s, y + 12 * s, GREEN, 3);
}

function iconCricket(cv: Canvas, x: number, y: number, s: number): void {
  cv.rect(x, y, 48 * s, 48 * s, NAVY, 2);
  // stumps
  for (let i = 0; i < 3; i++) {
    cv.fillRect(x + (14 + i * 7) * s, y + 24 * s, 3 * s, 18 * s, GOLD);
  }
  // bat (diagonal)
  cv.line(x + 30 * s, y + 8 * s, x + 40 * s, y + 30 * s, INK, 4);
  cv.line(x + 40 * s, y + 30 * s, x + 44 * s, y + 38 * s, INK, 3);
  // ball
  cv.circle(x + 12 * s, y + 12 * s, 5 * s, RED);
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

const W = 1024;
const H = 1024;
const M = 28; // outer margin

interface Panel {
  tag: string;
  accent: RGB;
  headline: string;
  body: string;
  icon: (cv: Canvas, x: number, y: number, s: number) => void;
}

const PANELS: Panel[] = [
  {
    tag: "PERU · DISASTER",
    accent: RED,
    headline: "MAGNITUDE 6.8 QUAKE IN PERU",
    body: "A 6.8 quake hit Junin in the Andes. Tremors were felt in Lima, about 320 km away.",
    icon: iconQuake,
  },
  {
    tag: "MARKETS · NEW YORK",
    accent: RED,
    headline: "US STOCKS SLUMP INTO CORRECTION",
    body: "US stocks fell about 3.7% as AI shares sold off, pushing the S&P 500 into correction.",
    icon: iconMarkets,
  },
  {
    tag: "EUROPE · BRUSSELS",
    accent: NAVY2,
    headline: "UK AND EU SIGN NEW DEALS",
    body: "PM Andy Burnham signed deals on food trade, carbon markets and youth mobility.",
    icon: iconFlags,
  },
  {
    tag: "NEW YORK · JUSTICE",
    accent: TEAL,
    headline: "RIKERS ISLAND TO CLOSE 2032",
    body: "Mayor Zohran Mamdani unveiled the first plan to shut the jail complex by 2032.",
    icon: iconJail,
  },
  {
    tag: "DENMARK · SECURITY",
    accent: TEAL,
    headline: "DENMARK FOILS ASSASSIN PLOT",
    body: "Police say they stopped a Russian plot to kill Kyivstoner. Denmark expels the attache.",
    icon: iconShield,
  },
  {
    tag: "SPORT · WELLINGTON",
    accent: GREEN,
    headline: "RAHUL COMPLETES THE SENA SET",
    body: "KL Rahul's 100 made him the first Indian opener with Test hundreds in all four SENA nations.",
    icon: iconCricket,
  },
];

function drawLeadGraphic(cv: Canvas, x: number, y: number, w: number, h: number): void {
  cv.fillRect(x, y, w, h, NAVY);
  // stars
  const stars: [number, number][] = [
    [20, 18], [70, 10], [120, 26], [170, 12], [220, 22], [260, 10],
    [40, 60], [140, 52], [230, 58], [290, 40], [90, 90], [200, 96],
  ];
  for (const [sx, sy] of stars) cv.fillRect(x + sx, y + sy, 2, 2, WHITE);
  // radar rings
  cv.ring(x + w - 70, y + h - 60, 46, [90, 120, 170], 2);
  cv.ring(x + w - 70, y + h - 60, 28, [90, 120, 170], 2);
  // NATO-style four-point star
  const cx = x + w - 70;
  const cy = y + h - 60;
  cv.line(cx, cy - 20, cx, cy + 20, GOLD, 3);
  cv.line(cx - 20, cy, cx + 20, cy, GOLD, 3);
  cv.line(cx - 12, cy - 12, cx + 12, cy + 12, GOLD, 2);
  cv.line(cx - 12, cy + 12, cx + 12, cy - 12, GOLD, 2);
  // two missile trails arcing in from the top
  cv.line(x + 30, y + 8, x + 150, y + 80, WHITE, 3);
  cv.line(x + 150, y + 80, x + 210, y + 130, WHITE, 3);
  cv.line(x + 90, y + 4, x + 190, y + 70, [200, 200, 200], 2);
  cv.line(x + 190, y + 70, x + 252, y + 138, [200, 200, 200], 2);
  // impact bursts
  cv.circle(x + 210, y + 130, 7, RED);
  cv.circle(x + 252, y + 138, 5, RED);
  cv.circle(x + 210, y + 130, 3, GOLD);
  cv.text("WARSAW", x + 16, y + h - 34, 2, WHITE);
  cv.text("NATO AIRSPACE", x + 16, y + h - 16, 2, GOLD);
}

function drawPanel(cv: Canvas, p: Panel, x: number, y: number, w: number, h: number): void {
  cv.fillRect(x, y, w, h, WHITE);
  cv.rect(x, y, w, h, LINE, 2);
  cv.fillRect(x, y, w, 8, p.accent);
  cv.text(p.tag, x + 14, y + 20, 2, p.accent);
  p.icon(cv, x + 14, y + 46, 1);
  const headLines = wrapText(cv, p.headline, w - 28, 3).slice(0, 2);
  drawLines(cv, headLines, x + 14, y + 104, 3, INK, 26);
  const bodyLines = wrapText(cv, p.body, w - 28, 2).slice(0, 4);
  drawLines(cv, bodyLines, x + 14, y + 104 + headLines.length * 26 + 8, 2, MUTED, 18);
}

function draw(): Canvas {
  const cv = new Canvas(W, H, PAPER);

  // ---- masthead ----
  cv.fillRect(0, 0, W, 132, NAVY);
  cv.textCentered("THE WORLD IN ONE DAY", W / 2, 18, 2, GOLD);
  cv.textCentered("SATURDAY, 21 NOVEMBER 2026", W / 2, 52, 5, WHITE);
  cv.fillRect(M, 116, W - 2 * M, 3, GOLD);

  // ---- lead story ----
  const leadY = 148;
  const leadH = 220;
  cv.fillRect(M, leadY, W - 2 * M, leadH, WHITE);
  cv.rect(M, leadY, W - 2 * M, leadH, NAVY, 3);
  cv.text("LEAD STORY", M + 20, leadY + 18, 2, RED);
  const leadHead = ["RUSSIAN MISSILES", "HIT POLAND"];
  drawLines(cv, leadHead, M + 20, leadY + 46, 4, INK, 34);
  const leadBody = wrapText(
    cv,
    "Two Russian missiles and a suspected drone came down in Poland. Warsaw called it a deliberate provocation; NATO called it a grave violation of its airspace.",
    560,
    2,
  ).slice(0, 4);
  drawLines(cv, leadBody, M + 20, leadY + 46 + 2 * 34 + 12, 2, MUTED, 18);
  drawLeadGraphic(cv, 660, leadY + 16, 316, leadH - 32);

  // ---- six story panels, 3 x 2 ----
  const gridY = 384;
  const gap = 16;
  const pw = Math.floor((W - 2 * M - 2 * gap) / 3);
  const ph = 236;
  PANELS.forEach((p, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    drawPanel(cv, p, M + col * (pw + gap), gridY + row * (ph + gap), pw, ph);
  });

  // ---- ticker ----
  const tickY = 888;
  cv.fillRect(0, tickY, W, 56, NAVY);
  const tick1 = "ALSO TODAY: COP31 TALKS STALL IN TURKEY - GEN Z RALLIES IN 25 NATIONS";
  const tick2 = "CYCLONE AKVAN HITS ODISHA - NEPAL PM BALEN TO DELHI - US SANCTIONS 4 IRANIANS";
  cv.text(tick1, M, tickY + 10, 2, WHITE);
  cv.text(tick2, M, tickY + 32, 2, GOLD);

  // ---- footer / sources ----
  cv.textCentered(
    "SOURCES: BBC - REUTERS - AP - AL JAZEERA - THE DAILY SHORT",
    W / 2,
    958,
    2,
    MUTED,
  );
  cv.textCentered(
    "ALL EVENTS HAPPENED OR WERE FIRST REPORTED ON 21 NOVEMBER 2026",
    W / 2,
    982,
    2,
    MUTED,
  );

  return cv;
}

function main(): void {
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
  fs.mkdirSync(outDir, { recursive: true });
  const cv = draw();
  const png = encodePng(W, H, cv.px);
  fs.writeFileSync(path.join(outDir, "entry.png"), png);
}

main();
