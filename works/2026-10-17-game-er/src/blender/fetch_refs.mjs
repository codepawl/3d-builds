// Fetch modelling reference images from Wikimedia Commons (search, then imageinfo with the
// licence from extmetadata) and plain-text Wikipedia extracts used as dimension sources.
// Images go to blender/refs/<asset>/NN.jpg, one manifest per run in blender/refs/manifest.json.
// Usage: node blender/fetch_refs.mjs
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const REFS = join(dirname(fileURLToPath(import.meta.url)), "refs");
const USER_AGENT = "CodePawl-game-er-refs/1.0 (modelling references; legal@codepawl.com)";
const ALLOWED = /^(cc0|public domain|pd|cc by(-sa)? ?[1-4]\.0|cc by(-sa)?[ -][1-4]\.0|cc-by(-sa)?-[1-4]\.0)/i;
const MAX_IMAGES = 38;

// asset -> list of [search query, how many to keep, title filter]
const QUERIES = {
  ambulance: [["Type III ambulance", 2, /ambulance/i], ["ambulance rear doors", 1, /ambulance/i], ["ambulance side view", 2, /ambulance/i]],
  helicopter: [["EC135 air ambulance", 2, /135|helicopter|air/i], ["H135 helicopter", 2, /135|helicopter/i]],
  helipad: [["hospital helipad", 2, /helipad|heliport|pad/i]],
  stretcher: [["ambulance stretcher", 2, /stretcher|gurney|cot/i], ["hospital gurney", 1, /gurney|stretcher|trolley/i]],
  hospital_bed: [["hospital bed", 3, /bed/i]],
  ct_scanner: [["CT scanner", 3, /CT|scanner|tomograph/i]],
  xray: [["radiography room x-ray", 2, /x-?ray|radiograph/i], ["x-ray machine", 1, /x-?ray/i]],
  nurses_station: [["nurses station", 2, /nurs|station/i], ["emergency department", 2, /emergency|department|ward|room/i]],
  waiting_room: [["hospital waiting room", 2, /waiting/i]],
  lab_analyzer: [["clinical chemistry analyzer", 2, /analy[sz]er|laborator/i]],
  wheelchair: [["wheelchair", 2, /wheelchair/i]],
  staff: [["scrubs nurse uniform", 2, /scrub|nurse|uniform/i]],
  ed_building: [["emergency department entrance ambulance", 2, /emergency|ambulance|entrance|hospital/i]],
};
const EXCLUDE = /patient|injur|victim|wound|blood|surg|accident|crash|dead|corpse|operat|map|mural|18[0-9][0-9]|19[0-6][0-9]|toy|model kit/i;

const ARTICLES = [
  "Ambulance", "Eurocopter EC135", "Helipad", "Stretcher", "Hospital bed", "CT scan", "Radiography",
  "Wheelchair", "Scrubs (clothing)", "Emergency department", "Triage", "Clinical chemistry analyzer",
  "Medical laboratory", "Air medical services",
];

async function api(host, params) {
  const url = `https://${host}/w/api.php?` + new URLSearchParams({ format: "json", origin: "*", ...params });
  const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.json();
}

function stripTags(text) {
  return (text || "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

async function searchImages(query, wanted) {
  const result = await api("commons.wikimedia.org", {
    action: "query", generator: "search", gsrsearch: `${query} filetype:bitmap`, gsrnamespace: "6",
    gsrlimit: "30", prop: "imageinfo", iiprop: "url|extmetadata|size", iiurlwidth: "900",
  });
  const pages = Object.values(result.query?.pages || {}).sort((first, second) => first.index - second.index);
  const kept = [];
  for (const page of pages) {
    const info = page.imageinfo?.[0];
    if (!info || !info.thumburl) continue;
    const licence = stripTags(info.extmetadata?.LicenseShortName?.value);
    if (!ALLOWED.test(licence)) continue;
    if (!/\.(jpe?g|png)$/i.test(page.title)) continue;
    kept.push({
      title: page.title, page: info.descriptionurl, thumb: info.thumburl, licence,
      artist: stripTags(info.extmetadata?.Artist?.value).slice(0, 80),
      description: stripTags(info.extmetadata?.ImageDescription?.value).slice(0, 160),
    });
    if (kept.length >= wanted) break;
  }
  return kept;
}

async function main() {
  const manifest = {};
  let total = 0;
  for (const [asset, queries] of Object.entries(QUERIES)) {
    manifest[asset] = [];
    const seen = new Set();
    for (const [query, wanted, titleFilter] of queries) {
      if (total >= MAX_IMAGES) break;
      const found = (await searchImages(query, 12)).filter((image) => titleFilter.test(image.title) && !EXCLUDE.test(image.title + " " + image.description));
      for (const image of found) {
        if (seen.has(image.title) || manifest[asset].length >= 6 || total >= MAX_IMAGES) continue;
        if (manifest[asset].filter((entry) => entry.query === query).length >= wanted) continue;
        seen.add(image.title);
        const response = await fetch(image.thumb, { headers: { "User-Agent": USER_AGENT } });
        if (!response.ok) continue;
        const index = String(manifest[asset].length + 1).padStart(2, "0");
        const file = join(REFS, asset, `${index}.jpg`);
        await mkdir(dirname(file), { recursive: true });
        await writeFile(file, Buffer.from(await response.arrayBuffer()));
        manifest[asset].push({ file: `${asset}/${index}.jpg`, query, ...image });
        total += 1;
        console.log(`${asset}/${index}.jpg  ${image.licence}  ${image.title}`);
      }
    }
  }
  await writeFile(join(REFS, "manifest.json"), JSON.stringify(manifest, null, 2));
  await mkdir(join(REFS, "sources"), { recursive: true });
  for (const article of ARTICLES) {
    const result = await api("en.wikipedia.org", {
      action: "query", prop: "extracts", explaintext: "1", redirects: "1", titles: article,
    });
    const page = Object.values(result.query.pages)[0];
    const text = `${page.title}\nhttps://en.wikipedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, "_"))}\n\n${page.extract || ""}`;
    await writeFile(join(REFS, "sources", `${article.replace(/[^A-Za-z0-9]+/g, "_")}.txt`), text);
  }
  console.log(`images ${total}, articles ${ARTICLES.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
