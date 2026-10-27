// Falcon 9's own checks, run by `node cli.mjs verify` on the real page with the live clock: the page opens
// on the pad, Enter launches, the flight runs through to a soft landing on the droneship.

export async function verifyMachine({ context, url, expect, stateOf, readouts }) {
  const page = await context.newPage();
  await page.goto(`${url}?tour=off`);
  const wait = (test, timeout = 30000) => page.waitForFunction(test, null, { timeout });
  const start = await stateOf(page);
  readouts.push(start.readout);
  expect(start.phase === "pad" && start.readout.includes("on the pad"), `the page opens on the pad: "${start.readout}"`);

  await page.locator(".iso-stage").focus();
  await page.keyboard.press("Enter");
  await wait(() => window.__anatomy.state().phase === "liftoff");
  const liftoff = await stateOf(page);
  readouts.push(liftoff.readout);
  expect(liftoff.engines === 9, `Enter launches: ${liftoff.readout}`);

  await wait(() => ["meco", "separation", "flip"].includes(window.__anatomy.state().phase), 45000);
  readouts.push((await stateOf(page)).readout);
  await wait(() => window.__anatomy.state().phase === "landing-burn", 45000);
  const burn = await stateOf(page);
  readouts.push(burn.readout);
  expect(burn.engines === 1, `landing burn on one engine: ${burn.readout}`);
  await wait(() => window.__anatomy.state().phase === "landed", 45000);
  const landed = await stateOf(page);
  readouts.push(landed.readout);
  expect(landed.touchdownSpeed < 2 && Math.abs(landed.missFromShip) < 12 && landed.legs > 0.95, `soft landing on the droneship: ${landed.touchdownSpeed} m/s, ${landed.missFromShip} m off, legs ${landed.legs}`);
  await page.close();
}
