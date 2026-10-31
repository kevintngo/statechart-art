# One becomes two

A tall scrolling wall about the life of one cell, from one cell to two. The cell cycle is a TLA+ model, checked by TLC
through the /statechart skill and laid out by pele. Each state is drawn as a glass slide and each step as a thread,
over hand-drawn scenes on sixteen sheets of paper, in pencil, pastel and gel pen simulated by the oav kit.

See it at https://kevintngo.github.io/statechart-art/one-becomes-two/

Charted with the /statechart skill by [@poteto](https://x.com/poteto). Checked by [TLC](https://github.com/tlaplus/tlaplus)
(MIT) and laid out by [pele](https://pele.run) (MIT). Lettering in Kevin Sans, traced from A. V. Hershey's 1967 fonts
(public domain). The video's music is played on CC0 instruments by [Versilian Studios](https://versilian-studios.com/)
(VSCO 2 CE and VCSL). The code, the model, the drawings and the music are under the MIT license (see `../LICENSE`).

TLC reached 61 states and 77 steps. Two rules hold: a cell never divides before it copies its DNA, and it never gets
stuck. Two checks are broken on purpose to show what they guard: without p53, damaged DNA gets copied and both
daughters carry the mutation (11 steps); without the spindle check, the sisters are pulled apart too soon and the
daughters get the wrong chromosomes (9 steps). The red threads on the wall follow those paths.

## Make it again

The drawing needs Node (made with Node 24) and the packages in `../tools` (`cd ../tools && npm install`).

Check the model and write the chart (the folder must be new or empty; the model's rules break on purpose, so the
command exits with 1):

```bash
~/.claude/skills/statechart/scripts/statechart model/CellCycle.tla --view model/view.mjs --out model/chart-new
```

Draw the sixteen sheets into `out/sheets/` (`--ppm=5` draws a quick small version, `--only=title,growing` draws some):

```bash
node art/render.js
```

The page has a step-through mode: the tag "Step through the chart" on the title opens it. A gold cell travels the
threads one step at a time while a spotlight marks its state and a microscope view shows the cell. The steps come from
`model/cellcycle.mjs`, the model ported to JavaScript; `node model/check.mjs` confirms it reaches the same 61 states, 77
steps, 28 arrows and bug paths as TLC. Draw the microscope views (21 states, 3 frames each) into `out/cells/`:

```bash
node art/cells.js
```

Draw the favicon, the icons and the OpenGraph card into `out/brand/`:

```bash
node art/brand.js
```

Render the music from `music/score.txt` with our serenade engine (not in this repo; it plays the score on CC0
samples), then scroll down the wall in time with it and write `out/video/one-becomes-two.mp4` (1080 by 1920, 30 fps):

```bash
node <serenade>/engine/render.mjs music/score.txt --out music/render
node art/video.js
```

Build the page into `../docs/one-becomes-two/`, where GitHub Pages serves it, and look at it at http://localhost:5298:

```bash
node art/page.js
node art/serve.mjs
```

## Files

| path | what it is |
|---|---|
| `model/` | the TLA+ model, its config, the view that words it, and the chart and report /statechart wrote |
| `art/chart.js` | reads the chart and lays out its two parent states with pele |
| `art/wall.js` | places the chart down the wall and joins the two parts with one thread |
| `art/marks.js` | the slides, threads, arrowheads and tags |
| `art/bio.js` | the drawn things: cells, DNA, chromosomes, spindle poles, tissue |
| `art/scenes.js` | the sixteen sheets: paper, scene, captions and alt text |
| `art/render.js`, `art/page.js` | draw the sheets, then build the page |
| `art/brand.js` | the favicon, the icons and the OpenGraph card: one gold cell pinching in two |
| `model/cellcycle.mjs`, `model/check.mjs` | the model in JavaScript, for the step-through mode, and the check that it matches TLC |
| `art/cells.js`, `art/step.mjs` | the microscope view of each state, and the step-through mode on the page |
| `art/video.js` | the video: scrolls down the wall, slowing and speeding so each chapter meets its part of the music |
| `music/score.txt` | the soundtrack's score |
| `../docs/one-becomes-two/` | the page: tiles in two sizes, the fonts, the icons, the video and the chart as text |
