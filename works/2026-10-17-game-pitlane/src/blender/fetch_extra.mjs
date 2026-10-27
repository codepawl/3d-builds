// Top-up fetch for gaps after review: same Commons API and licence check as fetch_refs.mjs,
// appended to refs/manifest.json. Usage: node blender/fetch_extra.mjs
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const REFS = join(dirname(fileURLToPath(import.meta.url)), "refs");
const USER_AGENT = "CodePawl-game-pitlane-refs/1.0 (modelling references; legal@codepawl.com)";
const ALLOWED = /^(cc0|public domain|pd|cc by)/i;
const EXTRA = [
  ["kerb", "curbs race track", /curb|kerb|track|turn|corner/i, 2],
  ["race_car", "Formula 1 show car", /F1|formula|car|show/i, 1],
];
const manifest = JSON.parse(await readFile(join(REFS, "manifest.json"), "utf8"));
const strip = (text) => (text || "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
for (const [asset, query, filter, wanted] of EXTRA) {
  const url = "https://commons.wikimedia.org/w/api.php?" + new URLSearchParams({ format: "json", action: "query",
    generator: "search", gsrsearch: `${query} filetype:bitmap`, gsrnamespace: "6", gsrlimit: "30",
    prop: "imageinfo", iiprop: "url|extmetadata", iiurlwidth: "900" });
  const result = await (await fetch(url, { headers: { "User-Agent": USER_AGENT } })).json();
  const pages = Object.values(result.query?.pages || {}).sort((a, b) => a.index - b.index);
  let kept = 0;
  for (const page of pages) {
    const info = page.imageinfo?.[0];
    const licence = strip(info?.extmetadata?.LicenseShortName?.value);
    const known = (manifest[asset] || []).some((entry) => entry.title === page.title);
    if (!info?.thumburl || !ALLOWED.test(licence) || !filter.test(page.title) || known || kept >= wanted) continue;
    if (!/\.(jpe?g|png)$/i.test(page.title)) continue;
    manifest[asset] = manifest[asset] || [];
    const index = String(10 + manifest[asset].length).padStart(2, "0");
    const file = join(REFS, asset, `${index}.jpg`);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, Buffer.from(await (await fetch(info.thumburl, { headers: { "User-Agent": USER_AGENT } })).arrayBuffer()));
    manifest[asset].push({ file: `${asset}/${index}.jpg`, query, title: page.title, page: info.descriptionurl, licence,
      artist: strip(info.extmetadata?.Artist?.value).slice(0, 80) });
    kept += 1;
    console.log(`${asset}/${index}.jpg  ${licence}  ${page.title}`);
  }
}
await writeFile(join(REFS, "manifest.json"), JSON.stringify(manifest, null, 2));
