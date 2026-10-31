export function parseChart(text) {
  const regions = [], states = {}, edges = [];
  let region = null;
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    const r = line.match(/^state "(.+)" as (r\d+) \{$/);
    if (r) { region = { name: r[1], id: r[2], states: [] }; regions.push(region); continue; }
    if (line === '}' ) { region = null; continue; }
    const st = line.match(/^(s\d+): (.+)$/);
    if (st && region) { states[st[1]] = { id: st[1], label: st[2], region: region.name, classes: [] }; region.states.push(st[1]); continue; }
    const e = line.match(/^(\[\*\]|s\d+) --> (s\d+)(?:: (.+))?$/);
    if (e && region) { edges.push({ from: e[1], to: e[2], label: e[3] || '', region: region.name }); continue; }
    const c = line.match(/^class (s\d+) (\w+)$/);
    if (c && states[c[1]]) states[c[1]].classes.push(c[2]);
  }
  return { regions, states, edges };
}

const FLOWN = ['Filling with propellant', 'Lifting off', 'Through max Q', 'Hot staging', 'Flipping, burning back', 'Falling home', 'Slowing over the tower', 'Caught by the arms', 'Riding on top', 'Engines lit while attached', 'Flying on to space', 'Falling back, glowing', 'Flipping upright', 'Splashed down', 'Arms open, waiting', 'Arms closing', 'Holding the booster'];
export const flown = (label) => FLOWN.includes(label);

const SLOTS = {
  'Filling with propellant': [0, 0], 'Holding the count': [-1, 0.9], 'Scrubbed for today': [-1, 1.9], 'Lifting off': [0, 1.4], 'Through max Q': [0, 2.4], 'Hot staging': [0, 3.4],
  'Flipping, burning back': [0, 4.4], 'Falling home': [0, 5.4], 'Diverted to the sea': [-1, 6.5], 'Slowing over the tower': [0, 6.5], 'Coming in on a failed check': [1, 6.5], 'Caught by the arms': [0, 7.6], 'Hits the tower': [1, 7.6],
  'Riding on top': [2.45, 0], 'Engines lit while attached': [2.45, 3.4], 'Flying on to space': [2.45, 4.4], 'Falling back, glowing': [2.45, 5.6], 'Flipping upright': [2.45, 6.6], 'Splashed down': [2.45, 7.6],
  'Arms open, waiting': [3.85, 0], 'Arms closing': [3.85, 6.5], 'Holding the booster': [3.85, 7.6], 'Damaged': [4.85, 7.6],
};
export function chartSlot(label) { return SLOTS[label] || [0, 0]; }

export function edgeKind(chart, e) {
  const a = chart.states[e.from], b = chart.states[e.to];
  if (!a) return 'start';
  if (b.classes.includes('breaks') || (a.classes.includes('breaks') && b.classes.includes('breaks'))) return 'red';
  if (flown(a.label) && flown(b.label)) return 'gold';
  return 'cream';
}
