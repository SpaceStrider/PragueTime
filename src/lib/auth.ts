import { timingSafeEqual } from "node:crypto";
import { getIdentity } from "../../cursor/identity";

export async function authorize(request: Request): Promise<Response | { ok: true; preview: boolean }> {
  if (!sameSite(request)) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }
  const identity = await getIdentity(request);
  if (identity.verified) return { ok: true, preview: identity.stage === "preview" };

  const expected = process.env.FAMILY_PIN?.trim() ?? "";
  const given = request.headers.get("x-family-pin")?.trim() ?? "";
  if (expected !== "" && given !== "" && pinsMatch(given, expected)) return { ok: true, preview: false };
  return Response.json({ error: "pin_required" }, { status: 401 });
}

function sameSite(request: Request): boolean {
  const site = request.headers.get("sec-fetch-site");
  if (site === "cross-site") return false;
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  try {
    return !!host && new URL(origin).host === host;
  } catch {
    return false;
  }
}

function pinsMatch(given: string, expected: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
