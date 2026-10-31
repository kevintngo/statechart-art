const MITOSIS = new Set(['prophase', 'prometaphase', 'metaphase', 'anaphase', 'telophase', 'cytokinesis']);
const ENDS = new Set(['two cells', 'dead']);
const set = (v, d) => ({ ...v, ...d });

export const configs = [
  { p53: 'working', spindleCheck: 'working' },
  { p53: 'broken', spindleCheck: 'working' },
  { p53: 'working', spindleCheck: 'broken' },
];

export const init = () => configs.map((c) => ({ phase: 'G1', dna: 'intact', mutated: false, copied: false, caught: 'none', split: 'even', ...c }));

export const actions = [
  { name: 'NoSignal', when: (v) => v.phase === 'G1' && v.dna === 'intact', then: (v) => set(v, { phase: 'G0' }) },
  { name: 'Signal', when: (v) => v.phase === 'G0', then: (v) => set(v, { phase: 'G1' }) },
  { name: 'Damage', when: (v) => (v.phase === 'G1' || v.phase === 'G2') && v.dna === 'intact', then: (v) => set(v, { dna: 'damaged' }) },
  { name: 'Repair', when: (v) => (v.phase === 'G1' || v.phase === 'G2') && v.dna === 'damaged', then: (v) => set(v, { dna: 'intact' }) },
  { name: 'Die', when: (v) => (v.phase === 'G1' || v.phase === 'G2') && v.dna === 'damaged' && v.p53 === 'working', then: (v) => set(v, { phase: 'dead' }) },
  { name: 'StartCopying', when: (v) => v.phase === 'G1' && (v.dna === 'intact' || v.p53 === 'broken'), then: (v) => set(v, { phase: 'S' }) },
  { name: 'FinishCopying', when: (v) => v.phase === 'S', then: (v) => set(v, { phase: 'G2', copied: true, mutated: v.mutated || v.dna === 'damaged', dna: 'intact' }) },
  { name: 'Condense', when: (v) => v.phase === 'G2' && v.dna === 'intact', then: (v) => set(v, { phase: 'prophase' }) },
  { name: 'OpenNucleus', when: (v) => v.phase === 'prophase', then: (v) => set(v, { phase: 'prometaphase' }) },
  { name: 'CatchSome', when: (v) => v.phase === 'prometaphase' && v.caught === 'none', then: (v) => set(v, { caught: 'some' }) },
  { name: 'CatchAll', when: (v) => v.phase === 'prometaphase' && v.caught === 'some', then: (v) => set(v, { caught: 'all', phase: 'metaphase' }) },
  { name: 'PullApart', when: (v) => v.phase === 'metaphase', then: (v) => set(v, { phase: 'anaphase' }) },
  { name: 'PullTooSoon', when: (v) => v.phase === 'prometaphase' && v.caught === 'some' && v.spindleCheck === 'broken', then: (v) => set(v, { phase: 'anaphase', split: 'uneven' }) },
  { name: 'Reform', when: (v) => v.phase === 'anaphase', then: (v) => set(v, { phase: 'telophase' }) },
  { name: 'Pinch', when: (v) => v.phase === 'telophase', then: (v) => set(v, { phase: 'cytokinesis' }) },
  { name: 'Divide', when: (v) => v.phase === 'cytokinesis', then: (v) => set(v, { phase: 'two cells' }) },
  { name: 'Done', when: (v) => ENDS.has(v.phase), then: (v) => v },
];

export const rules = [
  { name: 'CopiesBeforeDividing', text: 'A cell never divides before it copies its DNA.', holds: (v) => !(MITOSIS.has(v.phase) || v.phase === 'two cells') || v.copied },
  { name: 'NeverCopiesDamagedDNA', text: 'A cell never copies damaged DNA.', holds: (v) => v.phase !== 'S' || v.dna === 'intact' },
  { name: 'DaughtersCarryNoMutation', text: 'The daughters never carry a mutation.', holds: (v) => v.phase !== 'two cells' || !v.mutated },
  { name: 'SeparatesOnlyWhenAllCaught', text: 'The sisters are pulled apart only when every chromosome is caught.', holds: (v) => v.phase !== 'anaphase' || v.split === 'even' },
  { name: 'EachDaughterGetsOneOfEach', text: 'Each daughter gets one of every chromosome.', holds: (v) => v.phase !== 'two cells' || v.split === 'even' },
];

export const key = (v) => [v.phase, v.dna, v.mutated, v.copied, v.p53, v.spindleCheck, v.caught, v.split].join('|');
