# Catch

Starship's booster flies home and is caught by its tower, told as a statechart in paper, thread and light.

A scrolling three.js page. Each screen of scroll is one moment of the flight: the camera follows the booster from the
floodlit pad before dawn, through max Q and hot staging, back down to the tower's arms just after sunrise, then the
ship's fall into the night ocean on the other side of the world. The booster, the ship and the tower are three parts of
one statechart that run at the same time, so the page shows all three states at once. Each state hangs in the scene as a
felt patch, and where the screen has room, the step into it is stitched as a gold cord. At the end the whole chart hangs
over the pad, and the last section is the same chart embroidered on linen.

Everything is a paper theatre: rockets of rolled paper, a tower of balsa sticks, cotton steam, tissue-paper flames,
torn-paper dunes and a pastel sky. The textures are drawn in JavaScript with the pencil and pastel kit in `../tools`.

An unofficial fan piece, not made by or with SpaceX. The flight follows Flight 5 (13 October 2024), the only flight so
far that both caught its booster and splashed its ship down. The facts come from SpaceX's flight pages, Wikipedia,
NASASpaceflight and Spaceflight Now.

## Run it

```bash
npm install
npm start
```

Then open http://localhost:5299/ in a browser with WebGL. `npm start` serves the built page in `../docs/catch/`, so run
`npm run build` after changing anything in `web/`.

## The model

`model/Catch.tla` is the flight as a TLA+ model; `model/view.mjs` words it for the chart. Checked by TLC through the
/statechart skill: 88 states and 132 steps. The go/no-go call comes during the boostback burn, as it does for real.
Three rules hold: the arms close only when a booster is coming in to them, the booster turns back only after the ship is
free, and the flight never gets stuck. Two rules break if the go/no-go poll is skipped and the booster comes in by
default: a booster with a failed check heads for the tower anyway (5 steps), and then it hits the tower (7 steps). That
is a what-if. On real flights the sea is the default, and the booster comes in only if every check passes and the flight
director calls “go” before the boostback burn ends.

```bash
~/.claude/skills/statechart/scripts/statechart model/Catch.tla --view model/view.mjs --out model/chart-new
```

## Physics and contacts

`test/collide.mjs` replays the whole flight in Node and checks every solid against every other at more than a thousand
moments: rocket against tower, arms, launch ring, legs, light masts, ground and sea; the dropped hot-stage ring against
the booster; flames and steam against solids and the felt patches; the camera against clouds and paper flats at every
screen shape; patches, cords and the lines they hang from against each other, for both the wide-screen and the phone
layout of the patches. It also checks the contacts that must touch exactly (the booster on the launch ring, the catch
pins on the arms, the arm carriage on the tower), that the flames never jump in length, that each landing descent only
slows once its burn starts and then brakes evenly, and the booster's largest acceleration. Last, it casts rays from the
edges of fourteen screen shapes, from a phone to 32:9, through the whole flight, so no shot ever sees past the edge of
the paper world or into the other set.

The flight paths come from `web/flight.js`: a gravity-turn ascent, a simulated flip on the three centre engines and a
thirteen-engine boostback, the vented ring dropped with air drag right after the burn, then free fall and a
constant-deceleration landing burn that steps down from thirteen engines to three and stops exactly at the hover point.
The ship falls belly first at a steady speed, flips about its middle, and only slows once its engines light.

```bash
npm install
npm test
```

## Build

The drawing needs Node 22 or later and the packages in `../tools` (`cd ../tools && npm install`).

```bash
node art/textures.js
node art/flats.js
node art/patches.js
node art/sampler.js
node art/layout.js
node art/brand.js
node art/build.js
npm start
node art/og.mjs --at=8.05
node art/og.mjs --at=8.05 --bare --size=1600x1000 --name=poster
node art/build.js
```

`art/layout.js` lays the chart out with pele; the 3D chart in the finale uses that layout, and the page links pele's
drawing of it. `art/og.mjs` renders the share card and the poster shown when WebGL is off, from the running page, so it
needs `npm start` running. `art/build.js` writes the page to `../docs/catch/`, where GitHub Pages serves it.
`art/shoot.mjs` takes screenshots with a local Chrome, for checking frames (`--at=3.3,7.2` jumps to moments,
`--scroll=1.15` scrolls the page, `--size=390x844 --dpr=2` for a phone).

## Video

Render the soundtrack, "Seven Minutes Home", from `music/score.txt` with our serenade engine (not in this repo; it plays
the score on CC0 samples). Then, with `npm start` running, scroll the page frame by frame in time with it and write
`out/video/catch.mp4` (1080 by 1080, 60 fps, 45 seconds). Each station parks on its bar of the music: liftoff on the
first horn call, the catch on the loudest chord.

```bash
node <serenade>/engine/render.mjs music/score.txt --out music/render
node art/video.mjs
```

## Credits

Charted with the /statechart skill by [@poteto](https://x.com/poteto). Checked by [TLC](https://github.com/tlaplus/tlaplus)
and laid out by [pele](https://pele.run). Built with [three.js](https://threejs.org) (MIT). Lettering in Kevin Sans,
traced from A. V. Hershey's 1967 fonts. The video's music is played on CC0 instruments by
[Versilian Studios](https://versilian-studios.com/) (VSCO 2 CE and VCSL). The code, the model, the drawings and the music
are under the MIT license (see `../LICENSE`).
