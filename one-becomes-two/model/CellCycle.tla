---- MODULE CellCycle ----
VARIABLES phase, dna, mutated, copied, p53, spindleCheck, caught, split

vars == <<phase, dna, mutated, copied, p53, spindleCheck, caught, split>>

Mitosis == {"prophase", "prometaphase", "metaphase", "anaphase", "telophase", "cytokinesis"}
Ends == {"two cells", "dead"}

Init ==
  /\ phase = "G1"
  /\ dna = "intact"
  /\ mutated = FALSE
  /\ copied = FALSE
  /\ caught = "none"
  /\ split = "even"
  /\ \/ p53 = "working" /\ spindleCheck = "working"
     \/ p53 = "broken" /\ spindleCheck = "working"
     \/ p53 = "working" /\ spindleCheck = "broken"

NoSignal ==
  /\ phase = "G1"
  /\ dna = "intact"
  /\ phase' = "G0"
  /\ UNCHANGED <<dna, mutated, copied, p53, spindleCheck, caught, split>>

Signal ==
  /\ phase = "G0"
  /\ phase' = "G1"
  /\ UNCHANGED <<dna, mutated, copied, p53, spindleCheck, caught, split>>

Damage ==
  /\ phase \in {"G1", "G2"}
  /\ dna = "intact"
  /\ dna' = "damaged"
  /\ UNCHANGED <<phase, mutated, copied, p53, spindleCheck, caught, split>>

Repair ==
  /\ phase \in {"G1", "G2"}
  /\ dna = "damaged"
  /\ dna' = "intact"
  /\ UNCHANGED <<phase, mutated, copied, p53, spindleCheck, caught, split>>

Die ==
  /\ phase \in {"G1", "G2"}
  /\ dna = "damaged"
  /\ p53 = "working"
  /\ phase' = "dead"
  /\ UNCHANGED <<dna, mutated, copied, p53, spindleCheck, caught, split>>

StartCopying ==
  /\ phase = "G1"
  /\ dna = "intact" \/ p53 = "broken"
  /\ phase' = "S"
  /\ UNCHANGED <<dna, mutated, copied, p53, spindleCheck, caught, split>>

FinishCopying ==
  /\ phase = "S"
  /\ phase' = "G2"
  /\ copied' = TRUE
  /\ mutated' = (mutated \/ dna = "damaged")
  /\ dna' = "intact"
  /\ UNCHANGED <<p53, spindleCheck, caught, split>>

Condense ==
  /\ phase = "G2"
  /\ dna = "intact"
  /\ phase' = "prophase"
  /\ UNCHANGED <<dna, mutated, copied, p53, spindleCheck, caught, split>>

OpenNucleus ==
  /\ phase = "prophase"
  /\ phase' = "prometaphase"
  /\ UNCHANGED <<dna, mutated, copied, p53, spindleCheck, caught, split>>

CatchSome ==
  /\ phase = "prometaphase"
  /\ caught = "none"
  /\ caught' = "some"
  /\ UNCHANGED <<phase, dna, mutated, copied, p53, spindleCheck, split>>

CatchAll ==
  /\ phase = "prometaphase"
  /\ caught = "some"
  /\ caught' = "all"
  /\ phase' = "metaphase"
  /\ UNCHANGED <<dna, mutated, copied, p53, spindleCheck, split>>

PullApart ==
  /\ phase = "metaphase"
  /\ phase' = "anaphase"
  /\ UNCHANGED <<dna, mutated, copied, p53, spindleCheck, caught, split>>

PullTooSoon ==
  /\ phase = "prometaphase"
  /\ caught = "some"
  /\ spindleCheck = "broken"
  /\ phase' = "anaphase"
  /\ split' = "uneven"
  /\ UNCHANGED <<dna, mutated, copied, p53, spindleCheck, caught>>

Reform ==
  /\ phase = "anaphase"
  /\ phase' = "telophase"
  /\ UNCHANGED <<dna, mutated, copied, p53, spindleCheck, caught, split>>

Pinch ==
  /\ phase = "telophase"
  /\ phase' = "cytokinesis"
  /\ UNCHANGED <<dna, mutated, copied, p53, spindleCheck, caught, split>>

Divide ==
  /\ phase = "cytokinesis"
  /\ phase' = "two cells"
  /\ UNCHANGED <<dna, mutated, copied, p53, spindleCheck, caught, split>>

Done ==
  /\ phase \in Ends
  /\ UNCHANGED vars

Next ==
  \/ NoSignal \/ Signal \/ Damage \/ Repair \/ Die
  \/ StartCopying \/ FinishCopying \/ Condense \/ OpenNucleus
  \/ CatchSome \/ CatchAll \/ PullApart \/ PullTooSoon
  \/ Reform \/ Pinch \/ Divide \/ Done

Spec == Init /\ [][Next]_vars

TypeOK ==
  /\ phase \in {"G0", "G1", "S", "G2"} \cup Mitosis \cup Ends
  /\ dna \in {"intact", "damaged"}
  /\ mutated \in BOOLEAN
  /\ copied \in BOOLEAN
  /\ p53 \in {"working", "broken"}
  /\ spindleCheck \in {"working", "broken"}
  /\ caught \in {"none", "some", "all"}
  /\ split \in {"even", "uneven"}

CopiesBeforeDividing == phase \in Mitosis \cup {"two cells"} => copied

NeverCopiesDamagedDNA == phase = "S" => dna = "intact"

DaughtersCarryNoMutation == phase = "two cells" => ~mutated

SeparatesOnlyWhenAllCaught == phase = "anaphase" => split = "even"

EachDaughterGetsOneOfEach == phase = "two cells" => split = "even"
====
