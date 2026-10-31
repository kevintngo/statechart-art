export const title = "Catch";

const BOOSTER = {
  filling: "Filling with propellant",
  holding: "Holding the count",
  scrubbed: "Scrubbed for today",
  liftoff: "Lifting off",
  maxq: "Through max Q",
  staging: "Hot staging",
  boostback: "Flipping, burning back",
  falling: "Falling home",
  landing: "Slowing over the tower",
  comingin: "Coming in on a failed check",
  caught: "Caught by the arms",
  diverted: "Diverted to the sea",
  hit: "Hits the tower",
};
const SHIP = {
  riding: "Riding on top",
  lit: "Engines lit while attached",
  coasting: "Flying on to space",
  reentry: "Falling back, glowing",
  flipping: "Flipping upright",
  splashed: "Splashed down",
};
const TOWER = {
  open: "Arms open, waiting",
  closing: "Arms closing",
  holding: "Holding the booster",
  damaged: "Damaged",
};

const booster = (v) => BOOSTER[v.booster];

export const state = (v) => ({ "The booster": booster(v), "The ship": SHIP[v.ship], "The tower": TOWER[v.tower] });

export const step = (action) => {
  switch (action) {
    case "CallHold": return "a hold is called";
    case "Resume": return "the count resumes";
    case "Scrub": return "the launch is scrubbed";
    case "Liftoff": return "the count reaches zero";
    case "MaxQ": return "the air presses hardest";
    case "HotStage": return "most of the booster's engines cut off";
    case "Separate": return "the ship pulls away";
    case "GoForCatch": return "every check passes: go for catch";
    case "LandingBurn": return "the landing burn starts";
    case "Divert": return "a check fails: no-go";
    case "ComeInAnyway": return "a check fails, it comes in anyway [no go/no-go poll]";
    case "CloseArms": return "the arms close";
    case "CatchIt": return "the arms catch it";
    case "HitTower": return "it hits the tower";
    case "Reenter": return "falls back into the air";
    case "FlipShip": return "flips and lights its engines";
    case "SplashShip": return "touches the water";
    case "Done": return "done";
    default: return action;
  }
};
