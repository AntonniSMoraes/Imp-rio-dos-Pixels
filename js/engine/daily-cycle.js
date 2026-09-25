"use strict";

// One transaction boundary for the simulation: UI and persistence see the
// completed day, including births, politics and government decisions.
function advance() {
  if (!state || !alive().length) { speed = 0; return; }
  upgradeKingdom();
  advanceVillageDay();
  birthCycle();
  politicalCycle();
  governmentCycle();
  save();
  render();
  refreshPersonModal();
}
