import { chromium } from 'playwright';
import {setPriority,constants} from 'node:os';
import {writeFile} from 'node:fs/promises';
setPriority(0,constants.priority.PRIORITY_BELOW_NORMAL);
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--disable-renderer-backgrounding']});
try {
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 await page.goto(process.env.SEAL_URL || 'http://127.0.0.1:5178/');
 await page.waitForFunction(()=>window.sealDebug?.ready);
 const picking=await page.evaluate(async()=>{
   const THREE=await import('/vendor/three/build/three.module.js');
   const ray=new THREE.Raycaster();
   const samples=[];
   for(let i=0;i<80;i++) {
     ray.setFromCamera(new THREE.Vector2((i%10-5)*0.025,0),window.sealDebug.camera);
     const start=performance.now();
     ray.intersectObjects(window.sealDebug.seal.bodyMeshes,true);
     samples.push(performance.now()-start);
   }
   samples.sort((a,b)=>a-b);
   return {median:samples[40],p95:samples[76],triangles:window.sealDebug.seal.bodyMeshes.reduce((n,m)=>n+m.geometry.index.count/3,0)};
 });
 await page.evaluate(()=>{
  window.renderTimes=[];
  const renderer=window.sealDebug.renderer;
  const original=renderer.render.bind(renderer);
  renderer.render=(...args)=>{window.renderTimes.push(performance.now());return original(...args);};
 });
 const box=await page.locator('#seal-canvas').boundingBox();
 await page.mouse.move(box.x+20,box.y+50);await page.mouse.down();
 for(let i=0;i<40;i++) await page.mouse.move(box.x+20+i*6,box.y+50);
 await page.waitForTimeout(500);await page.mouse.up();
 const frames=await page.evaluate(()=>{
   const gaps=window.renderTimes.slice(1).map((t,i)=>t-window.renderTimes[i]);
   gaps.sort((a,b)=>a-b);
   return {count:window.renderTimes.length,medianInterval:gaps[Math.floor(gaps.length/2)],p95Interval:gaps[Math.floor(gaps.length*.95)]};
 });
 const report={picking,frames};
 await writeFile(new URL('./artifacts/orbit-perf-'+(process.argv[2]||'result')+'.json',import.meta.url),JSON.stringify(report,null,2));
 console.log(JSON.stringify(report));
} finally {await browser.close();}
