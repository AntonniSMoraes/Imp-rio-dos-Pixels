"use strict";

function validateSave(save) {
  if (
    !save ||
    save.version !== 2 ||
    !Array.isArray(save.people) ||
    save.people.length > 10000 ||
    !Array.isArray(save.logs) ||
    !Array.isArray(save.guests) ||
    save.guests.length > 3
  ) throw Error("save");

  for (const key of ["day", "wood", "iron", "food", "gold", "wins", "births", "nextRecruitDay"])
    if (!Number.isFinite(save[key]) || save[key] < 0) throw Error(key);
  for (const key in BUILD)
    if (!Number.isInteger(save.buildings?.[key]) || save.buildings[key] < 0) throw Error(key);
  for (const key of ["wood", "iron", "food"])
    if (!Number.isFinite(save.nodes?.[key]) || save.nodes[key] < 0) throw Error(key);

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
    normalizeLifeStage(person);
    ensureRaceData(person);
    validateReproduction(person, save);
  }

  for (const entry of save.logs)
    if (typeof entry.text !== "string" || !Number.isFinite(entry.day)) throw Error(entry);
  if (save.battle) {
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
