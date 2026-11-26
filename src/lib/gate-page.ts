import { GATE_KDF_ITERATIONS, GATE_MAX_AGE_SECONDS } from "./gate.ts";

export function gatePage(options: { failed: boolean; sealed?: string }): string {
  const sealed = options.sealed ?? "";
  if (sealed !== "" && !/^[A-Za-z0-9_-]+$/.test(sealed)) {
    throw new Error("sealed trip contains unexpected characters");
  }
  const error = options.failed ? "That code didn't work." : "";
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <script>
    (function () {
      try {
        var saved = localStorage.getItem("atlas-theme");
        var dark = saved === "dark" || (saved !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches);
        if (dark) document.documentElement.classList.add("theme-dark");
      } catch (e) {}
    })();
  </script>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content">
  <title>Prague atlas</title>
  <style>
    :root { color-scheme: light; }
    body { margin: 0; min-height: 100vh; min-height: 100dvh; display: grid; place-items: center; background: #141923; color: #141923; font-family: "Segoe UI", sans-serif; padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left); }
    main { width: min(22rem, calc(100% - 2rem)); background: #fcfaf6; border-radius: 1.4rem; padding: 1.5rem; }
    h1 { font-size: 1.6rem; line-height: 1.2; margin: 0 0 0.4rem; }
    p { margin: 0; color: #3d4654; line-height: 1.5; }
    form { display: grid; gap: 0.7rem; margin-top: 1.1rem; }
    label { font-size: 0.85rem; font-weight: 700; }
    input { font: inherit; font-size: 1.125rem; letter-spacing: 0.3rem; padding: 0.7rem 0.8rem; border-radius: 0.8rem; border: 1px solid rgba(20, 25, 35, 0.35); }
    button { font: inherit; font-weight: 700; border: 0; border-radius: 0.8rem; min-height: 2.75rem; padding: 0.75rem 1rem; background: #b8293d; color: white; touch-action: manipulation; }
    button:focus-visible, input:focus-visible { outline: 2px solid #141923; outline-offset: 2px; }
    #gate-error { min-height: 1.2rem; color: #9e2032; font-weight: 700; }
    #themeToggle { position: fixed; top: max(0.75rem, env(safe-area-inset-top)); right: max(0.75rem, env(safe-area-inset-right)); min-width: 2.75rem; min-height: 2.75rem; padding: 0 0.8rem; background: #fcfaf6; color: #141923; border: 1px solid rgba(20, 25, 35, 0.2); }
    html.theme-dark { color-scheme: dark; }
    html.theme-dark body { background: #0e1218; }
    html.theme-dark main { background: #1b2230; color: #f4efe6; }
    html.theme-dark p { color: #c5ceda; }
    html.theme-dark input { background: #151b26; color: #f4efe6; border-color: rgba(255, 255, 255, 0.2); }
    html.theme-dark #gate-error { color: #f3a8b4; }
    html.theme-dark #themeToggle { background: #1b2230; color: #f4efe6; border-color: rgba(255, 255, 255, 0.2); }
    html.theme-dark button:focus-visible, html.theme-dark input:focus-visible { outline-color: #f4efe6; }
    @media (prefers-reduced-motion: reduce) { * { scroll-behavior: auto; } }
  </style>
</head>
<body>
  <button type="button" id="themeToggle" aria-pressed="false" aria-label="Use dark mode">Dark</button>
  <main>
    <h1>Prague atlas</h1>
    <p>Enter the 4-digit code to open this trip.</p>
    <form id="gate-form" method="post" action="">
      <label for="gate-code">4-digit code</label>
      <input id="gate-code" name="code" inputmode="numeric" autocomplete="off" pattern="[0-9]{4}" minlength="4" maxlength="4" required autofocus aria-describedby="gate-error"${options.failed ? ' aria-invalid="true"' : ""}>
      <button type="submit">Unlock</button>
      <p id="gate-error" role="alert">${error}</p>
    </form>
  </main>
  <textarea id="gate-sealed" hidden readonly>${sealed}</textarea>
  <script>
    const ITERATIONS = ${GATE_KDF_ITERATIONS};
    const MAX_AGE = ${GATE_MAX_AGE_SECONDS};
    const themeButton = document.getElementById("themeToggle");
    function paintThemeButton() {
      const dark = document.documentElement.classList.contains("theme-dark");
      themeButton.setAttribute("aria-pressed", dark ? "true" : "false");
      themeButton.setAttribute("aria-label", dark ? "Use light mode" : "Use dark mode");
      themeButton.textContent = dark ? "Light" : "Dark";
    }
    paintThemeButton();
    themeButton.addEventListener("click", () => {
      const dark = document.documentElement.classList.contains("theme-dark");
      document.documentElement.classList.toggle("theme-dark", !dark);
      try { localStorage.setItem("atlas-theme", dark ? "light" : "dark"); } catch (e) {}
      paintThemeButton();
    });

    const form = document.getElementById("gate-form");
    const input = document.getElementById("gate-code");
    const error = document.getElementById("gate-error");
    const sealed = (document.getElementById("gate-sealed").value || "").trim();

    function bytesToBase64Url(bytes) {
      let binary = "";
      for (const byte of bytes) binary += String.fromCharCode(byte);
      return btoa(binary).replace(/\\+/g, "-").replace(/\\//g, "_").replace(/=+$/g, "");
    }

    function base64UrlToBytes(value) {
      const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (value.length % 4)) % 4);
      const binary = atob(padded);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
      return bytes;
    }

    function cookiePath() {
      const path = location.pathname;
      const dir = path.endsWith("/") ? path : path.slice(0, path.lastIndexOf("/") + 1);
      return dir || "/";
    }

    function readRemembered() {
      const prefix = "trip_gate=";
      for (const part of document.cookie.split(";")) {
        const trimmed = part.trim();
        if (trimmed.startsWith(prefix)) return decodeURIComponent(trimmed.slice(prefix.length));
      }
      return "";
    }

    function remember(rawKey) {
      const exp = Date.now() + MAX_AGE * 1000;
      const value = exp + "." + bytesToBase64Url(rawKey);
      const secure = location.protocol === "https:" ? "; Secure" : "";
      document.cookie = "trip_gate=" + encodeURIComponent(value) + "; Max-Age=" + MAX_AGE + "; Path=" + cookiePath() + "; SameSite=Lax" + secure;
    }

    async function deriveBits(code, salt) {
      const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(code), "PBKDF2", false, ["deriveBits"]);
      const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: ITERATIONS, hash: "SHA-256" }, material, 256);
      return new Uint8Array(bits);
    }

    async function decrypt(rawKey, packed) {
      const iv = packed.slice(16, 28);
      const cipher = packed.slice(28);
      const key = await crypto.subtle.importKey("raw", rawKey, "AES-GCM", false, ["decrypt"]);
      const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, cipher);
      return new TextDecoder().decode(plain);
    }

    function show(html) {
      const render = () => {
        document.open();
        document.write(html);
        document.close();
      };
      // A refresh decrypts during the gate page's own load. Writing the trip
      // from inside that load handler replaces the document without firing the
      // trip page's load event, so the shell appears and the data never paints.
      if (document.readyState === "complete") render();
      else window.addEventListener("load", () => setTimeout(render, 0), { once: true });
    }

    async function unlockWithKey(rawKey, store) {
      const html = await decrypt(rawKey, base64UrlToBytes(sealed));
      if (store) remember(rawKey);
      show(html);
    }

    form.addEventListener("submit", async (event) => {
      if (!sealed) return;
      event.preventDefault();
      const code = input.value.trim();
      if (!/^\\d{4}$/.test(code)) {
        error.textContent = "That code didn't work.";
        input.setAttribute("aria-invalid", "true");
        return;
      }
      try {
        const rawKey = await deriveBits(code, base64UrlToBytes(sealed).slice(0, 16));
        await unlockWithKey(rawKey, true);
      } catch (cause) {
        error.textContent = "That code didn't work.";
        input.setAttribute("aria-invalid", "true");
      }
    });

    if (sealed) {
      const remembered = readRemembered();
      const split = remembered.split(".");
      const exp = Number(split[0]);
      if (split.length === 2 && Number.isFinite(exp) && exp > Date.now()) {
        unlockWithKey(base64UrlToBytes(split[1]), false).catch(() => {});
      }
    }
  </script>
</body>
</html>
`;
}
