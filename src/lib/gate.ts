import { createHmac, timingSafeEqual } from "node:crypto";

export const GATE_COOKIE = "trip_gate";
export const GATE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
export const GATE_KDF_ITERATIONS = 120_000;

export function gateCodeFromEnv(): string | null {
  const raw = process.env.TRIP_GATE_CODE?.trim() ?? "";
  return /^\d{4}$/.test(raw) ? raw : null;
}

export function codesMatch(supplied: string, expected: string | null): boolean {
  if (!expected || !/^\d{4}$/.test(supplied)) return false;
  return timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));
}

export function sealCookie(code: string, now = Date.now()): string {
  const exp = now + GATE_MAX_AGE_SECONDS * 1000;
  const mac = createHmac("sha256", code).update(`v1.${exp}`).digest("base64url");
  return `v1.${exp}.${mac}`;
}

export function cookieUnlocks(token: string | null, code: string | null, now = Date.now()): boolean {
  if (!token || !code) return false;
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "v1") return false;
  const exp = Number(parts[1]);
  if (!Number.isFinite(exp) || exp <= now) return false;
  const expected = createHmac("sha256", code).update(`v1.${parts[1]}`).digest("base64url");
  const actual = Buffer.from(parts[2]);
  const want = Buffer.from(expected);
  if (actual.length !== want.length) return false;
  return timingSafeEqual(actual, want);
}

export function readCookie(header: string | null, name = GATE_COOKIE): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    if (trimmed.slice(0, eq) === name) return trimmed.slice(eq + 1);
  }
  return null;
}

export function requestIsSecure(request: Request): boolean {
  const forwarded = request.headers.get("x-forwarded-proto");
  if (forwarded) return forwarded.split(",")[0]?.trim() === "https";
  return new URL(request.url).protocol === "https:";
}

export function cookieHeader(token: string, secure: boolean): string {
  const parts = [
    `${GATE_COOKIE}=${token}`,
    `Max-Age=${GATE_MAX_AGE_SECONDS}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function bufferSource(bytes: Uint8Array): ArrayBuffer {
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  return copy;
}

function base64UrlToBytes(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (value.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function deriveBits(code: string, salt: Uint8Array): Promise<Uint8Array> {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(code),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: bufferSource(salt), iterations: GATE_KDF_ITERATIONS, hash: "SHA-256" },
    material,
    256,
  );
  return new Uint8Array(bits);
}

export async function sealAtlas(html: string, code: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const rawKey = await deriveBits(code, salt);
  const key = await crypto.subtle.importKey("raw", bufferSource(rawKey), "AES-GCM", false, ["encrypt"]);
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(html)));
  const packed = new Uint8Array(salt.length + iv.length + cipher.length);
  packed.set(salt, 0);
  packed.set(iv, salt.length);
  packed.set(cipher, salt.length + iv.length);
  return bytesToBase64Url(packed);
}

export async function openSealed(sealed: string, code: string): Promise<string> {
  const packed = base64UrlToBytes(sealed);
  if (packed.length < 29) throw new Error("sealed trip is incomplete");
  const salt = packed.slice(0, 16);
  const iv = packed.slice(16, 28);
  const cipher = packed.slice(28);
  const rawKey = await deriveBits(code, salt);
  const key = await crypto.subtle.importKey("raw", bufferSource(rawKey), "AES-GCM", false, ["decrypt"]);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, cipher);
  return new TextDecoder().decode(plain);
}
