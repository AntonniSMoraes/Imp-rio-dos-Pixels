"use strict";

const $ = (selector) => document.querySelector(selector);
const rand = (size) => Math.floor(Math.random() * size);
const pick = (items) => items[rand(items.length)];
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character],
  );
