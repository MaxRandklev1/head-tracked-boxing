import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { HDRLoader } from "three/addons/loaders/HDRLoader.js";

// First-person boxing. Left click throws the left hand, right click the right.
// There is no block button: you avoid punches by actually moving your head.
// Slip sideways or duck under a straight punch, duck or pull back from a hook.

const HEAD_HEIGHT = 1.65;
const PLAYER_Z = 0.62; // where the player stands; the opponent stands at -PLAYER_Z
const HEAD_RADIUS = 0.19; // how close a glove must end up to count as a hit
const SKIN = [0xc98d6b, 0x8d5a3c, 0xe2b48f, 0x6f4630];
const TRUNKS = [0xe5484d, 0x2e7dd6, 0x8ac926, 0xe8c547, 0x8f6bff];
// Multiplied into the model's neutral skin texture, one per opponent.
const SKIN_TINT = [0xffffff, 0xb78a70, 0xffeedd, 0x8c654d];
// Relative to wherever the page is hosted.
const ASSETS = `${import.meta.env.BASE_URL}models/boxing/`;
const NAMES = ["Rookie Rae", "Southpaw Sol", "Iron Ines", "Granite Gus", "The Champ"];

export function createBoxing({ scene, rig, canvas, camera, params }) {
  const world = new THREE.Group();
  world.visible = false;
  scene.add(world);

  // --- Ring (placeholder geometry until real models arrive) ---
  const RING = 3; // half-size
  const ringParts = new THREE.Group();
  world.add(ringParts);
  const canvasMat = new THREE.MeshStandardMaterial({ color: 0x9fb4c8, roughness: 0.9 });
  const mat = new THREE.Mesh(new THREE.BoxGeometry(RING * 2 + 1, 0.3, RING * 2 + 1), canvasMat);
  mat.position.y = -0.15;
  ringParts.add(mat);
  const apron = new THREE.Mesh(
    new THREE.BoxGeometry(RING * 2 + 1.05, 0.9, RING * 2 + 1.05),
    new THREE.MeshStandardMaterial({ color: 0x1b2535, roughness: 0.8 }),
  );
  apron.position.y = -0.76;
  ringParts.add(apron);
  const postMat = new THREE.MeshStandardMaterial({ color: 0x2a2f3a, roughness: 0.5, metalness: 0.4 });
  const ropeColors = [0xe5484d, 0xf2f2f2, 0x2e7dd6];
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.5, 12), postMat);
    post.position.set(sx * RING, 0.75, sz * RING);
    ringParts.add(post);
    const pad = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 1.0, 0.2),
      new THREE.MeshStandardMaterial({ color: sx * sz > 0 ? 0xe5484d : 0x2e7dd6, roughness: 0.7 }),
    );
    pad.position.set(sx * (RING - 0.1), 0.85, sz * (RING - 0.1));
    ringParts.add(pad);
  }
  ropeColors.forEach((color, i) => {
    const y = 0.5 + i * 0.4;
    const ropeMat = new THREE.MeshStandardMaterial({ color, roughness: 0.6 });
    for (let side = 0; side < 4; side++) {
      const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, RING * 2, 8), ropeMat);
      rope.rotation.z = Math.PI / 2;
      if (side % 2) rope.rotation.y = Math.PI / 2;
      rope.position.set(side === 1 ? RING : side === 3 ? -RING : 0, y, side === 0 ? -RING : side === 2 ? RING : 0);
      ringParts.add(rope);
    }
  });
  const hall = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 60),
    new THREE.MeshStandardMaterial({ color: 0x0b0d12, roughness: 1 }),
  );
  hall.rotation.x = -Math.PI / 2;
  hall.position.y = -1.01;
  world.add(hall);

  world.add(new THREE.HemisphereLight(0xdfe8ff, 0x20182a, 1.1));
  const spot = new THREE.SpotLight(0xfff1d6, 60, 14, 0.75, 0.5, 1.2);
  spot.position.set(0, 6, 0.5);
  spot.target.position.set(0, 0, 0);
  world.add(spot, spot.target);
  const rim = new THREE.DirectionalLight(0x88aaff, 1.2);
  rim.position.set(-3, 4, -5);
  world.add(rim);
  let background = new THREE.Color(0x05060a);
  let environment = null;
  let fog = new THREE.Fog(0x05060a, 7, 22);

  // --- Opponent (placeholder boxer built from primitives) ---
  const foe = new THREE.Group();
  foe.position.set(0, 0, -PLAYER_Z);
  world.add(foe);
  const skinMat = new THREE.MeshStandardMaterial({ color: SKIN[0], roughness: 0.65 });
  const trunksMat = new THREE.MeshStandardMaterial({ color: TRUNKS[0], roughness: 0.7 });
  const foeGloveMat = [0, 1].map(() => new THREE.MeshStandardMaterial({ color: 0xb3202a, roughness: 0.45 }));
  const body = new THREE.Group(); // leans and recoils as a unit
  foe.add(body);
  const legs = new THREE.Mesh(new THREE.CapsuleGeometry(0.19, 0.55, 4, 12), trunksMat);
  legs.position.y = 0.5;
  foe.add(legs);
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.21, 0.42, 4, 14), skinMat);
  torso.position.y = 1.2;
  torso.scale.set(1.15, 1, 0.8);
  const foeHead = new THREE.Mesh(new THREE.SphereGeometry(0.125, 20, 16), skinMat);
  foeHead.position.y = 1.64;
  foeHead.scale.set(0.92, 1.08, 1);
  const brow = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.025, 0.04), new THREE.MeshBasicMaterial({ color: 0x1a1210 }));
  brow.position.set(0, 1.675, 0.105);
  const eyes = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.02, 0.03), new THREE.MeshBasicMaterial({ color: 0x0c0c0c }));
  eyes.position.set(0, 1.648, 0.112);
  body.add(torso, foeHead, brow, eyes);
  const foeGloves = [-1, 1].map((side, i) => {
    const glove = new THREE.Mesh(new THREE.SphereGeometry(0.095, 16, 12), foeGloveMat[i]);
    glove.scale.set(1, 1.05, 1.25);
    body.add(glove);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 1, 10), skinMat);
    body.add(arm);
    return { glove, arm, side, shoulder: new THREE.Vector3(side * 0.24, 1.42, 0) };
  });
  // Local guard positions: gloves up by the chin, or tight in front of the face.
  const guardOpen = (side, out) => out.set(side * 0.17, 1.47, 0.24);
  const guardTight = (side, out) => out.set(side * 0.085, 1.6, 0.25);

  // --- Player gloves, attached to the view ---
  const myGloveMat = new THREE.MeshStandardMaterial({ color: 0x1f57c9, roughness: 0.45 });
  const myArmMat = new THREE.MeshStandardMaterial({ color: 0xc98d6b, roughness: 0.65 });
  const myGloves = [-1, 1].map((side) => {
    const group = new THREE.Group();
    const glove = new THREE.Mesh(new THREE.SphereGeometry(0.095, 16, 12), myGloveMat);
    glove.scale.set(1, 1.05, 1.3);
    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.075, 0.09, 12), new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.6 }));
    cuff.rotation.x = Math.PI / 2;
    cuff.position.z = 0.13;
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.6, 10), myArmMat);
    arm.rotation.x = Math.PI / 2;
    arm.position.z = 0.46;
    group.add(glove, cuff, arm);
    camera.add(group);
    group.visible = false;
    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.06, 1, 10), new THREE.MeshStandardMaterial({ color: 0xb8926f, roughness: 0.65 }));
    upper.visible = false;
    camera.add(upper);
    return { group, upper, side, t: 0, busy: 0, landed: false, rest: new THREE.Vector3(side * 0.25, -0.25, -0.46) };
  });

  // --- Sound ---
  let audio = null;
  function blip(freq, duration, type, volume) {
    try {
      audio = audio || new AudioContext();
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, audio.currentTime);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.35, audio.currentTime + duration);
      gain.gain.setValueAtTime(volume, audio.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + duration);
      osc.connect(gain).connect(audio.destination);
      osc.start();
      osc.stop(audio.currentTime + duration);
    } catch {}
  }

  // --- HUD ---
  const hud = document.createElement("div");
  hud.style.cssText =
    "position:fixed;inset:0;pointer-events:none;display:none;color:#f3f6fb;font-family:ui-monospace,Consolas,monospace;";
  const bar = (id, align, color) =>
    `<div style="position:absolute;top:18px;${align}:5%;width:36%;height:16px;background:rgba(0,0,0,.55);border:1px solid rgba(255,255,255,.35)">
       <div id="${id}" style="height:100%;width:100%;background:${color};${align === "right" ? "float:right" : ""}"></div></div>`;
  hud.innerHTML = `
    ${bar("b-me", "left", "#3b82f6")}${bar("b-foe", "right", "#e5484d")}
    <div style="position:absolute;top:38px;left:5%;width:36%;height:6px;background:rgba(0,0,0,.55)"><div id="b-stam" style="height:100%;width:100%;background:#e8c547"></div></div>
    <div id="b-names" style="position:absolute;top:50px;left:5%;right:5%;font-size:13px;display:flex;justify-content:space-between;text-shadow:0 0 6px #000"></div>
    <div id="b-pop" style="position:absolute;left:50%;top:27%;transform:translate(-50%,-50%);font-size:40px;font-weight:bold;text-shadow:0 0 10px #000;opacity:0"></div>
    <div id="b-msg" style="position:absolute;left:50%;top:44%;transform:translate(-50%,-50%);font-size:24px;text-align:center;line-height:1.5;text-shadow:0 0 8px #000;white-space:pre"></div>
    <div id="b-hurt" style="position:absolute;inset:0;background:radial-gradient(transparent 35%, rgba(255,30,40,.8));opacity:0"></div>`;
  document.body.appendChild(hud);
  const el = (id) => hud.querySelector("#" + id);
  const meBar = el("b-me"), foeBar = el("b-foe"), stamBar = el("b-stam");
  const namesEl = el("b-names"), popEl = el("b-pop"), msgEl = el("b-msg"), hurtEl = el("b-hurt");
  const HELP = [
    "CLICK TO FIGHT",
    "Left click: left hand   -   Right click: right hand",
    "Move your real head to dodge: slip sideways, duck, or pull back",
    "C recenters your head   -   Esc pauses",
    "Punch when they miss for a counter. Watch your stamina.",
  ].join("\n");
  // These are webcam games: with no tracked face there is nothing to play with.
  const NEED_FACE = [
    "WEBCAM REQUIRED",
    "This game is played with your head.",
    "Allow the camera, then sit where it can see your face.",
  ].join("\n");
  let popTimer = 0;
  const pop = (text, color = "#fff") => {
    popEl.textContent = text;
    popEl.style.color = color;
    popTimer = 0.7;
  };

  // --- State ---
  const state = { active: false, tracked: false, level: 0, wins: 0, hurt: 0, shake: 0, over: 0, stamina: 100 };
  const me = { health: 100, head: new THREE.Vector3(0, HEAD_HEIGHT, PLAYER_Z) };
  // phase: idle -> windup -> strike -> recover -> idle ... or stagger / ko
  const ai = {
    health: 100, phase: "idle", timer: 1.5, hand: 0, kind: "straight", guard: false, guardTimer: 0,
    target: new THREE.Vector3(), hitChecked: false, stagger: 0, sway: 0, lean: 0, recoil: 0, fall: 0,
    hitAnim: 0, // time left on the flinch from a punch that landed
  };
  let boxer = null; // the real model, once it has loaded
  const keys = new Set();
  let neutral = null;
  const lean = new THREE.Vector3();
  const leanTarget = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const tmp2 = new THREE.Vector3();
  const local = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const forward = new THREE.Vector3(0, 0, 1);
  const shoulder = new THREE.Vector3();

  // Real head rotation relative to how it was when you clicked in, amplified
  // (you cannot turn 90 degrees and still see the screen) with a small dead
  // zone so a resting head does not make the view swim.
  let neutralRot = null;
  const turn = [0, 0, 0];
  function headTurn(rot, dt, scale) {
    const target = [0, 0, 0];
    if (rot) {
      if (!neutralRot) neutralRot = [rot[0], rot[1], rot[2]];
      const gains = [params.turnGain, params.turnGain * 0.8, 1];
      const limits = [1.75, 1.0, 0.5];
      for (let i = 0; i < 3; i++) {
        let d = rot[i] - neutralRot[i];
        d = Math.sign(d) * Math.max(Math.abs(d) - 0.035, 0);
        target[i] = THREE.MathUtils.clamp(d * gains[i] * scale, -limits[i], limits[i]);
      }
    }
    const k = 1 - Math.exp(-dt * 16);
    for (let i = 0; i < 3; i++) turn[i] += (target[i] - turn[i]) * k;
    return turn;
  }

  // Each opponent is quicker to throw, quicker to recover, and tracks your head more.
  function tuning() {
    const l = Math.min(state.level, 8);
    return {
      windup: Math.max(0.5 - l * 0.035, 0.27),
      idleMin: Math.max(0.9 - l * 0.08, 0.3),
      idleMax: Math.max(1.9 - l * 0.15, 0.8),
      recover: Math.max(0.6 - l * 0.04, 0.32),
      tracking: Math.min(0.15 + l * 0.08, 0.6),
      guardChance: Math.min(0.3 + l * 0.06, 0.7),
      damage: 1 + l * 0.08,
      toughness: 1 + l * 0.2,
    };
  }

  function newOpponent() {
    ai.health = 100;
    ai.phase = "idle";
    ai.timer = 1.6;
    ai.guard = false;
    ai.stagger = ai.recoil = ai.fall = 0;
    ai.hitAnim = 0;
    skinMat.color.setHex(SKIN[state.level % SKIN.length]);
    trunksMat.color.setHex(TRUNKS[state.level % TRUNKS.length]);
    tintBoxer();
    foe.rotation.set(0, 0, 0);
    foe.position.set(0, 0, -PLAYER_Z);
    namesEl.innerHTML = `<span>YOU</span><span>${NAMES[Math.min(state.level, NAMES.length - 1)]}${state.level >= NAMES.length ? " +" + (state.level - NAMES.length + 1) : ""}  (fight ${state.level + 1})</span>`;
  }

  function reset() {
    state.level = 0;
    state.wins = 0;
    state.over = 0;
    state.stamina = 100;
    me.health = 100;
    lean.set(0, 0, 0);
    newOpponent();
  }

  const locked = () => document.pointerLockElement === canvas;
  document.addEventListener("pointerlockchange", () => {
    if (locked()) neutral = neutralRot = null;
  });
  canvas.addEventListener("mousedown", (e) => {
    if (!state.active) return;
    if (!locked()) {
      if (e.button === 0 && state.tracked) canvas.requestPointerLock();
      return;
    }
    if (e.button === 0) throwPunch(0);
    if (e.button === 2) throwPunch(1);
  });
  canvas.addEventListener("contextmenu", (e) => {
    if (state.active) e.preventDefault();
  });
  window.addEventListener("keydown", (e) => {
    if (!state.active) return;
    keys.add(e.code);
    if (e.code === "KeyC") neutral = neutralRot = null;
  });
  window.addEventListener("keyup", (e) => keys.delete(e.code));
  window.addEventListener("blur", () => keys.clear());

  function throwPunch(hand) {
    const g = myGloves[hand];
    if (g.busy > 0 || me.health <= 0 || ai.phase === "ko" || state.over > 0) return;
    g.busy = 0.36;
    g.t = 0;
    g.landed = false;
    g.power = 0.45 + 0.55 * (state.stamina / 100);
    state.stamina = Math.max(state.stamina - 15, 0);
    blip(220, 0.08, "triangle", 0.04);
  }

  // The player's glove reached the opponent.
  function landPunch(g) {
    g.landed = true;
    const t = tuning();
    let damage = (8 * g.power) / t.toughness;
    if (ai.phase === "recover" || ai.phase === "stagger") {
      damage *= 1.7;
      pop("COUNTER!", "#ffd54a");
      blip(150, 0.2, "sawtooth", 0.1);
    } else if (ai.guard && ai.phase === "idle") {
      damage *= 0.22;
      pop("blocked", "#aab4c4");
      blip(320, 0.06, "square", 0.05);
    } else {
      blip(170, 0.14, "sawtooth", 0.08);
    }
    ai.health -= damage;
    ai.recoil = Math.min(ai.recoil + damage * 0.035, 0.5);
    if (ai.phase === "idle") ai.hitAnim = 0.4;
    // A clean shot interrupts a wind-up some of the time.
    if (ai.phase === "windup" && Math.random() < 0.35) {
      ai.phase = "stagger";
      ai.timer = 0.35;
    }
    if (ai.health <= 0) {
      ai.phase = "ko";
      ai.timer = 3.2;
      state.wins += 1;
      pop("KNOCKOUT!", "#ffd54a");
      blip(90, 0.6, "sawtooth", 0.12);
    }
  }

  function hitPlayer(damage, label) {
    me.health -= damage * tuning().damage;
    state.hurt = 1;
    state.shake = 1;
    pop(label, "#ff5a5f");
    blip(120, 0.25, "sawtooth", 0.12);
    if (me.health <= 0) {
      state.over = 3.5;
      msgEl.textContent = `KNOCKED OUT\nYou won ${state.wins} fight${state.wins === 1 ? "" : "s"}`;
    }
  }

  function updateOpponent(dt, time) {
    const t = tuning();
    ai.timer -= dt;
    ai.hitAnim = Math.max(ai.hitAnim - dt, 0);
    ai.recoil *= Math.exp(-dt * 6);
    ai.sway = Math.sin(time * 1.3) * 0.07 + Math.sin(time * 2.9) * 0.025;

    if (ai.phase === "ko") {
      ai.fall = Math.min(ai.fall + dt * 2.2, 1);
      if (ai.timer <= 0) {
        state.level += 1;
        me.health = Math.min(me.health + 40, 100);
        newOpponent();
      }
      return;
    }
    if (ai.phase === "idle" || ai.phase === "stagger") {
      ai.guardTimer -= dt;
      if (ai.guardTimer <= 0) {
        ai.guard = Math.random() < t.guardChance;
        ai.guardTimer = 0.5 + Math.random() * 0.9;
      }
      if (ai.timer <= 0) {
        if (me.health <= 0) {
          ai.timer = 1;
          return;
        }
        ai.phase = "windup";
        ai.timer = t.windup;
        ai.hand = Math.random() < 0.5 ? 0 : 1;
        ai.kind = Math.random() < 0.35 ? "hook" : "straight";
        ai.guard = false;
        ai.target.copy(me.head); // aims where your head is as it winds up
        blip(520, 0.05, "sine", 0.03);
      }
    } else if (ai.phase === "windup") {
      if (ai.timer <= 0) {
        ai.phase = "strike";
        ai.timer = 0.11;
        ai.hitChecked = false;
        // Better fighters adjust toward where you have moved since.
        ai.target.lerp(me.head, t.tracking);
      }
    } else if (ai.phase === "strike") {
      if (ai.timer <= 0 && !ai.hitChecked) {
        ai.hitChecked = true;
        if (ai.kind === "straight") {
          if (me.head.distanceTo(ai.target) < HEAD_RADIUS) hitPlayer(12, "OOF");
          else pop("slip!", "#7dffb0");
        } else {
          // A hook sweeps across at head height: get under it or out of range.
          const ducked = me.head.y < HEAD_HEIGHT - 0.2;
          const pulledBack = me.head.z > PLAYER_Z + 0.2;
          if (!ducked && !pulledBack) hitPlayer(18, "HOOK!");
          else pop(ducked ? "ducked!" : "made them miss!", "#7dffb0");
        }
        ai.phase = "recover";
        ai.timer = t.recover;
      }
    } else if (ai.phase === "recover") {
      if (ai.timer <= 0) {
        ai.phase = "idle";
        ai.timer = t.idleMin + Math.random() * (t.idleMax - t.idleMin);
      }
    }
  }

  function tintBoxer() {
    if (!boxer) return;
    if (boxer.skin) boxer.skin.color.setHex(SKIN_TINT[state.level % SKIN_TINT.length]);
    if (boxer.trunks) boxer.trunks.color.setHex(TRUNKS[state.level % TRUNKS.length]);
  }

  // Where the opponent's face is right now (what your punches fly at).
  function foeFace(out) {
    if (!boxer || !boxer.head) return foeHead.getWorldPosition(out);
    boxer.head.getWorldPosition(out);
    out.y += 0.09;
    return out;
  }

  // Drive the real model. The fight logic owns the timing, so each clip is
  // scrubbed to the matching moment instead of being left to play on its own:
  // punch clips are 0-0.45 s wind-up, 0.55 s contact, 1.0 s back in stance.
  function poseBoxer(dt, time) {
    const t = tuning();
    if (ai.phase !== "ko") foe.position.x = ai.sway;
    foe.position.y = 0;
    foe.rotation.set(0, 0, 0);

    let clip = ai.guard ? "Block" : "Idle";
    let at = null; // null = loop on the clock
    let attacking = false;
    if (ai.phase === "windup" || ai.phase === "strike" || ai.phase === "recover") {
      clip = (ai.kind === "hook" ? "Hook" : "Jab") + (ai.hand === 0 ? "L" : "R");
      attacking = true;
      if (ai.phase === "windup") at = 0.45 * (1 - ai.timer / t.windup);
      else if (ai.phase === "strike") at = 0.45 + 0.1 * (1 - ai.timer / 0.11);
      else at = 0.55 + 0.45 * (1 - ai.timer / t.recover);
    } else if (ai.phase === "ko") {
      clip = "KO";
      at = Math.min(3.2 - ai.timer, 1.6);
    } else if (ai.phase === "stagger") {
      clip = "Stagger";
      at = 0.8 * (1 - Math.max(ai.timer, 0) / 0.35);
    } else if (ai.hitAnim > 0) {
      clip = "Hit";
      at = 0.4 - ai.hitAnim;
    }
    if (!boxer.actions[clip]) clip = "Idle";

    // Cross-fade by hand; punches and knockouts cut in immediately.
    const snap = ai.phase === "strike" || ai.phase === "ko" || clip === "Hit";
    const k = snap ? 1 : 1 - Math.exp(-dt * 16);
    for (const [name, action] of Object.entries(boxer.actions)) {
      const w = boxer.weights[name] + ((name === clip ? 1 : 0) - boxer.weights[name]) * k;
      boxer.weights[name] = w;
      action.setEffectiveWeight(w);
      if (name === clip) {
        const length = action.getClip().duration;
        action.time = at === null ? time % length : Math.min(Math.max(at, 0), length - 1e-3);
      }
    }
    boxer.mixer.update(0);

    // Turn and lean the whole fighter so the punch travels at its target, and
    // otherwise keep facing wherever your head has gone.
    const aimAt = attacking ? ai.target : me.head;
    const yaw = Math.atan2(aimAt.x - foe.position.x, aimAt.z - foe.position.z) * (attacking ? 1 : 0.7);
    const pitch = attacking && ai.kind !== "hook" ? THREE.MathUtils.clamp(Math.atan2(HEAD_HEIGHT - 0.03 - ai.target.y, 1.15), -0.12, 0.5) : 0;
    const follow = 1 - Math.exp(-dt * 12);
    boxer.yaw += (yaw - boxer.yaw) * follow;
    boxer.pitch += (pitch - boxer.pitch) * follow;
    boxer.model.rotation.set(ai.phase === "ko" ? 0 : boxer.pitch, Math.PI + boxer.yaw, 0);

    // The tell: the gloves heat up as a punch winds up.
    const glow = ai.phase === "windup" ? 1 - ai.timer / t.windup : ai.phase === "strike" ? 0.5 : 0;
    if (boxer.gloves) boxer.gloves.emissive.setRGB(glow * 0.8, glow * 0.18, 0);
    foe.updateMatrixWorld(true);
  }

  // Pose the placeholder boxer from the fight state.
  function poseOpponent(dt, time) {
    if (boxer) return poseBoxer(dt, time);
    const t = tuning();
    foe.position.x = ai.phase === "ko" ? foe.position.x : ai.sway;
    foe.rotation.x = -ai.fall * 1.45;
    foe.position.y = -ai.fall * 0.15;
    body.rotation.x = -ai.recoil * 0.5 + (ai.phase === "windup" ? -0.08 : ai.phase === "strike" ? 0.18 : 0);
    body.position.y = Math.sin(time * 5) * 0.012;
    body.position.z = -ai.recoil * 0.15;

    foe.updateMatrixWorld(true);
    foeGloves.forEach((g, i) => {
      const active = i === ai.hand;
      (ai.guard && ai.phase === "idle" ? guardTight : guardOpen)(g.side, tmp);
      let glow = 0;
      if (active && ai.phase === "windup") {
        // The tell: the punching hand draws back (wide, for a hook) and lights up.
        const k = 1 - ai.timer / t.windup;
        if (ai.kind === "hook") tmp.set(g.side * (0.2 + 0.32 * k), 1.5, 0.12 - 0.1 * k);
        else tmp.set(g.side * 0.2, 1.42, 0.2 - 0.26 * k);
        glow = k;
      } else if (active && (ai.phase === "strike" || (ai.phase === "recover" && ai.timer > t.recover - 0.12))) {
        const k = ai.phase === "strike" ? 1 - ai.timer / 0.11 : 1;
        local.copy(ai.target);
        body.worldToLocal(local);
        if (ai.kind === "hook") {
          // Sweep from out wide across the player's head line.
          tmp.set(g.side * (0.52 - 0.75 * k) - ai.sway, HEAD_HEIGHT - 0.02, PLAYER_Z * 2 - 0.12);
        } else {
          tmp2.set(g.side * 0.2, 1.42, -0.06);
          tmp.lerpVectors(tmp2, local, k);
        }
        glow = 1;
      }
      const rate = active && ai.phase === "strike" ? 60 : 14;
      g.glove.position.lerp(tmp, 1 - Math.exp(-dt * rate));
      foeGloveMat[i].emissive.setRGB(glow * 0.9, glow * 0.25, 0);
      // Stretch the arm from shoulder to glove.
      tmp2.copy(g.glove.position).sub(g.shoulder);
      const len = tmp2.length();
      g.arm.position.copy(g.shoulder).addScaledVector(tmp2, 0.5);
      g.arm.scale.set(1, len, 1);
      g.arm.quaternion.setFromUnitVectors(up, tmp2.normalize());
    });
  }

  function update(dt, eye, tracked, rot) {
    if (!state.active) return;
    dt = Math.min(dt, 0.05);
    const time = performance.now() / 1000;
    state.tracked = tracked;
    // No face, no fight: everything freezes until the camera can see you again.
    const playing = locked() && tracked;

    // --- Your head ---
    if (!tracked) eye = neutral || eye;
    else if (!neutral) neutral = [eye[0], eye[1], eye[2]];
    const zero = neutral || eye;
    const gain = params.boxGain;
    leanTarget.set(
      THREE.MathUtils.clamp((eye[0] - zero[0]) * gain, -0.55, 0.55),
      THREE.MathUtils.clamp((eye[1] - zero[1]) * gain, -0.6, 0.15),
      THREE.MathUtils.clamp((eye[2] - zero[2]) * gain * 0.8, -0.25, 0.42),
    );
    if (me.health <= 0) leanTarget.set(0, -1.1, 0.3);
    lean.lerp(leanTarget, 1 - Math.exp(-dt * (me.health <= 0 ? 4 : 22)));

    rig.position.set(0, HEAD_HEIGHT, PLAYER_Z);
    rig.quaternion.identity();
    rig.updateMatrixWorld(true);
    state.shake *= Math.exp(-dt * 9);
    camera.position.copy(lean);
    camera.position.x += (Math.random() - 0.5) * 0.05 * state.shake;
    camera.position.y += (Math.random() - 0.5) * 0.05 * state.shake;
    // Keep looking at the opponent's chest as you move, with a tilt into the slip.
    // On top of that, turning your real head turns the view.
    const look = headTurn(rot, dt, 1);
    camera.rotation.set(
      -0.06 - lean.y * 0.25 - state.shake * 0.12 + look[1],
      -lean.x * 0.45 + look[0],
      -lean.x * 0.22 + look[2],
      "YXZ",
    );
    me.head.set(lean.x, HEAD_HEIGHT + lean.y, PLAYER_Z + lean.z);

    if (playing) {
      if (state.over > 0) {
        state.over -= dt;
        if (state.over <= 0) {
          reset();
          msgEl.textContent = "";
        }
      }
      updateOpponent(dt, time);
      state.stamina = Math.min(state.stamina + 26 * dt, 100);
    }
    poseOpponent(dt, time);

    // --- Your gloves ---
    foeFace(tmp);
    camera.updateMatrixWorld(true);
    camera.worldToLocal(tmp);
    for (const g of myGloves) {
      g.group.visible = me.health > 0;
      let reach = 0;
      if (g.busy > 0) {
        g.busy -= dt;
        g.t += dt;
        // Out fast, back slower.
        reach = g.t < 0.1 ? g.t / 0.1 : Math.max(1 - (g.t - 0.1) / 0.24, 0);
        if (!g.landed && g.t >= 0.1 && playing) landPunch(g);
      }
      const bob = Math.sin(time * 4 + g.side) * 0.008;
      tmp2.copy(g.rest);
      tmp2.x -= lean.x * 0.15;
      tmp2.y += bob - lean.y * 0.1;
      local.copy(tmp);
      local.z += 0.12; // stop at the face, not inside it
      g.group.position.lerpVectors(tmp2, local, reach * reach * (3 - 2 * reach));
      // Point the forearm back at the shoulder so the arm always reaches in
      // from the corner of the view, and bridge the gap with an upper arm.
      shoulder.set(g.side * 0.3, -0.52, 0.12);
      tmp2.copy(shoulder).sub(g.group.position);
      const span = tmp2.length();
      tmp2.divideScalar(span);
      g.group.quaternion.setFromUnitVectors(forward, tmp2);
      g.group.rotateZ(-g.side * (0.5 + reach * 0.9)); // knuckles roll over as the punch lands
      const elbow = Math.min(0.6, span);
      g.upper.visible = g.group.visible && span > elbow + 0.02;
      g.upper.position.copy(g.group.position).addScaledVector(tmp2, (elbow + span) / 2);
      g.upper.scale.set(1, span - elbow, 1);
      g.upper.quaternion.setFromUnitVectors(up, tmp2);
    }

    // --- HUD ---
    state.hurt = Math.max(state.hurt - dt * 2.2, 0);
    hurtEl.style.opacity = me.health <= 0 ? 0.85 : state.hurt * 0.9;
    meBar.style.width = `${Math.max(me.health, 0)}%`;
    foeBar.style.width = `${Math.max(ai.health, 0)}%`;
    stamBar.style.width = `${state.stamina}%`;
    popTimer -= dt;
    popEl.style.opacity = Math.max(Math.min(popTimer * 3, 1), 0);
    if (!tracked) msgEl.textContent = NEED_FACE;
    else if (!playing) msgEl.textContent = HELP;
    else if (state.over <= 0) msgEl.textContent = "";
  }

  // --- Real models and sky, swapped in over the placeholders as they arrive ---
  const gltf = new GLTFLoader();
  const asset = (file, apply) =>
    gltf
      .loadAsync(ASSETS + file)
      .then(apply)
      .catch((err) => console.warn(`boxing asset ${file} not used:`, err.message || err));

  asset("ring.glb", (ring) => {
    world.add(ring.scene);
    ringParts.visible = false;
  });

  asset("gloves_fp.glb", (file) => {
    myGloves.forEach((g, i) => {
      const model = file.scene.getObjectByName(i === 0 ? "GloveL" : "GloveR");
      if (!model) return;
      for (const child of [...g.group.children]) g.group.remove(child);
      model.position.set(0, 0, 0);
      g.group.add(model);
    });
  });

  asset("boxer.glb", (file) => {
    const model = file.scene;
    const found = {};
    model.traverse((child) => {
      if (!child.isMesh) return;
      child.frustumCulled = false;
      found[child.material.name] = child.material;
    });
    const mixer = new THREE.AnimationMixer(model);
    const actions = {};
    const weights = {};
    for (const clip of file.animations) {
      const action = mixer.clipAction(clip);
      action.play();
      action.paused = true; // scrubbed by poseBoxer
      action.setEffectiveWeight(clip.name === "Idle" ? 1 : 0);
      actions[clip.name] = action;
      weights[clip.name] = clip.name === "Idle" ? 1 : 0;
    }
    if (!actions.Idle) throw new Error("boxer.glb has no Idle clip");
    foe.add(model);
    body.visible = false;
    legs.visible = false;
    boxer = {
      model, mixer, actions, weights,
      head: model.getObjectByName("Head"),
      skin: found.Skin, trunks: found.Trunks, gloves: found.Gloves,
      yaw: 0, pitch: 0,
    };
    tintBoxer();
  });

  const textures = new THREE.TextureLoader();
  const applySky = () => {
    if (!state.active) return;
    scene.background = background;
    scene.environment = environment;
    scene.fog = fog;
  };
  textures
    .loadAsync(ASSETS + "sky.jpg")
    .then((sky) => {
      sky.mapping = THREE.EquirectangularReflectionMapping;
      sky.colorSpace = THREE.SRGBColorSpace;
      background = sky;
      if (!environment) environment = sky;
      fog = null;
      applySky();
    })
    .catch((err) => console.warn("boxing sky not used:", err.message || err));
  new HDRLoader()
    .loadAsync(ASSETS + "sky.hdr")
    .then((hdr) => {
      hdr.mapping = THREE.EquirectangularReflectionMapping;
      environment = hdr; // lights the fighters; the JPG stays as the backdrop
      applySky();
    })
    .catch((err) => console.warn("boxing sky.hdr not used:", err.message || err));

  let savedBackground = null;
  let savedFog = null;
  let savedEnvironment = null;
  function setActive(on) {
    if (on === state.active) return;
    state.active = on;
    world.visible = on;
    hud.style.display = on ? "block" : "none";
    for (const g of myGloves) {
      g.group.visible = on;
      if (!on) g.upper.visible = false;
    }
    if (on) {
      savedBackground = scene.background;
      savedFog = scene.fog;
      savedEnvironment = scene.environment;
      scene.background = background;
      scene.environment = environment;
      scene.fog = fog;
      reset();
    } else {
      scene.background = savedBackground;
      scene.environment = savedEnvironment;
      scene.fog = savedFog;
      if (locked()) document.exitPointerLock();
      keys.clear();
      rig.position.set(0, 0, 0);
      rig.quaternion.identity();
      rig.updateMatrixWorld(true);
    }
  }

  return { update, setActive, state, me, ai, lean, isActive: () => state.active, weapon: { fovScale: 1 } };
}
