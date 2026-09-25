"use strict";

// Chronological years are shared by the calendar and people. Racial longevity
// will be a separate rule; it must not change the meaning of a displayed year.
const CALENDAR = Object.freeze({ daysPerYear: 48, daysPerSeason: 12, adultAge: 18 });

function calendarDate(day) {
  return { day: ((day - 1) % CALENDAR.daysPerYear) + 1, year: Math.floor((day - 1) / CALENDAR.daysPerYear) + 1 };
}

function isAdultAge(person) {
  return person.age >= CALENDAR.adultAge - 1e-9;
}

function ageOneDay(person) {
  person.age += 1 / CALENDAR.daysPerYear;
  // Prevent floating point drift from postponing birthdays by one day.
  if (Math.abs(person.age - Math.round(person.age)) < 1e-9) person.age = Math.round(person.age);
}

function normalizeLifeStage(person) {
  if (!isAdultAge(person)) {
    person.level = Math.min(person.level, 4);
    person.vocation = null;
    person.job = "idle";
    person.debut = false;
  }
}
