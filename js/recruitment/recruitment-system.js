"use strict";

function rollRecruitCount() {
  const roll = Math.random();
  return roll < 0.5 ? 0 : roll < 0.85 ? 1 : roll < 0.97 ? 2 : 3;
}

function recruitmentGroup(count) {
  if (!count) return [];
  if (count === 1) {
    const type = rand(3);
    return [makePerson({ age: type === 2 ? 3 + rand(10) : 18 + rand(24), sex: type === 0 ? "M" : type === 1 ? "F" : pick(["M", "F"]) })];
  }
  if (count === 2) {
    const type = rand(3);
    const family = freshFamily();
    if (type === 0) {
      const first = makePerson({ family, sex: "M", age: 22 + rand(12) });
      const second = makePerson({ family, sex: "F", age: 21 + rand(12) });
      first.spouse = second.id;
      second.spouse = first.id;
      return [first, second];
    }
    const parent = makePerson({ family, sex: type === 1 ? "F" : "M", age: 26 + rand(15) });
    const absentParent = makePerson({ family, sex: type === 1 ? "M" : "F", age: 30 });
    const child = childOf(parent, absentParent);
    child.age = 2 + rand(10);
    child.parents = [parent.id];
    child.origins = Object.fromEntries(Object.entries(child.origins).map(([key, id]) => [key, id === absentParent.id ? "unknown" : id]));
    parent.widowed = true;
    return [parent, child];
  }
  if (rand(2) === 0) {
    const family = freshFamily();
    const father = makePerson({ family, sex: "M", age: 27 + rand(12) });
    const mother = makePerson({ family, sex: "F", age: 25 + rand(12) });
    father.spouse = mother.id;
    mother.spouse = father.id;
    const child = childOf(father, mother);
    child.age = 2 + rand(10);
    return [father, mother, child];
  }
  return [0, 1, 2].map(() => makePerson({ age: 3 + rand(10) }));
}

function callRecruitment() {
  if (!state) return;
  if (state.guests.length) return toast("Acolha o grupo que está aguardando antes de fazer outro chamado.");
  if (state.day < state.nextRecruitDay) return toast("Um novo chamado ficará disponível no dia " + state.nextRecruitDay + ".");
  if (!alive().length) return;
  state.nextRecruitDay = state.day + 1;
  const count = rollRecruitCount();
  state.guests = recruitmentGroup(count);
  state.lastRecruit = { day: state.day, count };
  if (!count) {
    log("O chamado ecoou no vale. Ninguém respondeu.");
    toast("Ninguém respondeu. Tente outro chamado no próximo dia.");
  } else {
    log(count + " " + (count === 1 ? "viajante respondeu" : "viajantes responderam") + " ao chamado.");
    if (capacity() - alive().length >= count) admitGuests();
    else toast("Um grupo chegou, mas precisa de moradia. Construa espaço para acolhê-lo.");
  }
  save();
  render();
}

function admitGuests() {
  if (!state || !state.guests.length) return;
  if (capacity() - alive().length < state.guests.length) return toast("A família precisa de vagas para todos. Construa uma moradia.");
  const count = state.guests.length;
  state.people.push(...state.guests);
  state.guests = [];
  log(count + " " + (count === 1 ? "novo morador foi acolhido" : "novos moradores foram acolhidos") + " na vila.");
  save();
  render();
  toast(count + " " + (count === 1 ? "novo morador" : "novos moradores") + " na sua vila.");
}

function recruitMercenary() {
  if (!state || !state.buildings.tavern) return;
  if (state.gold < 90 || alive().length >= capacity()) return toast("É necessário 90 ouros e uma vaga.");
  state.gold -= 90;
  const person = makePerson({ family: "do Norte", rank: 1 });
  person.barbarian = true;
  person.social = 1;
  person.vocation = "Berserker";
  state.people.push(person);
  log(person.name + ", bárbaro imune ao frio, se juntou à vila.");
  save();
  render();
}
