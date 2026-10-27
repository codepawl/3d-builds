// Fetches modelling reference images from Wikimedia Commons (search, then imageinfo with the licence
// from extmetadata) and plain-text Wikipedia extracts for the dimension tables. Images go to
// refs/<asset>/, a manifest with source and licence to refs/manifest.json, extracts to refs/text/.
// Usage: node blender/fetch_refs.mjs   (ROUND=2 adds the second, more specific query set)
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const refsDir = join(dirname(fileURLToPath(import.meta.url)), "refs");
const userAgent = "LaunchsiteAssetRefs/1.0 (modelling references for a demo app; contact legal@codepawl.com)";
const allowedLicence = /public domain|cc0|cc by|cc-by|pd-/i;

// asset folder -> [search query, how many images to keep]
const searches = process.env.ROUND === "2" ? {
  ship: [["Starship SN8 prototype", 2], ["Starship SN15 landing", 1], ["Starship S24 stacked", 1]],
  booster: [["Booster 7 Starbase", 1], ["Super Heavy Booster Raptor engines", 1]],
  crawler_crane: [["crawler crane lattice boom", 2]],
  test_stand: [["Massey's test site Starbase", 2]],
} : {
  booster: [["Super Heavy booster rocket stainless", 3], ["Super Heavy grid fins", 1]],
  ship: [["Starship SN15 launch pad", 2], ["Starship prototype S24 OR S25 OR S20", 2]],
  tower: [["Starbase orbital launch tower", 3], ["Mechazilla chopsticks", 2]],
  launch_mount: [["orbital launch mount Starbase", 2]],
  tank_farm: [["Starbase tank farm", 2], ["Kennedy Space Center liquid oxygen sphere", 1], ["Launch Complex 39 liquid hydrogen tank", 1]],
  high_bay: [["Starbase high bay", 2], ["Starbase mega bay", 1]],
  spmt: [["self-propelled modular transporter", 3]],
  crawler_crane: [["Liebherr LR 11350", 2]],
  recovery_boat: [["platform supply vessel", 2]],
  test_stand: [["Starbase suborbital pad Massey", 2]],
  weather_tower: [["Kennedy Space Center weather tower", 1]],
};

const articles = ["SpaceX_Super_Heavy", "SpaceX_Starship_(spacecraft)", "SpaceX_Starbase", "Self-propelled_modular_transporter", "Liebherr_LR_11350", "Platform_supply_vessel", "Launch_Complex_39"];

async function api(host, params) {
  const url = `https://${host}/w/api.php?` + new URLSearchParams({ format: "json", origin: "*", ...params });
  const response = await fetch(url, { headers: { "User-Agent": userAgent } });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.json();
}

function stripTags(text) {
  return String(text || "").replace(/<[^>]+>/g, "").trim();
}

async function fetchImages() {
  const manifestPath = join(refsDir, "manifest.json");
  const manifest = process.env.ROUND === "2" ? JSON.parse(await readFile(manifestPath, "utf8")) : [];
  const seen = new Set(manifest.map((entry) => entry.title));
  for (const [asset, queries] of Object.entries(searches)) {
    await mkdir(join(refsDir, asset), { recursive: true });
    for (const [query, wanted] of queries) {
      const search = await api("commons.wikimedia.org", {
        action: "query", list: "search", srsearch: `filetype:bitmap ${query}`, srnamespace: "6", srlimit: "20",
      });
      const titles = search.query.search.map((hit) => hit.title).filter((title) => !seen.has(title));
      if (!titles.length) continue;
      const info = await api("commons.wikimedia.org", {
        action: "query", titles: titles.join("|"), prop: "imageinfo", iiprop: "url|extmetadata|size", iiurlwidth: "1280",
      });
      const pages = Object.values(info.query.pages).sort((a, b) => titles.indexOf(a.title) - titles.indexOf(b.title));
      let kept = 0;
      for (const page of pages) {
        if (kept >= wanted) break;
        const image = page.imageinfo?.[0];
        if (!image) continue;
        const licence = stripTags(image.extmetadata?.LicenseShortName?.value);
        if (!allowedLicence.test(licence)) continue;
        const source = image.thumburl || image.url;
        const extension = source.toLowerCase().includes(".png") ? "png" : "jpg";
        const fileName = `${asset}-${String(manifest.filter((entry) => entry.asset === asset).length + 1).padStart(2, "0")}.${extension}`;
        const download = await fetch(source, { headers: { "User-Agent": userAgent } });
        if (!download.ok) continue;
        await writeFile(join(refsDir, asset, fileName), Buffer.from(await download.arrayBuffer()));
        seen.add(page.title);
        kept += 1;
        manifest.push({
          asset, file: `${asset}/${fileName}`, title: page.title, page: image.descriptionurl, licence,
          artist: stripTags(image.extmetadata?.Artist?.value).slice(0, 120), query,
        });
        console.log(`${asset}/${fileName}  ${licence}  ${page.title}`);
      }
    }
  }
  await writeFile(join(refsDir, "manifest.json"), JSON.stringify(manifest, null, 2));
  console.log(`images: ${manifest.length}`);
}

async function fetchArticles() {
  await mkdir(join(refsDir, "text"), { recursive: true });
  for (const article of articles) {
    const result = await api("en.wikipedia.org", { action: "query", prop: "extracts", explaintext: "1", titles: article, redirects: "1" });
    const page = Object.values(result.query.pages)[0];
    await writeFile(join(refsDir, "text", `${article}.txt`), `https://en.wikipedia.org/wiki/${article}\n\n${page.extract || ""}`);
    console.log(`article ${article}: ${(page.extract || "").length} chars`);
  }
}

await fetchImages();
if (process.env.ROUND !== "2") await fetchArticles();
