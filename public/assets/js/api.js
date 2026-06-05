/* api.js, the revived core. 2022 shipped a single call to api.shrtco.de, which is now DEAD (the service shut down). This replaces it with spoo.me (primary) and tinyurl (fallback), both verified key-less and CORS-enabled, so the app stays a pure static site with no backend. */

const SPOO = "https://spoo.me";
const TINY = "https://tinyurl.com/api-create.php";

/** Upgrade an http URL to https for display. */
function normalize(url) {
  return url.replace(/^http:\/\//i, "https://");
}

/** Pull the short code (last path segment) out of a short URL. */
export function codeFromUrl(shortUrl) {
  try {
    const seg = new URL(shortUrl).pathname.replace(/^\/+|\/+$/g, "");
    // store the code decoded so getStats encodes it exactly once (fixes emoji/Unicode aliases)
    try {
      return decodeURIComponent(seg);
    } catch {
      return seg;
    }
  } catch {
    return "";
  }
}

/**
 * Shorten a URL.
 * @param {string} url
 * @param {{alias?:string, password?:string, maxClicks?:number}} opts
 * @returns {Promise<{ok:boolean, shortUrl?:string, code?:string, provider?:string, error?:string}>}
 */
export async function shorten(url, opts = {}) {
  const { alias, password, maxClicks } = opts;
  const hasAdvanced = Boolean(alias || password || maxClicks);

  //  Primary: spoo.me (supports alias / password / self-destruct) 
  try {
    const body = new URLSearchParams({ url });
    if (alias) body.set("alias", alias);
    if (password) body.set("password", password);
    if (maxClicks) body.set("max-clicks", String(maxClicks));

    const res = await fetch(`${SPOO}/`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });

    const data = await res.json().catch(() => ({}));
    const shortUrl = data.short_url ? normalize(data.short_url) : "";

    // Re-validate the scheme: never store/render a non-http(s) short URL.
    if (res.ok && /^https?:\/\//i.test(shortUrl)) {
      return {
        ok: true,
        shortUrl,
        code: codeFromUrl(shortUrl),
        provider: "spoo.me",
      };
    }

    // If the user asked for advanced features we can't fall back
    // (tinyurl has no alias/password/limits), report the real reason.
    const msg = readSpooError(data);
    if (hasAdvanced) {
      if (res.status === 429) {
        // spoo.me does not expose Retry-After across origins, so keep it generic
        return { ok: false, error: "Rate limit reached, wait a moment and retry." };
      }
      return { ok: false, error: msg || "Could not create that custom link." };
    }
    // Plain shorten: fall through to the tinyurl fallback (covers 429, 5xx, etc.)
  } catch {
    if (hasAdvanced) {
      return {
        ok: false,
        error: "Custom links need the spoo.me API, which didn't respond. Try again shortly.",
      };
    }
    // network error, try the fallback
  }

  //  Fallback: tinyurl (plain shortening only) 
  try {
    const res = await fetch(`${TINY}?url=${encodeURIComponent(url)}`);
    const text = (await res.text()).trim();
    if (res.ok && /^https?:\/\//i.test(text)) {
      const shortUrl = normalize(text);
      return {
        ok: true,
        shortUrl,
        code: codeFromUrl(shortUrl),
        provider: "tinyurl",
      };
    }
  } catch {
    /* both providers failed */
  }

  return {
    ok: false,
    error: "Couldn't shorten that link right now. Please try again in a moment.",
  };
}

/** Translate a spoo.me error payload into a friendly sentence.
   spoo.me returns errors as { UrlError | AliasError | PasswordError | MaxClicksError: "..." }. */
function readSpooError(data) {
  if (!data || typeof data !== "object") return "";
  // live API: { AliasError: "Alias already exists", ... } (the message is the value)
  for (const key of ["UrlError", "AliasError", "PasswordError", "MaxClicksError", "RateLimitError"]) {
    if (typeof data[key] === "string") return data[key];
  }
  // documented shape: { error: "AliasError", message: "human sentence" }
  if (typeof data.message === "string") return data.message;
  if (typeof data.error === "string") return data.error;
  for (const key of ["alias", "url", "password", "max-clicks"]) {
    if (Array.isArray(data[key]) && data[key].length) return `${key}: ${data[key][0]}`;
  }
  return "";
}

/**
 * Fetch live click analytics for a spoo.me short code.
 * @returns {Promise<object|null>}
 */
export async function getStats(code) {
  try {
    const res = await fetch(`${SPOO}/stats/${encodeURIComponent(code)}`, {
      method: "POST",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const data = await res.json();
    // shape check: don't let a non-analytics 200 body overwrite cached totals
    if (
      !data ||
      typeof data !== "object" ||
      (!("total-clicks" in data) && !("short_code" in data) && !("_id" in data))
    ) {
      return null;
    }
    return data;
  } catch {
    return null;
  }
}
