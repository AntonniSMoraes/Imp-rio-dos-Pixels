import { OPTIONS } from './catalog.mjs';

const LABELS = { body: 'Base adulta', skin: 'Conjunto de pele', outfit: 'Traje', hair: 'Cabelo' };

export function mountControls(container, onChange) {
  for (const [key, options] of Object.entries(OPTIONS)) {
    const label = document.createElement('label');
    label.textContent = LABELS[key];
    const select = document.createElement('select');
    select.name = key;
    select.setAttribute('aria-label', LABELS[key]);
    for (const option of options) select.add(new Option(option.label, option.id));
    select.addEventListener('change', () => onChange(key, select.value));
    label.append(select);
    container.append(label);
  }
}

export function updateControls(container, appearance) {
  for (const select of container.querySelectorAll('select')) select.value = appearance[select.name];
}
