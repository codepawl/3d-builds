// Renders the line art preview to stills/drawing.png for a visual check.
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { openPage, ROOT } from "./browser.mjs";

await mkdir(path.join(ROOT, "stills"), { recursive: true });
const { browser, page } = await openPage("density.html");
await page.screenshot({ path: path.join(ROOT, "stills", "drawing.png") });
await browser.close();
