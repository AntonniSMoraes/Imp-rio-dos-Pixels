"use strict";

function power(person) {
  return (
    (person.attrs.força + person.attrs.magia * 0.8 + person.attrs.agilidade * 0.5) *
    (1 + (person.level - 5) * 0.07) *
    (1 + person.social * 0.08) *
    (person.hp / 100)
  );
}

function startBattle() {
  if (!state || state.battle?.active || selection.length !== 4 || !state.buildings.barracks) return;
  const party = selection.map((id) => state.people.find((person) => person.id === id));
  if (party.some((person) => !person?.alive || onMission(person) || person.level < 5 || person.hp < 30))
    return toast("Escolha quatro adultos com pelo menos 30% de vida.");
  if (state.food < 15) return toast("A patrulha precisa de 15 alimentos.");
  state.food -= 15;
  state.battle = {
    active: true,
    party: [...selection],
    enemyHP: 200 + state.wins * 60,
    maxHP: 200 + state.wins * 60,
    round: 0,
    logs: ["A patrulha avança sobre a alcateia."],
    won: false,
  };
  log("Quatro cidadãos partiram para o Vale dos Lobos.");
  save();
  render();
}

function battleRound() {
  const battle = state?.battle;
  if (!battle?.active) return;
  const party = battle.party
    .map((id) => state.people.find((person) => person.id === id))
    .filter((person) => person.alive);
  if (!party.length) {
    battle.active = false;
    return;
  }

  battle.round++;
  let damage = 0;
  for (const person of party) {
    let value = power(person) * (person.spouse && party.some((ally) => ally.id === person.spouse) ? 1.15 : 1);
    if (person.vocation === "Berserker") value *= 1 + (100 - person.hp) / 100;
    if (person.vocation === "Mago") value *= 1.2;
    if (person.vocation === "Assassino" && battle.round === 1) value *= 1.5;
    if (["Clérigo", "Santo"].includes(person.vocation)) {
      const target = party.slice().sort((first, second) => first.hp - second.hp)[0];
      target.hp = Math.min(100, target.hp + (person.vocation === "Santo" ? 12 : 7) * MULT[person.rank]);
      value *= 0.45;
    }
    damage += value * 0.55;
  }

  battle.enemyHP = Math.max(0, battle.enemyHP - damage);
  battle.logs.unshift("Rodada " + battle.round + ": " + Math.round(damage) + " de dano à alcateia.");
  if (battle.enemyHP <= 0) {
    battle.active = false;
    battle.won = true;
    state.wins++;
    state.gold += 45;
    state.food += 30;
    state.iron += 12;
    party.forEach((person) => {
      person.xp += 50;
      if (person.xp >= 100) {
        person.level++;
        person.xp -= 100;
      }
    });
    log("Vitória! +45 ouro, +30 alimento e +12 ferro.");
    return;
  }

  const target = pick(party);
  let damageTaken = Math.max(5, 23 + state.wins * 3 - target.attrs.vigor * 0.25);
  if (target.vocation === "Paladino") damageTaken *= 0.55;
  if (target.vocation === "Arqueiro") damageTaken *= 0.7;
  target.hp = Math.max(0, target.hp - damageTaken);
  battle.logs.unshift(target.name + " recebeu " + Math.round(damageTaken) + " de dano.");
  if (target.hp <= 0) death(target, "em combate");
  if (!party.some((person) => person.alive)) {
    battle.active = false;
    log("A expedição foi derrotada.");
  }
  battle.logs = battle.logs.slice(0, 25);
}
