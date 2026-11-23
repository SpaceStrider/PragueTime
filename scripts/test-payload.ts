import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { embedPayload, renderAtlasHtml } from "../src/lib/trip-payload.ts";

const template = await readFile("content/atlas.html", "utf8");
assert.match(template, /\/\*__TRIP_PRIVATE_START__\*\/null\/\*__TRIP_PRIVATE_END__\*\//);

const rendered = await renderAtlasHtml();
assert.match(rendered, /Alex/);
assert.match(rendered, /Example Lane 1/);
assert.equal(rendered.includes("/*__TRIP_PRIVATE_START__*/null/*__TRIP_PRIVATE_END__*/"), false);
const still = await readFile("content/atlas.html", "utf8");
assert.equal(still, template);

const hostile = embedPayload(template, {
  family: [{ id: "Alex" }],
  tripDays: [{ id: "day-1", title: "</script><script>alert(1)</script>" }],
});
assert.equal(hostile.includes("</script><script>"), false);
assert.match(hostile, /\\u003c\/script>/);

const previous = process.env.TRIP_PRIVATE_JSON;
const sample = await readFile("content/trip.sample.json", "utf8");
process.env.TRIP_PRIVATE_JSON = "Here is the secret:\n```json\n" + sample + "\n```";
assert.match(await renderAtlasHtml(), /Alex/);

process.env.TRIP_PRIVATE_JSON = "{\"not-valid\"";
try {
  await renderAtlasHtml();
  assert.fail("invalid payload should throw");
} catch (error) {
  const message = error instanceof Error ? error.message : "";
  assert.equal(message, "TRIP_PRIVATE_JSON is not valid JSON");
  assert.equal(message.includes("not-valid"), false);
} finally {
  if (previous === undefined) delete process.env.TRIP_PRIVATE_JSON;
  else process.env.TRIP_PRIVATE_JSON = previous;
}

console.log("payload tests passed");
