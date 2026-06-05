/* ui.js, presentation helpers: toasts, modals (focus-trapped), theme, scroll-reveal, count-up, confetti, time + escaping. */

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* Escaping */
export function escapeHtml(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/* Toasts */
export function toast(message, type = "info", ms = 3200) {
  const region = document.getElementById("toast-region");
  if (!region) return;
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.setAttribute("role", type === "error" ? "alert" : "status");
  el.innerHTML = `<span>${escapeHtml(message)}</span>`;
  region.appendChild(el);
  const kill = () => {
    el.classList.add("leaving");
    el.addEventListener("animationend", () => el.remove(), { once: true });
  };
  setTimeout(kill, ms);
}

/* Confetti */
let _confetti = null;
function confettiFn() {
  if (_confetti) return _confetti;
  const c = globalThis.confetti;
  // Non-worker instance so a strict `worker-src 'self'` CSP isn't violated
  // (the default global confetti spawns a blob: Web Worker).
  _confetti = c && c.create ? c.create(undefined, { useWorker: false, resize: true }) : c;
  return _confetti;
}

export function celebrate() {
  if (reduceMotion || typeof globalThis.confetti !== "function") return;
  const fire = confettiFn();
  const colors = ["#2acfcf", "#3a3054", "#f5605a", "#9b87f5"];
  fire({ particleCount: 90, spread: 70, origin: { y: 0.35 }, colors });
  setTimeout(() => fire({ particleCount: 50, angle: 60, spread: 55, origin: { x: 0 }, colors }), 150);
  setTimeout(() => fire({ particleCount: 50, angle: 120, spread: 55, origin: { x: 1 }, colors }), 150);
}

/* Theme */
export function initTheme() {
  const saved = localStorage.getItem("shortly.theme");
  const theme = saved || (window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
  applyTheme(theme);
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  const btn = document.getElementById("theme-toggle");
  if (btn) {
    // stable action label in the HTML; aria-pressed conveys state (pressed = dark active)
    btn.setAttribute("aria-pressed", String(theme === "dark"));
  }
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", theme === "light" ? "#f8f7fc" : "#16131c");
}

export function toggleTheme() {
  const next = document.documentElement.getAttribute("data-theme") === "light" ? "dark" : "light";
  localStorage.setItem("shortly.theme", next);
  applyTheme(next);
}

/* Scroll reveal */
export function initReveal() {
  const els = document.querySelectorAll("[data-reveal]");
  if (reduceMotion || !("IntersectionObserver" in window)) {
    els.forEach((el) => el.classList.add("is-visible"));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add("is-visible");
          io.unobserve(e.target);
        }
      });
    },
    { threshold: 0.12 }
  );
  els.forEach((el) => io.observe(el));
}

/* Count-up */
export function countUp(el, target) {
  target = Number(target) || 0;
  if (el._countRaf) cancelAnimationFrame(el._countRaf); // cancel any in-flight count
  if (reduceMotion) {
    el.textContent = target.toLocaleString();
    el.dataset.current = String(target);
    return;
  }
  const start = Number(el.dataset.current || 0);
  const dur = 900;
  const t0 = performance.now();
  function tick(now) {
    const p = Math.min(1, (now - t0) / dur);
    const eased = 1 - Math.pow(1 - p, 3);
    const val = Math.round(start + (target - start) * eased);
    el.textContent = val.toLocaleString();
    if (p < 1) {
      el._countRaf = requestAnimationFrame(tick);
    } else {
      el.dataset.current = String(target);
      el._countRaf = null;
    }
  }
  el._countRaf = requestAnimationFrame(tick);
}

/* Modals (focus-trapped, Escape + backdrop to close) */
let lastFocused = null;
const BG_LANDMARKS = ".site-header, main, .site-footer";

function setBackgroundInert(on) {
  document.querySelectorAll(BG_LANDMARKS).forEach((el) => {
    if (on) {
      el.setAttribute("inert", "");
      el.setAttribute("aria-hidden", "true");
    } else {
      el.removeAttribute("inert");
      el.removeAttribute("aria-hidden");
    }
  });
}

export function openModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  lastFocused = document.activeElement;
  modal.hidden = false;
  document.body.style.overflow = "hidden";
  setBackgroundInert(true); // hide page content from AT + focus while dialog is open
  const focusable = getFocusable(modal);
  (focusable[0] || modal.querySelector(".modal-close"))?.focus();
  if (modal._keyHandler) modal.removeEventListener("keydown", modal._keyHandler); // avoid double-bind
  modal._keyHandler = (e) => trapKeys(e, modal, id);
  modal.addEventListener("keydown", modal._keyHandler);
}

/** Re-point where the open modal returns focus on close (e.g. its trigger was re-rendered). */
export function setReturnFocus(el) {
  if (el) lastFocused = el;
}

export function closeModal(id) {
  const modal = document.getElementById(id);
  if (!modal || modal.hidden) return;
  modal.hidden = true;
  document.body.style.overflow = "";
  if (modal._keyHandler) modal.removeEventListener("keydown", modal._keyHandler);
  setBackgroundInert(false); // restore page before returning focus to it
  if (lastFocused && document.contains(lastFocused)) lastFocused.focus();
}

function getFocusable(root) {
  return [
    ...root.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'
    ),
  ].filter((el) => el.offsetParent !== null);
}

function trapKeys(e, modal, id) {
  if (e.key === "Escape") {
    closeModal(id);
    return;
  }
  if (e.key !== "Tab") return;
  const f = getFocusable(modal);
  if (!f.length) return;
  const first = f[0];
  const last = f[f.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

export function wireModalClosers() {
  document.querySelectorAll(".modal").forEach((modal) => {
    modal.querySelectorAll("[data-close]").forEach((btn) => {
      btn.addEventListener("click", () => closeModal(modal.id));
    });
  });
}

/* Misc helpers */
export function relativeTime(ts) {
  const diff = Date.now() - ts;
  const s = Math.floor(diff / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(ts).toLocaleDateString();
}

export function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export const prefersReducedMotion = reduceMotion;
