export const title = "One becomes two";

const READY = "Getting ready (interphase)";
const DIVIDING = "Dividing (mitosis)";

export const state = (v) => {
  switch (v.phase) {
    case "G0": return [READY, "Resting (G0)"];
    case "G1":
      if (v.dna === "intact") return [READY, "Growing (G1)"];
      return [READY, v.p53 === "working" ? "Damaged, held by p53" : "Damaged, and p53 is broken"];
    case "S": return [READY, v.dna === "intact" ? "Copying its DNA (S)" : "Copying damaged DNA"];
    case "G2": return [READY, v.dna === "intact" ? "Checking the copy (G2)" : "Damaged, held at the second check"];
    case "prophase": return [DIVIDING, "Coiling up (prophase)"];
    case "prometaphase":
      if (v.caught === "none") return [DIVIDING, "The spindle reaches in (prometaphase)"];
      return [DIVIDING, v.spindleCheck === "working" ? "Some caught, the check waits" : "Some caught, the check is broken"];
    case "metaphase": return [DIVIDING, "Lined up in the middle (metaphase)"];
    case "anaphase": return [DIVIDING, v.split === "even" ? "Sisters pulled apart (anaphase)" : "Pulled apart too soon"];
    case "telophase": return [DIVIDING, "Two nuclei form (telophase)"];
    case "cytokinesis": return [DIVIDING, "Pinching in two (cytokinesis)"];
    case "dead": return ["Dies on purpose (apoptosis)"];
    default:
      if (v.split === "uneven") return ["Two cells with the wrong chromosomes"];
      return [v.mutated ? "Two cells carrying a mutation" : "Two healthy cells"];
  }
};

export const step = (action, from, to) => {
  switch (action) {
    case "NoSignal": return "no signal to grow";
    case "Signal": return "a growth signal arrives";
    case "Damage": return from.phase === "G1" && from.p53 === "broken" ? "the DNA is damaged [p53 broken]" : "the DNA is damaged";
    case "Repair": return "the damage is repaired";
    case "Die": return from.phase === "G2" ? "too much damage [p53 working]" : "too much damage";
    case "StartCopying": return from.dna === "intact" ? "passes the first check" : "copies it anyway";
    case "FinishCopying": return from.dna === "intact" ? "the copy is done" : "the damage is copied as a mutation";
    case "Condense": return "passes the second check";
    case "OpenNucleus": return "the nucleus opens";
    case "CatchSome": return to.spindleCheck === "working" ? "fibres catch some chromosomes" : "fibres catch some [check broken]";
    case "CatchAll": return "every chromosome is caught";
    case "PullApart": return "the sisters are pulled apart";
    case "PullTooSoon": return "pulled apart anyway";
    case "Reform": return "two nuclei form";
    case "Pinch": return "the cell pinches";
    case "Divide": return to.split === "uneven" ? "splits, chromosomes uneven" : to.mutated ? "splits, passing the mutation on" : "splits in two";
    case "Done": return "done";
    default: return action;
  }
};
