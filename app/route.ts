import { cookieHeader, cookieUnlocks, codesMatch, gateCodeFromEnv, readCookie, requestIsSecure, sealCookie } from "../src/lib/gate.ts";
import { gatePage } from "../src/lib/gate-page.ts";
import { renderAtlasHtml } from "../src/lib/trip-payload.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const htmlHeaders = {
  "content-type": "text/html; charset=utf-8",
  "cache-control": "private, no-store",
};

function gateResponse(failed: boolean): Response {
  return new Response(gatePage({ failed }), {
    status: failed ? 401 : 200,
    headers: htmlHeaders,
  });
}

async function submittedCode(request: Request): Promise<string> {
  const type = request.headers.get("content-type") ?? "";
  if (type.includes("application/json")) {
    const body = (await request.json().catch(() => null)) as { code?: unknown } | null;
    return typeof body?.code === "string" ? body.code.trim() : "";
  }
  const form = await request.formData();
  const value = form.get("code");
  return typeof value === "string" ? value.trim() : "";
}

export async function GET(request: Request) {
  const code = gateCodeFromEnv();
  if (!cookieUnlocks(readCookie(request.headers.get("cookie")), code)) {
    return gateResponse(false);
  }
  try {
    const html = await renderAtlasHtml();
    return new Response(html, { headers: htmlHeaders });
  } catch {
    console.error("atlas render failed");
    return new Response("Trip page unavailable", { status: 503, headers: { "cache-control": "no-store" } });
  }
}

export async function POST(request: Request) {
  const expected = gateCodeFromEnv();
  const supplied = await submittedCode(request);
  if (!expected || !codesMatch(supplied, expected)) {
    return gateResponse(true);
  }
  const url = new URL(request.url);
  return new Response(null, {
    status: 303,
    headers: {
      location: url.pathname || "/",
      "set-cookie": cookieHeader(sealCookie(expected), requestIsSecure(request)),
      "cache-control": "no-store",
    },
  });
}
