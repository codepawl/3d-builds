import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { setPriority, constants } from 'node:os';
setPriority(0, constants.priority.PRIORITY_BELOW_NORMAL);
const base = 'https://honkingseal.codepawl.com';
const remote = Buffer.from(await (await fetch(base + '/main.js')).arrayBuffer());
const local = await readFile(new URL('./dist/main.js', import.meta.url));
const hash = b => createHash('sha256').update(b).digest('hex');
if (hash(remote) !== hash(local)) throw Error('Live bundle mismatch');
const browser = await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true,args:['--disable-renderer-backgrounding']});
try {
  for (const engine of ['three','67']) {
    const page = await browser.newPage({viewport:{width:1440,height:1000}});
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base+'/?engine='+engine);
    await page.waitForFunction(()=>window.sealDebug?.ready);
    const bounds=await page.locator('#seal-canvas').boundingBox();
    const x=bounds.x+bounds.width/2, y=bounds.y+bounds.height/2;
    await page.mouse.move(x,y); await page.mouse.down();
    await page.mouse.move(x,y-160,{steps:12});
    const pulled=await page.evaluate(()=>window.sealDebug.state);
    await page.mouse.up();
    await page.waitForTimeout(3200);
    const idle=await page.evaluate(()=>window.sealDebug.state);
    await page.locator('#horn-toggle').click();
    await page.locator('#seal-canvas').focus();
    await page.keyboard.press('ArrowUp');
    const unequipped=await page.evaluate(()=>window.sealDebug.state);
    await page.setViewportSize({width:390,height:844});
    await page.screenshot({path:new URL('./artifacts/live-'+engine+'.png',import.meta.url).pathname.slice(1)});
    if(errors.length||pulled.position!==1||pulled.audioState!=='running'||idle.position!==0||unequipped.hornEquipped) throw Error(JSON.stringify({engine,errors,pulled,idle,unequipped}));
    console.log(JSON.stringify({engine,ready:true,dragNote:pulled.position,idleReset:idle.position,audio:pulled.audioState,errors}));
    await page.close();
  }
  console.log(JSON.stringify({bundleSha256:hash(remote)}));
} finally {await browser.close();}
