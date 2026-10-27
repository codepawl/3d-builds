// Fetch modelling reference images from Wikimedia Commons (search, then imageinfo with the
// licence from extmetadata) and plain-text Wikipedia extracts used as dimension sources.
// Images go to blender/refs/<asset>/NN.jpg, one manifest in blender/refs/manifest.json.
// Usage: node blender/fetch_refs.mjs
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const REFS = join(dirname(fileURLToPath(import.meta.url)), "refs");
const USER_AGENT = "CodePawl-game-themepark-refs/1.0 (3D modelling references; legal@codepawl.com)";
const ALLOWED = /^(cc0|public domain|pd|cc by(-sa)? ?[1-4]\.0|cc by(-sa)?[ -][1-4]\.0|cc-by(-sa)?-[1-4]\.0)/i;
const MAX_IMAGES = 36;

// asset -> list of [search query, how many to keep, title filter]
const QUERIES = {
  coaster_train: [["steel roller coaster train", 2, /coaster|train/i], ["roller coaster car wheels", 1, /coaster|car|wheel/i]],
  coaster_track: [["roller coaster lift hill", 2, /lift|coaster|hill/i], ["steel roller coaster track supports", 1, /coaster|track/i]],
  log_flume: [["log flume ride", 2, /flume|log/i], ["log flume boat", 1, /flume|log|boat/i]],
  ferris_wheel: [["Wonder Wheel Coney Island", 2, /wonder|wheel/i], ["Ferris wheel gondola", 1, /wheel|gondola/i]],
  carousel: [["carousel merry-go-round", 2, /carousel|merry|go-round/i], ["carousel horse", 1, /horse|carousel/i]],
  monorail: [["straddle beam monorail", 2, /monorail/i], ["monorail beam pylon", 1, /monorail|beam|pylon/i]],
  castle: [["Neuschwanstein Castle", 2, /neuschwanstein|castle/i], ["conical turret castle", 1, /castle|turret|tower/i]],
  dark_ride: [["dark ride building amusement park", 2, /ride|building|park/i], ["show building theme park", 1, /building|show|park/i]],
  food_stand: [["food kiosk amusement park", 2, /kiosk|stand|food|park/i], ["concession stand", 1, /concession|stand/i]],
  parking_tram: [["parking lot tram theme park", 2, /tram|train|parking/i], ["trackless train", 1, /train|tram/i]],
  utility_cart: [["utility vehicle golf cart", 2, /cart|utility|vehicle/i], ["maintenance cart", 1, /cart/i]],
  parade_float: [["parade float", 3, /float|parade/i]],
  people: [["amusement park crowd", 2, /park|crowd|visitor/i], ["ride operator amusement", 1, /operator|ride|attendant/i]],
};

const ARTICLES = [
  "Roller coaster", "Roller coaster train", "Lift hill", "Roller coaster elements", "Log flume (attraction)",
  "Ferris wheel", "Wonder Wheel", "Carousel", "Monorail", "ALWEG", "Neuschwanstein Castle", "Dark ride",
  "Trackless train", "Golf cart", "Parade float", "Human height", "Queue area",
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
