// End-to-end check in headless Chrome. There is no webcam there, so the test
// feeds face samples through the dev-only hook, the same way the tracker does.
// Start the dev server first (npm run dev), then: npm test [url]
import puppeteer from "puppeteer-core";

const url = process.argv[2] || "http://localhost:5173/";
const chrome = process.env.CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: true,
  args: ["--window-size=1280,720", "--enable-gpu", "--ignore-gpu-blocklist"],
  defaultViewport: { width: 1280, height: 720 },
});
const page = await browser.newPage();
const problems = [];
page.on("console", (m) => {
  const text = m.text();
  if ((m.type() === "error" || /not used/.test(text)) && !/404|favicon/.test(text)) problems.push(text);
});
page.on("pageerror", (e) => problems.push(e.message));
await page.goto(url, { waitUntil: "load" });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let failed = 0;
const check = (name, ok, detail = "") => {
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  (" + detail + ")" : ""}`);
};
const locked = () => page.evaluate(() => !!document.pointerLockElement);
const message = () => page.evaluate(() => document.querySelector("#b-msg").textContent);
const snap = () =>
  page.evaluate(() => {
    const g = window.__dev.game;
    return {
      leanX: g.lean.x,
      leanY: g.lean.y,
      me: g.me.health,
      foe: g.ai.health,
      timer: g.ai.timer,
      yaw: window.__dev.camera.rotation.y,
      level: g.state.level,
    };
  });

await wait(5000); // models load

// 1. No face: the game must refuse to start.
check("asks for a webcam when there is no face", (await message()).includes("WEBCAM REQUIRED"));
await page.mouse.click(600, 360);
await wait(300);
check("cannot start without a tracked face", !(await locked()));

// 2. A face appears (simulated head, centered, 60 cm from the camera).
await page.evaluate(() => {
  window.__pose = { x: 0, y: 0, z: 0.6, yaw: 0 };
  window.__feed = setInterval(() => {
    const p = window.__pose;
    window.__dev.feed([-p.x, -p.y, p.z], [p.yaw, 0, 0]);
  }, 16);
});
await wait(400);
await page.mouse.click(600, 360);
await wait(400);
check("starts once a face is tracked", await locked());

// 3. Only the head dodges: the old A / D / S keys do nothing.
await page.keyboard.down("KeyD");
await page.keyboard.down("KeyS");
await wait(500);
const keyed = await snap();
check(
  "keyboard no longer moves the head",
  Math.abs(keyed.leanX) < 0.01 && Math.abs(keyed.leanY) < 0.01,
  `lean ${keyed.leanX.toFixed(3)}, ${keyed.leanY.toFixed(3)}`,
);
await page.keyboard.up("KeyD");
await page.keyboard.up("KeyS");
await page.evaluate(() => Object.assign(window.__pose, { x: 0.12, y: -0.1 }));
await wait(600);
const moved = await snap();
check(
  "moving the head slips and ducks in-game",
  moved.leanX > 0.25 && moved.leanY < -0.2,
  `lean ${moved.leanX.toFixed(2)}, ${moved.leanY.toFixed(2)} m`,
);
await page.evaluate(() => Object.assign(window.__pose, { x: 0, y: 0 }));

// 4. Standing still gets you hit.
await wait(9000);
const hit = await snap();
check("standing still gets you hit", hit.me < 100, `health ${Math.round(hit.me)}`);
await page.screenshot({ path: "test-playing.png" });

// 5. Dodge with the head on every wind-up: slip for straights, duck for hooks.
await page.evaluate(() => {
  const g = window.__dev.game;
  g.me.health = 100;
  window.__dodge = setInterval(() => {
    const threat = g.ai.phase === "windup" || g.ai.phase === "strike";
    window.__pose.x = threat && g.ai.kind !== "hook" ? 0.12 : 0;
    window.__pose.y = threat && g.ai.kind === "hook" ? -0.12 : 0;
  }, 16);
});
await wait(10000);
const dodged = await snap();
check("head movement dodges punches", dodged.me >= 85, `health ${Math.round(dodged.me)} after 10 s of dodging`);

// 6. Both mouse buttons punch.
for (let i = 0; i < 24; i++) {
  const button = i % 2 ? "right" : "left";
  await page.mouse.down({ button });
  await page.mouse.up({ button });
  await wait(400);
}
const punched = await snap();
check("punches land", punched.foe < 100 || punched.level > 0, `opponent health ${Math.round(punched.foe)}, fight ${punched.level + 1}`);

// 7. Turning the head turns the view.
await page.evaluate(() => {
  clearInterval(window.__dodge);
  Object.assign(window.__pose, { x: 0, y: 0, yaw: -0.3 });
});
await wait(700);
const yaw = (await snap()).yaw;
check("turning the head right looks right", yaw < -0.5, `camera yaw ${yaw.toFixed(2)} rad`);

// 8. Lose the face and the fight freezes.
await page.evaluate(() => clearInterval(window.__feed));
await wait(1200);
const frozenA = await snap();
await wait(600);
const frozenB = await snap();
check("fight freezes when the face is lost", frozenA.timer === frozenB.timer && frozenA.me === frozenB.me);
check("asks for the webcam again", (await message()).includes("WEBCAM REQUIRED"));
await page.screenshot({ path: "test-no-face.png" });

check("no page errors or rejected assets", problems.length === 0, problems.slice(0, 3).join(" | "));
await browser.close();
process.exit(failed ? 1 : 0);
