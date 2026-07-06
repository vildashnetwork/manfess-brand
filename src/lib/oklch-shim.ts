// Replace oklch() colors with rgb() on a cloned DOM subtree so libraries
// like html2canvas/html2pdf (which don't yet parse oklch) can render it.

function srgbCompand(x: number) {
  x = Math.max(0, Math.min(1, x));
  return x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055;
}

export function oklchToRgbString(L: number, C: number, h: number, alpha = 1): string {
  const hr = (h * Math.PI) / 180;
  const a = C * Math.cos(hr);
  const b = C * Math.sin(hr);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3;
  const r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const bb = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
  const R = Math.round(srgbCompand(r) * 255);
  const G = Math.round(srgbCompand(g) * 255);
  const B = Math.round(srgbCompand(bb) * 255);
  return alpha < 1 ? `rgba(${R}, ${G}, ${B}, ${alpha})` : `rgb(${R}, ${G}, ${B})`;
}

const OKLCH_RE = /oklch\(\s*([\d.]+%?)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+%?))?\s*\)/gi;

export function convertOklchString(input: string): string {
  return input.replace(OKLCH_RE, (_m, lRaw, cRaw, hRaw, aRaw) => {
    const L = String(lRaw).endsWith("%") ? parseFloat(lRaw) / 100 : parseFloat(lRaw);
    const C = parseFloat(cRaw);
    const h = parseFloat(hRaw);
    const a = aRaw ? (String(aRaw).endsWith("%") ? parseFloat(aRaw) / 100 : parseFloat(aRaw)) : 1;
    return oklchToRgbString(L, C, h, a);
  });
}

const COLOR_PROPS = [
  "color",
  "backgroundColor",
  "borderTopColor",
  "borderRightColor",
  "borderBottomColor",
  "borderLeftColor",
  "outlineColor",
  "fill",
  "stroke",
  "textDecorationColor",
  "caretColor",
  "columnRuleColor",
] as const;

/** Walk subtree, read computed styles, inline-override any oklch values with rgb. */
export function inlineFixOklch(root: HTMLElement) {
  const win = root.ownerDocument.defaultView;
  if (!win) return;
  const nodes: HTMLElement[] = [root, ...Array.from(root.querySelectorAll<HTMLElement>("*"))];
  for (const el of nodes) {
    const cs = win.getComputedStyle(el);
    for (const p of COLOR_PROPS) {
      const v = cs.getPropertyValue(camelToKebab(p));
      if (v && v.includes("oklch")) {
        (el.style as unknown as Record<string, string>)[p] = convertOklchString(v);
      }
    }
    // background shorthand may contain oklch images/gradients
    const bg = cs.getPropertyValue("background-image");
    if (bg && bg.includes("oklch")) {
      el.style.backgroundImage = convertOklchString(bg);
    }
  }
}

function camelToKebab(s: string) {
  return s.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase());
}