import { applyFilter, type Filter } from "./filters";

export interface StripTheme {
  id: string;
  label: string;
  paper: string | [string, string]; // solid or vertical gradient
  ink: string;
  accent: string;
}

export const THEMES: StripTheme[] = [
  { id: "bubblegum", label: "Bubblegum", paper: ["#ffe3f1", "#ffc6e3"], ink: "#d81b72", accent: "#ffffff" },
  { id: "chrome", label: "Chrome", paper: ["#f4f6fb", "#c9cfdc"], ink: "#3b3f58", accent: "#8f7cff" },
  { id: "midnight", label: "Midnight", paper: ["#1b1638", "#0d0b1f"], ink: "#e8dcff", accent: "#ff8fc8" },
  { id: "classic", label: "Classic", paper: "#fbfaf6", ink: "#1a1a1a", accent: "#ff5fa2" },
];

export const getTheme = (id: string) => THEMES.find((t) => t.id === id) ?? THEMES[0];

// Strip geometry (px). 4:3 frames, like a real booth strip.
const W = 600;
const PAD = 36;
const GAP = 22;
const PHOTO_W = W - PAD * 2;
const PHOTO_H = Math.round((PHOTO_W * 3) / 4);
const FOOTER = 150;
export const STRIP_SIZE = { w: W, h: PAD + PHOTO_H * 4 + GAP * 3 + FOOTER };

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function sparkle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.quadraticCurveTo(x, y, x, y + r);
  ctx.quadraticCurveTo(x, y, x - r, y);
  ctx.quadraticCurveTo(x, y, x, y - r);
  ctx.fill();
  ctx.restore();
}

/** Draws the finished strip. Everything happens locally on a canvas. */
export async function renderStrip(canvas: HTMLCanvasElement, shots: string[], filter: Filter, theme: StripTheme) {
  const scale = 2; // export at 1200px wide for crisp prints
  canvas.width = STRIP_SIZE.w * scale;
  canvas.height = STRIP_SIZE.h * scale;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);

  // Paper
  if (Array.isArray(theme.paper)) {
    const g = ctx.createLinearGradient(0, 0, 0, STRIP_SIZE.h);
    g.addColorStop(0, theme.paper[0]);
    g.addColorStop(1, theme.paper[1]);
    ctx.fillStyle = g;
  } else {
    ctx.fillStyle = theme.paper;
  }
  ctx.fillRect(0, 0, STRIP_SIZE.w, STRIP_SIZE.h);

  const images = await Promise.all(shots.map(loadImage));
  images.forEach((img, i) => {
    const x = PAD;
    const y = PAD + i * (PHOTO_H + GAP);
    ctx.drawImage(img, x, y, PHOTO_W, PHOTO_H);
    // Filter on device pixels for this frame
    applyFilter(ctx, x * scale, y * scale, PHOTO_W * scale, PHOTO_H * scale, filter);
    ctx.strokeStyle = theme.ink;
    ctx.globalAlpha = 0.18;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, PHOTO_W - 1, PHOTO_H - 1);
    ctx.globalAlpha = 1;
  });

  // Footer
  try {
    await document.fonts.load('52px "Bagel Fat One"');
    await document.fonts.load('15px "DM Mono"');
  } catch {
    /* fall back to system fonts */
  }
  const fy = PAD + PHOTO_H * 4 + GAP * 3;
  ctx.textAlign = "center";
  ctx.fillStyle = theme.ink;
  ctx.font = '52px "Bagel Fat One", system-ui, sans-serif';
  ctx.fillText("FLASHBACK", W / 2, fy + 72);
  ctx.font = '15px "DM Mono", ui-monospace, monospace';
  const date = new Date()
    .toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" })
    .replace(/\//g, ".");
  ctx.globalAlpha = 0.75;
  ctx.fillText(`${date}  ·  your internet photo booth`, W / 2, fy + 106);
  ctx.globalAlpha = 1;

  sparkle(ctx, 66, fy + 54, 14, theme.accent);
  sparkle(ctx, 92, fy + 84, 7, theme.ink);
  sparkle(ctx, W - 70, fy + 60, 11, theme.ink);
  sparkle(ctx, W - 96, fy + 34, 7, theme.accent);
}
