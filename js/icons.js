// Minimal line icons (24×24, currentColor).
const wrap = (d, cls = '') => `<svg class="ico ${cls}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;

const SUN = '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>';
const CLOUD = '<path d="M7 18h10a4 4 0 0 0 .6-7.95A5.5 5.5 0 0 0 7.1 9.5 4.25 4.25 0 0 0 7 18Z"/>';

export const ICONS = {
  sun: wrap(SUN, 'i-sun'),
  partly: wrap('<circle cx="8.5" cy="8.5" r="3"/><path d="M8.5 2.5v1.2M2.5 8.5h1.2M4.3 4.3l.9.9M12.7 4.3l-.9.9"/><path d="M9 19h8.5a3.5 3.5 0 0 0 .4-6.98 4.8 4.8 0 0 0-9.1-.9A3.9 3.9 0 0 0 9 19Z"/>', 'i-partly'),
  cloud: wrap(CLOUD, 'i-cloud'),
  snow: wrap('<path d="M7 14h10a3.6 3.6 0 0 0 .5-7.15A5 5 0 0 0 7.9 5.6 3.8 3.8 0 0 0 7 14Z"/><path d="M8 17.5v.01M12 17v.01M16 17.5v.01M10 20.5v.01M14 20.5v.01" stroke-width="2.2"/>', 'i-snow'),
  rain: wrap('<path d="M7 14h10a3.6 3.6 0 0 0 .5-7.15A5 5 0 0 0 7.9 5.6 3.8 3.8 0 0 0 7 14Z"/><path d="M8.5 17l-1 2.5M12.5 17l-1 2.5M16.5 17l-1 2.5"/>', 'i-rain'),
  fog: wrap('<path d="M4 9h16M3 13h18M5 17h14"/>', 'i-fog'),
  wind: wrap('<path d="M3 9h11a2.5 2.5 0 1 0-2.5-2.5M3 13h15a2.5 2.5 0 1 1-2.5 2.5M3 17h7"/>'),
  flake: wrap('<path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9M9.5 4.5 12 6l2.5-1.5M9.5 19.5 12 18l2.5 1.5"/>'),
  lift: wrap('<path d="M3 5l18 4"/><path d="M12 7v4"/><rect x="8" y="11" width="8" height="6" rx="1.5"/><path d="M8 14h8"/>'),
  car: wrap('<path d="M4 16v-3.5L6 8h12l2 4.5V16M4 16h16M4 16v2M20 16v2"/><circle cx="7.5" cy="13" r=".6" fill="currentColor"/><circle cx="16.5" cy="13" r=".6" fill="currentColor"/>'),
  train: wrap('<rect x="6" y="3.5" width="12" height="13" rx="3"/><path d="M6 10h12M9 20l1.5-3.5M15 20l-1.5-3.5"/>'),
  ticket: wrap('<path d="M4 8a2 2 0 0 0 0 4v4h16v-4a2 2 0 0 1 0-4V4H4Z" transform="translate(0 2)"/><path d="M14 6v12" stroke-dasharray="2 2"/>'),
  people: wrap('<circle cx="9" cy="8" r="3"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0"/><circle cx="17" cy="9" r="2.3"/><path d="M15.5 14.2A4.5 4.5 0 0 1 21 18.5"/>'),
  mountain: wrap('<path d="M2.5 19.5 9.5 7l4 7 2.5-3.5 5.5 9Z"/>'),
  avalanche: wrap('<path d="M12 3 2.5 20h19Z"/><path d="M12 10v4.5M12 17.2v.01"/>'),
  clock: wrap('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>'),
  arrow: wrap('<path d="M7 17 17 7M9 7h8v8"/>'),
  chevron: wrap('<path d="m6 9 6 6 6-6"/>'),
  sunrise: wrap('<path d="M4 18h16M7 14a5 5 0 0 1 10 0M12 4v4M9.5 6.5 12 4l2.5 2.5"/>'),
  info: wrap('<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8v.01"/>'),
  fogEscape: wrap('<circle cx="16" cy="7" r="3"/><path d="M3 13h18M5 16.5h14M7 20h10"/>'),
  calendar: wrap('<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>'),
  road: wrap('<path d="M8 3 5 21M16 3l3 18M12 4v2.5M12 10v3M12 16.5V20"/>'),
  coin: wrap('<circle cx="12" cy="12" r="8.5"/><path d="M14.5 9.2A2.8 2.8 0 0 0 12 8c-1.5 0-2.6.8-2.6 2s1 1.6 2.6 2 2.6.9 2.6 2-1.1 2-2.6 2a2.9 2.9 0 0 1-2.6-1.3M12 6.5V8M12 16v1.5"/>'),
  thermo: wrap('<path d="M10 14.5V5a2 2 0 1 1 4 0v9.5a4 4 0 1 1-4 0Z"/><path d="M12 9v7"/>'),
};
