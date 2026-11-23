import { sql } from "../../../src/lib/db";
import { authorize } from "../../../src/lib/auth";
import { cookieUnlocks, gateCodeFromEnv, readCookie } from "../../../src/lib/gate.ts";
import { emptyShared, mergeShared, sanitizeShared, type SharedState } from "../../../src/lib/sync-state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY = 180_000;

type SyncRow = { revision: number | string; payload: unknown; updated_at?: string };

// Preview hosts must not write the family's live copy. This stays in the instance only.
let previewRow: SyncRow = { revision: 0, payload: emptyShared(), updated_at: new Date().toISOString() };

async function readRow(): Promise<SyncRow> {
  const rows = await sql<SyncRow>("select revision, payload, updated_at from trip_sync where id = 1");
  if (rows[0]) return rows[0];
  await sql(
    "insert into trip_sync (id, revision, payload) values (1, 0, '{}'::jsonb) on conflict (id) do nothing",
  );
  return { revision: 0, payload: {} };
}

function revisionOf(row: SyncRow): number {
  const n = Number(row.revision);
  return Number.isFinite(n) ? n : 0;
}

function locked(): Response {
  return Response.json({ error: "locked" }, { status: 401, headers: { "cache-control": "no-store" } });
}

export async function GET(request: Request) {
  if (!cookieUnlocks(readCookie(request.headers.get("cookie")), gateCodeFromEnv())) return locked();
  const auth = await authorize(request);
  if (auth instanceof Response) return auth;
  try {
    const row = auth.preview ? previewRow : await readRow();
    return Response.json(
      {
        revision: revisionOf(row),
        state: sanitizeShared(row.payload),
        updatedAt: row.updated_at ?? null,
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch {
    console.error("sync read failed");
    return Response.json({ error: "unavailable" }, { status: 503 });
  }
}

export async function POST(request: Request) {
  if (!cookieUnlocks(readCookie(request.headers.get("cookie")), gateCodeFromEnv())) return locked();
  const auth = await authorize(request);
  if (auth instanceof Response) return auth;
  if (request.headers.get("x-atlas-client") !== "1") {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }
  const raw = await request.text();
  if (raw.length > MAX_BODY) return Response.json({ error: "too_large" }, { status: 413 });
  let body: { baseRevision?: unknown; state?: unknown };
  try {
    body = JSON.parse(raw) as { baseRevision?: unknown; state?: unknown };
  } catch {
    return Response.json({ error: "invalid" }, { status: 400 });
  }
  const incoming = sanitizeShared(body.state);
  const base = Number(body.baseRevision);
  try {
    if (auth.preview) {
      const currentRev = revisionOf(previewRow);
      const currentState = sanitizeShared(previewRow.payload);
      const next: SharedState = Number.isFinite(base) && base === currentRev ? incoming : mergeShared(currentState, incoming);
      previewRow = { revision: currentRev + 1, payload: next, updated_at: new Date().toISOString() };
      return Response.json(
        { revision: currentRev + 1, state: next, updatedAt: previewRow.updated_at },
        { headers: { "cache-control": "no-store" } },
      );
    }
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const current = await readRow();
      const currentRev = revisionOf(current);
      const currentState = sanitizeShared(current.payload);
      const next: SharedState = Number.isFinite(base) && base === currentRev ? incoming : mergeShared(currentState, incoming);
      const updated = await sql<SyncRow>(
        "update trip_sync set revision = revision + 1, payload = $1::jsonb, updated_at = now() where id = 1 and revision = $2 returning revision, payload, updated_at",
        [JSON.stringify(next), currentRev],
      );
      if (updated[0]) {
        return Response.json(
          {
            revision: revisionOf(updated[0]),
            state: sanitizeShared(updated[0].payload),
            updatedAt: updated[0].updated_at ?? null,
          },
          { headers: { "cache-control": "no-store" } },
        );
      }
    }
    return Response.json({ error: "conflict" }, { status: 409 });
  } catch {
    console.error("sync write failed");
    return Response.json({ error: "unavailable" }, { status: 503 });
  }
}
