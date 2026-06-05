/* store.js, link history + local analytics, persisted in localStorage. The 2022 version forgot every link on refresh; this remembers them per-device. */

const KEY = "shortly.links.v1";

/** @returns {Array<object>} */
export function all() {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(list)) return [];
    // Only trust well-shaped records with http(s) URLs (guards against tampered
    // storage smuggling a javascript:/data: URL into a rendered anchor href).
    return list.filter(
      (l) =>
        l &&
        typeof l.id === "string" &&
        typeof l.short === "string" &&
        /^https?:\/\//i.test(l.short) &&
        typeof l.original === "string" &&
        /^https?:\/\//i.test(l.original)
    );
  } catch {
    return [];
  }
}

function save(list) {
  localStorage.setItem(KEY, JSON.stringify(list));
}

/** Create a stable-ish id without external deps. */
function makeId() {
  return `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}

/**
 * Add a link to the top of history.
 * @param {{original:string, short:string, code:string, provider:string,
 *          alias?:string, hasPassword?:boolean, maxClicks?:number}} data
 */
export function add(data) {
  const list = all();
  // De-dupe: if the same short URL already exists, surface it as not-created.
  const existing = list.find((l) => l.short === data.short);
  if (existing) return { record: existing, created: false };

  const max = Number(data.maxClicks);
  const record = {
    id: makeId(),
    original: data.original,
    short: data.short,
    code: data.code || "",
    provider: data.provider || "spoo.me",
    alias: data.alias || "",
    hasPassword: Boolean(data.hasPassword),
    maxClicks: max > 0 ? max : null,
    createdAt: Date.now(),
    opens: 0,
    clicks: 0,
    note: "",
  };
  list.unshift(record);
  save(list);
  return { record, created: true };
}

export function remove(id) {
  save(all().filter((l) => l.id !== id));
}

export function clear() {
  save([]);
}

export function update(id, patch) {
  const list = all();
  const item = list.find((l) => l.id === id);
  if (!item) return null;
  Object.assign(item, patch);
  save(list);
  return item;
}

export function incOpens(id) {
  const item = all().find((l) => l.id === id);
  if (item) update(id, { opens: (item.opens || 0) + 1 });
}

/** Cache the real click total fetched from spoo.me stats. */
export function setClicks(id, clicks) {
  update(id, { clicks: Number(clicks) || 0 });
}

/** Save a short user note/label on a link (capped length). */
export function setNote(id, note) {
  update(id, { note: String(note || "").slice(0, 140) });
}

/**
 * Merge a previously exported list back in, skipping malformed entries and
 * any short URL already saved. Returns how many were added.
 */
export function importLinks(arr) {
  if (!Array.isArray(arr)) return 0;
  const list = all();
  const seen = new Set(list.map((l) => l.short));
  let added = 0;
  for (const r of arr) {
    if (!r || typeof r.short !== "string" || typeof r.original !== "string") continue;
    if (!/^https?:\/\//i.test(r.short) || !/^https?:\/\//i.test(r.original)) continue;
    if (seen.has(r.short)) continue;
    seen.add(r.short);
    list.push({
      id: makeId(),
      original: r.original,
      short: r.short,
      code: typeof r.code === "string" ? r.code : "",
      provider: typeof r.provider === "string" ? r.provider : "spoo.me",
      alias: typeof r.alias === "string" ? r.alias : "",
      hasPassword: Boolean(r.hasPassword),
      maxClicks: Number(r.maxClicks) > 0 ? Number(r.maxClicks) : null,
      createdAt: Number(r.createdAt) || Date.now(),
      opens: Number(r.opens) || 0,
      clicks: Number(r.clicks) || 0,
      note: typeof r.note === "string" ? r.note.slice(0, 140) : "",
    });
    added++;
  }
  if (added) save(list);
  return added;
}

/** Aggregates for the animated stat band. */
export function aggregate() {
  const list = all();
  let clicks = 0;
  let saved = 0;
  for (const l of list) {
    clicks += Math.max(l.clicks || 0, l.opens || 0);
    saved += Math.max(0, (l.original?.length || 0) - (l.short?.length || 0));
  }
  return { count: list.length, clicks, saved };
}

/** Export the full history as a downloadable JSON blob URL. */
export function exportBlobUrl() {
  const blob = new Blob([JSON.stringify(all(), null, 2)], {
    type: "application/json",
  });
  return URL.createObjectURL(blob);
}
