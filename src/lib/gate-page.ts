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
      document.documentElement.classList.add("has-js");
      try {
        var saved = localStorage.getItem("atlas-theme");
        var dark = saved === "dark" || (saved !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches);
        if (dark) document.documentElement.classList.add("theme-dark");
      } catch (e) {}
    })();
  </script>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content">
  <title>Prague Time</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,500;0,9..144,600;0,9..144,700;1,9..144,500&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    :root { color-scheme: light; --parchment: #fcfaf6; --ink: #141923; --muted: #3d4654; --garnet: #b8293d; --garnet-deep: #9e2032; --linden: #245c46; --pilsner: #c97a1e; --line: rgba(20, 25, 35, 0.14); --cell: #ffffff; --display: "Fraunces", Georgia, "Times New Roman", serif; --body: "Plus Jakarta Sans", system-ui, -apple-system, "Segoe UI", sans-serif; }
    * { box-sizing: border-box; }
    html { background: #efe9df; }
    body { margin: 0; min-height: 100vh; min-height: 100dvh; display: grid; place-items: center; color: var(--ink); font-family: var(--body); -webkit-text-size-adjust: 100%; padding: max(1rem, env(safe-area-inset-top)) max(1rem, env(safe-area-inset-right)) max(1rem, env(safe-area-inset-bottom)) max(1rem, env(safe-area-inset-left)); background:
      radial-gradient(36rem 26rem at 8% -6%, rgba(184, 41, 61, 0.13), transparent 70%),
      radial-gradient(34rem 28rem at 100% 104%, rgba(36, 92, 70, 0.14), transparent 70%),
      radial-gradient(circle at 1px 1px, rgba(20, 25, 35, 0.07) 1px, transparent 1.5px) 0 0 / 22px 22px,
      #efe9df; background-attachment: fixed; }
    main { width: 100%; max-width: 23rem; background: var(--parchment); border: 1px solid var(--line); border-radius: 1.6rem; padding: 1.5rem 1.4rem; box-shadow: 0 1.2rem 2.6rem -0.8rem rgba(60, 45, 25, 0.28), 0 0.15rem 0.4rem rgba(60, 45, 25, 0.08); }
    .brand { display: flex; align-items: center; gap: 0.85rem; }
    .sticker { flex: none; width: 4.1rem; height: 4.1rem; border-radius: 1.2rem; background: #fff7d6; border: 2px solid #f0d98a; display: grid; place-items: center; transform: rotate(-4deg); box-shadow: 0 0.35rem 0.8rem -0.3rem rgba(120, 85, 20, 0.45); }
    .sticker img { width: 3.2rem; height: 3.2rem; object-fit: contain; display: block; filter: drop-shadow(0 1px 0 rgba(255, 255, 255, 0.9)); }
    h1 { font-family: var(--display); font-weight: 700; font-size: 2rem; line-height: 1.05; letter-spacing: -0.01em; margin: 0; }
    .tagline { margin: 0.2rem 0 0; font-size: 0.8rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--garnet); }
    .lede { margin: 1.15rem 0 0; color: var(--muted); font-size: 1rem; line-height: 1.5; }
    form { display: grid; gap: 0.8rem; margin-top: 1.2rem; }
    label { font-size: 0.8rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--linden); }
    .code-wrap { position: relative; }
    .code-cells { display: none; gap: 0.6rem; }
    .code-cell { flex: 1; height: 3.9rem; min-width: 0; display: grid; place-items: center; font-family: var(--display); font-weight: 600; font-size: 2rem; line-height: 1; background: var(--cell); border: 1.5px solid rgba(20, 25, 35, 0.28); border-radius: 1rem; transition: border-color 0.12s, box-shadow 0.12s, background-color 0.12s; }
    .code-cell.is-filled { border-color: var(--ink); }
    .code-wrap:focus-within .code-cell.is-active { border-color: var(--garnet); box-shadow: 0 0 0 3px rgba(184, 41, 61, 0.22); }
    #gate-code { display: block; width: 100%; min-height: 3.5rem; font: 600 1.5rem/1 var(--display); letter-spacing: 0.5em; text-align: center; color: var(--ink); background: var(--cell); border: 1.5px solid rgba(20, 25, 35, 0.28); border-radius: 1rem; padding: 0.7rem 0.8rem 0.7rem calc(0.8rem + 0.5em); -webkit-appearance: none; appearance: none; }
    #gate-code:focus-visible { outline: 3px solid rgba(184, 41, 61, 0.35); outline-offset: 2px; border-color: var(--garnet); }
    html.has-js .code-cells { display: flex; }
    html.has-js #gate-code { position: absolute; inset: 0; height: 100%; opacity: 0; font-size: 1.25rem; letter-spacing: 0; padding: 0; caret-color: transparent; cursor: text; outline: none; }
    #gate-code[aria-invalid="true"] ~ .code-cells .code-cell, .code-wrap.has-error .code-cell { border-color: var(--garnet); }
    button[type="submit"] { font: inherit; font-weight: 800; font-size: 1.05rem; letter-spacing: 0.01em; border: 0; border-radius: 1rem; min-height: 3.25rem; padding: 0.75rem 1rem; background: var(--garnet); color: #fff; touch-action: manipulation; cursor: pointer; box-shadow: 0 0.5rem 1rem -0.45rem rgba(158, 32, 50, 0.8); transition: background-color 0.12s, transform 0.08s; }
    button[type="submit"]:hover { background: var(--garnet-deep); }
    button[type="submit"]:active { transform: translateY(1px); }
    button[type="submit"]:disabled { opacity: 0.7; cursor: progress; }
    button:focus-visible { outline: 3px solid var(--ink); outline-offset: 3px; }
    #gate-error { margin: -0.1rem 0; min-height: 1.25rem; color: var(--garnet-deep); font-size: 0.9rem; font-weight: 700; line-height: 1.25rem; text-align: center; }
    #themeToggle { position: fixed; top: max(0.75rem, env(safe-area-inset-top)); right: max(0.75rem, env(safe-area-inset-right)); width: 2.75rem; height: 2.75rem; padding: 0; display: grid; place-items: center; border-radius: 50%; background: var(--parchment); color: var(--ink); border: 1px solid var(--line); box-shadow: 0 0.3rem 0.8rem -0.4rem rgba(60, 45, 25, 0.5); cursor: pointer; touch-action: manipulation; }
    #themeToggle svg { width: 1.3rem; height: 1.3rem; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
    #themeToggle .icon-sun { display: none; }
    html.theme-dark { color-scheme: dark; background: #0e1218; }
    html.theme-dark body { color: #f4efe6; background:
      radial-gradient(36rem 26rem at 8% -6%, rgba(184, 41, 61, 0.2), transparent 70%),
      radial-gradient(34rem 28rem at 100% 104%, rgba(143, 212, 176, 0.1), transparent 70%),
      radial-gradient(circle at 1px 1px, rgba(255, 255, 255, 0.06) 1px, transparent 1.5px) 0 0 / 22px 22px,
      #0e1218; background-attachment: fixed; }
    html.theme-dark main { background: #1b2230; border-color: rgba(255, 255, 255, 0.12); box-shadow: 0 1.2rem 2.6rem -0.8rem rgba(0, 0, 0, 0.7); }
    html.theme-dark .lede { color: #c5ceda; }
    html.theme-dark .tagline { color: #f3a8b4; }
    html.theme-dark label { color: #8fd4b0; }
    html.theme-dark .code-cell, html.theme-dark #gate-code { background: #151b26; color: #f4efe6; border-color: rgba(255, 255, 255, 0.24); }
    html.theme-dark .code-cell.is-filled { border-color: #f4efe6; }
    html.theme-dark .code-wrap:focus-within .code-cell.is-active { border-color: #f3a8b4; box-shadow: 0 0 0 3px rgba(243, 168, 180, 0.25); }
    html.theme-dark #gate-code[aria-invalid="true"] ~ .code-cells .code-cell, html.theme-dark .code-wrap.has-error .code-cell { border-color: #f3a8b4; }
    html.theme-dark button[type="submit"] { background: #c9364b; box-shadow: none; }
    html.theme-dark button[type="submit"]:hover { background: #d8475c; }
    html.theme-dark button:focus-visible { outline-color: #f4efe6; }
    html.theme-dark #gate-error { color: #f3a8b4; }
    html.theme-dark #themeToggle { background: #1b2230; color: #f4efe6; border-color: rgba(255, 255, 255, 0.2); box-shadow: none; }
    html.theme-dark #themeToggle .icon-moon { display: none; }
    html.theme-dark #themeToggle .icon-sun { display: block; }
    html.theme-dark .sticker { background: #2a2a1c; border-color: #6d5b22; box-shadow: none; }
    @media (prefers-reduced-motion: no-preference) {
      @keyframes sticker-in { from { opacity: 0; transform: rotate(-14deg) scale(0.7); } to { opacity: 1; transform: rotate(-4deg) scale(1); } }
      @keyframes shake { 20%, 60% { transform: translateX(-6px); } 40%, 80% { transform: translateX(6px); } }
      .sticker { animation: sticker-in 0.45s cubic-bezier(0.2, 1.3, 0.4, 1) both; }
      .code-wrap.shake { animation: shake 0.32s; }
    }
    @media (prefers-reduced-motion: reduce) { * { scroll-behavior: auto; transition: none !important; } }
    @media (max-width: 22rem) { h1 { font-size: 1.75rem; } .code-cells { gap: 0.45rem; } .code-cell { height: 3.5rem; } }
  </style>
</head>
<body>
  <button type="button" id="themeToggle" aria-pressed="false" aria-label="Use dark mode">
    <svg class="icon-moon" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>
    <svg class="icon-sun" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>
  </button>
  <main>
    <div class="brand">
      <div class="sticker"><img src="guides/krtek.png" alt="" width="426" height="512" decoding="async"></div>
      <div>
        <h1>Prague Time</h1>
        <p class="tagline">Trip atlas</p>
      </div>
    </div>
    <p class="lede">Enter the 4-digit code to open this trip.</p>
    <form id="gate-form" method="post" action="">
      <label for="gate-code">4-digit code</label>
      <div class="code-wrap" id="code-wrap">
        <input id="gate-code" name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{4}" minlength="4" maxlength="4" required autofocus aria-describedby="gate-error"${options.failed ? ' aria-invalid="true"' : ""}>
        <div class="code-cells" aria-hidden="true"><span class="code-cell"></span><span class="code-cell"></span><span class="code-cell"></span><span class="code-cell"></span></div>
      </div>
      <p id="gate-error" role="alert">${error}</p>
      <button type="submit" id="gate-submit">Unlock</button>
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
    const submit = document.getElementById("gate-submit");
    const wrap = document.getElementById("code-wrap");
    const cells = Array.from(wrap.querySelectorAll(".code-cell"));
    let busy = false;
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

    function paintCells() {
      const value = input.value;
      const focused = document.activeElement === input;
      cells.forEach((cell, i) => {
        cell.textContent = value.charAt(i);
        cell.classList.toggle("is-filled", i < value.length);
        cell.classList.toggle("is-active", focused && i === Math.min(value.length, cells.length - 1));
      });
    }

    function clearError() {
      error.textContent = "";
      input.removeAttribute("aria-invalid");
      wrap.classList.remove("has-error");
    }

    function fail() {
      error.textContent = "";
      setTimeout(() => { error.textContent = "That code didn't work."; }, 40);
      input.setAttribute("aria-invalid", "true");
      wrap.classList.add("has-error");
      wrap.classList.remove("shake");
      void wrap.offsetWidth;
      wrap.classList.add("shake");
      input.value = "";
      paintCells();
      input.focus();
    }

    function setBusy(next) {
      busy = next;
      submit.disabled = next;
      submit.textContent = next ? "Unlocking\\u2026" : "Unlock";
    }

    function holdCaretAtEnd() {
      const end = input.value.length;
      input.setSelectionRange(end, end);
    }

    input.addEventListener("input", () => {
      const digits = input.value.replace(/\\D/g, "").slice(0, 4);
      if (digits !== input.value) input.value = digits;
      if (error.textContent) clearError();
      paintCells();
      if (digits.length === 4 && !busy && typeof form.requestSubmit === "function") form.requestSubmit();
    });
    input.addEventListener("paste", (event) => {
      const text = (event.clipboardData && event.clipboardData.getData("text")) || "";
      const digits = text.replace(/\\D/g, "").slice(0, 4);
      if (!digits) return;
      event.preventDefault();
      input.value = digits;
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    input.addEventListener("focus", () => { paintCells(); holdCaretAtEnd(); });
    input.addEventListener("blur", paintCells);
    input.addEventListener("click", holdCaretAtEnd);
    input.addEventListener("keyup", holdCaretAtEnd);
    wrap.addEventListener("animationend", () => wrap.classList.remove("shake"));
    if (input.getAttribute("aria-invalid") === "true") wrap.classList.add("has-error");
    paintCells();

    form.addEventListener("submit", async (event) => {
      if (!sealed) return;
      event.preventDefault();
      if (busy) return;
      const code = input.value.trim();
      if (!/^\\d{4}$/.test(code)) {
        fail();
        return;
      }
      setBusy(true);
      try {
        const rawKey = await deriveBits(code, base64UrlToBytes(sealed).slice(0, 16));
        await unlockWithKey(rawKey, true);
      } catch (cause) {
        setBusy(false);
        fail();
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
