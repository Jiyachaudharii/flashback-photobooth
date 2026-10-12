// Filters are defined once as a list of CSS-style operations.
// The live preview uses the CSS string (fast, GPU), and the exported
// strip runs the exact same math on pixels, so what you see is what you get.
// (Pixel processing also avoids ctx.filter, which older Safari ignores.)

type Op =
  | { kind: "grayscale"; v: number }
  | { kind: "sepia"; v: number }
  | { kind: "saturate"; v: number }
  | { kind: "hue-rotate"; v: number } // degrees
  | { kind: "contrast"; v: number }
  | { kind: "brightness"; v: number };

export interface Filter {
  id: string;
  label: string;
  ops: Op[];
  grain: number; // 0..1, export-only film grain
  swatch: string; // button preview colour
}

export const FILTERS: Filter[] = [
  { id: "clear", label: "Clear", ops: [], grain: 0, swatch: "#bfe3ff" },
  {
    id: "film",
    label: "Faded film",
    ops: [
      { kind: "sepia", v: 0.28 },
      { kind: "saturate", v: 0.85 },
      { kind: "contrast", v: 0.86 },
      { kind: "brightness", v: 1.08 },
    ],
    grain: 0.35,
    swatch: "#f4d9b0",
  },
  {
    id: "y2k",
    label: "Y2K pop",
    ops: [
      { kind: "saturate", v: 1.45 },
      { kind: "hue-rotate", v: -12 },
      { kind: "contrast", v: 1.06 },
      { kind: "brightness", v: 1.06 },
    ],
    grain: 0.15,
    swatch: "#ff8fc8",
  },
  {
    id: "sepia",
    label: "Sepia",
    ops: [
      { kind: "sepia", v: 0.85 },
      { kind: "contrast", v: 0.95 },
    ],
    grain: 0.3,
    swatch: "#c79a6b",
  },
  {
    id: "noir",
    label: "B&W",
    ops: [
      { kind: "grayscale", v: 1 },
      { kind: "contrast", v: 1.22 },
      { kind: "brightness", v: 1.03 },
    ],
    grain: 0.4,
    swatch: "#8a8a8a",
  },
];

export const getFilter = (id: string) => FILTERS.find((f) => f.id === id) ?? FILTERS[0];

export function filterToCss(f: Filter): string {
  if (!f.ops.length) return "none";
  return f.ops
    .map((op) => (op.kind === "hue-rotate" ? `hue-rotate(${op.v}deg)` : `${op.kind}(${op.v})`))
    .join(" ");
}

// Colour matrices from the Filter Effects spec (same ones browsers use for CSS filters).
function matrixFor(op: Op): number[] | null {
  switch (op.kind) {
    case "grayscale": {
      const a = 1 - Math.min(1, op.v);
      return [
        0.2126 + 0.7874 * a, 0.7152 - 0.7152 * a, 0.0722 - 0.0722 * a,
        0.2126 - 0.2126 * a, 0.7152 + 0.2848 * a, 0.0722 - 0.0722 * a,
        0.2126 - 0.2126 * a, 0.7152 - 0.7152 * a, 0.0722 + 0.9278 * a,
      ];
    }
    case "sepia": {
      const a = 1 - Math.min(1, op.v);
      return [
        0.393 + 0.607 * a, 0.769 - 0.769 * a, 0.189 - 0.189 * a,
        0.349 - 0.349 * a, 0.686 + 0.314 * a, 0.168 - 0.168 * a,
        0.272 - 0.272 * a, 0.534 - 0.534 * a, 0.131 + 0.869 * a,
      ];
    }
    case "saturate": {
      const s = op.v;
      return [
        0.213 + 0.787 * s, 0.715 - 0.715 * s, 0.072 - 0.072 * s,
        0.213 - 0.213 * s, 0.715 + 0.285 * s, 0.072 - 0.072 * s,
        0.213 - 0.213 * s, 0.715 - 0.715 * s, 0.072 + 0.928 * s,
      ];
    }
    case "hue-rotate": {
      const r = (op.v * Math.PI) / 180;
      const c = Math.cos(r);
      const s = Math.sin(r);
      return [
        0.213 + c * 0.787 - s * 0.213, 0.715 - c * 0.715 - s * 0.715, 0.072 - c * 0.072 + s * 0.928,
        0.213 - c * 0.213 + s * 0.143, 0.715 + c * 0.285 + s * 0.14, 0.072 - c * 0.072 - s * 0.283,
        0.213 - c * 0.213 - s * 0.787, 0.715 - c * 0.715 + s * 0.715, 0.072 + c * 0.928 + s * 0.072,
      ];
    }
    default:
      return null;
  }
}

const clamp = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v);

/** Applies a filter in place to a canvas region. */
export function applyFilter(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, f: Filter) {
  if (!f.ops.length && !f.grain) return;
  const img = ctx.getImageData(x, y, w, h);
  const d = img.data;
  const steps = f.ops.map((op) => ({ op, m: matrixFor(op) }));
  const grain = f.grain * 28;

  for (let i = 0; i < d.length; i += 4) {
    let r = d[i], g = d[i + 1], b = d[i + 2];
    for (const { op, m } of steps) {
      if (m) {
        const nr = m[0] * r + m[1] * g + m[2] * b;
        const ng = m[3] * r + m[4] * g + m[5] * b;
        const nb = m[6] * r + m[7] * g + m[8] * b;
        r = clamp(nr); g = clamp(ng); b = clamp(nb);
      } else if (op.kind === "brightness") {
        r = clamp(r * op.v); g = clamp(g * op.v); b = clamp(b * op.v);
      } else if (op.kind === "contrast") {
        const o = 128 * (1 - op.v);
        r = clamp(r * op.v + o); g = clamp(g * op.v + o); b = clamp(b * op.v + o);
      }
    }
    if (grain) {
      const n = (Math.random() - 0.5) * grain;
      r = clamp(r + n); g = clamp(g + n); b = clamp(b + n);
    }
    d[i] = r; d[i + 1] = g; d[i + 2] = b;
  }
  ctx.putImageData(img, x, y);
}
