"use strict";

const REPRODUCTION = Object.freeze({ version: 1, attemptInterval: 4, gestationDays: 36, recoveryDays: 24 });

function humanRecovery(person, people = typeof state !== 'undefined' ? state?.people || [] : []) {
  const count = people.filter(p => p.parents?.includes(person.id)).length;
  return Math.min(240, 96 + Math.max(0, count - 1) * 24);
}

function reproductionProfile(person, people) {
  const ancestry = normalizedAncestry(person);
  const elves = (ancestry.elf || 0) + (ancestry.darkElf || 0);
  const beasts = ['wolf', 'cat', 'bunny', 'beastfolk'].reduce((sum, race) => sum + (ancestry[race] || 0), 0);
  const fertility = Object.entries(ancestry).reduce((sum, [race, share]) => sum + share * (RACES[race].fertilityRate ?? 1), 0);
  return {
    gestationDays: Math.round(REPRODUCTION.gestationDays * (1 + elves * 0.75)),
    recoveryDays: ancestry.human > .999999 ? humanRecovery(person, people) : beasts > 0.999999 ? 12 : Math.round(REPRODUCTION.recoveryDays * (1 + elves)),
    twinChance: 0.4 * beasts,
    conceptionChance: Math.min(0.35, 0.2 * fertility),
  };
}

function ensureReproduction(person, day, people) {
  if (!person.reproduction) {
    person.reproduction = {
      version: REPRODUCTION.version,
      nextAttemptDay: day + REPRODUCTION.attemptInterval,
      recoveryUntil: person.lastBirth >= 0 ? Math.ceil(person.lastBirth + reproductionProfile(person, people).recoveryDays) : 0,
      pregnancy: null,
    };
  }
  if (!person.reproduction.humanSpacingVersion && normalizedAncestry(person).human > .999999) {
    if (person.lastBirth >= 0) person.reproduction.recoveryUntil = Math.max(person.reproduction.recoveryUntil, Math.ceil(person.lastBirth + humanRecovery(person, people)));
    person.reproduction.humanSpacingVersion = 1;
  }
  return person.reproduction;
}

function validateReproduction(person, save) {
  const cycle = ensureReproduction(person, save.day, save.people);
  if (cycle.version !== 1 || !Number.isInteger(cycle.nextAttemptDay) || cycle.nextAttemptDay < 0 ||
      !Number.isInteger(cycle.recoveryUntil) || cycle.recoveryUntil < 0) throw Error('reproduction');
  const pregnancy = cycle.pregnancy;
  if (pregnancy !== null && (!pregnancy || person.sex !== 'F' || !isAdultAge(person) ||
      !Number.isInteger(pregnancy.conceivedDay) || pregnancy.conceivedDay < 0 || pregnancy.conceivedDay > save.day ||
      !Number.isInteger(pregnancy.dueDay) || pregnancy.dueDay <= pregnancy.conceivedDay ||
      ![1, 2].includes(pregnancy.babies) || !Number.isInteger(pregnancy.recoveryDays) || pregnancy.recoveryDays < 1 ||
      pregnancy.fatherId === person.id || !save.people.some(parent => parent.id === pregnancy.fatherId && parent.sex === 'M'))) {
    throw Error('pregnancy');
  }
}

function fertilePartners(mother) {
  return partners(mother).filter(father => adult(father) && father.sex === 'M' && father.age < 55 && canBreed(mother.race, father.race));
}

function reservedBirths() {
  return alive().reduce((sum, person) => sum + (person.reproduction?.pregnancy?.babies || 0), 0);
}

function conceptionBlock(mother) {
  const cycle = ensureReproduction(mother, state.day);
  if (!mother.alive) return 'Falecida';
  if (!adult(mother)) return 'Ainda não atingiu a maioridade';
  if (mother.sex !== 'F') return 'Ciclo acompanhado na ficha da parceira';
  if (mother.age >= 55) return 'Fora da idade fértil';
  if (state.day < cycle.recoveryUntil) return 'Recuperação: ' + (cycle.recoveryUntil - state.day) + ' dias';
  if (!fertilePartners(mother).length) return 'Sem parceiro fértil compatível';
  if (onMission(mother) || !fertilePartners(mother).some(father => !onMission(father))) return 'Aguardando retorno da expedição';
  const slots = reproductionProfile(mother).twinChance > 0 ? 2 : 1;
  if (alive().length + reservedBirths() + slots > capacity()) return 'Aguardando moradia (inclui vagas para gestações)';
  if (state.food < alive().length * 0.65 + 5 * slots) return 'Alimento insuficiente para tentar conceber';
  return '';
}

function breedingStatus(person) {
  if (!state) return '';
  const cycle = ensureReproduction(person, state.day);
  if (!person.alive) return 'Falecida';
  if (cycle.pregnancy) {
    const pregnancy = cycle.pregnancy;
    return 'Gestação' + (pregnancy.babies === 2 ? ' de gêmeos' : '') + ': ' + Math.max(0, pregnancy.dueDay - state.day) + ' dias até o parto';
  }
  const blocked = conceptionBlock(person);
  if (blocked) return blocked;
  const chance = Math.round(reproductionProfile(person).conceptionChance * 100);
  return 'Próxima tentativa em ' + Math.max(0, cycle.nextAttemptDay - state.day) + ' dias · ' + chance + '% de chance';
}

function reproductionRules(person) {
  const profile = reproductionProfile(person);
  return 'Gestação: ' + profile.gestationDays + ' dias · Recuperação: ' + profile.recoveryDays +
    ' dias · Gêmeos: ' + Math.round(profile.twinChance * 100) + '% por gestação.';
}

function deliverPregnancy(mother) {
  const cycle = mother.reproduction;
  const pregnancy = cycle.pregnancy;
  const father = byId(pregnancy.fatherId); // Deceased parents remain in the genealogy.
  if (!father) return; // Invalid imported saves are rejected by validation.
  const children = [];
  for (let index = 0; index < pregnancy.babies; index++) {
    const child = childOf(father, mother);
    state.people.push(child);
    if (typeof FamilyChronicle !== "undefined") FamilyChronicle.record("birth", [child, father, mother], child.name + " nasceu. Pais: " + father.name + " e " + mother.name + ".");
    children.push(child.name);
    state.births++;
  }
  cycle.pregnancy = null;
  mother.lastBirth = state.day;
  const recovery = normalizedAncestry(mother).human > .999999 ? humanRecovery(mother) : pregnancy.recoveryDays;
  cycle.recoveryUntil = state.day + recovery;
  cycle.nextAttemptDay = cycle.recoveryUntil + REPRODUCTION.attemptInterval;
  state.food = Math.max(0, state.food - 5 * pregnancy.babies);
  log((pregnancy.babies === 2 ? 'Gêmeos: ' : 'Nascimento: ') + children.join(' e ') + '. Pais: ' + father.name + ' e ' + mother.name + '. Recuperação: ' + recovery + ' dias.');
  if (alive().length > capacity()) log('O parto aumentou a população além da moradia disponível. Construa mais abrigos.');
}

function birthCycle(random = Math.random) {
  if (!state || state.lastReproductionDay === state.day) return;
  state.lastReproductionDay = state.day;
  // Resolve pregnancies every day, independently of partners, food or housing.
  for (const mother of [...state.people]) {
    const cycle = ensureReproduction(mother, state.day);
    if(mother.away)continue;
    if (!mother.alive) { cycle.pregnancy = null; continue; }
    if (cycle.pregnancy && state.day >= cycle.pregnancy.dueDay) deliverPregnancy(mother);
  }
  const mothers = adults().filter(person => person.sex === 'F').sort((a, b) => a.lastBirth - b.lastBirth || a.id.localeCompare(b.id));
  for (const mother of mothers) {
    const cycle = mother.reproduction;
    if (cycle.pregnancy || state.day < cycle.nextAttemptDay) continue;
    cycle.nextAttemptDay = state.day + REPRODUCTION.attemptInterval;
    if (conceptionBlock(mother)) continue;
    const profile = reproductionProfile(mother);
    if (random() >= profile.conceptionChance) continue;
    const candidates = fertilePartners(mother).filter(father => !onMission(father));
    const father = candidates[Math.floor(random() * candidates.length)];
    cycle.pregnancy = {
      fatherId: father.id, conceivedDay: state.day, dueDay: state.day + profile.gestationDays,
      babies: random() < profile.twinChance ? 2 : 1, recoveryDays: profile.recoveryDays,
    };
    log(mother.name + ' está grávida' + (cycle.pregnancy.babies === 2 ? ' de gêmeos' : '') + '. Parto previsto em ' + profile.gestationDays + ' dias.');
  }
}
