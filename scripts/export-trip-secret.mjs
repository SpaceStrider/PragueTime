// Read a pre-change atlas.html and print a trip payload on stdout.
// The payload is private. Do not commit it, paste it into the repo, or run this in CI.
// Usage: node scripts/export-trip-secret.mjs path/to/atlas.html

import { readFileSync } from "node:fs";
import vm from "node:vm";

const file = process.argv[2];
if (!file) {
  console.error("Usage: node scripts/export-trip-secret.mjs path/to/atlas.html");
  process.exit(1);
}

const source = readFileSync(file, "utf8");

function sliceValue(text, start) {
  let i = start;
  while (/\s/.test(text[i] ?? "")) i += 1;
  const open = text[i];
  const pairs = { "{": "}", "[": "]" };
  if (!pairs[open]) throw new Error("Expected an object or array");
  const stack = [pairs[open]];
  let quote = null;
  i += 1;
  while (i < text.length && stack.length) {
    const ch = text[i];
    if (quote) {
      if (ch === "\\") {
        i += 2;
        continue;
      }
      if (ch === quote) quote = null;
      i += 1;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
      i += 1;
      continue;
    }
    if (ch === "{" || ch === "[") {
      stack.push(pairs[ch]);
      i += 1;
      continue;
    }
    if (ch === "}" || ch === "]") {
      if (ch !== stack[stack.length - 1]) throw new Error("Unbalanced data");
      stack.pop();
      i += 1;
      continue;
    }
    i += 1;
  }
  if (stack.length) throw new Error("Unclosed data");
  return text.slice(start, i);
}

function extractConst(name) {
  const token = `const ${name} = `;
  const at = source.indexOf(token);
  if (at < 0) throw new Error(`Missing ${name}`);
  return sliceValue(source, at + token.length);
}

function extractFunction(name) {
  const token = `function ${name}`;
  const at = source.indexOf(token);
  if (at < 0) throw new Error(`Missing function ${name}`);
  const brace = source.indexOf("{", at);
  const body = sliceValue(source, brace);
  return source.slice(at, brace + body.length);
}

function unescapeJs(value) {
  return value.replace(/\\'/g, "'").replace(/\\n/g, "\n");
}

function grab(fnSource, pattern) {
  const match = fnSource.match(pattern);
  return match ? unescapeJs(match[1]) : "";
}

const context = vm.createContext({ console });
const constNames = [
  "FAMILY_MEMBERS",
  "TRIP_DAYS",
  "DISTRICT_CALLOUTS",
  "REGIONAL_HUBS",
  "REGIONAL_ARCS",
  "BOOKING_CHECKLIST",
  "ARRIVES",
  "HOUSE",
  "BOAT",
  "AIRBNB",
  "AIRPORT",
  "NUREMBERG_STAY",
  "MODE_META",
];
for (const name of constNames) {
  vm.runInContext(`${name} = ${extractConst(name)}`, context);
}

const fnNames = [
  "legacyMember",
  "getDayStops",
  "haversineKm",
  "userIsHere",
  "dayUsesCar",
  "onTheBoat",
  "routeStart",
  "routeEnd",
  "routeVoice",
  "includeInRoute",
  "routeNote",
  "fromHouse",
  "pragueTransitDay",
  "legPlan",
  "routeBlurb",
  "parkingCopy",
  "lodgingNote",
];
for (const name of fnNames) {
  vm.runInContext(extractFunction(name), context);
}

context.state = {
  activeUser: null,
  dayVariants: {},
  customStops: {},
  selectedDayIndex: 0,
};

const variantMatch = source.match(/dayVariants:\s*(\{[^}]+\})/);
if (variantMatch) {
  context.state.dayVariants = vm.runInContext(`(${variantMatch[1]})`, context);
}
const defaultVariants = { ...context.state.dayVariants };

const activeMatch = source.match(/activeUser:\s*'([^']+)'/);
const defaultUser = activeMatch ? activeMatch[1] : context.FAMILY_MEMBERS[0].id;

const roles = {};
for (const member of context.FAMILY_MEMBERS) {
  const start = context.routeStart(member.id, context.TRIP_DAYS[0]);
  const atHouse = start && start.lat === context.HOUSE.lat && start.lng === context.HOUSE.lng && start.name === context.HOUSE.name;
  if (context.onTheBoat(member.id)) roles[member.id] = "driver";
  else if (atHouse) roles[member.id] = "home";
  else roles[member.id] = "guest";
}

const late = context.FAMILY_MEMBERS.find((member) => !context.userIsHere(member.id, 0));
context.state.activeUser = late ? late.id : defaultUser;
const awayVoice = context.routeVoice(context.TRIP_DAYS[0]);

function placeKey(point) {
  if (!point) return null;
  const map = {
    house: context.HOUSE,
    boat: context.BOAT,
    lodging: context.AIRBNB,
    airport: context.AIRPORT,
    awayNight: context.NUREMBERG_STAY,
  };
  for (const [key, place] of Object.entries(map)) {
    if (place && point.lat === place.lat && point.lng === place.lng && point.name === place.name) return key;
  }
  return null;
}

function carShape(day) {
  if (!day.hasVariants) {
    context.state.dayVariants[day.id] = day.activeVariant || "prague";
    return context.dayUsesCar(day) ? { usesCar: true } : {};
  }
  const modes = Object.keys(day.variants);
  const on = [];
  for (const mode of modes) {
    context.state.dayVariants[day.id] = mode;
    if (context.dayUsesCar(day)) on.push(mode);
  }
  context.state.dayVariants[day.id] = day.activeVariant || defaultVariants[day.id] || "prague";
  if (on.length === 1 && modes.length > 1) return { carVariant: on[0] };
  if (on.length > 0) return { usesCar: true };
  return {};
}

function snapshotRole(day, member) {
  const idx = context.TRIP_DAYS.findIndex((item) => item.id === day.id);
  context.state.activeUser = member.id;
  const start = context.routeStart(member.id, day);
  const end = context.routeEnd(member.id, day);
  const stops = context.getDayStops(day);
  const skipped = stops.filter((stop) => !context.includeInRoute(member.id, stop, day)).map((stop) => stop.id);
  const notes = {};
  for (const stop of stops) {
    const note = context.routeNote(member.id, stop, day);
    if (note) notes[stop.id] = note;
  }
  const blurb = context.routeBlurb(member.id, day);
  const special = blurb && !blurb.startsWith("Start at ") && !blurb.startsWith("While you are away");
  return {
    start: placeKey(start),
    end: placeKey(end),
    skipped,
    notes,
    blurb: special ? blurb : "",
    parking: context.parkingCopy(member.id, idx, day) || "",
    sleep: context.lodgingNote(day) || "",
  };
}

const tripDays = context.TRIP_DAYS.map((day) => {
  const byRole = {};
  for (const role of ["home", "driver", "guest"]) {
    const members = context.FAMILY_MEMBERS.filter((member) => roles[member.id] === role);
    if (!members.length) continue;
    const snaps = members.map((member) => snapshotRole(day, member));
    const fingerprint = JSON.stringify(snaps[0]);
    if (snaps.some((snap) => JSON.stringify(snap) !== fingerprint)) {
      throw new Error(`Members who share the ${role} role do not share a route snapshot for ${day.id}`);
    }
    byRole[role] = snaps[0];
  }
  const route = carShape(day);
  const startPlaceByRole = {};
  const endPlaceByRole = {};
  const skipStopsByRole = {};
  const stopNotesByRole = {};
  const blurbByRole = {};
  const parkingByRole = {};
  const sleepByRole = {};
  for (const [role, snap] of Object.entries(byRole)) {
    if (snap.start) startPlaceByRole[role] = snap.start;
    if (snap.end) endPlaceByRole[role] = snap.end;
    if (snap.skipped.length) skipStopsByRole[role] = snap.skipped;
    if (Object.keys(snap.notes).length) stopNotesByRole[role] = snap.notes;
    if (snap.blurb) blurbByRole[role] = snap.blurb;
    if (snap.parking) parkingByRole[role] = snap.parking;
    if (snap.sleep) sleepByRole[role] = snap.sleep;
  }
  if (Object.keys(startPlaceByRole).length) route.startPlaceByRole = startPlaceByRole;
  if (Object.keys(endPlaceByRole).length) route.endPlaceByRole = endPlaceByRole;
  if (Object.keys(skipStopsByRole).length) route.skipStopsByRole = skipStopsByRole;
  if (Object.keys(stopNotesByRole).length) route.stopNotesByRole = stopNotesByRole;
  if (Object.keys(blurbByRole).length) route.blurbByRole = blurbByRole;
  if (Object.keys(parkingByRole).length) route.parkingByRole = parkingByRole;
  const next = { ...day, route };
  if (Object.keys(sleepByRole).length) next.sleepByRole = sleepByRole;
  return next;
});

const blurbSource = extractFunction("routeBlurb");
const lodgingWhenOrigin = grab(blurbSource, /origin === AIRBNB\s*\?\s*'((?:\\'|[^'])*)'/);
const boatWhenEnd = grab(blurbSource, /end === BOAT \? '((?:\\'|[^'])*)'/);
const boatWhenOrigin = grab(blurbSource, /origin === BOAT \? '((?:\\'|[^'])*)'/);

const legacySource = extractFunction("legacyMember");
const legacyMembers = {};
for (const match of legacySource.matchAll(/id === '([^']+)'\) return '([^']+)'/g)) {
  legacyMembers[match[1]] = match[2];
}

const dateMatch = source.match(/2xl:inline-flex[\s\S]*?>\s*([^<]+?)\s*<\/span>/);
const shareMatch = source.match(/<h3 class="font-bold text-sm text-vltava">([^<]+)<\/h3>/);
const whoMatch = source.match(/<p class="text-sm text-slate-600 mt-1 leading-relaxed">([^<]+)<\/p>/);

function decode(text) {
  return (text || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .trim();
}

const payload = {
  defaultUser,
  awayVoice,
  dateRange: decode(dateMatch?.[1] || ""),
  shareHeading: decode(shareMatch?.[1] || ""),
  whoIntro: decode(whoMatch?.[1] || ""),
  legacyMembers,
  defaultVariants,
  family: context.FAMILY_MEMBERS.map((member) => ({
    id: member.id,
    label: member.label,
    color: member.color,
    arrives: context.ARRIVES[member.id] ?? 0,
    role: roles[member.id],
  })),
  places: {
    house: { ...context.HOUSE },
    boat: { ...context.BOAT, whenEnd: boatWhenEnd, whenOrigin: boatWhenOrigin },
    lodging: { ...context.AIRBNB, whenOrigin: lodgingWhenOrigin },
    airport: { ...context.AIRPORT },
    awayNight: { ...context.NUREMBERG_STAY },
  },
  tripDays,
  districts: context.DISTRICT_CALLOUTS,
  regionalHubs: context.REGIONAL_HUBS.map((hub) => ({ ...hub, primary: hub.name === "Prague" })),
  regionalArcs: context.REGIONAL_ARCS,
  bookingChecklist: context.BOOKING_CHECKLIST,
};

process.stderr.write("Private trip payload. Do not commit this output.\n");
process.stdout.write(JSON.stringify(payload));
