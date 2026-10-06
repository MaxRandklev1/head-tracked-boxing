# Head-Tracked Boxing

A first-person boxing game you play with your head. Your webcam tracks your face, and there is no block button: you avoid punches by actually moving.

- **Slip** sideways or **duck** to make a straight punch miss.
- **Duck** under a hook, or **pull back** out of its range.
- Punch right after they miss for a **counter**.

Each opponent you knock out is replaced by a faster one that tracks your head better.

**This is a webcam game. There is no keyboard or mouse substitute for the head.** If no face is being tracked, the fight does not start, and if your face leaves the picture mid-fight everything freezes until it is back.

## Play it

**https://maxrandklev1.github.io/head-tracked-boxing/** (Chrome or Edge, with a webcam).

## Run it locally

Needs [Node.js](https://nodejs.org) 20 or newer, a webcam, and a Chromium-based browser (Chrome or Edge).

```
npm install
npm run dev
```

Open the address it prints (http://localhost:5173/), allow the camera, sit where it can see your face, and click to fight. Press **F** for fullscreen.

## Controls

| Input | Action |
|---|---|
| Your head | Slip, duck, pull back, look around |
| Left mouse | Left hand |
| Right mouse | Right hand |
| C | Recenter: your current head position becomes your stance |
| Esc | Release the mouse and pause |

Wherever your head is when you click in counts as your neutral stance. Leave yourself room to move a hand's width in every direction.

## How to read a punch

The opponent's gloves glow as a punch winds up.

- **Hand drawn straight back:** a straight punch, aimed at where your head is right now. Move your head off that spot.
- **Arm swung out wide:** a hook, sweeping across at head height. Get under it or lean back.

Punches cost stamina (the yellow bar), and tired punches are weak, so do not just swing.

## Tips

- A 60 fps webcam mode makes a big difference. The game asks the camera for its fastest mode; many webcams fall back to 30 fps in dim light, so light your face.
- If your head movement feels like too much or too little in-game, the sliders are in the Settings panel (visible while paused).

## How it works

- [three.js](https://threejs.org) for rendering.
- [MediaPipe Face Landmarker](https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker) runs in the browser. Head position comes from the iris landmarks (distance from the pixel spacing of the eyes), head rotation from the face transformation matrix. Nothing leaves your machine.
- A One Euro filter smooths the tracking, and a short velocity prediction hides camera latency.
- The opponent's animation clips are scrubbed to the fight logic's timing, so the moment a punch visibly lands is the moment the hit is judged.

`src/boxing.js` is the game, `src/tracker.js` the webcam tracking, `src/filter.js` the smoothing, `src/main.js` the glue.

## Deploy

`npm run deploy` builds the game and pushes the build to the `gh-pages` branch, which GitHub Pages serves.

## Test

With the dev server running:

```
npm test
```

This drives the game in headless Chrome. There is no webcam there, so it feeds simulated face samples through a development-only hook and checks that the fight refuses to run without a face, that only head movement dodges, and that everything freezes when the face is lost. The hook does not exist in production builds (`npm run build`).
