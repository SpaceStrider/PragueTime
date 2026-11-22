export const FAMILY_MEMBERS = ["Ethan", "Debi", "Tom", "Olivia", "Jordan"] as const;
const MEMBER_SET = new Set<string>(FAMILY_MEMBERS);
const CATEGORIES = new Set(["food", "sight", "walk", "transit", "holiday"]);
const DAY_ID = /^day-([1-9]|1[0-7])$/;
const STOP_ID = /^custom-[a-zA-Z0-9_-]{1,40}$/;

export type Clocks = {
  v: Record<string, Record<string, number>>;
  c: Record<string, number>;
  x: Record<string, number>;
  n: Record<string, number>;
  b: Record<string, number>;
  m: Record<string, number>;
};

export type CustomStop = {
  id: string;
  time: string;
  title: string;
  category: string;
  lat: number;
  lng: number;
  neighborhood: string;
  tip: string;
  booking: string | null;
  isCustom: true;
};

export type SharedState = {
  v: Record<string, string[]>;
  c: Record<string, boolean>;
  x: Record<string, CustomStop[]>;
  n: Record<string, string>;
  b: Record<string, boolean>;
  m: Record<string, string>;
  k: Clocks;
};

const EMPTY_CLOCKS = (): Clocks => ({ v: {}, c: {}, x: {}, n: {}, b: {}, m: {} });

export function emptyShared(): SharedState {
  return { v: {}, c: {}, x: {}, n: {}, b: {}, m: {}, k: EMPTY_CLOCKS() };
}

function memberName(value: unknown): string | null {
  const raw = typeof value === "string" ? value : "";
  const mapped = raw === "Mom" ? "Debi" : raw === "Dad" ? "Tom" : raw;
  return MEMBER_SET.has(mapped) ? mapped : null;
}

function clockValue(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(n, Date.now() + 86_400_000);
}

function clip(value: unknown, max: number): string {
  return String(value ?? "").slice(0, max);
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function dayKey(value: string): string | null {
  return DAY_ID.test(value) ? value : null;
}

export function sanitizeShared(input: unknown): SharedState {
  const src = asRecord(input);
  const clocksIn = asRecord(src.k);
  const state = emptyShared();

  const votes = asRecord(src.v);
  const voteClocks = asRecord(clocksIn.v);
  for (const [stopId, list] of Object.entries(votes).slice(0, 80)) {
    const cleanStop = stopId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 48);
    if (!cleanStop || !Array.isArray(list)) continue;
    const names = [...new Set(list.map(memberName).filter((name): name is string => !!name))];
    if (names.length) state.v[cleanStop] = names;
  }
  for (const [stopId, rawMembers] of Object.entries(voteClocks).slice(0, 80)) {
    const cleanStop = stopId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 48);
    const members = asRecord(rawMembers);
    if (!cleanStop) continue;
    const bucket: Record<string, number> = {};
    for (const [member, at] of Object.entries(members)) {
      const name = memberName(member);
      const t = clockValue(at);
      if (name && t) bucket[name] = t;
    }
    if (Object.keys(bucket).length) state.k.v[cleanStop] = bucket;
  }

  const completed = asRecord(src.c);
  const completedClocks = asRecord(clocksIn.c);
  for (const [stopId, on] of Object.entries(completed).slice(0, 200)) {
    const cleanStop = stopId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 48);
    if (cleanStop && on === true) state.c[cleanStop] = true;
  }
  for (const [stopId, at] of Object.entries(completedClocks).slice(0, 200)) {
    const cleanStop = stopId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 48);
    const t = clockValue(at);
    if (cleanStop && t) state.k.c[cleanStop] = t;
  }

  const bookings = asRecord(src.b);
  const bookingClocks = asRecord(clocksIn.b);
  for (const [id, on] of Object.entries(bookings).slice(0, 40)) {
    const clean = id.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40);
    if (clean && on === true) state.b[clean] = true;
  }
  for (const [id, at] of Object.entries(bookingClocks).slice(0, 40)) {
    const clean = id.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40);
    const t = clockValue(at);
    if (clean && t) state.k.b[clean] = t;
  }

  const notes = asRecord(src.n);
  const noteClocks = asRecord(clocksIn.n);
  for (const [dayId, text] of Object.entries(notes).slice(0, 20)) {
    const day = dayKey(dayId);
    const clipped = clip(text, 2000).trim();
    if (day && clipped) state.n[day] = clipped;
  }
  for (const [dayId, at] of Object.entries(noteClocks).slice(0, 20)) {
    const day = dayKey(dayId);
    const t = clockValue(at);
    if (day && t) state.k.n[day] = t;
  }

  const variants = asRecord(src.m);
  const variantClocks = asRecord(clocksIn.m);
  for (const [dayId, mode] of Object.entries(variants).slice(0, 20)) {
    const day = dayKey(dayId);
    if (day && (mode === "prague" || mode === "krumlov")) state.m[day] = mode;
  }
  for (const [dayId, at] of Object.entries(variantClocks).slice(0, 20)) {
    const day = dayKey(dayId);
    const t = clockValue(at);
    if (day && t) state.k.m[day] = t;
  }

  const customs = asRecord(src.x);
  const customClocks = asRecord(clocksIn.x);
  for (const [dayId, list] of Object.entries(customs).slice(0, 20)) {
    const day = dayKey(dayId);
    if (!day || !Array.isArray(list)) continue;
    const stops: CustomStop[] = [];
    for (const item of list.slice(0, 24)) {
      const row = asRecord(item);
      const id = clip(row.id, 48);
      if (!STOP_ID.test(id)) continue;
      const lat = Number(row.lat);
      const lng = Number(row.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) continue;
      const category = CATEGORIES.has(String(row.category)) ? String(row.category) : "sight";
      stops.push({
        id,
        time: clip(row.time, 40) || "Flexible",
        title: clip(row.title, 160).trim() || "Custom stop",
        category,
        lat: Math.round(lat * 1e6) / 1e6,
        lng: Math.round(lng * 1e6) / 1e6,
        neighborhood: clip(row.neighborhood, 160),
        tip: clip(row.tip, 600),
        booking: row.booking ? clip(row.booking, 120) : null,
        isCustom: true,
      });
    }
    if (stops.length) state.x[day] = stops;
  }
  for (const [dayId, at] of Object.entries(customClocks).slice(0, 20)) {
    const day = dayKey(dayId);
    const t = clockValue(at);
    if (day && t) state.k.x[day] = t;
  }

  return state;
}

function mergeBool(
  a: Record<string, boolean>,
  b: Record<string, boolean>,
  ca: Record<string, number>,
  cb: Record<string, number>,
) {
  const keys = new Set([...Object.keys(a), ...Object.keys(b), ...Object.keys(ca), ...Object.keys(cb)]);
  const out: Record<string, boolean> = {};
  const clocks: Record<string, number> = {};
  for (const key of keys) {
    const ta = clockValue(ca[key]);
    const tb = clockValue(cb[key]);
    const on = tb > ta ? !!b[key] : ta > tb ? !!a[key] : !!(a[key] || b[key]);
    const t = Math.max(ta, tb);
    if (t) clocks[key] = t;
    if (on) out[key] = true;
  }
  return { out, clocks };
}

function mergeVotes(
  a: Record<string, string[]>,
  b: Record<string, string[]>,
  ca: Record<string, Record<string, number>>,
  cb: Record<string, Record<string, number>>,
) {
  const stops = new Set([...Object.keys(a), ...Object.keys(b), ...Object.keys(ca), ...Object.keys(cb)]);
  const out: Record<string, string[]> = {};
  const clocks: Record<string, Record<string, number>> = {};
  for (const stop of stops) {
    const members = new Set([
      ...(a[stop] ?? []),
      ...(b[stop] ?? []),
      ...Object.keys(ca[stop] ?? {}),
      ...Object.keys(cb[stop] ?? {}),
    ]);
    const voted: string[] = [];
    const bucket: Record<string, number> = {};
    for (const member of members) {
      const ta = clockValue(ca[stop]?.[member]);
      const tb = clockValue(cb[stop]?.[member]);
      const on = tb > ta ? (b[stop] ?? []).includes(member) : ta > tb ? (a[stop] ?? []).includes(member) : (a[stop] ?? []).includes(member) || (b[stop] ?? []).includes(member);
      const t = Math.max(ta, tb);
      if (t) bucket[member] = t;
      if (on) voted.push(member);
    }
    if (Object.keys(bucket).length) clocks[stop] = bucket;
    if (voted.length) out[stop] = voted;
  }
  return { out, clocks };
}

function mergeText(
  a: Record<string, string>,
  b: Record<string, string>,
  ca: Record<string, number>,
  cb: Record<string, number>,
) {
  const keys = new Set([...Object.keys(a), ...Object.keys(b), ...Object.keys(ca), ...Object.keys(cb)]);
  const out: Record<string, string> = {};
  const clocks: Record<string, number> = {};
  for (const key of keys) {
    const ta = clockValue(ca[key]);
    const tb = clockValue(cb[key]);
    const chosen = tb > ta ? (b[key] ?? "") : ta > tb ? (a[key] ?? "") : (b[key] ?? a[key] ?? "");
    const t = Math.max(ta, tb);
    if (t) clocks[key] = t;
    if (chosen) out[key] = chosen;
  }
  return { out, clocks };
}

function mergeCustoms(
  a: Record<string, CustomStop[]>,
  b: Record<string, CustomStop[]>,
  ca: Record<string, number>,
  cb: Record<string, number>,
) {
  const keys = new Set([...Object.keys(a), ...Object.keys(b), ...Object.keys(ca), ...Object.keys(cb)]);
  const out: Record<string, CustomStop[]> = {};
  const clocks: Record<string, number> = {};
  for (const key of keys) {
    const ta = clockValue(ca[key]);
    const tb = clockValue(cb[key]);
    const chosen = tb >= ta ? (b[key] ?? a[key] ?? []) : (a[key] ?? b[key] ?? []);
    const t = Math.max(ta, tb);
    if (t) clocks[key] = t;
    if (chosen.length) out[key] = chosen;
  }
  return { out, clocks };
}

export function mergeShared(base: SharedState, incoming: SharedState): SharedState {
  const votes = mergeVotes(base.v, incoming.v, base.k.v, incoming.k.v);
  const completed = mergeBool(base.c, incoming.c, base.k.c, incoming.k.c);
  const bookings = mergeBool(base.b, incoming.b, base.k.b, incoming.k.b);
  const notes = mergeText(base.n, incoming.n, base.k.n, incoming.k.n);
  const variants = mergeText(base.m, incoming.m, base.k.m, incoming.k.m);
  const customs = mergeCustoms(base.x, incoming.x, base.k.x, incoming.k.x);
  return sanitizeShared({
    v: votes.out,
    c: completed.out,
    b: bookings.out,
    n: notes.out,
    m: variants.out,
    x: customs.out,
    k: {
      v: votes.clocks,
      c: completed.clocks,
      b: bookings.clocks,
      n: notes.clocks,
      m: variants.clocks,
      x: customs.clocks,
    },
  });
}
