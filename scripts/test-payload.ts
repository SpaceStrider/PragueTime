import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { embedPayload, renderAtlasHtml } from "../src/lib/trip-payload.ts";

const template = await readFile("content/atlas.html", "utf8");
assert.match(template, /\/\*__TRIP_PRIVATE_START__\*\/null\/\*__TRIP_PRIVATE_END__\*\//);
assert.equal(template.includes("user-scalable"), false);
assert.equal(template.includes("maximum-scale"), false);
assert.match(template, /Skip to the day list/);
assert.equal((template.match(/aria-label="Close"/g) || []).length, 3);
assert.match(template, /id="themeToggle"/);
assert.match(template, /atlas-theme/);
assert.match(template, /html\.theme-dark/);
assert.match(template, /\.text-coffee \{ color: #7A4B2A; \}/);
assert.match(template, /hover:bg-garnet-dark/);
assert.match(template, /Café', color: '#7A4B2A'/);
assert.equal((template.match(/@media \(prefers-color-scheme: dark\)/g) || []).length, 0);

const rendered = await renderAtlasHtml();
assert.match(rendered, /Alex/);
assert.match(rendered, /Example Lane 1/);
assert.equal(rendered.includes("/*__TRIP_PRIVATE_START__*/null/*__TRIP_PRIVATE_END__*/"), false);
assert.equal(rendered.includes("window.ATLAS_STATIC = true"), false);
assert.match(template, /window\.ATLAS_STATIC === true/);
const staticRendered = await renderAtlasHtml({ staticSite: true });
assert.match(staticRendered, /<head>\s*<script>window\.ATLAS_STATIC = true;<\/script>/);
assert.match(staticRendered, /Alex/);
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
