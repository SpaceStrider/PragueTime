import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

const START = "/*__TRIP_PRIVATE_START__*/";
const END = "/*__TRIP_PRIVATE_END__*/";

export type TripRoster = {
  members: string[];
  legacy: Record<string, string>;
};

type TripShape = {
  family: { id?: unknown }[];
  tripDays: unknown[];
  legacyMembers?: unknown;
};

let rosterCache: TripRoster | undefined;
let rosterKey: string | undefined;

function assertPayload(value: unknown): asserts value is TripShape {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Trip payload must be a JSON object");
  }
  const row = value as { family?: unknown; tripDays?: unknown };
  if (!Array.isArray(row.family) || row.family.length === 0) {
    throw new Error("Trip payload is missing family");
  }
  if (!Array.isArray(row.tripDays) || row.tripDays.length === 0) {
    throw new Error("Trip payload is missing tripDays");
  }
}

function parsePayload(raw: string): TripShape {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("TRIP_PRIVATE_JSON is not valid JSON");
  }
  assertPayload(parsed);
  return parsed;
}

function samplePath(): string {
  return path.join(process.cwd(), "content", "trip.sample.json");
}

export function loadTripPayloadSync(): TripShape {
  const raw = process.env.TRIP_PRIVATE_JSON?.trim() ?? "";
  if (raw) return parsePayload(raw);
  return parsePayload(readFileSync(samplePath(), "utf8"));
}

export async function loadTripPayload(): Promise<TripShape> {
  const raw = process.env.TRIP_PRIVATE_JSON?.trim() ?? "";
  if (raw) return parsePayload(raw);
  return parsePayload(await readFile(samplePath(), "utf8"));
}

export function tripRoster(): TripRoster {
  const key = process.env.TRIP_PRIVATE_JSON?.trim() ?? "";
  if (rosterCache && rosterKey === key) return rosterCache;
  const payload = loadTripPayloadSync();
  const members = payload.family
    .map((member) => (typeof member.id === "string" ? member.id : ""))
    .filter((id) => id !== "");
  const legacy: Record<string, string> = {};
  if (payload.legacyMembers && typeof payload.legacyMembers === "object" && !Array.isArray(payload.legacyMembers)) {
    for (const [from, to] of Object.entries(payload.legacyMembers)) {
      if (typeof to === "string" && to !== "") legacy[from] = to;
    }
  }
  rosterCache = { members, legacy };
  rosterKey = key;
  return rosterCache;
}

export function embedPayload(template: string, payload: unknown): string {
  const start = template.indexOf(START);
  const end = template.indexOf(END);
  if (start < 0 || end < start) throw new Error("Atlas template is missing the trip payload marker");
  const json = JSON.stringify(payload)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
  return template.slice(0, start + START.length) + json + template.slice(end);
}

export async function renderAtlasHtml(): Promise<string> {
  const template = await readFile(path.join(process.cwd(), "content", "atlas.html"), "utf8");
  const payload = await loadTripPayload();
  return embedPayload(template, payload);
}
