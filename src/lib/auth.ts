import { getIdentity } from "../../cursor/identity";

export async function authorize(request: Request): Promise<Response | { ok: true; preview: boolean }> {
  if (!sameSite(request)) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }
  const identity = await getIdentity(request);
  if (identity.verified && identity.stage === "preview") return { ok: true, preview: true };
  return { ok: true, preview: false };
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
