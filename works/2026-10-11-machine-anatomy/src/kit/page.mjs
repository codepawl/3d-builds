// Builds one machine's page: the figure from its figure.mjs, the plate, the legend, the trace, the zoom
// frame, the controls, every theme and render style, and the inlined script (kit runtime, machine model
// and live hooks). Every visible text goes through the text registry so `lint` can tie it to facts.json.
// Adapted from the Edison and Enigma build scripts.
import { existsSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { pathToFileURL } from "node:url";
import * as isoKit from "./vendor/iso-kit.mjs";
import { createDrawing, screenAxes } from "./drawing.mjs";
import { createExplodeKit } from "./explode.mjs";
import { formatOf } from "./film.mjs";
import { KIT_VOICES, BODIES } from "./sound.mjs";
import { styleCss, styleDefs, pixelRoot, DEFAULT_STYLE } from "./styles.mjs";
import { themeCss, pageColoursOf, DEFAULT_THEME } from "./themes.mjs";
import { KIT_NAME } from "./name.mjs";
import { createTextRegistry, numberWord } from "./texts.mjs";

const KIT_DIR = new URL(".", import.meta.url);
const kitFile = (name) => readFileSync(new URL(name, KIT_DIR), "utf8");

export async function loadMachine(machineDir) {
  const module = await import(pathToFileURL(join(machineDir, "machine.mjs")).href);
  const machine = module.default;
  const factsFile = join(machineDir, "facts.json");
  const facts = existsSync(factsFile) ? JSON.parse(readFileSync(factsFile, "utf8")) : { facts: {} };
  const figure = await import(pathToFileURL(join(machineDir, machine.figure ?? "figure.mjs")).href);
  return { dir: machineDir, machine, facts, figure };
}

// The projection: the machine's world box fitted into the format's figure region.
function projectionFor(machine, frame) {
  const bounds = machine.worldBounds;
  const corners = isoKit.boxCorners(bounds.box, bounds.z0, bounds.z1);
  const region = frame.figure;
  const fitted = isoKit.fitProjection(corners, region.width, region.height, { pad: region.pad, azimuth: machine.azimuth ?? 45 });
  return { ...fitted, origin: [fitted.origin[0] + region.x, fitted.origin[1] + region.y] };
}

function frameFor(machine, film, formatName) {
  if (film) return formatOf(formatName);
  const page = machine.page;
  return { name: "page", width: page.width, height: page.height, figure: { x: page.nudge[0], y: page.nudge[1], width: page.width, height: page.height, pad: page.pad }, zoom: page.zoom, margin: page.margin ?? { x: 44, y: 44, lift: 0 } };
}

function zoomSourceOf(corners, frame) {
  const xs = corners.map((point) => point[0]);
  const ys = corners.map((point) => point[1]);
  const wide = Math.max(...xs) - Math.min(...xs);
  const tall = Math.max(...ys) - Math.min(...ys);
  const scale = Math.min(frame.width / (wide * 1.12), frame.height / (tall * 1.08));
  return { x: (Math.max(...xs) + Math.min(...xs)) / 2, y: (Math.max(...ys) + Math.min(...ys)) / 2, width: frame.width / scale, height: frame.height / scale, scale };
}

function apartViewOf(items, explode, projection) {
  const shifts = explode.fullShifts();
  const xs = [];
  const ys = [];
  for (const item of items) {
    if (!item.bounds) continue;
    const moved = explode.movedBox(item.bounds, shifts[item.piece]);
    for (const x of [moved[0], moved[1]]) {
      for (const y of [moved[2], moved[3]]) {
        for (const z of [moved[4], moved[5]]) {
          const point = isoKit.iso([x, y, z], projection);
          xs.push(point[0]);
          ys.push(point[1]);
        }
      }
    }
  }
  const left = Math.min(...xs);
  const right = Math.max(...xs);
  const up = Math.min(...ys);
  const down = Math.max(...ys);
  return { x: (left + right) / 2, y: (up + down) / 2, width: right - left, height: down - up };
}

// Draws the figure and measures its painter's order. Shared by the page build and the audit.
export function drawMachine(loaded, { film = false, format = "16:9" } = {}) {
  const { machine, figure } = loaded;
  const frame = frameFor(machine, film, format);
  const projection = projectionFor(machine, frame);
  const drawing = createDrawing(projection);
  const drawn = figure.drawFigure(drawing, { film, frame });
  const explode = createExplodeKit({ pieces: machine.pieces, leaveOrder: machine.leaveOrder, spring: machine.spring });
  const axes = screenAxes(projection);
  const measured = explode.restOrder(drawing.items, axes);
  const items = measured.order.map((index) => drawing.items[index]);
  return { frame, projection, drawing, drawn, explode, axes, measured, items, listed: drawing.items };
}

const BASE_CSS = kitFile("page.css");

// `legendSide`: the legend takes its own column at the right instead of the band under the figure, so
// it never covers a part of a tall machine (the recorder checks that no legend row overlaps a part).
// The trace strip fades out in the first half of `--ma-apart` and the legend in during the second, so
// the two never show at once where they share the band under the figure.
function filmCss(frame, legendSide = false) {
  const side = legendSide ? `.ma-film-legend{grid-template-columns:auto;justify-content:start;left:auto;right:${frame.legend.side?.right ?? 44}px;top:${frame.legend.side?.top ?? 120}px;bottom:auto;gap:14px}` : "";
  const steps = frame.steps;
  const wrap = steps.width ? `max-width:${steps.width}px;white-space:normal` : "white-space:nowrap";
  return `
html,body{margin:0!important;overflow:hidden!important;background:var(--anatomy-card)!important}
.iso{--anatomy-weight:1.7px}
.iso-page{width:${frame.width}px!important;margin:0!important}
.iso-figure{margin:0!important}
.iso-plate{width:${frame.width}px;height:${frame.height}px;padding:0!important;overflow:hidden;box-shadow:none!important;box-sizing:border-box}
.iso-plate-corners{inset:34px 44px!important;z-index:3}
.iso-plate-corner{font-size:21px!important;background:var(--anatomy-card);padding:8px 12px;margin:-8px -12px;border-radius:6px}
.iso-plate-corner[data-corner="hint"]{display:none}
.iso-legend,.ma-sr{display:none!important}
.ma-badge{width:36px;height:36px;margin:-18px 0 0 -18px;font-size:20px;box-shadow:0 0 0 3px var(--anatomy-card)}
.ma-film-legend{display:grid;grid-template-columns:repeat(${frame.legend.columns},auto);justify-content:center;gap:12px 40px;position:absolute;left:0;right:0;bottom:${frame.legend.bottom}px;margin:0;padding:0;list-style:none;font-size:${frame.legend.size}px;color:var(--anatomy-text);opacity:clamp(0,calc(var(--ma-apart,0) * 2 - 1),1)}
.ma-film-legend li{display:flex;align-items:center;gap:11px;white-space:nowrap}
.ma-film-legend .ma-num{width:30px;height:30px;font-size:17px}
.ma-tracebox{position:absolute;left:0;right:0;bottom:${frame.trace.bottom}px;margin:0;z-index:3;opacity:clamp(0,calc(1 - var(--ma-apart,0) * 2),1)}
.ma-trace{font-size:${frame.trace.size}px;gap:0 20px}
.ma-pathkey{font-size:${Math.round(frame.trace.size * 0.67)}px;gap:0 44px;margin-top:18px}
.ma-pathkey span{gap:12px}
.ma-swatch{width:44px;height:5px}
.ma-steps{display:grid;gap:${Math.round(steps.size * 0.5)}px;position:absolute;left:${steps.left}px;top:${steps.top}px;margin:0;padding:0;list-style:none;font-size:${steps.size}px;color:var(--anatomy-strong);z-index:3;opacity:var(--ma-steps,0)}
.ma-steps li{--glow:0;display:flex;align-items:center;gap:13px;${wrap};opacity:calc(.16 + .84*var(--glow))}
.ma-steps .ma-num{width:${Math.round(steps.size * 1.36)}px;height:${Math.round(steps.size * 1.36)}px;font-size:${Math.round(steps.size * 0.76)}px}
.ma-stepmark{display:grid;background:var(--ma-heat)}
${side}
`;
}

function escapeHtml(text) {
  return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function controlHtml(control, texts) {
  if (control.kind === "range") {
    const label = texts.ui(control.label);
    const unit = control.unit ?? "";
    return `<label class="ma-range">${escapeHtml(label)}<input type="range" data-${control.data} min="${control.min}" max="${control.max}" step="${control.step ?? 1}" value="${control.value}" aria-label="${escapeHtml(texts.ui(control.aria ?? control.label))}"><output data-${control.data}-text>${escapeHtml(texts.ui(`${control.value} ${unit}`))}</output></label>`;
  }
  return `<button type="button" data-${control.data}${control.pressed === undefined ? "" : ` aria-pressed="${control.pressed}"`}>${escapeHtml(texts.ui(control.label))}</button>`;
}

function controlsHtml(machine, texts) {
  const kitControls = [{ data: "apart", label: "Take apart", pressed: false }, { data: "sound", label: "Sound", pressed: false }];
  const all = kitControls.concat(machine.controls ?? []);
  return `<span class="ma-controls" role="group" aria-label="${escapeHtml(texts.ui(machine.controlsLabel ?? "Controls"))}">${all.map((control) => controlHtml(control, texts)).join("")}</span>`;
}

function piecesInOrder(machine) {
  return Object.entries(machine.pieces).sort((first, second) => first[1].number - second[1].number);
}

function partsList(machine, className, texts, useShort) {
  const rows = piecesInOrder(machine).map(([, piece]) => `<li><span class="ma-num">${piece.number}</span>${escapeHtml(texts.fact(useShort ? piece.short ?? piece.name : piece.name))}</li>`);
  return `<ol class="${className}">${rows.join("")}</ol>`;
}

function badgesHtml(machine, film) {
  const badges = piecesInOrder(machine).filter(([, piece]) => piece.badge !== false).map(([name, piece]) => `<span class="ma-badge" data-badge="${name}">${piece.number}</span>`);
  const marks = film ? (machine.steps ?? []).map((_, index) => `<span class="ma-badge ma-stepmark" data-stepmark="${index}">${index + 1}</span>`) : [];
  return `<div class="ma-badges" aria-hidden="true">${badges.join("")}${marks.join("")}</div>`;
}

function traceHtml(machine, texts) {
  const chips = (machine.trace ?? []).map((entry, index) => `<span class="ma-chip" data-trace="${index}"${entry.tint ? ` data-tint="${entry.tint}"` : ""}>${escapeHtml(texts.fact(entry))}</span>`);
  const keys = (machine.pathKey ?? []).map((entry) => `<span><i class="ma-swatch"${entry.tint ? ` data-tint="${entry.tint}"` : ""}></i>${escapeHtml(texts.fact(entry))}</span>`);
  return `<div class="ma-tracebox" aria-hidden="true"><div class="ma-trace">${chips.join('<span class="ma-chip-arrow">→</span>')}</div><div class="ma-pathkey">${keys.join("")}</div></div>`;
}

function stepsHtml(machine, texts) {
  const rows = (machine.steps ?? []).map((step, index) => `<li data-step-item="${index}"><span class="ma-num">${index + 1}</span>${escapeHtml(texts.fact(step))}</li>`);
  return `<ol class="ma-steps" aria-hidden="true">${rows.join("")}</ol>`;
}

// The short "simplified" note the page shows for every part drawn simpler than the real one.
function simplifiedHtml(machine, texts) {
  const notes = piecesInOrder(machine)
    .filter(([, piece]) => piece.provenance?.kind === "simplified")
    .map(([, piece]) => texts.fact(piece.provenance.note));
  const extra = (machine.simplifiedNotes ?? []).map((entry) => texts.fact(entry));
  const all = notes.concat(extra);
  if (!all.length) return "";
  return `<span class="ma-simplified"><span class="ma-simplified-label">${escapeHtml(texts.ui("Simplified:"))}</span> ${all.map(escapeHtml).join(" ")}</span>`;
}

function sceneMarkup(built, drawnDefs, source, frame) {
  const scene = `<g id="ma-scene" data-dyn="world">${built.items.map((item) => `<g class="ma-item" data-piece="${item.piece}">${item.markup}</g>`).join("")}</g>`;
  const corner = (frame.zoom.corner / source.scale).toFixed(1);
  const sourceMark = `<rect class="ma-zoom-source" data-dyn="zoom-source" x="${(source.x - source.width / 2).toFixed(1)}" y="${(source.y - source.height / 2).toFixed(1)}" width="${source.width.toFixed(1)}" height="${source.height.toFixed(1)}" rx="${corner}"/>`;
  const zoomFrame = `<path class="ma-zoom-ties" data-dyn="zoom-ties" d=""/><g class="ma-zoom" data-dyn="zoom"><clipPath id="ma-zoom-clip"><rect data-dyn="zoom-clip"/></clipPath><rect class="ma-zoom-paper" data-dyn="zoom-paper"/><g clip-path="url(#ma-zoom-clip)"><use href="#ma-scene" data-dyn="zoom-use"/></g><rect class="ma-zoom-edge" data-dyn="zoom-edge"/></g>`;
  const block = frame.name === "page" ? 3 : 7;
  const cell = frame.name === "page" ? 1.5 : 3;
  const defs = styleDefs({ width: frame.width, height: frame.height, cell, block });
  return `${defs}${pixelRoot(frame.width, frame.height, `${drawnDefs ?? ""}<g data-dyn="lens">${scene}${sourceMark}</g>${zoomFrame}`)}`;
}

// ---- inlining the script ---------------------------------------------------------------------------------

const IMPORT_LINE = /^import\s*\{([^}]*)\}\s*from\s*"([^"]+)";\s*$/gm;
const KIT_MODULES = { "motion.mjs": "Kit.Motion", "explode.mjs": "Kit.Explode", "effects.mjs": "Kit.Effects" };

function exportedNames(source) {
  const names = [];
  for (const found of source.matchAll(/^export\s+(?:async\s+)?(?:function|const|let|class)\s+([A-Za-z_$][\w$]*)/gm)) names.push(found[1]);
  return names;
}

// One ES module as an expression: its imports become reads from modules already inlined, its exports the
// returned object. Only named imports of kit or sibling modules are supported, which is all a machine needs.
function wrapModule(source, resolve) {
  const names = exportedNames(source);
  const body = source.replace(IMPORT_LINE, (line, imported, from) => `const {${imported.replace(/\s+as\s+/g, ": ")}} = ${resolve(from)};`).replace(/^export\s+/gm, "");
  return `(() => {\n${body}\nreturn { ${names.join(", ")} };\n})()`;
}

function resolverFor(machine) {
  return (from) => {
    const name = basename(from);
    if (KIT_MODULES[name] && !(machine.modules ?? []).includes(from.replace("./", ""))) return KIT_MODULES[name];
    return `Modules[${JSON.stringify(name)}]`;
  };
}

function scriptOf(loaded, config) {
  const { machine, dir } = loaded;
  const resolve = resolverFor(machine);
  const kitTop = kitFile("vendor/iso-kit.mjs").replace(/^export /gm, "");
  const kitModules = `const Kit = {};\nKit.Motion = ${wrapModule(kitFile("motion.mjs"), resolve)};\nKit.Explode = ${wrapModule(kitFile("explode.mjs"), resolve)};
Kit.Effects = ${wrapModule(kitFile("effects.mjs"), resolve)};`;
  const machineModules = (machine.modules ?? []).map((name) => `Modules[${JSON.stringify(name)}] = ${wrapModule(readFileSync(join(dir, name), "utf8"), resolve)};`);
  const live = readFileSync(join(dir, machine.live ?? "live.js"), "utf8");
  return `${kitTop}\n${kitModules}\nconst Modules = {};\n${machineModules.join("\n")}\nconst CONFIG = ${JSON.stringify(config)};\n${kitFile("runtime.js")}\n${live}\nstartFigure(createMachineHooks);\n`;
}

// The inlined kit carries a page template of its own. Its tag names are written with an escaped first
// letter, so the finished page holds no second doctype, html, head, meta or body tag, even inside a string.
const BACKSLASH = String.fromCharCode(92);
const ESCAPED = { h: `${BACKSLASH}x68`, m: `${BACKSLASH}x6d`, b: `${BACKSLASH}x62` };
const TAG_NAMES = /<(\/?)(h)(tml|ead)|<(\/?)(m)(eta)|<(\/?)(b)(ody)/gi;

function escapeTags(source) {
  return source.replace(/<!doctype/gi, `<${BACKSLASH}x21doctype`).replace(TAG_NAMES, (...found) => {
    const slash = found[1] ?? found[4] ?? found[7] ?? "";
    const letter = (found[2] ?? found[5] ?? found[8]).toLowerCase();
    const rest = found[3] ?? found[6] ?? found[9];
    return `<${slash}${ESCAPED[letter]}${rest}`;
  });
}

// The page for publishing: no doctype, html, head, meta or body tags; the title and the styles first,
// then the page colours and the two body attributes, then the body's content.
export function publishFragment(html, theme) {
  const title = /<title>[\s\S]*?<\/title>/.exec(html)[0];
  const headStyles = /<\/title>([\s\S]*?)<\/head>/.exec(html)[1];
  const content = /<body[^>]*>([\s\S]*)<\/body>/.exec(html)[1];
  const colours = pageColoursOf(theme);
  const setup = `<style>html,body{background:${colours.background};color-scheme:${colours.scheme}}</style><script>document.body.classList.add("iso");document.body.setAttribute("data-theme","${theme}");</script>`;
  return `${title}${headStyles}${setup}${content}`;
}

function configOf(loaded, built, extra) {
  const { machine } = loaded;
  const { frame, projection, drawn, explode, items } = built;
  const source = zoomSourceOf(drawn.zoomCorners, frame.zoom);
  return {
    source,
    config: {
      kitName: KIT_NAME,
      film: extra.film,
      theme: extra.theme,
      style: extra.style,
      projection,
      zoom: { source, frame: frame.zoom },
      stepPoints: drawn.stepPoints ?? [],
      explodeSpec: { pieces: machine.pieces, leaveOrder: machine.leaveOrder, spring: machine.spring },
      explode: { film: extra.film, width: frame.width, height: frame.height, margin: frame.margin, items: items.map((item) => ({ piece: item.piece, bounds: item.bounds, crosses: item.crosses })), anchors: drawn.anchors, apart: apartViewOf(items, explode, projection) },
      apartWords: { many: numberWord(Object.keys(machine.pieces).length) },
      sound: { voices: { ...KIT_VOICES, ...(machine.sound?.voices ?? {}) }, bodies: { ...BODIES, ...(machine.sound?.bodies ?? {}) }, pan: machine.sound?.pan ?? 0, middlePiece: machine.sound?.middlePiece ?? 5 },
    },
  };
}

// Builds the page in memory. Returns the html, the publish fragment and the text registry for lint.
export function buildPage(loaded, { film = false, format = "16:9", theme, style } = {}) {
  const { machine } = loaded;
  const chosenTheme = theme ?? machine.theme ?? DEFAULT_THEME;
  const chosenStyle = style ?? machine.style ?? DEFAULT_STYLE;
  const texts = createTextRegistry();
  const built = drawMachine(loaded, { film, format });
  const { config, source } = configOf(loaded, built, { film, theme: chosenTheme, style: chosenStyle });
  const svg = isoKit.figureSvg({ width: built.frame.width, height: built.frame.height, label: texts.fact(built.drawn.label), body: sceneMarkup(built, built.drawn.defs, source, built.frame) });
  const stage = `<div class="iso-stage" tabindex="0" role="group" aria-label="${escapeHtml(texts.ui(machine.stageLabel))}">${svg}${badgesHtml(machine, film)}</div>`;
  const filmParts = film ? stepsHtml(machine, texts) + partsList(machine, "ma-film-legend", texts, true) : "";
  const plate = isoKit.plateHtml({
    fig: texts.ui(machine.fig ?? "Fig 1"),
    title: texts.fact(machine.title),
    hint: texts.ui(machine.hint ?? "Shift+E: apart"),
    readout: texts.readout(machine.initialReadout ?? ""),
    keys: machine.legendKey ? [{ mark: "raised", label: texts.fact(machine.legendKey) }] : [],
    caption: (machine.caption ?? []).map((sentence) => texts.fact(sentence)).join(" "),
    body: `${stage}${traceHtml(machine, texts)}${filmParts}`,
  });
  const withControls = plate.replace('<figcaption class="iso-legend">', `<figcaption class="iso-legend">${controlsHtml(machine, texts)}`);
  const withParts = withControls.replace('<span class="iso-caption">', `${partsList(machine, "ma-parts", texts, false)}<span class="iso-caption">`);
  const withNote = withParts.replace("</figcaption>", `${simplifiedHtml(machine, texts)}</figcaption>`);
  const css = `${themeCss()}\n${BASE_CSS}\n${styleCss()}\n${built.drawn.css ?? ""}\n${film ? filmCss(built.frame, loaded.machine.film?.legend === "side") : ""}`;
  const body = `<style>${css}</style>${withNote}<span class="ma-sr" data-announce aria-live="polite"></span>`;
  const script = escapeTags(scriptOf(loaded, config));
  const html = isoKit.pageHtml({ title: texts.fact(machine.pageTitle), theme: chosenTheme, body, script, width: machine.page.cardWidth ?? 650 }).replace(`<body class="iso" data-theme="${chosenTheme}">`, `<body class="iso" data-theme="${chosenTheme}" data-style="${chosenStyle}">`);
  return { html, texts, built, theme: chosenTheme, style: chosenStyle, publish: film ? null : publishFragment(html, chosenTheme) };
}
