"use strict";

function validateSave(save) {
  if(typeof validateCourt==="function" && save && Array.isArray(save.people))validateCourt(save);
  if (typeof FamilyChronicle !== "undefined" && save) FamilyChronicle.validate(save);
  if (
    !save ||
    save.version !== 2 ||
    !Array.isArray(save.people) ||
    save.people.length > 10000 ||
    !Array.isArray(save.logs) ||
    !Array.isArray(save.guests) ||
    save.guests.length > 3
  ) throw Error("save");

  if (save.capitalIndex !== undefined && (!Number.isInteger(save.capitalIndex) || save.capitalIndex < 0 || save.capitalIndex >= 512 || !save.royalLands?.includes(save.capitalIndex))) throw Error('capitalIndex');

  if (save.betrothals !== undefined) {
    if (!Array.isArray(save.betrothals) || save.betrothals.length > 10000) throw Error('betrothals');
    const people = new Set(save.people.map(p => p.id)), reserved = new Set(), promises = new Set();
    for (const p of save.betrothals) {
      if (!p || typeof p.id !== 'string' || promises.has(p.id) || p.a === p.b ||
          ![p.a,p.b,p.houseA,p.houseB].every(id => people.has(id)) ||
          !['promised','married','broken','cancelled'].includes(p.status) ||
          !Number.isFinite(p.day) || p.day < 0) throw Error('betrothal');
      promises.add(p.id);
      if (p.status === 'promised') {
        if (reserved.has(p.a) || reserved.has(p.b)) throw Error('duplicate betrothal');
        reserved.add(p.a); reserved.add(p.b);
      }
    }
  }
  if (save.houseRelations !== undefined && (!save.houseRelations || typeof save.houseRelations !== 'object' || Array.isArray(save.houseRelations) || Object.values(save.houseRelations).some(value => !Number.isFinite(value) || value < -100 || value > 100))) throw Error('houseRelations');

  for (const key of ["day", "wood", "iron", "food", "gold", "wins", "births", "nextRecruitDay"])
    if (!Number.isFinite(save[key]) || save[key] < 0) throw Error(key);
  for (const key in BUILD)
    if (!Number.isInteger(save.buildings?.[key]) || save.buildings[key] < 0) throw Error(key);
  for (const key of ["wood", "iron", "food"])
    if (!Number.isFinite(save.nodes?.[key]) || save.nodes[key] < 0) throw Error(key);

  if (typeof validateWarfare === "function") validateWarfare(save);
  const validAccount = account => account && typeof account === 'object' && !Array.isArray(account) && ['wood','iron','food','gold'].every(k=>account[k]===undefined || (Number.isFinite(account[k]) && account[k]>=0 && account[k]<=1e15));
  if (save.dragons !== undefined && (!Array.isArray(save.dragons) || save.dragons.length>4 || save.dragons.some(d=>!d || !Number.isInteger(d.id) || !Number.isInteger(d.tile) || d.tile<0 || d.tile>511 || !Number.isInteger(d.arrived) || !Number.isInteger(d.leave) || d.leave<d.arrived || typeof d.brood!=='boolean' || (d.warning!==null && (!Number.isInteger(d.warning)||d.warning<0)))))throw Error('dragons');
  if(save.dragonRuins!==undefined && (!save.dragonRuins || typeof save.dragonRuins!=='object' || Object.entries(save.dragonRuins).some(([i,d])=>!/^\d+$/.test(i)||Number(i)>511||!Number.isInteger(d)||d<0)))throw Error('dragon ruins');
  for(const realm of save.warfare?.realms || []) {
    if(realm.treasury!==undefined && !validAccount(realm.treasury))throw Error('realm treasury');
    for(const village of Object.values(realm.villageAccounts || {}))if(!validAccount(village.treasury)||!validAccount(village.annualOpening))throw Error('village treasury');
  }
  const ids = new Set();
  for (const person of [...save.people, ...save.guests]) {
    if (
      typeof person.id !== "string" ||
      !/^[a-zA-Z0-9-]+$/.test(person.id) ||
      ids.has(person.id)
    ) throw Error("id");
    ids.add(person.id);
    for (const key of ["name", "family"])
      if (typeof person[key] !== "string" || person[key].length > 100) throw Error(key);
    if (
      !["M", "F"].includes(person.sex) ||
      !Array.isArray(person.parents) ||
      !Array.isArray(person.high) ||
      !person.origins ||
      !Object.keys({ força: 1, vigor: 1, magia: 1, agilidade: 1 }).every((key) =>
        Number.isFinite(person.attrs?.[key]),
      ) ||
      Object.keys(person.attrs).length !== 4
    ) throw Error("person");

    if(person.paperDoll!==undefined&&typeof CampaignAppearance!=='undefined')CampaignAppearance.validate(person.paperDoll);
    for (const [key, size] of [
      ["hair", HAIR.length],
      ["style", STYLES.length],
      ["skin", SKIN.length],
      ["eyes", EYES.length],
      ["brow", 2],
    ])
      if (!Number.isInteger(person.genes?.[key]) || person.genes[key] < 0 || person.genes[key] >= size)
        throw Error("gene");

    if (
      typeof person.genes.freckles !== "boolean" ||
      !Number.isInteger(person.rank) ||
      person.rank < 0 ||
      person.rank > 4 ||
      !Number.isInteger(person.social) ||
      person.social < 0 ||
      person.social > 8 ||
      !Number.isFinite(person.hp) ||
      person.hp < 0 ||
      person.hp > 100 ||
      !Number.isFinite(person.age) ||
      !Number.isFinite(person.level) ||
      !Number.isFinite(person.xp) ||
      !Number.isFinite(person.lastBirth) ||
      !(person.job in JOBS) ||
      (person.vocation && !CLASSES.includes(person.vocation))
    ) throw Error("stats");
    if (person.manualHeir !== undefined && typeof person.manualHeir !== 'boolean') throw Error('manualHeir');
    if (person.nextNobleRecruitDay !== undefined && (!Number.isFinite(person.nextNobleRecruitDay) || person.nextNobleRecruitDay < 0)) throw Error('nextNobleRecruitDay');
    if (person.feudalGrantor !== undefined && (typeof person.feudalGrantor !== 'string' || !/^[a-zA-Z0-9-]+$/.test(person.feudalGrantor))) throw Error('feudalGrantor');
    for(const key of ['treasury','annualOpening'])if(person[key]!==undefined && !validAccount(person[key]))throw Error(key);
    if(person.knighthoodTraining!==undefined && (!Number.isInteger(person.knighthoodTraining)||person.knighthoodTraining<0||person.knighthoodTraining>47))throw Error('knighthood training');
    if(person.exclusivePartnerId!==undefined && (typeof person.exclusivePartnerId!=='string'||person.exclusivePartnerId===person.id||!save.people.some(p=>p.id===person.exclusivePartnerId)))throw Error('exclusive partner');
    const squad=person.conscripts;
    if(squad!==undefined && (!squad || !Number.isInteger(squad.count)||squad.count<0||squad.count>10||!Number.isFinite(squad.wounds)||squad.wounds<0||squad.wounds>=100||!Number.isInteger(squad.losses)||squad.losses<0||!Number.isInteger(squad.merit)||squad.merit<0||typeof squad.recommended!=='boolean'))throw Error('conscripts');
    const request=person.promotionRequest;
    if(request!==undefined && (!request || !Number.isInteger(request.tier)||request.tier<1||request.tier>7||!Array.isArray(request.tiles)||request.tiles.length>512||request.tiles.some(i=>!Number.isInteger(i)||i<0||i>511)||!validAccount(request.fee)||!Number.isInteger(request.day)||request.day<0))throw Error('promotion request');
    if(person.inheritance !== undefined && (!validInheritanceRecord(person.inheritance) || !person.inheritance.parents.every(p => person.parents.includes(p.id))))throw Error('inheritance');
    if(!validBiology(person))throw Error('biology');
    normalizeLifeStage(person);
    ensureRaceData(person);
    validateReproduction(person, save);
  }

  for (const entry of save.logs)
    if (typeof entry.text !== "string" || !Number.isFinite(entry.day)) throw Error(entry);
  if (save.battle) {
    if (save.battle.enemies !== undefined && (!Array.isArray(save.battle.enemies) || save.battle.enemies.length > 12 || save.battle.enemies.some(p => !p || typeof p.id !== 'string' || typeof p.alive !== 'boolean' || !Number.isFinite(p.hp) || p.hp < 0 || p.hp > 100 || !Number.isFinite(p.level) || !Number.isFinite(p.xp) || !['força','vigor','magia','agilidade'].every(k => Number.isFinite(p.attrs?.[k]) && p.attrs[k] > 0)))) throw Error('expedition enemies');
    if (
      !Array.isArray(save.battle.party) ||
      !save.battle.party.every((id) => save.people.some((person) => person.id === id)) ||
      !Array.isArray(save.battle.logs) ||
      save.battle.logs.some((entry) => typeof entry !== "string") ||
      !Number.isFinite(save.battle.enemyHP) ||
      !Number.isFinite(save.battle.maxHP)
    ) throw Error("battle");
  }
}
