/* main.js, orchestration. Wires the UI to api/store/qr/ui. */

import { shorten, getStats } from "./api.js";
import * as store from "./store.js";
import { renderQR, downloadCanvas } from "./qr.js";
import {
  toast, celebrate, initTheme, toggleTheme, initReveal, countUp,
  openModal, wireModalClosers, relativeTime, setReturnFocus,
  hostOf, escapeHtml, prefersReducedMotion,
} from "./ui.js";

const $ = (sel, root = document) => root.querySelector(sel);
const MAX_BULK = 5;

/* Inline icons */
const ICON = {
  copy: '<svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18"><rect x="9" y="9" width="11" height="11" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
  check: '<svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18"><path d="M5 13l4 4L19 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  qr: '<svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M3 3h8v8H3V3Zm2 2v4h4V5H5Zm8-2h8v8h-8V3Zm2 2v4h4V5h-4ZM3 13h8v8H3v-8Zm2 2v4h4v-4H5Zm10-2h2v2h-2v-2Zm4 0h2v2h-2v-2Zm-4 4h2v2h-2v-2Zm2 2h2v2h-2v-2Zm2-2h2v2h-2v-2Z"/></svg>',
  stats: '<svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="6" y1="20" x2="6" y2="13"/><line x1="12" y1="20" x2="12" y2="6"/><line x1="18" y1="20" x2="18" y2="10"/></svg>',
  share: '<svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.6" y1="13.5" x2="15.4" y2="17.5"/><line x1="15.4" y1="6.5" x2="8.6" y2="10.5"/></svg>',
  trash: '<svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m2 0v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V7"/></svg>',
  ext: '<svg aria-hidden="true" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 4h6v6"/><path d="M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>',
  lock: '<svg aria-hidden="true" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
  timer: '<svg aria-hidden="true" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="13" r="8"/><path d="M12 9.5V13l2 1.5"/><path d="M9 2.5h6"/></svg>',
  edit: '<svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
};

/* URL validation */
function isValidUrl(v) {
  try {
    const u = new URL(v.trim());
    return (u.protocol === "http:" || u.protocol === "https:") && u.hostname.includes(".");
  } catch {
    return false;
  }
}

/* Render history */
function avatarFor(url) {
  const host = hostOf(url);
  const letter = (host[0] || "?").toUpperCase();
  let h = 0;
  for (let i = 0; i < host.length; i++) h = (h * 31 + host.charCodeAt(i)) >>> 0;
  return { letter, idx: h % 6 };
}

function cardHtml(l) {
  const av = avatarFor(l.original);
  const badges = [];
  if (l.hasPassword) badges.push(`<span class="link-badge lock" title="Password protected">${ICON.lock} locked</span>`);
  if (l.maxClicks) badges.push(`<span class="link-badge boom" title="Self-destructs">${ICON.timer} ${escapeHtml(String(l.maxClicks))}-click</span>`);
  badges.push(`<span class="link-badge">${escapeHtml(l.provider)}</span>`);

  // Live analytics only where it actually works: spoo.me, with a code, not password-locked.
  const statsBtn = l.provider === "spoo.me" && l.code && !l.hasPassword
    ? `<button class="icon-btn" data-action="stats" title="Live analytics" aria-label="Live analytics for ${escapeHtml(l.short)}">${ICON.stats}</button>`
    : "";

  const note = l.note
    ? `<button class="link-note" data-action="note" title="Edit note">${escapeHtml(l.note)}</button>`
    : "";

  return `
  <article class="link-card" data-id="${escapeHtml(String(l.id))}">
    <span class="link-favicon av${av.idx}" aria-hidden="true">${escapeHtml(av.letter)}</span>
    <div class="link-info">
      <a class="link-short" href="${escapeHtml(l.short)}" target="_blank" rel="noopener" data-action="open">
        ${escapeHtml(l.short.replace(/^https?:\/\//, ""))} ${ICON.ext}
      </a>
      <div class="link-orig" title="${escapeHtml(l.original)}">${escapeHtml(hostOf(l.original))}${escapeHtml(pathPreview(l.original))}</div>
      ${note}
      <div class="link-meta">
        <span data-created>${relativeTime(l.createdAt)}</span>
        ${badges.join("")}
      </div>
    </div>
    <div class="link-actions">
      <button class="icon-btn" data-action="copy" title="Copy" aria-label="Copy short link">${ICON.copy}</button>
      <button class="icon-btn" data-action="qr" title="QR code" aria-label="Show QR code">${ICON.qr}</button>
      ${statsBtn}
      <button class="icon-btn" data-action="note" title="${l.note ? "Edit note" : "Add note"}" aria-label="${l.note ? "Edit note" : "Add a note"}">${ICON.edit}</button>
      <button class="icon-btn" data-action="share" title="Share" aria-label="Share link">${ICON.share}</button>
      <button class="icon-btn danger" data-action="delete" title="Delete" aria-label="Delete link">${ICON.trash}</button>
    </div>
  </article>`;
}

function pathPreview(url) {
  try {
    const u = new URL(url);
    const tail = (u.pathname + u.search).slice(0, 40);
    return tail === "/" ? "" : tail;
  } catch {
    return "";
  }
}

function renderHistory() {
  const results = $("#results");
  const search = ($("#history-search")?.value || "").toLowerCase().trim();
  const sort = $("#sort-select")?.value || "newest";
  const all = store.all(); // read storage once per render
  let list = search
    ? all.filter(
        (l) =>
          l.original.toLowerCase().includes(search) ||
          l.short.toLowerCase().includes(search) ||
          (l.note || "").toLowerCase().includes(search)
      )
    : all.slice();

  list.sort((a, b) => {
    if (sort === "oldest") return a.createdAt - b.createdAt;
    if (sort === "clicks") return Math.max(b.clicks, b.opens) - Math.max(a.clicks, a.opens);
    return b.createdAt - a.createdAt;
  });

  results.innerHTML = list.map(cardHtml).join("");
  const empty = $("#empty-state");
  const totalCount = all.length;
  empty.hidden = totalCount > 0;
  if (totalCount > 0 && list.length === 0) {
    empty.hidden = false;
    empty.querySelector("p").textContent = "No links match your search.";
  } else if (totalCount > 0) {
    empty.hidden = true;
  } else {
    empty.querySelector("p").textContent =
      "No links yet, shorten one above and it'll appear here, saved on this device.";
  }
}

/* Stat band */
function refreshStats(animate = true) {
  const { count, clicks, saved } = store.aggregate();
  const set = (id, val) => {
    const el = $(id);
    if (!el) return;
    if (animate) {
      countUp(el, val);
    } else {
      // Cancel any running count-up and keep data-current in sync so a later
      // animated count-up starts from the value actually on screen.
      if (el._countRaf) {
        cancelAnimationFrame(el._countRaf);
        el._countRaf = null;
      }
      const n = Number(val) || 0;
      el.textContent = n.toLocaleString();
      el.dataset.current = String(n);
    }
  };
  set("#stat-links", count);
  set("#stat-clicks", clicks);
  set("#stat-saved", saved);
}

/** Announce a short message to assistive tech via the polite status region. */
function announce(msg) {
  const el = $("#sr-status");
  if (el) el.textContent = msg;
}

/** Set stat values immediately, then count them up once the band scrolls into view. */
function initStatBand() {
  refreshStats(false); // correct values underneath the reveal
  const band = document.querySelector(".stats-band");
  if (!band || prefersReducedMotion || !("IntersectionObserver" in window)) return;
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        ["#stat-links", "#stat-clicks", "#stat-saved"].forEach((id) => {
          const el = $(id);
          if (el) {
            el.dataset.current = "0";
            el.textContent = "0";
          }
        });
        refreshStats(true);
        io.disconnect();
      });
    },
    { threshold: 0.5 }
  );
  io.observe(band);
}

/* Shorten flow */
async function doShorten() {
  const btn = $("#shorten-btn");
  if (btn.getAttribute("aria-busy") === "true") return; // ignore Enter-key re-submits while in flight
  const bulk = $("#bulk-toggle").checked;
  const opts = readAdvanced();

  btn.setAttribute("aria-busy", "true");
  try {
    if (bulk) {
      await shortenBulk(opts);
    } else {
      await shortenSingle($("#url-input").value.trim(), opts);
    }
  } finally {
    btn.removeAttribute("aria-busy");
  }
}

function readAdvanced() {
  const alias = $("#alias-input").value.trim();
  const password = $("#password-input").value.trim();
  const maxClicks = parseInt($("#maxclicks-input").value, 10);
  return {
    alias: alias || undefined,
    password: password || undefined,
    maxClicks: Number.isFinite(maxClicks) && maxClicks > 0 ? maxClicks : undefined,
  };
}

async function shortenSingle(url, opts) {
  const input = $("#url-input");
  const hint = $("#url-hint");
  if (!isValidUrl(url)) {
    input.classList.add("is-invalid");
    input.setAttribute("aria-invalid", "true");
    hint.textContent = "Please enter a valid http(s) link.";
    hint.classList.remove("ok");
    return;
  }
  if (opts.password) {
    const p = opts.password;
    const strong = p.length >= 8 && /[a-z]/i.test(p) && /\d/.test(p) && /[@.]/.test(p);
    if (!strong) {
      toast("Password needs 8+ characters with a letter, a number and a . or @", "error", 4500);
      return;
    }
  }
  const res = await shorten(url, opts);
  if (!res.ok) {
    toast(res.error || "Something went wrong.", "error", 4500);
    hint.textContent = res.error || "";
    hint.classList.remove("ok"); // an API error isn't a "valid" green hint
    input.classList.remove("is-valid");
    input.classList.add("is-invalid");
    input.setAttribute("aria-invalid", "true");
    return;
  }
  const { record, created } = store.add({
    original: url,
    short: res.shortUrl,
    code: res.code,
    provider: res.provider,
    alias: opts.alias,
    hasPassword: Boolean(opts.password),
    maxClicks: opts.maxClicks || null,
  });
  // Reset form
  input.value = "";
  input.classList.remove("is-valid", "is-invalid");
  input.removeAttribute("aria-invalid");
  hint.textContent = "";
  clearAdvanced();
  renderHistory();
  refreshStats();
  navigator.clipboard?.writeText(res.shortUrl).catch(() => {});

  const shortLabel = res.shortUrl.replace(/^https?:\/\//, "");
  if (created) {
    celebrate();
    toast(`Shortened with ${res.provider}: ${shortLabel}`, "success");
    announce(`Short link created and copied: ${shortLabel}`);
  } else {
    toast("You already shortened that link, it's in your list.", "info");
    announce("That link was already shortened.");
  }
  // bring the relevant card into view (only scrolls if it's off-screen)
  document
    .querySelector(`#results .link-card[data-id="${record.id}"]`)
    ?.scrollIntoView({ behavior: prefersReducedMotion ? "auto" : "smooth", block: "nearest" });
}

async function shortenBulk(opts) {
  const raw = $("#bulk-input").value.split("\n").map((s) => s.trim()).filter(Boolean);
  const valid = raw.filter(isValidUrl);
  if (!valid.length) {
    toast("Add at least one valid http(s) link.", "error");
    return;
  }
  const slice = valid.slice(0, MAX_BULK);
  if (valid.length > MAX_BULK) {
    toast(`Shortening the first ${MAX_BULK} of ${valid.length} (rate limits).`, "info", 4000);
  }
  let done = 0;
  let lastErr = "";
  for (const url of slice) {
    // bulk ignores alias (one alias can't apply to many) but keeps no advanced opts
    const res = await shorten(url, {});
    if (res.ok) {
      store.add({ original: url, short: res.shortUrl, code: res.code, provider: res.provider });
      done++;
    } else {
      lastErr = res.error || lastErr;
    }
  }
  if (done) {
    $("#bulk-input").value = ""; // keep the user's input if nothing worked
    renderHistory(); // render once, not per iteration
  }
  refreshStats();
  if (done) {
    celebrate();
    const failed = slice.length - done;
    toast(
      failed ? `Shortened ${done}, ${failed} failed.` : `Shortened ${done} link${done > 1 ? "s" : ""}.`,
      failed ? "info" : "success"
    );
  } else {
    toast(lastErr || "Couldn't shorten those links.", "error", 4500);
  }
}

function clearAdvanced() {
  $("#alias-input").value = "";
  $("#password-input").value = "";
  $("#maxclicks-input").value = "";
}

/* Card actions (delegated) */
async function onResultsClick(e) {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  const card = e.target.closest(".link-card");
  if (!card) return;
  const id = card.dataset.id;
  const rec = store.all().find((l) => l.id === id);
  if (!rec) return;
  const action = btn.dataset.action;

  if (action === "open") {
    store.incOpens(id);
    refreshStats(false);
    return; // let the anchor navigate
  }
  e.preventDefault();

  if (action === "copy") {
    try {
      await navigator.clipboard.writeText(rec.short);
      btn.classList.add("copied");
      btn.innerHTML = ICON.check;
      toast("Copied to clipboard!", "success", 1800);
      setTimeout(() => {
        btn.classList.remove("copied");
        btn.innerHTML = ICON.copy;
      }, 1600);
    } catch {
      toast("Couldn't access the clipboard.", "error");
    }
  } else if (action === "qr") {
    openQr(rec);
  } else if (action === "stats") {
    openStats(rec);
  } else if (action === "share") {
    shareLink(rec);
  } else if (action === "note") {
    editNote(rec);
  } else if (action === "delete") {
    card.classList.add("removing");
    let removed = false;
    function removeNow() {
      if (removed) return;
      removed = true;
      card.removeEventListener("animationend", onEnd);
      const nextId = (card.nextElementSibling || card.previousElementSibling)?.dataset.id;
      store.remove(id);
      renderHistory();
      refreshStats();
      announce("Link deleted.");
      // keep keyboard focus in the list instead of dropping to <body>
      const target =
        (nextId && document.querySelector(`#results .link-card[data-id="${nextId}"] [data-action="delete"]`)) ||
        document.getElementById("history-search");
      target?.focus();
    }
    function onEnd(ev) {
      if (ev.animationName === "card-out") removeNow(); // ignore the card-in animation
    }
    card.addEventListener("animationend", onEnd);
    setTimeout(removeNow, 450); // failsafe if animationend never fires
  }
}

function editNote(rec) {
  const next = window.prompt("Note for this link (where you shared it, what it is, etc.):", rec.note || "");
  if (next === null) return; // cancelled
  store.setNote(rec.id, next.trim());
  renderHistory();
  announce(next.trim() ? "Note saved." : "Note cleared.");
}

async function shareLink(rec) {
  if (navigator.share) {
    try {
      await navigator.share({ title: "Shortened link", url: rec.short });
    } catch {
      /* user cancelled */
    }
  } else if (navigator.clipboard) {
    await navigator.clipboard.writeText(rec.short).catch(() => {});
    toast("Link copied, share away!", "success");
  } else {
    toast("Sharing is not supported on this browser.", "info");
  }
}

/* QR modal */
let qrTargetUrl = "";
let statsRequestId = 0;
function openQr(rec) {
  qrTargetUrl = rec.short;
  $("#qr-target").textContent = rec.short.replace(/^https?:\/\//, "");
  const ok = renderQR($("#qr-canvas"), rec.short, { size: 248 });
  $("#qr-canvas").setAttribute("aria-label", "QR code for " + rec.short);
  if (!ok) toast("QR generator failed to load.", "error");
  openModal("qr-modal");
}

/* Stats modal */
async function openStats(rec) {
  const reqId = ++statsRequestId;
  $("#stats-target").textContent = rec.short.replace(/^https?:\/\//, "");
  const body = $("#stats-body");
  body.innerHTML = '<div class="stats-loading"><span class="spinner big"></span> Fetching live click data…</div>';
  openModal("stats-modal");

  const data = await getStats(rec.code);
  if (reqId !== statsRequestId) return; // a newer stats modal was opened, ignore stale response
  if (!data) {
    body.innerHTML = `<p class="stats-empty">Couldn't load analytics for this link right now.</p>`;
    announce("Couldn't load analytics for this link.");
    return;
  }
  const total = Number(data["total-clicks"] || 0);
  const unique = Number(data["total_unique_clicks"] || 0);
  if ("total-clicks" in data) store.setClicks(rec.id, total); // don't overwrite a cached total with 0
  refreshStats(false);
  renderHistory(); // reflect fresh click totals in the "Most clicks" sort
  // renderHistory rebuilt the trigger button; re-point the modal's focus return to it
  setReturnFocus(
    document.querySelector(`#results .link-card[data-id="${CSS.escape(rec.id)}"] [data-action="stats"]`)
  );
  announce(`Analytics loaded: ${total} total clicks, ${unique} unique.`);

  const max = data["max-clicks"];

  body.innerHTML = `
    <div class="stats-grid">
      <div class="stat-tile"><span class="stat-tile-num">${total.toLocaleString()}</span><span class="stat-tile-label">total clicks</span></div>
      <div class="stat-tile"><span class="stat-tile-num">${unique.toLocaleString()}</span><span class="stat-tile-label">unique visitors</span></div>
      ${max ? `<div class="stat-tile"><span class="stat-tile-num">${escapeHtml(String(max))}</span><span class="stat-tile-label">self-destruct limit</span></div>` : ""}
    </div>
    ${breakdown("Browsers", data.browser)}
    ${breakdown("Operating systems", data.os_name)}
    ${breakdown("Countries", data.country)}
    ${data["last-click"] ? `<p class="stats-last">Last click ${escapeHtml(String(data["last-click"]))}</p>` : ""}
    <p class="stats-foot">Live from the spoo.me analytics API, the dashboard 2022-me only mocked up.</p>`;
}

/** Render a labelled set of proportion bars from a {label: count} object. */
function breakdown(title, obj) {
  const entries = Object.entries(obj || {})
    .map(([k, v]) => [k, Number(v) || 0])
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  if (!entries.length) {
    return `<div class="bd"><h3 class="bd-title">${escapeHtml(title)}</h3><p class="bd-empty">No clicks recorded yet.</p></div>`;
  }
  const top = entries[0][1];
  const rows = entries
    .map(
      ([k, v]) => `
      <div class="bd-row">
        <span class="bd-label">${escapeHtml(k)}</span>
        <span class="bd-track"><span class="bd-fill" style="width:${Math.round((v / top) * 100)}%"></span></span>
        <span class="bd-val">${v}</span>
      </div>`
    )
    .join("");
  return `<div class="bd"><h3 class="bd-title">${escapeHtml(title)}</h3>${rows}</div>`;
}

/* Misc wiring */
function wire() {
  // form
  $("#shorten-form").addEventListener("submit", (e) => {
    e.preventDefault();
    doShorten();
  });

  // live validation
  $("#url-input").addEventListener("input", (e) => {
    const v = e.target.value.trim();
    const hint = $("#url-hint");
    if (!v) {
      e.target.classList.remove("is-valid", "is-invalid");
      e.target.removeAttribute("aria-invalid");
      hint.textContent = "";
      return;
    }
    if (isValidUrl(v)) {
      e.target.classList.add("is-valid");
      e.target.classList.remove("is-invalid");
      e.target.setAttribute("aria-invalid", "false");
      hint.textContent = "Looks good, hit Shorten It!";
      hint.classList.add("ok");
    } else {
      e.target.classList.add("is-invalid");
      e.target.classList.remove("is-valid");
      e.target.setAttribute("aria-invalid", "true");
      hint.textContent = "Include http:// or https://";
      hint.classList.remove("ok");
    }
  });

  // advanced toggle
  $("#advanced-toggle").addEventListener("click", (e) => {
    const panel = $("#advanced-panel");
    const open = panel.hidden;
    panel.hidden = !open;
    e.currentTarget.setAttribute("aria-expanded", String(open));
    announce(open ? "Advanced options shown." : "Advanced options hidden.");
  });

  // bulk toggle (role=switch conveys on/off via checked; no aria-expanded)
  $("#bulk-toggle").addEventListener("change", (e) => {
    const on = e.target.checked;
    $("#bulk-panel").hidden = !on;
    const urlInput = $("#url-input");
    urlInput.closest(".field").style.display = on ? "none" : "";
    urlInput.disabled = on; // keep the hidden field out of focus/validation
    urlInput.classList.remove("is-valid", "is-invalid");
    urlInput.removeAttribute("aria-invalid");
    const hint = $("#url-hint");
    hint.textContent = "";
    hint.classList.remove("ok");
    if (on) {
      $("#bulk-input").focus();
      announce("Bulk mode on, enter one URL per line.");
    } else {
      urlInput.focus();
      announce("Single-link mode.");
    }
  });

  // history controls (debounced so we re-render once typing pauses)
  let searchTimer;
  $("#history-search").addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      renderHistory();
      const term = $("#history-search").value.trim();
      if (term) {
        const n = $("#results").querySelectorAll(".link-card").length;
        announce(n ? `${n} link${n === 1 ? "" : "s"} match "${term}".` : `No links match "${term}".`);
      }
    }, 140);
  });
  $("#sort-select").addEventListener("change", renderHistory);
  $("#results").addEventListener("click", onResultsClick);

  $("#export-btn").addEventListener("click", () => {
    if (!store.all().length) return toast("Nothing to export yet.", "info");
    const url = store.exportBlobUrl();
    const a = document.createElement("a");
    a.href = url;
    a.download = "shortly-links.json";
    a.click();
    URL.revokeObjectURL(url);
    toast("History exported as JSON.", "success");
  });

  // import a previously exported JSON file
  $("#import-btn").addEventListener("click", () => $("#import-file").click());
  $("#import-file").addEventListener("change", async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = ""; // let the same file be picked again later
    if (!file) return;
    try {
      const added = store.importLinks(JSON.parse(await file.text()));
      renderHistory();
      refreshStats();
      toast(
        added ? `Imported ${added} link${added === 1 ? "" : "s"}.` : "Nothing new to import.",
        added ? "success" : "info"
      );
    } catch {
      toast("That file is not a valid Shortly export.", "error", 4500);
    }
  });

  $("#clear-btn").addEventListener("click", () => {
    if (!store.all().length) return;
    if (confirm("Delete all saved links from this device?")) {
      store.clear();
      renderHistory();
      refreshStats();
      toast("History cleared.", "info");
    }
  });

  // QR download
  $("#qr-download").addEventListener("click", () => {
    const name = `qr-${qrTargetUrl.replace(/^https?:\/\//, "").replace(/[^\w.-]/g, "_")}.png`;
    downloadCanvas($("#qr-canvas"), name);
  });

  // theme
  $("#theme-toggle").addEventListener("click", toggleTheme);

  // mobile nav (overlay): trap focus and inert the page behind it, like the modals
  const navToggle = $("#nav-toggle");
  const nav = $("#primary-nav");
  const isMobileNav = () => window.matchMedia("(max-width: 880px)").matches;
  // include the toggle so the visible Close control is reachable in the trap cycle
  const navItems = () => [navToggle, ...nav.querySelectorAll("a, button")].filter((el) => el.offsetParent !== null);

  function setNavInert(on) {
    document.querySelectorAll("main, .site-footer, .brand").forEach((el) => {
      if (on) {
        el.setAttribute("inert", "");
        el.setAttribute("aria-hidden", "true");
      } else {
        el.removeAttribute("inert");
        el.removeAttribute("aria-hidden");
      }
    });
  }

  function navKeydown(e) {
    if (e.key === "Escape") {
      closeNav();
      navToggle.focus();
      return;
    }
    if (e.key !== "Tab") return;
    const items = navItems();
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  function openNav() {
    nav.classList.add("open");
    navToggle.setAttribute("aria-expanded", "true");
    navToggle.setAttribute("aria-label", "Close menu");
    if (isMobileNav()) {
      setNavInert(true);
      document.addEventListener("keydown", navKeydown); // on document so the toggle is covered too
      nav.querySelector("a, button")?.focus();
    }
  }

  function closeNav() {
    if (!nav.classList.contains("open")) return;
    nav.classList.remove("open");
    navToggle.setAttribute("aria-expanded", "false");
    navToggle.setAttribute("aria-label", "Open menu");
    document.removeEventListener("keydown", navKeydown);
    setNavInert(false);
  }

  navToggle.addEventListener("click", () => {
    if (nav.classList.contains("open")) {
      closeNav();
      navToggle.focus();
    } else {
      openNav();
    }
  });
  nav.querySelectorAll("a").forEach((a) => a.addEventListener("click", closeNav));
  // restore the page if the viewport grows past the mobile breakpoint while the menu is open
  window.matchMedia("(max-width: 880px)").addEventListener("change", (e) => {
    if (!e.matches) closeNav();
  });

  // keyboard shortcut: Cmd/Ctrl+K focuses the URL input
  document.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      ($("#bulk-toggle").checked ? $("#bulk-input") : $("#url-input")).focus();
      document.getElementById("shorten").scrollIntoView({
        behavior: prefersReducedMotion ? "auto" : "smooth",
        block: "center",
      });
    }
  });

  // header shadow on scroll (only touch the DOM when the state actually flips)
  const header = $(".site-header");
  let isScrolled = false;
  const onScroll = () => {
    const s = window.scrollY > 8;
    if (s !== isScrolled) {
      isScrolled = s;
      header.classList.toggle("scrolled", s);
    }
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // PWA install: surface a button (shown only on mobile via CSS) when the browser offers a prompt
  let deferredPrompt = null;
  const installBtn = $("#install-btn");
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    installBtn.hidden = false;
  });
  installBtn.addEventListener("click", async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    installBtn.hidden = true;
  });
  window.addEventListener("appinstalled", () => {
    installBtn.hidden = true;
    toast("Installed! Shortly is now an app.", "success");
  });
}

/* Init */
function init() {
  initTheme();
  wireModalClosers();
  wire();
  renderHistory();
  initStatBand();
  initReveal();
  $("#year").textContent = new Date().getFullYear();
  window.__shortlyReady = true; // tells boot.js the app initialized (reveal failsafe)

  // animate the background only while the user is actively interacting, so it
  // (and the glass surfaces over it) does not repaint every frame at idle
  let bgIdleTimer;
  const wakeBg = () => {
    document.body.classList.add("bg-active");
    clearTimeout(bgIdleTimer);
    bgIdleTimer = setTimeout(() => document.body.classList.remove("bg-active"), 1500);
  };
  ["scroll", "pointermove", "pointerdown", "keydown"].forEach((ev) =>
    window.addEventListener(ev, wakeBg, { passive: true })
  );
  wakeBg(); // a brief drift on first load

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () =>
      navigator.serviceWorker.register("sw.js").catch(() => {})
    );
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
