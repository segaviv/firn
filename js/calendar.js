// Holidays that move crowds on Swiss slopes. Dates are approximate and should
// be refreshed each season (school holidays differ by canton / municipality).
// factor multiplies the crowd index.
const PERIODS = [
  // 2026/27
  { from: '2026-12-08', to: '2026-12-08', label: 'Immaculate Conception (holiday in Catholic cantons)', factor: 1.15 },
  { from: '2026-12-19', to: '2027-01-03', label: 'Christmas school holidays', factor: 1.3 },
  { from: '2027-01-30', to: '2027-03-07', label: 'Sports holidays in several cantons', factor: 1.12 },
  { from: '2027-02-06', to: '2027-02-21', label: 'Zürich sports holidays (Sportferien)', factor: 1.3 },
  { from: '2027-03-26', to: '2027-03-29', label: 'Easter weekend', factor: 1.25 },
  // 2027/28
  { from: '2027-12-08', to: '2027-12-08', label: 'Immaculate Conception (holiday in Catholic cantons)', factor: 1.15 },
  { from: '2027-12-18', to: '2028-01-02', label: 'Christmas school holidays', factor: 1.3 },
  { from: '2028-01-29', to: '2028-03-05', label: 'Sports holidays in several cantons', factor: 1.12 },
  { from: '2028-02-05', to: '2028-02-20', label: 'Zürich sports holidays (Sportferien)', factor: 1.3 },
  { from: '2028-04-14', to: '2028-04-17', label: 'Easter weekend', factor: 1.2 },
];

export function holidayFor(isoDate) {
  const hits = PERIODS.filter((p) => isoDate >= p.from && isoDate <= p.to);
  if (!hits.length) return null;
  return hits.reduce((a, b) => (b.factor > a.factor ? b : a));
}

// Public holidays on which everyone is off (treated like a Saturday).
const PUBLIC = ['2026-12-25', '2026-12-26', '2027-01-01', '2027-01-02', '2027-03-26', '2027-03-29', '2027-12-25', '2027-12-26', '2028-01-01', '2028-01-02', '2028-04-14', '2028-04-17'];
export const isPublicHoliday = (iso) => PUBLIC.includes(iso);
