// Downloads plain-text Wikipedia extracts used to source the book's facts.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(here, '..', 'research');
for (const title of ['Titanic', 'Rankine_cycle', 'Thermal_power_station', 'Utility_frequency', 'Cooling_tower', 'Pop-up_book']) {
  const url = `https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&format=json&redirects=1&titles=${title}`;
  const response = await fetch(url, { headers: { 'user-agent': 'popup-book-research/1.0' } });
  const json = await response.json();
  const page = Object.values(json.query.pages)[0];
  fs.writeFileSync(path.join(outDir, `${title}.txt`), page.extract || '');
  console.log(title, (page.extract || '').length);
}
