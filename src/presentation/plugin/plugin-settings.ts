// ─── Color theme ─────────────────────────────────────────────────────────────

export type ColorTheme =
  | "default"
  | "light"
  | "ayu"
  | "solarized"
  | "one-dark"
  | "monokai";

export interface ColorThemeDef {
  /** Display name shown in the settings dropdown */
  label: string;
  /**
   * Explicit color palette for dark backgrounds.
   * When defined, the hash selects a color directly from this array.
   * When undefined, the default HSL derivation is used.
   */
  colorsDark?: string[];
  /**
   * Explicit color palette for light backgrounds.
   * Falls back to colorsDark if omitted.
   */
  colorsLight?: string[];
}

export const COLOR_THEMES: Record<ColorTheme, ColorThemeDef> = {
  default: {
    label: "Default",
  },
  light: {
    label: "Light",
    // パステルカラー：彩度・明度を調整した HSL 固定値
    colorsDark: [
      "hsl(0,55%,78%)",
      "hsl(30,55%,78%)",
      "hsl(60,55%,78%)",
      "hsl(120,55%,78%)",
      "hsl(180,55%,78%)",
      "hsl(210,55%,78%)",
      "hsl(270,55%,78%)",
      "hsl(330,55%,78%)",
    ],
    colorsLight: [
      "hsl(0,55%,68%)",
      "hsl(30,55%,68%)",
      "hsl(60,55%,68%)",
      "hsl(120,55%,68%)",
      "hsl(180,55%,68%)",
      "hsl(210,55%,68%)",
      "hsl(270,55%,68%)",
      "hsl(330,55%,68%)",
    ],
  },
  ayu: {
    label: "Ayu",
    // Ayu Dark: https://github.com/ayu-theme/ayu-vim
    colorsDark: [
      "#FF7733", // keyword  — orange
      "#FFB454", // function — gold
      "#B8CC52", // string   — yellow-green
      "#36A3D9", // tag/type — blue
      "#FFEE99", // constant — pale yellow
      "#F07178", // error    — red-pink
      "#95E6CB", // regexp   — mint
      "#E6B673", // special  — peach
    ],
    // Ayu Light
    colorsLight: [
      "#FF7733", // keyword  — orange
      "#F29718", // function — amber
      "#86B300", // string   — lime
      "#36A3D9", // tag/type — blue
      "#A37ACC", // constant — purple
      "#F07178", // error    — red-pink
      "#4CBF99", // regexp   — teal
      "#E6B673", // special  — peach
    ],
  },
  solarized: {
    label: "Solarized",
    // Solarized: https://ethanschoonover.com/solarized/
    // 8 accent hues are identical for dark and light
    colorsDark: [
      "#B58900", // yellow
      "#CB4B16", // orange
      "#DC322F", // red
      "#D33682", // magenta
      "#6C71C4", // violet
      "#268BD2", // blue
      "#2AA198", // cyan
      "#859900", // green
    ],
    colorsLight: [
      "#B58900",
      "#CB4B16",
      "#DC322F",
      "#D33682",
      "#6C71C4",
      "#268BD2",
      "#2AA198",
      "#859900",
    ],
  },
  "one-dark": {
    label: "One Dark",
    // One Dark: https://github.com/atom/one-dark-syntax
    colorsDark: [
      "#56B6C2", // cyan   hsl(187,47%,55%)
      "#61AFEF", // blue   hsl(207,82%,66%)
      "#C678DD", // purple hsl(286,60%,67%)
      "#98C379", // green  hsl(95,38%,62%)
      "#E06C75", // red    hsl(355,65%,65%)
      "#D19A66", // orange hsl(29,54%,61%)
      "#E5C07B", // yellow hsl(39,67%,69%)
    ],
    // One Light: https://github.com/atom/one-light-syntax
    colorsLight: [
      "#0184BC", // cyan   hsl(198,99%,37%)
      "#4078F2", // blue   hsl(221,87%,60%)
      "#A626A4", // purple hsl(301,63%,40%)
      "#50A14F", // green  hsl(119,34%,47%)
      "#E45649", // red    hsl(5,74%,59%)
      "#986801", // orange hsl(41,99%,30%)
      "#C18401", // yellow hsl(41,99%,38%)
    ],
  },
  monokai: {
    label: "Monokai",
    // Classic Monokai (no official light variant — same palette for both modes)
    colorsDark: [
      "#F92672", // keyword  — hot pink
      "#A6E22E", // function — lime green
      "#E6DB74", // string   — pale yellow
      "#AE81FF", // constant — purple
      "#66D9E8", // type     — cyan
      "#FD971F", // macro    — orange
    ],
    colorsLight: [
      "#F92672",
      "#A6E22E",
      "#E6DB74",
      "#AE81FF",
      "#66D9E8",
      "#FD971F",
    ],
  },
};

// ─── Settings ─────────────────────────────────────────────────────────────────

export interface TriangleGraphSettings {
  gridSize: number; // triangle side length L in graph coordinates (default 60)
  colorTheme: ColorTheme;
  showEdgeLabels: boolean;
  /** ノードラベルの最大文字数（超過時は「…」で省略）。0 で無制限。 */
  labelMaxChars: number;
  /** 省略時に末尾から保持する文字数。0 で末尾保持なし。 */
  labelTailChars: number;
}

export const DEFAULT_SETTINGS: TriangleGraphSettings = {
  gridSize: 60,
  colorTheme: "default",
  showEdgeLabels: false,
  labelMaxChars: 14,
  labelTailChars: 0,
};
