"use strict";

function ancestors(person, seen = new Set()) {
  for (const id of person.parents) {
    if (seen.has(id)) continue;
    seen.add(id);
    const parent = state?.people.find((candidate) => candidate.id === id);
    if (parent) ancestors(parent, seen);
  }
  return seen;
}

function related(firstPerson, secondPerson) {
  const firstAncestors = ancestors(firstPerson);
  const secondAncestors = ancestors(secondPerson);
  return firstAncestors.has(secondPerson.id) || secondAncestors.has(firstPerson.id) || [...firstAncestors].some((id) => secondAncestors.has(id));
}

function hasSpouse(person) {
  return Boolean(state?.people.some((candidate) => candidate.id === person.spouse && candidate.alive));
}

function marriageCandidates(person) {
  return adults().filter((candidate) => candidate.id !== person.id && candidate.sex !== person.sex && !hasSpouse(candidate) && !related(person, candidate));
}

function marry(firstId, secondId) {
  if (!state) return;
  const firstPerson = state.people.find((person) => person.id === firstId);
  const secondPerson = state.people.find((person) => person.id === secondId);
  if (!firstPerson || !secondPerson || !firstPerson.alive || firstPerson.level < 5 || hasSpouse(firstPerson) || !marriageCandidates(firstPerson).includes(secondPerson))
    return toast("Esse casamento não está disponível.");
  firstPerson.spouse = secondPerson.id;
  secondPerson.spouse = firstPerson.id;
  firstPerson.widowed = secondPerson.widowed = false;
  log(firstPerson.name + " e " + secondPerson.name + " celebraram uma aliança. +15% quando lutarem juntos.");
  save();
  render();
  refreshPersonModal();
  toast("Aliança celebrada.");
}

function setJob(person, job) {
  if (!person || person.level < 5 || !person.alive || onMission(person)) return toast("Este cidadão não está disponível.");
  if (job === "train" && !state?.buildings.barracks) return toast("Construa um quartel primeiro.");
  person.job = job;
  save();
  render();
  refreshPersonModal();
}
