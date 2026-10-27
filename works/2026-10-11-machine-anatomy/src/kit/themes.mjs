// Colour themes: token sets only. A theme never changes how a surface is shaded or a line drawn; that is
// the render style's job (styles.mjs), so any theme works with any style. The machine's own CSS uses the
// shared `--ma-*` tokens for its accents (the path colours, wires, glass) so it follows the theme too.

const SHARED_TOKENS = ["page", "card", "text", "strong", "muted", "paper", "face", "top", "shade-0", "shade-1", "shade-2", "shade-3", "lit-top", "lit-shade", "hi", "mid", "lo", "faint", "lit", "halo", "halo-opacity", "dot"];

export const THEMES = {
  light: {
    anatomy: { page: "#f2f2ef", card: "#fbfbfa", text: "#3f3f45", strong: "#18181a", muted: "#6c6c72", paper: "#fbfbfa", face: "#ffffff", top: "#f9f9f6", "shade-0": "#cdcdc8", "shade-1": "#dadad5", "shade-2": "#e5e5e0", "shade-3": "#efefea", "lit-top": "#ffffff", "lit-shade": "#eeeeeb", hi: "#1a1a1e", mid: "#55555c", lo: "#85858c", faint: "#bcbcc1", lit: "#d9480f", halo: "#8a8a80", "halo-opacity": ".32", dot: "#3a3a3e" },
    machine: { flow: "#1971c2", "flow-2": "#c2410c", heat: "#c2410c", wire: "#3a3a40", glass: "#6f7f8c", "glass-fill": "rgba(214,228,238,.3)", ink: "#1a1a1e", "paper-ink": "#fbfbfa", blend: "multiply" },
  },
  dark: {
    anatomy: { page: "#09090a", card: "#111113", text: "#bcbcc3", strong: "#ececf0", muted: "#8b8b93", paper: "#111113", face: "#1b1b1f", top: "#44444c", "shade-0": "#1e1e22", "shade-1": "#26262b", "shade-2": "#2f2f35", "shade-3": "#38383f", "lit-top": "#4a4a52", "lit-shade": "#2f2f35", hi: "#e4e4e8", mid: "#a6a6ae", lo: "#7a7a82", faint: "#4c4c53", lit: "#ff9f43", halo: "#050505", "halo-opacity": ".9", dot: "#e4e4e8" },
    machine: { flow: "#74c0fc", "flow-2": "#ffb35c", heat: "#ffb35c", wire: "#c9c9d0", glass: "#9fb2c2", "glass-fill": "rgba(160,190,214,.1)", ink: "#e4e4e8", "paper-ink": "#111113", blend: "screen" },
  },
  blueprint: {
    anatomy: { page: "#173a6b", card: "#1d4a85", text: "#d6e4f7", strong: "#ffffff", muted: "#a9c0e0", paper: "#1d4a85", face: "#22528f", top: "#2a5c9c", "shade-0": "#163d70", "shade-1": "#1a4479", "shade-2": "#1e4a82", "shade-3": "#23518b", "lit-top": "#2f64a6", "lit-shade": "#22528f", hi: "#f4f8ff", mid: "#c3d5ee", lo: "#8faad1", faint: "#4f74a8", lit: "#ffffff", halo: "#0d2648", "halo-opacity": ".55", dot: "#f4f8ff" },
    machine: { flow: "#ffd43b", "flow-2": "#ffa8a8", heat: "#ffd43b", wire: "#e7eefb", glass: "#d7e6f8", "glass-fill": "rgba(215,230,248,.10)", ink: "#f4f8ff", "paper-ink": "#1d4a85", blend: "screen" },
  },
  patent: {
    anatomy: { page: "#ece4cf", card: "#f6f0e1", text: "#3b352b", strong: "#1b1915", muted: "#6f6656", paper: "#f6f0e1", face: "#fbf6ea", top: "#fbf6ea", "shade-0": "#ddd2b8", "shade-1": "#e6dcc5", "shade-2": "#ede4d0", "shade-3": "#f2eadb", "lit-top": "#fbf6ea", "lit-shade": "#efe7d4", hi: "#1b1915", mid: "#4f493d", lo: "#857b69", faint: "#c4b89e", lit: "#1b1915", halo: "#857b69", "halo-opacity": ".22", dot: "#1b1915" },
    machine: { flow: "#a61e1e", "flow-2": "#1f4e8c", heat: "#a61e1e", wire: "#2b2722", glass: "#4d473c", "glass-fill": "rgba(60,50,30,.04)", ink: "#1b1915", "paper-ink": "#f6f0e1", blend: "multiply" },
  },
};

export const THEME_NAMES = Object.keys(THEMES);
export const DEFAULT_THEME = "light";

function declarations(prefix, tokens) {
  return Object.entries(tokens)
    .map(([name, value]) => `--${prefix}-${name}:${value}`)
    .join(";");
}

// The CSS for every theme, scoped by `data-theme` on the page body, so one page can switch at run time.
export function themeCss() {
  return THEME_NAMES.map((name) => {
    const theme = THEMES[name];
    return `.iso[data-theme="${name}"]{${declarations("anatomy", theme.anatomy)};${declarations("ma", theme.machine)}}`;
  }).join("\n");
}

// Which page background and colour scheme a published fragment needs for its theme.
export function pageColoursOf(name) {
  const theme = THEMES[name] ?? THEMES[DEFAULT_THEME];
  const scheme = name === "dark" || name === "blueprint" ? "dark" : "light";
  return { background: theme.anatomy.page, scheme };
}

export function missingTokens(name) {
  const theme = THEMES[name];
  return SHARED_TOKENS.filter((token) => !(token in theme.anatomy));
}
