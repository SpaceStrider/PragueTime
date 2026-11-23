import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { GET, POST } from "../app/route.ts";
import { cookieUnlocks, openSealed } from "../src/lib/gate.ts";
import { renderPublishedHtml } from "../src/lib/publish-site.ts";

const previous = process.env.TRIP_GATE_CODE;
delete process.env.TRIP_GATE_CODE;

const locked = await GET(new Request("http://127.0.0.1/"));
const lockedHtml = await locked.text();
assert.equal(locked.status, 200);
assert.equal(lockedHtml.includes("Sample arrival"), false);
assert.match(lockedHtml, /4-digit code/);

const missing = await POST(new Request("http://127.0.0.1/", {
  method: "POST",
  headers: { "content-type": "application/x-www-form-urlencoded" },
  body: "code=0000",
}));
assert.equal(missing.status, 401);
assert.equal((await missing.text()).includes("Sample arrival"), false);
assert.equal(missing.headers.get("set-cookie"), null);

const fixture = String(1000 + (crypto.getRandomValues(new Uint16Array(1))[0] % 9000));
const wrongDigits = fixture === "9999" ? "9998" : "9999";
process.env.TRIP_GATE_CODE = fixture;

const wrong = await POST(new Request("http://127.0.0.1/", {
  method: "POST",
  headers: { "content-type": "application/x-www-form-urlencoded" },
  body: `code=${wrongDigits}`,
}));
const wrongHtml = await wrong.text();
assert.equal(wrong.status, 401);
assert.match(wrongHtml, /That code didn't work/);
assert.equal(wrongHtml.includes("Sample arrival"), false);
assert.equal(wrongHtml.includes(wrongDigits), false);
assert.equal(wrong.headers.get("set-cookie"), null);

const right = await POST(new Request("http://127.0.0.1/", {
  method: "POST",
  headers: { "content-type": "application/x-www-form-urlencoded" },
  body: `code=${fixture}`,
}));
assert.equal(right.status, 303);
assert.equal(right.headers.get("location"), "/");
const setCookie = right.headers.get("set-cookie") ?? "";
const token = setCookie.split(";")[0]?.split("=").slice(1).join("=") ?? "";
assert.equal(setCookie.includes("HttpOnly"), true);
assert.equal(setCookie.includes("SameSite=Lax"), true);
assert.equal(setCookie.includes("Max-Age=2592000"), true);
assert.equal(setCookie.includes("Secure"), false);
assert.equal(token.split(".").includes(fixture), false);
assert.equal(token.split(".").length, 3);

const opened = await GET(new Request("http://127.0.0.1/", { headers: { cookie: `trip_gate=${token}` } }));
const openedHtml = await opened.text();
assert.equal(opened.status, 200);
assert.match(openedHtml, /Sample arrival/);

const tampered = `${token.slice(0, -1)}${token.endsWith("a") ? "b" : "a"}`;
assert.equal(cookieUnlocks(tampered, fixture), false);
const stillLocked = await GET(new Request("http://127.0.0.1/", { headers: { cookie: `trip_gate=${tampered}` } }));
assert.equal((await stillLocked.text()).includes("Sample arrival"), false);

const secure = await POST(new Request("http://127.0.0.1/", {
  method: "POST",
  headers: {
    "content-type": "application/x-www-form-urlencoded",
    "x-forwarded-proto": "https",
  },
  body: `code=${fixture}`,
}));
assert.equal((secure.headers.get("set-cookie") ?? "").includes("Secure"), true);

delete process.env.TRIP_GATE_CODE;
const syncSource = await readFile("app/api/sync/route.ts", "utf8");
const gateLine = 'if (!cookieUnlocks(readCookie(request.headers.get("cookie")), gateCodeFromEnv())) return locked();';
assert.equal(syncSource.split(gateLine).length, 3);
const publishedLocked = await renderPublishedHtml();
assert.equal(publishedLocked.includes("Sample arrival"), false);
assert.equal(publishedLocked.includes("gate-sealed"), true);

process.env.TRIP_GATE_CODE = fixture;
const published = await renderPublishedHtml();
assert.equal(published.includes("Sample arrival"), false);
assert.equal(published.includes("/^\\d{4}$/"), true);
const sealed = published.match(/id="gate-sealed"[^>]*>([^<]*)</)?.[1]?.trim() ?? "";
assert.notEqual(sealed, "");
assert.equal(sealed.includes(fixture), false);
const plain = await openSealed(sealed, fixture);
assert.match(plain, /Sample arrival/);
await assert.rejects(() => openSealed(sealed, wrongDigits));

if (previous === undefined) delete process.env.TRIP_GATE_CODE;
else process.env.TRIP_GATE_CODE = previous;

console.log("gate tests passed");
