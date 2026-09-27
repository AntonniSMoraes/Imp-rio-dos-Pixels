"use strict";

// One transaction boundary for the simulation: UI and persistence see the
// completed day, including births, politics and government decisions.
function advance() {
  if (!state || !alive().length) { speed = 0; return; }
  upgradeKingdom();
  if(typeof DomainAutonomy !== 'undefined')DomainAutonomy.economy();
  advanceVillageDay();
  birthCycle();
  politicalCycle();
  governmentCycle();
  if(typeof VassalAid!=="undefined")VassalAid.tick();
  const foodBeforeWar = state.food;
  Warfare.tick();
  if(typeof LocalRecruitment!=='undefined')LocalRecruitment.custodyTick();
  if (typeof Dragons !== 'undefined') Dragons.tick();
  if (state.economyBalance) state.economyBalance.food -= foodBeforeWar - state.food;
  save();
  render();
  refreshPersonModal();
}
