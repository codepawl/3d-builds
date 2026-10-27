// Fetch modelling reference images from Wikimedia Commons (search, then imageinfo with the
// licence from extmetadata) and plain-text Wikipedia extracts used as dimension sources.
// Images go to blender/refs/<asset>/NN.jpg, one manifest per run in blender/refs/manifest.json.
// Usage: node blender/fetch_refs.mjs
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const REFS = join(dirname(fileURLToPath(import.meta.url)), "refs");
const USER_AGENT = "CodePawl-game-pitlane-refs/1.0 (modelling references; legal@codepawl.com)";
const ALLOWED = /^(cc0|public domain|pd|cc by(-sa)? ?[1-4]\.0|cc by(-sa)?[ -][1-4]\.0|cc-by(-sa)?-[1-4]\.0)/i;
const MAX_IMAGES = 36;

// asset -> list of [search query, how many to keep, title filter]
const QUERIES = {
  race_car: [["Formula One car 2022", 2, /F1|formula|car|RB1|W1|SF-|MCL|AMR|FW4|C4|A52|VF-/i], ["Dallara F2 2024 car", 1, /F2|formula|dallara/i], ["Formula One car 2023", 2, /F1|formula|car|RB1|W1|SF-|MCL|AMR/i]],
  pit_crew: [["Formula One pit stop", 3, /pit|stop|F1|grand prix/i], ["pit crew tyre change", 1, /pit|crew|tyre|tire/i]],
  pit_tools: [["pit stop jack", 1, /jack|pit/i], ["pneumatic impact wrench", 1, /wrench|impact|gun/i]],
  tyre: [["Pirelli Formula One tyres", 2, /pirelli|tyre|tire|P Zero/i], ["tyre blankets", 1, /blanket|tyre|tire/i]],
  garage: [["Formula One garage", 2, /garage|box|pit/i], ["pit lane garages", 1, /pit|garage|lane/i]],
  pit_wall: [["pit wall Formula One", 2, /pit|wall|gantry|stand/i]],
  team_truck: [["Formula One team truck", 2, /truck|transporter|paddock|lorry/i]],
  hospitality: [["paddock motorhome", 2, /motorhome|hospitality|paddock/i]],
  grandstand: [["grandstand race circuit", 2, /grandstand|tribune|stand/i]],
  kerb: [["race track kerb", 2, /kerb|curb|corner|turn|track/i]],
  safety_car: [["Formula One safety car", 2, /safety|car/i]],
  marshal_post: [["marshal post circuit", 1, /marshal|post/i], ["track marshal flag", 1, /marshal|flag/i]],
};

const ARTICLES = [
  "Formula One car", "Halo (safety device)", "Formula One tyres", "Pit stop", "Safety car",
  "Formula One regulations", "Semi-trailer truck", "Grandstand", "Race track", "Track marshal",
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
      const found = (await searchImages(query, 12)).filter((image) => titleFilter.test(image.title) && !/map|mural|19[0-4][0-9]|18[0-9][0-9]/i.test(image.title));
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
