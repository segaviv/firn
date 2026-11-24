// Static resort knowledge. Live data (weather, lifts, snow, trains, avalanche) is layered on top.
//
// Field notes
//  base/top        elevation in metres (ski area)
//  km              total piste km of the area you'd realistically ski in a day
//  drive           OSRM free-flow minutes from Zürich HB to the parking (traffic factor applied later)
//  driveKm         one-way road km
//  corridor        traffic corridor used for weekend congestion estimates
//  parking         CHF per car per day (approx.)
//  lastMile        minutes from the SBB stop to the first lift
//  station         SBB/transport.opendata.ch stop name
//  trainFallback   minutes Zürich HB -> station (Saturday morning), used if the live timetable is unreachable
//  price           adult 1-day pass CHF [min, max]; for fixed prices min === max (2025/26 approx.)
//  dynamic         true if the resort uses demand-based (dynamic) pricing
//  fit             0..1 terrain fit for intermediate–advanced skiers (long reds/blacks, freeride access)
//  popularity      0..1 baseline weekend crowd pressure relative to capacity
//  windExposed     top lifts often close in strong wind
//  slf             SLF avalanche region IDs
//  bergfex         bergfex.com slug for snow & lift report (null = not covered)
export const RESORTS = [
  {
    id: 'flumserberg', name: 'Flumserberg', region: 'St. Gallen',
    lat: 47.0944, lon: 9.2858, base: 1220, top: 2222, km: 65,
    drive: 73, driveKm: 94, corridor: 'A3', parking: 10,
    station: 'Unterterzen', lastMile: 5, trainFallback: 58,
    price: [47, 79], dynamic: true, fit: 0.6, popularity: 0.88, windExposed: false,
    slf: ['CH-3223'], bergfex: 'flumserberg',
    url: 'https://www.flumserberg.ch', tickets: 'https://www.flumserberg.ch/tickets',
    blurb: 'Closest big area to Zürich, lake views, gets very busy on sunny weekends.',
  },
  {
    id: 'hoch-ybrig', name: 'Hoch-Ybrig', region: 'Schwyz',
    lat: 47.0306, lon: 8.8117, base: 1050, top: 1856, km: 50,
    drive: 54, driveKm: 54, corridor: 'central', parking: 10,
    station: 'Unteriberg Weglosen (Talst.)', lastMile: 5, trainFallback: 84,
    price: [56, 62], dynamic: false, fit: 0.55, popularity: 0.72, windExposed: false,
    slf: ['CH-2132'], bergfex: 'ybrig',
    url: 'https://www.hoch-ybrig.ch', tickets: 'https://www.hoch-ybrig.ch/tickets',
    blurb: 'Short drive, compact and family-friendly; low top elevation.',
  },
  {
    id: 'stoos', name: 'Stoos', region: 'Schwyz',
    lat: 46.977, lon: 8.663, park: [47.0000, 8.6510], base: 1300, top: 1922, km: 35,
    drive: 51, driveKm: 62, corridor: 'central', parking: 8,
    station: 'Schwyz, Stoosbahn', lastMile: 10, trainFallback: 79,
    price: [48, 68], dynamic: true, fit: 0.65, popularity: 0.78, windExposed: true,
    slf: ['CH-2133'], bergfex: 'stoos',
    url: 'https://www.stoos.ch', tickets: 'https://www.stoos.ch/tickets',
    blurb: 'Car-free village up the world’s steepest funicular, with Fronalpstock views over the lakes. Small area.',
  },
  {
    id: 'engelberg', name: 'Engelberg-Titlis', region: 'Obwalden',
    lat: 46.8196, lon: 8.4035, base: 1000, top: 3028, km: 82,
    drive: 73, driveKm: 86, corridor: 'central', parking: 10,
    station: 'Engelberg', lastMile: 10, trainFallback: 103,
    price: [72, 79], dynamic: false, fit: 0.92, popularity: 0.7, windExposed: true,
    slf: ['CH-2122'], bergfex: 'engelberg',
    url: 'https://www.titlis.ch', tickets: 'https://www.titlis.ch/en/tickets',
    blurb: 'Glacier above 3,000 m and legendary freeride (Laub, Steinberg). High and snow-sure.',
  },
  {
    id: 'laax', name: 'Laax · Flims · Falera', region: 'Graubünden',
    lat: 46.829, lon: 9.247, base: 1100, top: 3018, km: 224,
    drive: 121, driveKm: 144, corridor: 'A13', parking: 10,
    station: 'Laax Murschetg (Talstation)', lastMile: 0, trainFallback: 126,
    price: [49, 109], dynamic: true, fit: 0.95, popularity: 0.75, windExposed: true,
    slf: ['CH-5124'], bergfex: 'laax',
    url: 'https://www.laax.com', tickets: 'https://shop.laax.com/en',
    blurb: 'Huge, varied terrain from Vorab glacier down to Flims; top parks, plenty of freeride.',
  },
  {
    id: 'davos', name: 'Davos Klosters · Parsenn', region: 'Graubünden',
    lat: 46.8095, lon: 9.839, base: 1124, top: 2844, km: 110,
    drive: 117, driveKm: 148, corridor: 'A13', parking: 10,
    station: 'Davos Dorf', lastMile: 5, trainFallback: 135,
    price: [57, 92], dynamic: true, fit: 0.9, popularity: 0.65, windExposed: true,
    slf: ['CH-5123'], bergfex: 'davos-parsenn',
    url: 'https://www.davos.ch', tickets: 'https://www.davos.ch/en/winter/ski-snowboard/tickets',
    blurb: 'Classic long descents (Weissfluh–Küblis), big terrain and reliable snow.',
  },
  {
    id: 'lenzerheide', name: 'Arosa Lenzerheide', region: 'Graubünden',
    lat: 46.7286, lon: 9.5567, base: 1229, top: 2865, km: 225,
    drive: 105, driveKm: 139, corridor: 'A13', parking: 10,
    station: 'Lenzerheide/Lai, Post', lastMile: 5, trainFallback: 121,
    price: [59, 98], dynamic: true, fit: 0.82, popularity: 0.68, windExposed: false,
    slf: ['CH-5221', 'CH-5122'], bergfex: 'arosa-lenzerheide',
    url: 'https://arosalenzerheide.swiss', tickets: 'https://arosalenzerheide.swiss/en/Tickets',
    blurb: 'Two valleys linked by the Urdenbahn — lots of cruisy reds and the Rothorn.',
  },
  {
    id: 'andermatt', name: 'Andermatt · Sedrun', region: 'Uri / Graubünden',
    lat: 46.6366, lon: 8.594, base: 1444, top: 2961, km: 180,
    drive: 89, driveKm: 109, corridor: 'A2', parking: 10,
    station: 'Andermatt', lastMile: 5, trainFallback: 121,
    price: [55, 115], dynamic: true, fit: 0.95, popularity: 0.62, windExposed: true,
    slf: ['CH-2223', 'CH-2224', 'CH-5211'], bergfex: 'andermatt-oberalp-sedrun',
    url: 'https://www.andermatt-sedrun-disentis.ch', tickets: 'https://www.andermatt-sedrun-disentis.ch/en/tickets',
    blurb: 'Gemsstock is a freerider’s mountain; a snow magnet thanks to Gotthard south-stau.',
  },
  {
    id: 'pizol', name: 'Pizol', region: 'St. Gallen',
    lat: 47.0347, lon: 9.4365, base: 1000, top: 2227, km: 40,
    drive: 68, driveKm: 93, corridor: 'A3', parking: 5,
    station: 'Wangs, Pizolbahn', lastMile: 0, trainFallback: 68,
    price: [49, 62], dynamic: false, fit: 0.55, popularity: 0.45, windExposed: false,
    slf: ['CH-3224'], bergfex: 'pizol',
    url: 'https://www.pizol.com', tickets: 'https://www.pizol.com/tickets',
    blurb: 'Quieter alternative to Flumserberg with big views over the Rhine valley.',
  },
  {
    id: 'elm', name: 'Elm', region: 'Glarus',
    lat: 46.918, lon: 9.1735, base: 1000, top: 2105, km: 40,
    drive: 78, driveKm: 90, corridor: 'A3', parking: 5,
    station: 'Elm, Sportbahnen', lastMile: 0, trainFallback: 101,
    price: [50, 54], dynamic: false, fit: 0.6, popularity: 0.45, windExposed: false,
    slf: ['CH-3113'], bergfex: 'elm',
    url: 'https://www.sportbahnenelm.ch', tickets: 'https://www.sportbahnenelm.ch',
    blurb: 'Authentic, uncrowded valley with surprisingly good off-piste.',
  },
  {
    id: 'toggenburg', name: 'Toggenburg · Chäserrugg', region: 'St. Gallen',
    lat: 47.1972, lon: 9.3088, base: 900, top: 2262, km: 60,
    drive: 83, driveKm: 93, corridor: 'east', parking: 5,
    station: 'Unterwasser, Dorf', lastMile: 0, trainFallback: 107,
    price: [49, 69], dynamic: true, fit: 0.55, popularity: 0.5, windExposed: true,
    slf: ['CH-3221'], bergfex: 'toggenburg-chaeserrugg',
    url: 'https://www.chaeserrugg.ch', tickets: 'https://www.chaeserrugg.ch',
    blurb: 'Churfirsten panorama; Chäserrugg top station by Herzog & de Meuron.',
  },
  {
    id: 'melchsee', name: 'Melchsee-Frutt', region: 'Obwalden',
    lat: 46.8095, lon: 8.2846, base: 1080, top: 2255, km: 32,
    drive: 75, driveKm: 84, corridor: 'central', parking: 5,
    station: 'Stöckalp', lastMile: 0, trainFallback: 105,
    price: [55, 60], dynamic: false, fit: 0.45, popularity: 0.5, windExposed: false,
    slf: ['CH-2123'], bergfex: 'melchsee-frutt',
    url: 'https://www.melchsee-frutt.ch', tickets: 'https://www.melchsee-frutt.ch',
    blurb: 'High plateau, snow-sure and gentle; better for cruising than for steeps.',
  },
  {
    id: 'hasliberg', name: 'Meiringen-Hasliberg', region: 'Bern',
    lat: 46.7275, lon: 8.1868, base: 1050, top: 2433, km: 60,
    drive: 85, driveKm: 100, corridor: 'central', parking: 5,
    station: 'Meiringen', lastMile: 15, trainFallback: 126,
    price: [62, 72], dynamic: true, fit: 0.7, popularity: 0.45, windExposed: false,
    slf: ['CH-1244'], bergfex: 'meiringen-hasliberg',
    url: 'https://www.meiringen-hasliberg.ch', tickets: 'https://www.meiringen-hasliberg.ch',
    blurb: 'Underrated Bernese area; Glogghüs runs and good freeride from Planplatten.',
  },
  {
    id: 'wengen', name: 'Grindelwald · Wengen', region: 'Bern',
    lat: 46.6283, lon: 8.0365, base: 943, top: 2501, km: 105,
    drive: 124, driveKm: 138, corridor: 'A8', parking: 20,
    station: 'Grindelwald Terminal', lastMile: 0, trainFallback: 145,
    price: [69, 89], dynamic: true, fit: 0.78, popularity: 0.58, windExposed: false,
    slf: ['CH-1242', 'CH-1234'], bergfex: 'wengen',
    url: 'https://www.jungfrau.ch', tickets: 'https://www.jungfrau.ch/en-gb/tickets',
    blurb: 'Eiger north face backdrop, Lauberhorn runs; far, but spectacular.',
  },
  {
    id: 'adelboden', name: 'Adelboden-Lenk', region: 'Bern',
    lat: 46.4925, lon: 7.5594, base: 1068, top: 2362, km: 185,
    drive: 142, driveKm: 186, corridor: 'A8', parking: 10,
    station: 'Adelboden, Post', lastMile: 10, trainFallback: 144,
    price: [59, 79], dynamic: true, fit: 0.75, popularity: 0.5, windExposed: false,
    slf: ['CH-1226', 'CH-1224'], bergfex: 'adelboden',
    url: 'https://www.adelboden-lenk.ch', tickets: 'https://www.adelboden-lenk.ch',
    blurb: 'Large interlinked area, rarely packed; long trip from Zürich.',
  },
  {
    id: 'obersaxen', name: 'Obersaxen Mundaun', region: 'Graubünden',
    lat: 46.747, lon: 9.0965, base: 1200, top: 2310, km: 120,
    drive: 123, driveKm: 161, corridor: 'A13', parking: 0,
    station: 'Obersaxen, Meierhof Post', lastMile: 5, trainFallback: 148,
    price: [59, 64], dynamic: false, fit: 0.6, popularity: 0.3, windExposed: false,
    slf: ['CH-5214'], bergfex: null,
    url: 'https://www.obersaxen-mundaun.ch', tickets: 'https://www.obersaxen-mundaun.ch',
    blurb: 'Sunny, wide and quiet, with free parking.',
  },
  {
    id: 'soerenberg', name: 'Sörenberg', region: 'Lucerne',
    lat: 46.8235, lon: 8.0359, base: 1159, top: 2350, km: 50,
    drive: 94, driveKm: 95, corridor: 'central', parking: 5,
    station: 'Sörenberg, Post', lastMile: 5, trainFallback: 107,
    price: [49, 59], dynamic: false, fit: 0.5, popularity: 0.55, windExposed: false,
    slf: ['CH-2112'], bergfex: 'soerenberg',
    url: 'https://www.soerenberg.ch', tickets: 'https://www.soerenberg.ch',
    blurb: 'Brienzer Rothorn top; good value, popular with Lucerne families.',
  },
  {
    id: 'stmoritz', name: 'St. Moritz · Corviglia', region: 'Graubünden',
    lat: 46.498, lon: 9.8456, base: 1730, top: 3057, km: 155,
    drive: 163, driveKm: 204, corridor: 'A13', parking: 15,
    station: 'St. Moritz', lastMile: 10, trainFallback: 185,
    price: [55, 99], dynamic: true, fit: 0.85, popularity: 0.5, windExposed: false,
    slf: ['CH-7114', 'CH-7111'], bergfex: 'st-moritz-corviglia',
    url: 'https://www.mountains.ch', tickets: 'https://www.mountains.ch/en/tickets',
    blurb: 'High, sunny and dry Engadin; far for a day trip, but best when the north is grey.',
  },
  {
    id: 'savognin', name: 'Savognin', region: 'Graubünden',
    lat: 46.5966, lon: 9.5967, base: 1200, top: 2713, km: 80,
    drive: 122, driveKm: 165, corridor: 'A13', parking: 0,
    station: 'Savognin, posta', lastMile: 5, trainFallback: 146,
    price: [54, 64], dynamic: false, fit: 0.65, popularity: 0.3, windExposed: false,
    slf: ['CH-5232'], bergfex: 'savognin',
    url: 'https://www.savognin.ch', tickets: 'https://www.savognin.ch',
    blurb: 'Empty slopes and wide carving runs; free parking.',
  },
  {
    id: 'braunwald', name: 'Braunwald', region: 'Glarus',
    lat: 46.9405, lon: 8.9988, park: [46.9244, 9.0018], base: 1256, top: 1904, km: 32,
    drive: 76, driveKm: 87, corridor: 'A3', parking: 10,
    station: 'Braunwald', lastMile: 10, trainFallback: 109,
    price: [45, 50], dynamic: false, fit: 0.35, popularity: 0.3, windExposed: false,
    slf: ['CH-3112'], bergfex: 'braunwald',
    url: 'https://www.braunwald.ch', tickets: 'https://www.braunwald.ch',
    blurb: 'Tiny car-free sun terrace; relaxed, not for chasing vertical.',
  },
];

export const ZURICH = { lat: 47.3769, lon: 8.5417, station: 'Zürich HB' };

// Weekend traffic multipliers on the outbound trip (Sat morning is the worst outbound).
export const CORRIDORS = {
  A3: { label: 'A3 Walensee', sat: 1.12, sun: 1.06, weekday: 1.03, returnSun: 1.4, returnSat: 1.2 },
  A13: { label: 'A3/A13 Graubünden', sat: 1.12, sun: 1.06, weekday: 1.03, returnSun: 1.45, returnSat: 1.2 },
  A2: { label: 'A2 Gotthard', sat: 1.1, sun: 1.05, weekday: 1.03, returnSun: 1.35, returnSat: 1.12 },
  central: { label: 'A4/A2 Central', sat: 1.06, sun: 1.04, weekday: 1.03, returnSun: 1.22, returnSat: 1.1 },
  east: { label: 'A1/A53 East', sat: 1.05, sun: 1.03, weekday: 1.03, returnSun: 1.18, returnSat: 1.08 },
  A8: { label: 'A1/A8 Bernese Oberland', sat: 1.08, sun: 1.04, weekday: 1.03, returnSun: 1.3, returnSat: 1.12 },
};
