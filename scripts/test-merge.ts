import assert from "node:assert/strict";
import { emptyShared, mergeShared, sanitizeShared, type SharedState } from "../src/lib/sync-state.ts";

function withVote(base: SharedState, stop: string, member: string, at: number, on: boolean): SharedState {
  const next = structuredClone(base);
  const list = new Set(next.v[stop] ?? []);
  if (on) list.add(member);
  else list.delete(member);
  if (list.size) next.v[stop] = [...list];
  else delete next.v[stop];
  next.k.v[stop] = { ...(next.k.v[stop] ?? {}), [member]: at };
  return next;
}

const alex = withVote(emptyShared(), "d1-s1", "Alex", 10, true);
const sam = withVote(emptyShared(), "d1-s1", "Sam", 12, true);
const both = mergeShared(alex, sam);
assert.deepEqual(both.v["d1-s1"]?.sort(), ["Alex", "Sam"]);

const removed = mergeShared(both, withVote(emptyShared(), "d1-s1", "Alex", 20, false));
assert.deepEqual(removed.v["d1-s1"], ["Sam"]);

const noteA = emptyShared();
noteA.n["day-1"] = "boat";
noteA.k.n["day-1"] = 5;
const noteB = emptyShared();
noteB.n["day-1"] = "hotel confirmed";
noteB.k.n["day-1"] = 9;
assert.equal(mergeShared(noteA, noteB).n["day-1"], "hotel confirmed");
assert.equal(mergeShared(noteB, noteA).n["day-1"], "hotel confirmed");

const dirty = sanitizeShared({
  v: { "d1-s1": ["ElderOne", "ElderTwo", "<script>"] },
  n: { "day-1": "hello<script>", "nope": "x" },
  x: {
    "day-3": [{ id: "custom-boat", title: "Botel", category: "food", lat: 50.1, lng: 14.4, tip: "ok", time: "15:00", neighborhood: "Vltava", isCustom: true }],
  },
});
assert.deepEqual(dirty.v["d1-s1"]?.sort(), ["Riley", "Sam"]);
assert.equal(dirty.n["day-1"], "hello<script>");
assert.equal(dirty.n.nope, undefined);
assert.equal(dirty.x["day-3"]?.[0]?.title, "Botel");

console.log("merge tests passed");
