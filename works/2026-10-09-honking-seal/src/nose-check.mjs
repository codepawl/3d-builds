import {chromium} from 'playwright';
import {setPriority,constants} from 'node:os';
setPriority(0,constants.priority.PRIORITY_BELOW_NORMAL);
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try {
 const page=await browser.newPage({viewport:{width:1200,height:900}});
 await page.goto('http://127.0.0.1:5178/');
 await page.waitForFunction(()=>window.sealDebug?.ready);
 await page.locator('#horn-toggle').click();
 const view=process.argv[2]||'profile';
 await page.evaluate(view=>{
  window.sealDebug.camera.position.set(...(view==='front'?[0,0.8,6.5]:[6,0.3,0.2]));
  window.sealDebug.camera.lookAt(0,0.15,0);
 },view);
 await page.waitForTimeout(300);
 await page.screenshot({path:new URL('./artifacts/nose-'+view+'.png',import.meta.url).pathname.slice(1)});
} finally {await browser.close();}
