---- MODULE Catch ----
VARIABLES booster, ship, tower, checks, poll

vars == <<booster, ship, tower, checks, poll>>

Ends == {"scrubbed", "caught", "diverted", "hit"}

Init ==
  /\ booster = "filling"
  /\ ship = "riding"
  /\ tower = "open"
  /\ checks \in {"pass", "fail"}
  /\ poll \in {"held", "skipped"}

CallHold ==
  /\ booster = "filling"
  /\ booster' = "holding"
  /\ UNCHANGED <<ship, tower, checks, poll>>

Resume ==
  /\ booster = "holding"
  /\ booster' = "filling"
  /\ UNCHANGED <<ship, tower, checks, poll>>

Scrub ==
  /\ booster = "holding"
  /\ booster' = "scrubbed"
  /\ UNCHANGED <<ship, tower, checks, poll>>

Liftoff ==
  /\ booster = "filling"
  /\ booster' = "liftoff"
  /\ UNCHANGED <<ship, tower, checks, poll>>

MaxQ ==
  /\ booster = "liftoff"
  /\ booster' = "maxq"
  /\ UNCHANGED <<ship, tower, checks, poll>>

HotStage ==
  /\ booster = "maxq"
  /\ ship = "riding"
  /\ booster' = "staging"
  /\ ship' = "lit"
  /\ UNCHANGED <<tower, checks, poll>>

Separate ==
  /\ booster = "staging"
  /\ ship = "lit"
  /\ booster' = "boostback"
  /\ ship' = "coasting"
  /\ UNCHANGED <<tower, checks, poll>>

GoForCatch ==
  /\ booster = "boostback"
  /\ checks = "pass"
  /\ booster' = "falling"
  /\ UNCHANGED <<ship, tower, checks, poll>>

Divert ==
  /\ booster = "boostback"
  /\ checks = "fail"
  /\ poll = "held"
  /\ booster' = "diverted"
  /\ UNCHANGED <<ship, tower, checks, poll>>

ComeInAnyway ==
  /\ booster = "boostback"
  /\ checks = "fail"
  /\ poll = "skipped"
  /\ booster' = "comingin"
  /\ UNCHANGED <<ship, tower, checks, poll>>

LandingBurn ==
  /\ booster = "falling"
  /\ booster' = "landing"
  /\ UNCHANGED <<ship, tower, checks, poll>>

CloseArms ==
  /\ tower = "open"
  /\ booster \in {"landing", "comingin"}
  /\ tower' = "closing"
  /\ UNCHANGED <<booster, ship, checks, poll>>

CatchIt ==
  /\ booster = "landing"
  /\ tower = "closing"
  /\ checks = "pass"
  /\ booster' = "caught"
  /\ tower' = "holding"
  /\ UNCHANGED <<ship, checks, poll>>

HitTower ==
  /\ booster = "comingin"
  /\ tower = "closing"
  /\ booster' = "hit"
  /\ tower' = "damaged"
  /\ UNCHANGED <<ship, checks, poll>>

Reenter ==
  /\ ship = "coasting"
  /\ ship' = "reentry"
  /\ UNCHANGED <<booster, tower, checks, poll>>

FlipShip ==
  /\ ship = "reentry"
  /\ ship' = "flipping"
  /\ UNCHANGED <<booster, tower, checks, poll>>

SplashShip ==
  /\ ship = "flipping"
  /\ ship' = "splashed"
  /\ UNCHANGED <<booster, tower, checks, poll>>

Done ==
  /\ \/ booster = "scrubbed"
     \/ booster \in Ends /\ ship = "splashed"
  /\ UNCHANGED vars

Next ==
  \/ CallHold \/ Resume \/ Scrub \/ Liftoff \/ MaxQ
  \/ HotStage \/ Separate
  \/ GoForCatch \/ Divert \/ ComeInAnyway \/ LandingBurn
  \/ CloseArms \/ CatchIt \/ HitTower
  \/ Reenter \/ FlipShip \/ SplashShip \/ Done

Spec == Init /\ [][Next]_vars

TypeOK ==
  /\ booster \in {"filling", "holding", "scrubbed", "liftoff", "maxq", "staging", "boostback", "falling", "landing", "comingin", "caught", "diverted", "hit"}
  /\ ship \in {"riding", "lit", "coasting", "reentry", "flipping", "splashed"}
  /\ tower \in {"open", "closing", "holding", "damaged"}
  /\ checks \in {"pass", "fail"}
  /\ poll \in {"held", "skipped"}

ArmsCloseOnlyOnBooster == tower = "closing" => booster \in {"landing", "comingin"}

ShipFreeBeforeTurningBack == booster \in {"boostback", "falling", "landing", "comingin", "caught", "diverted", "hit"} => ship \notin {"riding", "lit"}

HeadsForTowerOnlyWhenGo == booster \in {"falling", "landing", "comingin"} => checks = "pass"

TowerNeverHit == tower # "damaged"
====
