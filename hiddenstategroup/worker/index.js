/*
  Hidden State — door API.

  This Worker sits in front of the site. Anything under /api it answers
  itself; everything else it hands to the static files.

  WHY THIS EXISTS. Until now the guest list, the shared secret and the login
  check all lived in the browser, which meant three things were true:
    • the secret was readable by anyone who looked
    • "already used" only existed on one phone
    • the login could be stepped around

  All three are fixed by moving the work here, where the visitor cannot see or
  change it.
*/

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

const fail = (message, status = 400) => json({ ok: false, error: message }, status);

const now = () => new Date().toISOString();

// ─── crypto helpers ────────────────────────────────────────────────────────

const enc = new TextEncoder();

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest("SHA-256", enc.encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/*
  Password hashing uses PBKDF2 with 150,000 iterations rather than a plain
  SHA-256. A single hash is far too quick to compute, which is exactly what
  makes stolen hashes worth brute-forcing. This is deliberately slow.
*/
// 100,000 is the ceiling Workers allow for PBKDF2. Asking for more does not
// make it slower — it throws, and every login fails with a 500.
const PBKDF2_ROUNDS = 100000;

async function hashPassword(password, salt) {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: enc.encode(salt), iterations: PBKDF2_ROUNDS, hash: "SHA-256" },
    key,
    256
  );
  return [...new Uint8Array(bits)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Comparison that takes the same time whether it fails on the first character
// or the last, so timing cannot be used to guess a value.
function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const randomHex = (bytes = 32) =>
  [...crypto.getRandomValues(new Uint8Array(bytes))].map((b) => b.toString(16).padStart(2, "0")).join("");

// ─── the rotating door code ────────────────────────────────────────────────

const WINDOW_SECONDS = 30;
const currentWindow = () => Math.floor(Date.now() / 1000 / WINDOW_SECONDS);

async function rotatingCode(secret, code, window) {
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(`${code}:${window}`));
  const bytes = new Uint8Array(sig);
  const offset = bytes[bytes.length - 1] & 0xf;
  const num =
    ((bytes[offset] & 0x7f) << 24) |
    ((bytes[offset + 1] & 0xff) << 16) |
    ((bytes[offset + 2] & 0xff) << 8) |
    (bytes[offset + 3] & 0xff);
  return String(num % 1000000).padStart(6, "0");
}

// ─── email ─────────────────────────────────────────────────────────────────

/*
  Sending a pass.

  The key lives as a Worker secret, never in the code and never in the
  browser. If it is missing, issuing still works and simply reports that
  nothing was sent — a pass that exists but was not emailed is a small
  problem; a pass that failed to be created because email was down is a real
  one.
*/
async function sendPassEmail(env, { to, name, code, party, kind, reminder = false, signoff = "Hidden State" }) {
  // Log every reason for not sending. A silent skip is the worst outcome:
  // nothing arrives, nothing appears in the logs, and there is nothing to
  // act on.
  if (!env.RESEND_API_KEY) {
    console.error("Email skipped: RESEND_API_KEY is not set on this Worker.");
    return { sent: false, reason: "no key configured" };
  }
  if (!to) {
    console.error("Email skipped: no address given.");
    return { sent: false, reason: "no address" };
  }
  console.log("Sending pass", code, "to", to);

  const url = `https://hiddenstategroup.com/pass/${code}`;
  const isInvite = kind === "INVITATION";
  const heading = reminder ? "TOMORROW" : isInvite ? "YOU'RE INVITED" : "YOUR PASS";

  const text = [
    `${name},`,
    "",
    isInvite
      ? `You're invited to ${party.name}.`
      : `Your pass for ${party.name} is ready.`,
    "",
    `Date: ${party.date_label}`,
    party.venue ? `Venue: ${party.venue}` : "Venue: to be announced",
    "",
    "Open your pass here:",
    url,
    "",
    "Keep this link. At the door it shows a number that changes every thirty",
    "seconds, so a screenshot will not work — open the page when you arrive.",
    "",
    `${party.minimum_age}+. Bring ID matching the name on the pass.`,
    "",
    "Hidden State",
  ].join("\n");

  const html = `
    <div style="font-family:Georgia,serif;color:#16130E;background:#F3EBD9;padding:32px">
      <div style="max-width:480px;margin:0 auto">
        <p style="font-family:Helvetica,sans-serif;font-size:10px;letter-spacing:.2em;color:#8A6A28;margin:0">
          ${heading}
        </p>
        <div style="border-top:2px solid #16130E;margin-top:10px"></div>
        <div style="border-top:1px solid #16130E;margin-top:3px"></div>
        <h1 style="font-size:30px;font-weight:400;margin:24px 0 6px">${party.name}</h1>
        <p style="font-family:Helvetica,sans-serif;font-size:11px;letter-spacing:.16em;color:#463F35;margin:0">
          ${party.date_label}${party.venue ? " · " + party.venue : ""}
        </p>
        <p style="font-size:17px;line-height:1.6;margin:24px 0 0">
          ${name}, your pass is ready.
        </p>
        <p style="margin:24px 0">
          <a href="${url}" style="display:inline-block;background:#16130E;color:#F3EBD9;
             font-family:Helvetica,sans-serif;font-size:11px;letter-spacing:.2em;
             padding:14px 28px;text-decoration:none">OPEN YOUR PASS</a>
        </p>
        <p style="font-size:15px;line-height:1.6;color:#463F35;margin:0">
          Keep this link. At the door it shows a number that changes every
          thirty seconds, so a screenshot will not work — open the page when
          you arrive.
        </p>
        <p style="font-family:Helvetica,sans-serif;font-size:10px;letter-spacing:.16em;color:#463F35;margin:24px 0 0">
          ${party.minimum_age}+ · BRING ID MATCHING THE NAME
        </p>
      </div>
    </div>`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${env.RESEND_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: "Hidden State <passes@hiddenstategroup.com>",
        to: [to],
        subject: reminder
          ? `Tomorrow — ${party.name}`
          : isInvite
            ? `You're invited — ${party.name}`
            : `Your pass — ${party.name}`,
        text,
        html,
      }),
    });
    const detail = await res.text();
    if (!res.ok) {
      console.error("Resend refused:", res.status, detail);
      // Pass the real reason back to the console. Guessing at a failed email
      // wastes far more time than showing it does.
      let reason = `email service returned ${res.status}`;
      try {
        const parsed = JSON.parse(detail);
        if (parsed.message) reason = parsed.message;
      } catch { /* not JSON — the status alone will do */ }
      return { sent: false, reason };
    }
    console.log("Resend accepted:", detail);
    return { sent: true };
  } catch (err) {
    console.error("Email failed:", err && err.message);
    return { sent: false, reason: "could not reach the email service" };
  }
}

/*
  Account details for a new team member.

  The password is sent once, here, and never stored anywhere readable — the
  database holds only its hash. If it is lost, the only path is to set a new
  one, which is the correct trade.
*/
async function sendAccountEmail(env, { to, displayName, username, password, role, copyTo }) {
  if (!env.RESEND_API_KEY) {
    console.error("Account email skipped: RESEND_API_KEY is not set.");
    return { sent: false, reason: "no key configured" };
  }
  if (!to) return { sent: false, reason: "no address" };

  const what = role === "STAFF"
    ? "You can scan passes at the door."
    : "You can scan passes, see the door list, and review guest list requests.";

  const text = [
    `${displayName},`,
    "",
    "Your Hidden State door account is ready.",
    "",
    `  Username: ${username}`,
    `  Password: ${password}`,
    "",
    "Sign in at https://hiddenstategroup.com/admins-staff-boss",
    "",
    what,
    "",
    "Keep this to yourself. Nobody else should use your login — the door",
    "record shows who admitted whom, and that only works if each person",
    "signs in as themselves.",
    "",
    "Hidden State",
  ].join("\n");

  const html = `
    <div style="font-family:Georgia,serif;color:#16130E;background:#F3EBD9;padding:32px">
      <div style="max-width:480px;margin:0 auto">
        <p style="font-family:Helvetica,sans-serif;font-size:10px;letter-spacing:.2em;color:#8A6A28;margin:0">
          YOUR DOOR ACCOUNT
        </p>
        <div style="border-top:2px solid #16130E;margin-top:10px"></div>
        <div style="border-top:1px solid #16130E;margin-top:3px"></div>

        <h1 style="font-size:28px;font-weight:400;margin:24px 0 6px">${displayName}</h1>
        <p style="font-size:17px;line-height:1.6;margin:0 0 22px">
          Your Hidden State door account is ready.
        </p>

        <table style="border-collapse:collapse;font-family:Helvetica,sans-serif;font-size:14px">
          <tr><td style="padding:6px 18px 6px 0;color:#463F35">Username</td>
              <td style="padding:6px 0"><strong>${username}</strong></td></tr>
          <tr><td style="padding:6px 18px 6px 0;color:#463F35">Password</td>
              <td style="padding:6px 0"><strong>${password}</strong></td></tr>
        </table>

        <p style="margin:24px 0">
          <a href="https://hiddenstategroup.com/admins-staff-boss"
             style="display:inline-block;background:#16130E;color:#F3EBD9;
             font-family:Helvetica,sans-serif;font-size:11px;letter-spacing:.2em;
             padding:14px 28px;text-decoration:none">SIGN IN</a>
        </p>

        <p style="font-size:15px;line-height:1.6;color:#463F35;margin:0">
          ${what}
        </p>
        <p style="font-size:15px;line-height:1.6;color:#463F35;margin:14px 0 0">
          Keep this to yourself. The door record shows who admitted whom, and
          that only works if each person signs in as themselves.
        </p>
      </div>
    </div>`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${env.RESEND_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: "Hidden State <passes@hiddenstategroup.com>",
        to: [to],
        // Blind copy: the new member should not see an internal address.
        bcc: copyTo && copyTo !== to ? [copyTo] : undefined,
        subject: "Your Hidden State door account",
        text,
        html,
      }),
    });
    const detail = await res.text();
    if (!res.ok) {
      console.error("Account email refused:", res.status, detail);
      let reason = `email service returned ${res.status}`;
      try {
        const parsed = JSON.parse(detail);
        if (parsed.message) reason = parsed.message;
      } catch { /* status alone will do */ }
      return { sent: false, reason };
    }
    return { sent: true };
  } catch (err) {
    console.error("Account email failed:", err && err.message);
    return { sent: false, reason: "could not reach the email service" };
  }
}

/*
  Telling you a request came in.

  Without this, requests sit in the database until somebody thinks to look —
  which means a guest who asked on Tuesday hears nothing until Friday, or not
  at all. The point of a request is that it reaches a person.
*/
async function sendRequestAlert(env, { to, request, party }) {
  if (!env.RESEND_API_KEY || !to) return { sent: false };

  const lines = [
    "Someone has asked for a pass.",
    "",
    `  Name:  ${request.name}`,
    `  Email: ${request.email}`,
    request.phone ? `  Phone: ${request.phone}` : null,
    request.people > 1 ? `  For:   ${request.people} people` : null,
    party ? `  Event: ${party.name} — ${party.date_label}` : null,
    request.note ? "" : null,
    request.note ? `  "${request.note}"` : null,
    "",
    "Approve or decline in the console:",
    "https://hiddenstategroup.com/console",
  ].filter((l) => l !== null).join("\n");

  const html = `
    <div style="font-family:Georgia,serif;color:#16130E;background:#F3EBD9;padding:32px">
      <div style="max-width:460px;margin:0 auto">
        <p style="font-family:Helvetica,sans-serif;font-size:10px;letter-spacing:.2em;color:#8A6A28;margin:0">
          A PASS REQUEST
        </p>
        <div style="border-top:2px solid #16130E;margin-top:10px"></div>
        <div style="border-top:1px solid #16130E;margin-top:3px"></div>

        <h1 style="font-size:26px;font-weight:400;margin:22px 0 4px">${request.name}</h1>
        <p style="font-family:Helvetica,sans-serif;font-size:12px;color:#463F35;margin:0">
          ${request.email}${request.phone ? " · " + request.phone : ""}
          ${request.people > 1 ? " · " + request.people + " people" : ""}
        </p>
        ${party ? `<p style="font-family:Helvetica,sans-serif;font-size:11px;letter-spacing:.14em;color:#463F35;margin:10px 0 0">
          ${party.name.toUpperCase()} — ${(party.date_label || "").toUpperCase()}
        </p>` : ""}
        ${request.note ? `<p style="font-size:16px;font-style:italic;line-height:1.6;margin:18px 0 0;color:#463F35">
          &ldquo;${request.note}&rdquo;
        </p>` : ""}

        <p style="margin:26px 0 0">
          <a href="https://hiddenstategroup.com/console"
             style="display:inline-block;background:#16130E;color:#F3EBD9;
             font-family:Helvetica,sans-serif;font-size:11px;letter-spacing:.2em;
             padding:14px 28px;text-decoration:none">OPEN THE CONSOLE</a>
        </p>
      </div>
    </div>`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${env.RESEND_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: "Hidden State <passes@hiddenstategroup.com>",
        to: [to],
        // So a reply goes to the guest rather than to the site.
        reply_to: request.email,
        subject: `Pass request — ${request.name}`,
        text: lines,
        html,
      }),
    });
    if (!res.ok) {
      console.error("Request alert refused:", res.status, await res.text());
      return { sent: false };
    }
    return { sent: true };
  } catch (err) {
    console.error("Request alert failed:", err && err.message);
    return { sent: false };
  }
}

// ─── sessions ──────────────────────────────────────────────────────────────

async function createSession(env, member, hours) {
  const token = randomHex(32);
  // Comes from settings, so changing it in the console actually takes effect.
  const span = Number(hours) > 0 ? Number(hours) : DEFAULT_SETTINGS.sessionHours;
  const expires = new Date(Date.now() + span * 3600 * 1000).toISOString();
  await env.DB.prepare(
    "INSERT INTO sessions (token_hash, username, role, created_at, expires_at) VALUES (?, ?, ?, ?, ?)"
  ).bind(await sha256Hex(token), member.username, member.role, now(), expires).run();
  return { token, expires };
}

async function readSession(env, request) {
  const header = request.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return null;

  const row = await env.DB.prepare(
    "SELECT s.username, s.role, s.expires_at, s.created_at, s.last_seen, t.display_name, t.active, t.permissions " +
    "FROM sessions s JOIN team t ON t.username = s.username WHERE s.token_hash = ?"
  ).bind(await sha256Hex(token)).first();

  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) return null;

  /*
    Optional idle timeout. A door phone left on a table should not stay signed
    in indefinitely just because the shift has not ended.

    Each request pushes the session forward, so someone actually working is
    never interrupted.
  */
  const cfgIdle = await getSettings(env);
  if (cfgIdle.idleSignOutMinutes > 0) {
    const idleFor = (Date.now() - new Date(row.last_seen || row.created_at || row.expires_at).getTime()) / 60000;
    if (row.last_seen && idleFor > cfgIdle.idleSignOutMinutes) {
      await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(await sha256Hex(token)).run();
      return null;
    }
    await env.DB.prepare("UPDATE sessions SET last_seen = ? WHERE token_hash = ?")
      .bind(now(), await sha256Hex(token)).run();
  }
  // Suspending someone takes effect immediately, without waiting for their
  // session to lapse.
  if (!row.active) return null;
  return {
    username: row.username, role: row.role, displayName: row.display_name,
    can: permissionsFor(row.role, row.permissions, await getSettings(env)),
  };
}

/* ─── THE SONG POOL ────────────────────────────────────────────────────────

   Someone pastes a link; the pool shows the song's name. That one line of
   product is the whole reason this code exists, and doing it well means
   resolving the link on the SERVER rather than in the browser:

     • the browser cannot read another site's page — CORS forbids it, and
       every "link preview" that works in a browser is really a server
       somewhere doing this same job;
     • the answer is cached in our own database, so a pool of forty songs
       does not hammer Spotify forty times every time someone opens the page.

   FETCHING URLs THAT STRANGERS SUPPLY IS THE DANGEROUS PART. A worker will
   happily fetch anything it is told to, including an internal address, which
   is how a link box becomes a way to probe things that are not meant to be
   public. So the host is checked against a list of music services before
   anything is fetched, and nothing else is ever requested. A link to a
   service that is not on the list is still accepted and stored — it just
   keeps the pasted URL as its name rather than being fetched.                */

const OEMBED = {
  "open.spotify.com":   "https://open.spotify.com/oembed?url=",
  "youtube.com":        "https://www.youtube.com/oembed?format=json&url=",
  "m.youtube.com":      "https://www.youtube.com/oembed?format=json&url=",
  "music.youtube.com":  "https://www.youtube.com/oembed?format=json&url=",
  "youtu.be":           "https://www.youtube.com/oembed?format=json&url=",
  "soundcloud.com":     "https://soundcloud.com/oembed?format=json&url=",
  "m.soundcloud.com":   "https://soundcloud.com/oembed?format=json&url=",
};

// Services with no oEmbed, where the page's own metadata is read instead.
const SCRAPE = new Set([
  "music.apple.com", "geo.music.apple.com",
  "bandcamp.com", "www.bandcamp.com",
  "beatport.com", "www.beatport.com",
  "deezer.com", "www.deezer.com", "link.deezer.com",
  "tidal.com", "listen.tidal.com",
  "audius.co",
]);

const PROVIDER = (host) =>
  host.includes("spotify") ? "SPOTIFY"
: host.includes("youtu")   ? "YOUTUBE"
: host.includes("soundcloud") ? "SOUNDCLOUD"
: host.includes("apple")   ? "APPLE MUSIC"
: host.includes("bandcamp") ? "BANDCAMP"
: host.includes("beatport") ? "BEATPORT"
: host.includes("deezer")  ? "DEEZER"
: host.includes("tidal")   ? "TIDAL"
: "LINK";

/*
  Titles come back in whatever shape the service felt like. YouTube gives one
  string with the artist, the track and usually a shout about it being an
  official video; Spotify gives the track alone and the artist separately.
  This pulls them into the same two fields so a pool reads as one list rather
  than as five services stapled together.
*/
function splitTitle(raw, author, provider) {
  let title = (raw || "").trim();
  let artist = (author || "").trim();

  // the marketing that gets stapled onto a title
  title = title
    .replace(/\s*[\(\[][^)\]]*\b(official|lyric|audio|video|visualizer|hd|4k|mv)\b[^)\]]*[\)\]]/gi, "")
    .replace(/\s*[-–—|]\s*(official\s+)?(music\s+)?video\s*$/i, "")
    .trim();

  // "Artist - Track" is the near-universal convention on YouTube, and on
  // SoundCloud the "author" is an account handle — soundcloud gives you
  // `blackcoffee`, while the title carries the real name. A handle has no
  // space in it, which is a good enough tell to prefer what the title says.
  const handle = artist && !/\s/.test(artist);
  if (!artist || handle || provider === "YOUTUBE") {
    const m = title.match(/^(.{2,60}?)\s+[-–—]\s+(.{2,})$/);
    if (m) { artist = m[1].trim(); title = m[2].trim(); }
  }
  // SoundCloud's "author" is an account name, which is better than nothing
  if (artist.length > 60) artist = artist.slice(0, 60);
  if (title.length > 140) title = title.slice(0, 140);
  return { title, artist };
}

const meta = (html, prop) => {
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`, "i");
  const alt = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`, "i");
  return (html.match(re) || html.match(alt) || [])[1] || "";
};

async function resolveSong(rawUrl) {
  let u;
  try { u = new URL(rawUrl); } catch { return null; }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;

  const host = u.hostname.replace(/^www\./, "");
  const provider = PROVIDER(host);
  const clean = `${u.origin}${u.pathname}`;   // query strings are tracking, not identity

  const timeout = (ms) => {
    const c = new AbortController();
    setTimeout(() => c.abort(), ms);
    return c.signal;
  };

  try {
    if (OEMBED[host]) {
      const res = await fetch(OEMBED[host] + encodeURIComponent(rawUrl),
                             { signal: timeout(4000), headers: { accept: "application/json" } });
      if (!res.ok) return { provider, ...splitTitle("", "", provider) };
      const d = await res.json();
      const { title, artist } = splitTitle(d.title, d.author_name, provider);
      return { provider, title, artist, artwork: d.thumbnail_url || null };
    }

    if (SCRAPE.has(host)) {
      const res = await fetch(clean, {
        signal: timeout(5000),
        headers: { "user-agent": "Mozilla/5.0 (compatible; HiddenStateBot/1.0)" },
      });
      if (!res.ok) return { provider, title: "", artist: "" };
      const html = (await res.text()).slice(0, 120000);
      const og = meta(html, "og:title") ||
                 (html.match(/<title[^>]*>([^<]+)<\/title>/i) || [])[1] || "";
      const { title, artist } = splitTitle(og, meta(html, "music:musician") ||
                                               meta(html, "og:description").split("·")[0], provider);
      return { provider, title, artist, artwork: meta(html, "og:image") || null };
    }
  } catch {
    /* a service being slow or down must never lose someone's request */
  }
  return { provider, title: "", artist: "", artwork: null };
}

/*  A pasted link with no resolvable name still has to read as something in a
    list, so it falls back to the tidiest thing the URL itself contains.      */
function nameFromUrl(rawUrl) {
  try {
    const u = new URL(rawUrl);
    // Apple Music and friends end in a numeric id; the words are the segment
    // before it, which is the part worth showing.
    const parts = u.pathname.split("/").filter(Boolean).filter((x) => !/^\d+$/.test(x));
    const last = parts.pop() || u.hostname;
    return decodeURIComponent(last).replace(/[-_]+/g, " ").replace(/\.\w{2,4}$/, "").trim();
  } catch { return rawUrl; }
}

/*
  SETTINGS. Anything worth changing on a night without waiting for a deploy.

  Defaults are here; the database only holds what has been changed. That means
  a fresh install works with no settings rows at all, and a bad value can be
  fixed by deleting the row rather than by editing code.
*/
const DEFAULT_SETTINGS = {
  // Seconds a code is ignored after a successful scan. Without this, a camera
  // left pointing at the same pass re-reads it and reports ALREADY USED,
  // which looks to staff like a refusal.
  scanCooldown: 4,
  // Windows either side accepted, for clock drift between phones.
  codeDrift: 1,
  // How long a team session lasts, in hours.
  sessionHours: 12,
  // Failed logins from one address before a pause, and how long that window is.
  loginMaxFails: 8,
  loginWindowMinutes: 15,
  // Copy of every new team account, so there is always a second record.
  accountCopyTo: "management@hiddenstategroup.com",
  // Whether door staff may see the full door list.
  staffSeeDoorList: true,
  // Refill the code pool once fewer than this remain.
  poolLowWater: 200,

  // Go amber at this share of capacity, so a full room is seen coming
  // rather than hit blind.
  capacityWarnAt: 90,

  // How long before the night the reminder goes out. 0 turns it off.
  reminderHoursBefore: 24,

  // Refuse everyone this many minutes after doors open. 0 means no cut-off
  // and the event's own closing time still applies.
  autoCloseAfterMinutes: 0,

  // Whether the public guest list form accepts requests.
  guestListOpen: true,

  // Ask for ID on every pass, not only sold tickets.
  idOnEveryPass: false,

  // Shown at the foot of every email.
  emailSignoff: "Hidden State",

  // ── the public site ──────────────────────────────────────────────────────
  // A line across the top of every page. Empty means no banner.
  announcement: "",
  announcementLink: "",

  // The countdown on the home page.
  showCountdown: true,
  countdownTarget: "2026-12-13T00:00:00+02:00",
  countdownLabel: "COUNTING DOWN TO 13.12.2026",

  // The notes under the roster and the events list.
  rosterNote: "More DJs and producers will join.",
  eventsNote: "More events to come.",

  // Where the public forms send to.
  contactEmail: "info@hiddenstategroup.com",
  bookingEmail: "booking@hiddenstategroup.com",

  // Whether the guest list link is shown publicly at all.
  guestListLinkVisible: true,

  // ── the team ─────────────────────────────────────────────────────────────
  // Whether management may issue and cancel passes, or only you.
  managementCanIssue: false,
  // Whether staff may see guests' email and phone on the door list.
  staffSeeContacts: false,
  // Sign everyone out after this many minutes of doing nothing. 0 disables it.
  idleSignOutMinutes: 0,

  // ── passes ───────────────────────────────────────────────────────────────
  // Default kind and tier when issuing, so the common case is one field less.
  defaultKind: "TICKET",
  defaultTier: "STANDARD",
  // Ask before issuing a second pass to a name already on the list.
  warnOnDuplicate: true,
  // Email the pass automatically when one is issued with an address.
  emailPassOnIssue: true,

  // ── the guest list ───────────────────────────────────────────────────────
  // Most people one request may ask for.
  maxPeoplePerRequest: 6,
  // The line shown after someone asks.
  requestThanksMessage: "We'll be in touch. If you're on the list, your pass arrives by email before the night.",

  // ── the floating bar ─────────────────────────────────────────────────────
  // Width of each tab once it scrolls.
  barTabWidth: 64,
  // Label size. Smaller fits more; larger is readable in a dark room.
  barLabelSize: 7.5,
  // Labels off leaves icons only, which fits far more across.
  barShowLabels: true,

  /*
    ── THE LOOK ─────────────────────────────────────────────────────────────
    The design is a system, not a set of hardcoded values, so the parts of it
    that are a matter of taste can be changed from the console on a Tuesday
    instead of through a deploy.

    Deliberately a SHORT list of named choices rather than free colour pickers.
    Three papers that all work with the ink, three accents that all work on the
    paper. A free colour field would let anyone produce an unreadable site in
    two seconds, and the whole point of a system is that it has edges.
  */
  paperTone: "BOARD",        // BOARD | IVORY | BONE
  accentTone: "OXBLOOD",     // OXBLOOD | BRASS | INK
  grainStrength: "NORMAL",   // NONE | LIGHT | NORMAL | HEAVY
  // The dot screen photographs are printed through, and the warm duotone on
  // the full-bleed ones. Both off gives clean modern photography.
  photoHalftone: true,
  photoDuotone: true,

  // The home page.
  heroImage: "club",         // club | booth | portrait
  heroHeightVw: 46,          // how tall the opening photograph is, in vw
  showContactSheet: true,
  storyHeadline: "",         // empty keeps the built-in line
  closingLine: "",
  footerNote: "",

  // Closes the whole site to visitors, leaving the door tools working. For a
  // rebuild, or if something needs taking down quickly.
  siteClosed: false,
  siteClosedMessage: "Back shortly.",
};

/*
  Which settings the public site may see.

  Deliberately a list rather than a rule: it should be impossible to add a
  setting one day and accidentally publish it. Anything not named here stays
  behind the login.
*/
const PUBLIC_SETTINGS = [
  "announcement", "announcementLink",
  "showCountdown", "countdownTarget", "countdownLabel",
  "rosterNote", "eventsNote",
  "contactEmail", "bookingEmail",
  "guestListLinkVisible", "guestListOpen",
  "siteClosed", "siteClosedMessage",
  "maxPeoplePerRequest", "requestThanksMessage",
  "barTabWidth", "barLabelSize", "barShowLabels",
  "paperTone", "accentTone", "grainStrength", "photoHalftone", "photoDuotone",
  "heroImage", "heroHeightVw", "showContactSheet",
  "storyHeadline", "closingLine", "footerNote",
];

async function getSettings(env) {
  try {
    const rows = await env.DB.prepare("SELECT key, value FROM settings").all();
    const out = { ...DEFAULT_SETTINGS };
    for (const r of rows.results) {
      const fallback = DEFAULT_SETTINGS[r.key];
      if (fallback === undefined) continue;
      out[r.key] = typeof fallback === "number" ? Number(r.value)
                 : typeof fallback === "boolean" ? r.value === "true"
                 : r.value;
    }
    return out;
  } catch (err) {
    // A missing settings table must never stop the door working.
    console.error("Settings unavailable, using defaults:", err && err.message);
    return { ...DEFAULT_SETTINGS };
  }
}

/*
  Permissions. These names are the single vocabulary: the checkboxes in the
  console grant exactly these keys, and every check below reads exactly these
  keys.

  They were briefly two vocabularies — the console granted `issuePasses` while
  the server checked `issue` — which meant ticking a box silently did nothing.
  Keeping one list is what stops that recurring.
*/
/*
  Two of the settings widen what a role may do. They are applied on top of the
  table below rather than written into it, so the table stays the plain
  statement of what each role means.
*/
function withSettings(role, base, cfg) {
  const out = { ...base };
  if (role === "OWNER" && cfg.managementCanIssue) {
    out.issuePasses = true;
    out.revokePasses = true;
  }
  if (role === "STAFF" && cfg.staffSeeContacts) out.seeContacts = true;
  if (role === "STAFF" && cfg.staffSeeDoorList) out.seeList = true;
  return out;
}

const CAN = {
  BOSS: {
    scan: true, seeList: true, seeReasons: true, reset: true,
    issuePasses: true, revokePasses: true, manageTeam: true, seeContacts: true,
  },
  OWNER: {
    scan: true, seeList: true, seeReasons: true, reset: true,
    issuePasses: false, revokePasses: false, manageTeam: false, seeContacts: true,
  },
  STAFF: {
    scan: true, seeList: false, seeReasons: false, reset: false,
    issuePasses: false, revokePasses: false, manageTeam: false, seeContacts: false,
  },
};

/*
  Permissions come from the role by default, but any account can override
  them. That way a particular door supervisor can be given the door list
  without promoting them to management.
*/
function permissionsFor(role, stored, cfg = DEFAULT_SETTINGS) {
  const base = withSettings(role, CAN[role] || CAN.STAFF, cfg);
  if (!stored) return base;
  try {
    // An account's own settings win over the role and over the switches.
    return { ...base, ...JSON.parse(stored) };
  } catch {
    return base;
  }
}

const can = (who, action) => {
  if (!who) return false;
  // `who` may be a session (with its own permissions) or a bare role string.
  if (typeof who === "string") return !!(CAN[who] && CAN[who][action]);
  return !!(who.can && who.can[action]);
};

// ─── the code pool ─────────────────────────────────────────────────────────

/*
  Codes are never reused.

  Handing a finished event's code to someone new would mean an old guest who
  kept their link could open it and read a stranger's name. There are 729
  million possible codes, so there is no reason to recycle.

  Instead the pool tops itself up. Whenever it runs low, more are generated
  and inserted, so issuing never stops mid-night because a list ran out.
*/

// No O/0 or I/1: a code read aloud at a loud door should not be
// guessable-wrong.
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRTUVWXYZ2346789";
const TOP_UP_BY = 1000;

function makeCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  let out = "HS-";
  for (const b of bytes) out += CODE_ALPHABET[b % CODE_ALPHABET.length];
  return out;
}

async function topUpPool(env, lowWater) {
  const row = await env.DB.prepare("SELECT COUNT(*) AS n FROM code_pool WHERE used = 0").first();
  const spare = row ? row.n : 0;
  const threshold = Number(lowWater) > 0 ? Number(lowWater) : DEFAULT_SETTINGS.poolLowWater;
  if (spare >= threshold) return { added: 0, spare };

  // INSERT OR IGNORE handles the rare case of generating one that already
  // exists, so a collision costs a row rather than an error.
  const statements = [];
  for (let i = 0; i < TOP_UP_BY; i += 100) {
    const values = [];
    for (let j = 0; j < 100; j++) values.push(makeCode());
    statements.push(
      env.DB.prepare(
        "INSERT OR IGNORE INTO code_pool (code) VALUES " + values.map(() => "(?)").join(", ")
      ).bind(...values)
    );
  }
  await env.DB.batch(statements);
  console.log(`Code pool topped up: ${spare} left, added about ${TOP_UP_BY}.`);
  return { added: TOP_UP_BY, spare };
}

/*
  ── BACKUPS ───────────────────────────────────────────────────────────────

  Every pass, every request, every song and the whole team live in one
  database with, until now, no copy of it anywhere. A mistake — a bad DELETE,
  a wrong migration, an account removed in error — was final.

  Once a week the entire database is written out as JSON and put in the media
  bucket under a prefix the public route refuses to serve. Twelve are kept,
  which is three months; the oldest is dropped as a new one lands.

  WHY JSON AND NOT SQL. A .sql dump has to be replayed by something that
  understands the dialect, and D1 has already rejected perfectly ordinary DDL
  twice on this project. JSON can be read by anything, including by eye at
  four in the morning, which is when a backup is actually opened.
*/
const PRIVATE_PREFIX = "backups/";
const KEEP_BACKUPS = 12;

// A table can grow without anyone watching. Rather than fail on a huge one,
// take the newest rows and say so in the file.
const MAX_ROWS = 20000;

async function backupDatabase(env) {
  if (!env.MEDIA) return { ok: false, error: "No bucket is connected." };

  const tables = await env.DB.prepare(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
  ).all();

  const dump = {
    taken: now(),
    database: "hiddenstate",
    tables: {},
    truncated: [],
  };

  for (const { name } of tables.results || []) {
    // The table name comes from sqlite_master, not from a request, so it
    // cannot be anything the database did not already call a table.
    const rows = await env.DB.prepare(
      `SELECT * FROM "${name}" LIMIT ${MAX_ROWS + 1}`
    ).all();
    const list = rows.results || [];
    if (list.length > MAX_ROWS) {
      dump.truncated.push(name);
      list.length = MAX_ROWS;
    }
    dump.tables[name] = list;
  }

  const key = `${PRIVATE_PREFIX}hiddenstate-${new Date().toISOString().slice(0, 10)}.json`;
  const body = JSON.stringify(dump);
  await env.MEDIA.put(key, body, {
    httpMetadata: { contentType: "application/json" },
  });

  // Keep the last twelve and drop the rest.
  const listed = await env.MEDIA.list({ prefix: PRIVATE_PREFIX, limit: 200 });
  const old = (listed.objects || [])
    .sort((a, b) => new Date(b.uploaded) - new Date(a.uploaded))
    .slice(KEEP_BACKUPS);
  for (const o of old) await env.MEDIA.delete(o.key);

  return {
    ok: true,
    key,
    bytes: body.length,
    tables: Object.keys(dump.tables).length,
    rows: Object.values(dump.tables).reduce((n, r) => n + r.length, 0),
    dropped: old.length,
    truncated: dump.truncated,
  };
}

// ─── routes ────────────────────────────────────────────────────────────────

async function handleApi(request, env, url, ctx) {
  const path = url.pathname.replace(/^\/api/, "");
  const method = request.method;
  const body = method === "POST" || method === "PATCH" ? await request.json().catch(() => ({})) : {};

  /*
    Login attempts are counted per address. Without this, someone could try
    passwords at machine speed and nothing would stop them.

    Failures are what count, and they expire — a member of staff mistyping
    twice at the start of a shift should not be locked out an hour later.
  */
  const limits = await getSettings(env);
  const LOGIN_WINDOW_MIN = limits.loginWindowMinutes;
  const LOGIN_MAX_FAILS = limits.loginMaxFails;

  /*
    Both of these swallow their own errors on purpose.

    Rate limiting protects the login; it must never BE the reason nobody can
    log in. If the attempts table is missing or the write fails, the login
    carries on unprotected rather than locking out the whole team — a smaller
    problem than a door staff member stuck outside at midnight.
  */
  async function loginBlocked(ip) {
    try {
      const since = new Date(Date.now() - LOGIN_WINDOW_MIN * 60000).toISOString();
      const row = await env.DB.prepare(
        "SELECT COUNT(*) AS n FROM login_attempts WHERE ip = ? AND ok = 0 AND at > ?"
      ).bind(ip, since).first();
      return (row ? row.n : 0) >= LOGIN_MAX_FAILS;
    } catch (err) {
      console.error("Rate-limit check skipped:", err && err.message);
      return false;
    }
  }

  async function recordAttempt(ip, username, ok) {
    try {
      await env.DB.prepare(
        "INSERT INTO login_attempts (ip, username, ok, at) VALUES (?, ?, ?, ?)"
      ).bind(ip, username || null, ok ? 1 : 0, now()).run();
    } catch (err) {
      console.error("Attempt not recorded:", err && err.message);
    }
  }

  // ── team sign in ────────────────────────────────────────────────────────
  if (path === "/login" && method === "POST") {
    const ip = request.headers.get("cf-connecting-ip") || "unknown";
    if (await loginBlocked(ip)) {
      return fail("Too many attempts. Wait a few minutes and try again.", 429);
    }
    const username = String(body.username || "").trim().toLowerCase();
    const member = await env.DB.prepare(
      "SELECT * FROM team WHERE username = ? AND active = 1"
    ).bind(username).first();

    // Hash regardless of whether the account exists, so the response time
    // never reveals which usernames are real.
    const salt = member ? member.salt : "no-such-account";
    const attempt = await hashPassword(String(body.password || ""), salt);
    if (!member || !safeEqual(attempt, member.password_hash)) {
      await recordAttempt(ip, username, false);
      return fail("Those details weren't recognised.", 401);
    }

    await recordAttempt(ip, username, true);
    const settings = await getSettings(env);
    const { token, expires } = await createSession(env, member, settings.sessionHours);
    return json({
      ok: true, token, expires,
      user: { username: member.username, role: member.role, displayName: member.display_name,
              can: permissionsFor(member.role, member.permissions, settings) },
    });
  }

  // Who the current token belongs to. Without this, a refresh would show the
  // login form again even though the session was still perfectly valid.
  if (path === "/me" && method === "GET") {
    const who = await readSession(env, request);
    if (!who) return fail("Not signed in.", 401);
    return json({ ok: true, user: who });
  }

  if (path === "/logout" && method === "POST") {
    const header = request.headers.get("authorization") || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (token) {
      await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(await sha256Hex(token)).run();
    }
    return json({ ok: true });
  }

  // ── a guest opening their own pass ──────────────────────────────────────
  // No login. The code is the credential, and it only ever returns that one
  // pass — there is no way to list or enumerate others.
  if (path.startsWith("/pass/") && method === "GET") {
    const code = decodeURIComponent(path.slice(6)).toUpperCase();
    const pass = await env.DB.prepare(
      "SELECT p.*, y.name AS party_name, y.date_label, y.venue, y.doors_close_at, y.minimum_age, y.rotating, y.starts_at, y.lineup " +
      "FROM passes p JOIN parties y ON y.id = p.party_id WHERE p.code = ?"
    ).bind(code).first();

    if (!pass) return fail("We couldn't find that pass.", 404);
    if (pass.status === "REVOKED") {
      return json({ ok: false, revoked: true, error: "This pass has been cancelled." }, 200);
    }

    const over = new Date(pass.doors_close_at).getTime() < Date.now();
    const code6 = pass.rotating
      ? await rotatingCode(env.PASS_SECRET, pass.code, currentWindow())
      : await rotatingCode(env.PASS_SECRET, pass.code, 0);

    return json({
      ok: true,
      pass: {
        code: pass.code, name: pass.name, kind: pass.kind, tier: pass.tier,
        ticketRef: pass.ticket_ref, note: pass.note, idRequired: !!pass.id_required,
      },
      party: {
        name: pass.party_name, date: pass.date_label, venue: pass.venue,
        capacityWarnAt: undefined,
        minimumAge: pass.minimum_age, rotating: !!pass.rotating, over,
        startsAt: pass.starts_at,
        // Stored as JSON text; parsed here so the page never has to.
        lineup: (() => { try { return JSON.parse(pass.lineup || "[]"); } catch { return []; } })(),
      },
      code: over ? null : code6,
      // Seconds until the number changes, so the page can show a countdown
      // without guessing.
      refreshIn: pass.rotating ? WINDOW_SECONDS - (Math.floor(Date.now() / 1000) % WINDOW_SECONDS) : null,
    });
  }

  /*
    The public site's own settings. No login: these are things every visitor
    sees anyway. Only the names in PUBLIC_SETTINGS are ever sent.
  */
  if (path === "/site" && method === "GET") {
    const all = await getSettings(env);
    const out = {};
    for (const key of PUBLIC_SETTINGS) out[key] = all[key];
    return json({ ok: true, settings: out });
  }

  // Public: the soonest event still open. The guest list form reads its age
  // limit and event from here, so changing them in the console changes the
  // public page too.
  /*
    A setup check. Reports which bindings this Worker can actually see —
    NAMES ONLY, never values. Guessing at whether a secret arrived has cost
    us a lot of time; this answers it in one request.

    Requires a sign-in, so it is not public.
  */
  if (path === "/health" && method === "GET") {
    const who = await readSession(env, request);
    if (!who || !can(who, "manageTeam")) return fail("Not allowed.", 403);

    const present = (v) => (typeof v === "string" && v.length > 0);
    return json({
      ok: true,
      bindings: Object.keys(env).sort(),
      database: !!env.DB,
      assets: !!env.ASSETS,
      passSecret: present(env.PASS_SECRET),
      resendKey: present(env.RESEND_API_KEY),
      // Length only — enough to tell a real key from an empty string or a
      // stray space, without ever revealing the key itself.
      resendKeyLength: typeof env.RESEND_API_KEY === "string" ? env.RESEND_API_KEY.length : 0,
    });
  }

  if (path === "/next-party" && method === "GET") {
    const party = await env.DB.prepare(
      "SELECT id, name, date_label, venue, minimum_age FROM parties " +
      "WHERE archived = 0 AND doors_close_at > ? ORDER BY doors_close_at ASC LIMIT 1"
    ).bind(now()).first();
    return json({ ok: true, party: party || null });
  }

  /*
    "I've lost my link."

    This will be the most common message you ever get. Someone deletes the
    email, changes phone, or simply cannot find it an hour before doors.

    Public on purpose — asking someone to prove who they are before you will
    resend to an address you already hold is theatre. But it never REVEALS
    anything: the reply is identical whether the address is on the list or
    not, so it cannot be used to find out who is coming.
  */
  if (path === "/resend" && method === "POST") {
    const email = String(body.email || "").trim().toLowerCase();
    const sameAnswer = json({
      ok: true,
      message: "If that address is on the list, the pass is on its way.",
    });
    if (!email) return sameAnswer;

    const pass = await env.DB.prepare(
      "SELECT p.*, y.name AS party_name, y.date_label, y.venue, y.minimum_age, y.doors_close_at " +
      "FROM passes p JOIN parties y ON y.id = p.party_id " +
      "WHERE LOWER(p.email) = ? AND p.status = 'ACTIVE' AND y.doors_close_at > ? " +
      "ORDER BY y.doors_close_at ASC LIMIT 1"
    ).bind(email, now()).first();

    if (pass) {
      await sendPassEmail(env, {
        to: pass.email, name: pass.name, code: pass.code,
        party: { name: pass.party_name, date_label: pass.date_label,
                 venue: pass.venue, minimum_age: pass.minimum_age },
        kind: pass.kind,
      });
    }
    return sameAnswer;
  }

  /*
    A calendar file for the guest's own phone.

    Served as a real .ics download rather than a Google link, because that
    works on every phone and every calendar app rather than assuming which
    one someone uses.
  */
  if (path.startsWith("/calendar/") && method === "GET") {
    const code = decodeURIComponent(path.slice(10)).toUpperCase().replace(/\.ics$/i, "");
    const pass = await env.DB.prepare(
      "SELECT p.name, p.code, y.name AS party_name, y.date_label, y.venue, y.doors_close_at, y.starts_at " +
      "FROM passes p JOIN parties y ON y.id = p.party_id WHERE p.code = ? AND p.status = 'ACTIVE'"
    ).bind(code).first();
    if (!pass) return fail("No such pass.", 404);

    // Calendars want UTC in this exact shape, with no punctuation.
    const stamp = (iso) => new Date(iso).toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    const start = pass.starts_at || pass.doors_close_at;

    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Hidden State//Pass//EN",
      "CALSCALE:GREGORIAN",
      "BEGIN:VEVENT",
      `UID:${pass.code}@hiddenstategroup.com`,
      `DTSTAMP:${stamp(new Date().toISOString())}`,
      `DTSTART:${stamp(start)}`,
      `DTEND:${stamp(pass.doors_close_at)}`,
      `SUMMARY:${pass.party_name} — Hidden State`,
      `LOCATION:${pass.venue || "To be announced"}`,
      `DESCRIPTION:Your pass: https://hiddenstategroup.com/pass/${pass.code}`,
      `URL:https://hiddenstategroup.com/pass/${pass.code}`,
      // A reminder three hours before, set by the calendar itself.
      "BEGIN:VALARM",
      "TRIGGER:-PT3H",
      "ACTION:DISPLAY",
      `DESCRIPTION:${pass.party_name} tonight`,
      "END:VALARM",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    return new Response(ics, {
      headers: {
        "content-type": "text/calendar; charset=utf-8",
        "content-disposition": `attachment; filename="hidden-state-${pass.code}.ics"`,
      },
    });
  }

  /*
    POSTS. Written and edited from the console rather than by re-deploying.

    Photographs are not uploaded here: they are files already on the site, and
    the editor offers the ones that exist. That keeps this simple and avoids
    standing up file storage for something that happens a few times a month.
  */
  if (path === "/posts" && method === "GET") {
    // Public. Drafts are only visible to someone signed in.
    const who = await readSession(env, request);
    const showDrafts = who && can(who, "issuePasses");
    const rows = await env.DB.prepare(
      showDrafts
        ? "SELECT * FROM posts ORDER BY sort_date DESC"
        : "SELECT * FROM posts WHERE published = 1 ORDER BY sort_date DESC"
    ).all();

    // Stored flat; handed over in the shape the site already renders.
    const posts = rows.results.map((r) => ({
      ...r,
      body: r.body ? r.body.split("\n").filter(Boolean) : [],
      categories: (() => { try { return JSON.parse(r.categories || "[]"); } catch { return []; } })(),
      published: !!r.published,
    }));
    return json({ ok: true, posts });
  }

  if (path === "/posts" && method === "POST") {
    const who = await readSession(env, request);
    if (!who || !can(who, "issuePasses")) return fail("Not allowed.", 403);
    if (!body.slug || !body.headline) return fail("A web address and a headline are needed.");

    const exists = await env.DB.prepare("SELECT slug FROM posts WHERE slug = ?").bind(body.slug).first();
    if (exists) return fail("A post already uses that web address.", 409);

    await env.DB.prepare(
      "INSERT INTO posts (slug, headline, summary, body, kicker, signoff, category, categories, " +
      "issue, date_label, sort_date, poster, photo, caption, link, link_label, published, created_at, author) " +
      "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).bind(
      body.slug, body.headline, body.summary || null,
      Array.isArray(body.body) ? body.body.join("\n") : (body.body || null),
      body.kicker || null, body.signoff || null,
      body.category || "NEWS", JSON.stringify(body.categories || []),
      body.issue || null, body.dateLabel || null,
      body.sortDate || new Date().toISOString().slice(0, 10),
      body.poster || null, body.photo || null, body.caption || null,
      body.link || null, body.linkLabel || null,
      body.published === false ? 0 : 1, now(), who.username
    ).run();

    return json({ ok: true, slug: body.slug });
  }

  if (path.startsWith("/posts/") && method === "PATCH") {
    const who = await readSession(env, request);
    if (!who || !can(who, "issuePasses")) return fail("Not allowed.", 403);

    const slug = decodeURIComponent(path.slice(7));
    const map = {
      headline: "headline", summary: "summary", kicker: "kicker", signoff: "signoff",
      category: "category", issue: "issue", dateLabel: "date_label", sortDate: "sort_date",
      poster: "poster", photo: "photo", caption: "caption",
      link: "link", linkLabel: "link_label", published: "published",
    };
    const fields = [];
    const values = [];
    for (const [key, column] of Object.entries(map)) {
      if (body[key] === undefined) continue;
      fields.push(`${column} = ?`);
      values.push(typeof body[key] === "boolean" ? (body[key] ? 1 : 0) : body[key]);
    }
    if (body.body !== undefined) {
      fields.push("body = ?");
      values.push(Array.isArray(body.body) ? body.body.join("\n") : body.body);
    }
    if (body.categories !== undefined) {
      fields.push("categories = ?");
      values.push(JSON.stringify(body.categories));
    }
    if (!fields.length) return fail("Nothing to change.");

    fields.push("updated_at = ?");
    values.push(now(), slug);
    await env.DB.prepare(`UPDATE posts SET ${fields.join(", ")} WHERE slug = ?`).bind(...values).run();
    return json({ ok: true, slug });
  }

  if (path.startsWith("/posts/") && method === "DELETE") {
    const who = await readSession(env, request);
    if (!who || !can(who, "issuePasses")) return fail("Not allowed.", 403);
    const slug = decodeURIComponent(path.slice(7));
    await env.DB.prepare("DELETE FROM posts WHERE slug = ?").bind(slug).run();
    return json({ ok: true, slug });
  }

  /*
    UPLOADING A PHOTO.

    Stored in R2 and served back through this Worker at /media/..., so nothing
    needs a public bucket address and every image stays behind your own domain.

    Deliberately strict about what it accepts. An upload endpoint that takes
    anything is a way to host anything, and this one is reachable by every
    account that can write a post.
  */
  if (path === "/upload" && method === "POST") {
    const who = await readSession(env, request);
    if (!who || !can(who, "issuePasses")) return fail("Not allowed.", 403);
    if (!env.MEDIA) return fail("Photo storage is not connected.", 500);

    const form = await request.formData().catch(() => null);
    const file = form && form.get("file");
    if (!file || typeof file === "string") return fail("No file received.");

    const ALLOWED = {
      "image/jpeg": "jpg", "image/png": "png",
      "image/webp": "webp", "image/gif": "gif",
    };
    const ext = ALLOWED[file.type];
    if (!ext) return fail("Images only — JPEG, PNG, WebP or GIF.");

    const MAX = 8 * 1024 * 1024;
    if (file.size > MAX) return fail("That image is over 8MB. Please shrink it first.");

    /*
      The stored name is ours, not theirs. A filename from a phone can contain
      anything, and letting it decide the path is how an upload folder ends up
      with surprises in it.
    */
    const folder = (form.get("folder") || "uploads").toString().replace(/[^a-z0-9-]/gi, "").slice(0, 24) || "uploads";
    const stamp = new Date().toISOString().slice(0, 10);
    const key = `${folder}/${stamp}-${randomHex(6)}.${ext}`;

    await env.MEDIA.put(key, file.stream(), {
      httpMetadata: { contentType: file.type, cacheControl: "public, max-age=31536000, immutable" },
      customMetadata: { uploadedBy: who.username, originalName: String(file.name || "").slice(0, 120) },
    });

    return json({ ok: true, path: `/media/${key}`, key });
  }

  // What has been uploaded, so the editor can offer them.
  if (path === "/media" && method === "GET") {
    const who = await readSession(env, request);
    if (!who || !can(who, "issuePasses")) return fail("Not allowed.", 403);
    if (!env.MEDIA) return json({ ok: true, files: [] });

    const listed = await env.MEDIA.list({ limit: 500 });
    const files = listed.objects
      .map((o) => ({ path: `/media/${o.key}`, key: o.key, size: o.size, uploaded: o.uploaded }))
      .sort((a, b) => new Date(b.uploaded) - new Date(a.uploaded));
    return json({ ok: true, files });
  }

  if (path.startsWith("/media/") && method === "DELETE") {
    const who = await readSession(env, request);
    if (!who || !can(who, "issuePasses")) return fail("Not allowed.", 403);
    const key = decodeURIComponent(path.slice(7));
    await env.MEDIA.delete(key);
    return json({ ok: true, key });
  }

  /*
    ARTISTS, RECORDS AND MIXES.

    One handler for all three, because they differ only in their columns. Three
    near-identical copies would be three places to fix every future change.

    Reading is public — the site uses it. Writing needs the same permission as
    posts.
  */
  const CONTENT = {
    artists: {
      table: "artists", key: "id",
      cols: ["id","name","alias","type","genres","country","location","descr","bio",
             "photo","poster","instagram","sort_order","published"],
      json: ["genres"],
    },
    records: {
      table: "records", key: "slug",
      cols: ["slug","title","artist","kind","tagline","catalog","release_date","cover",
             "playlist","note","tracks","sort_order","published"],
      json: ["tracks"],
    },
    mixes: {
      table: "mixes", key: "slug",
      cols: ["slug","artist_id","name","alias","photo","genres","intro","coming_soon",
             "coming_soon_note","sections","sort_order","published"],
      json: ["genres","sections"],
    },
  };

  const contentMatch = path.match(/^\/content\/(\w+)(?:\/(.+))?$/);
  if (contentMatch) {
    const [, kind, id] = contentMatch;
    const def = CONTENT[kind];
    if (!def) return fail("No such content type.", 404);

    // Parse the JSON columns on the way out so pages never have to.
    const shape = (row) => {
      const out = { ...row };
      for (const col of def.json) {
        try { out[col] = JSON.parse(row[col] || "[]"); } catch { out[col] = []; }
      }
      out.published = !!row.published;
      return out;
    };

    if (method === "GET") {
      const who = await readSession(env, request);
      const drafts = who && can(who, "issuePasses");
      const rows = await env.DB.prepare(
        `SELECT * FROM ${def.table} ${drafts ? "" : "WHERE published = 1"} ORDER BY sort_order, ${def.key}`
      ).all();
      return json({ ok: true, items: rows.results.map(shape) });
    }

    const who = await readSession(env, request);
    if (!who || !can(who, "issuePasses")) return fail("Not allowed.", 403);

    if (method === "POST") {
      const fields = [];
      const marks = [];
      const values = [];
      for (const col of def.cols) {
        // Accept either the column name or its camelCase form.
        const camel = col.replace(/_(\w)/g, (m, c) => c.toUpperCase());
        let v = body[col] !== undefined ? body[col] : body[camel];
        if (v === undefined) continue;
        if (def.json.includes(col)) v = JSON.stringify(v);
        if (typeof v === "boolean") v = v ? 1 : 0;
        fields.push(col); marks.push("?"); values.push(v);
      }
      if (!fields.length) return fail("Nothing to save.");
      await env.DB.prepare(
        `INSERT INTO ${def.table} (${fields.join(", ")}, updated_at) VALUES (${marks.join(", ")}, ?)`
      ).bind(...values, now()).run();
      return json({ ok: true });
    }

    if (method === "PATCH" && id) {
      const sets = [];
      const values = [];
      for (const col of def.cols) {
        if (col === def.key) continue;   // the key itself is never rewritten
        const camel = col.replace(/_(\w)/g, (m, c) => c.toUpperCase());
        let v = body[col] !== undefined ? body[col] : body[camel];
        if (v === undefined) continue;
        if (def.json.includes(col)) v = JSON.stringify(v);
        if (typeof v === "boolean") v = v ? 1 : 0;
        sets.push(`${col} = ?`); values.push(v);
      }
      if (!sets.length) return fail("Nothing to change.");
      await env.DB.prepare(
        `UPDATE ${def.table} SET ${sets.join(", ")}, updated_at = ? WHERE ${def.key} = ?`
      ).bind(...values, now(), decodeURIComponent(id)).run();
      return json({ ok: true });
    }

    if (method === "DELETE" && id) {
      await env.DB.prepare(`DELETE FROM ${def.table} WHERE ${def.key} = ?`)
        .bind(decodeURIComponent(id)).run();
      return json({ ok: true });
    }

    return fail("Unknown request.", 400);
  }

  // ── the door ────────────────────────────────────────────────────────────
  if (path === "/scan" && method === "POST") {
    const who = await readSession(env, request);
    if (!who || !can(who, "scan")) return fail("Not signed in.", 401);
    const settings = await getSettings(env);

    const parts = String(body.payload || "").split("|");
    const code = (parts.length === 3 ? parts[1] : String(body.code || "")).toUpperCase();
    const given = parts.length === 3 ? parts[2] : null;

    const pass = await env.DB.prepare(
      "SELECT p.*, y.name AS party_name, y.doors_close_at, y.rotating, y.starts_at FROM passes p " +
      "JOIN parties y ON y.id = p.party_id WHERE p.code = ?"
    ).bind(code).first();

    const record = async (result, reason) => {
      await env.DB.prepare(
        "INSERT INTO scans (code, party_id, result, reason, scanned_by, scanned_at) VALUES (?, ?, ?, ?, ?, ?)"
      ).bind(code, pass ? pass.party_id : "unknown", result, reason || null, who.username, now()).run();
    };

    if (!pass) { await record("REFUSED", "UNKNOWN"); return json({ ok: false, reason: "UNKNOWN" }); }
    if (pass.status === "REVOKED") {
      await record("REFUSED", "REVOKED");
      return json({ ok: false, reason: "REVOKED", name: pass.name, note: pass.revoke_note });
    }
    if (new Date(pass.doors_close_at).getTime() < Date.now()) {
      await record("REFUSED", "PARTY_OVER");
      return json({ ok: false, reason: "PARTY_OVER", name: pass.name });
    }

    // An optional earlier cut-off, so late arrivals are refused by the system
    // rather than by a judgement call at the door.
    if (settings.autoCloseAfterMinutes > 0 && pass.starts_at) {
      const shutAt = new Date(pass.starts_at).getTime() + settings.autoCloseAfterMinutes * 60000;
      if (Date.now() > shutAt) {
        await record("REFUSED", "DOORS_CLOSED");
        return json({ ok: false, reason: "DOORS_CLOSED", name: pass.name });
      }
    }

    // Rotating codes: accept the window either side for clock drift, then
    // look back ten minutes to tell a stale code from an invented one.
    if (pass.rotating && given !== null) {
      const w = currentWindow();
      let matched = false;
      const drift = Math.max(0, Math.min(5, settings.codeDrift));
      const windows = [w];
      for (let i = 1; i <= drift; i++) windows.push(w - i, w + i);
      for (const win of windows) {
        if (await rotatingCode(env.PASS_SECRET, code, win) === given) { matched = true; break; }
      }
      if (!matched) {
        let stale = false;
        for (let back = 2; back <= 20; back++) {
          if (await rotatingCode(env.PASS_SECRET, code, w - back) === given) { stale = true; break; }
        }
        const reason = stale ? "EXPIRED" : "NOT_VALID";
        await record("REFUSED", reason);
        return json({ ok: false, reason, name: pass.name });
      }
    }

    const already = await env.DB.prepare(
      "SELECT scanned_at FROM scans WHERE code = ? AND party_id = ? AND result = 'ADMITTED'"
    ).bind(code, pass.party_id).first();

    if (already) {
      /*
        A camera left pointing at the same pass reads it again a moment later.
        Reporting ALREADY USED there looks to staff like a refusal, and they
        turn away someone they just admitted.

        So within the cooldown, the same code simply repeats the original
        result instead of counting as a second attempt.
      */
      const secondsSince = (Date.now() - new Date(already.scanned_at).getTime()) / 1000;
      if (secondsSince <= settings.scanCooldown) {
        return json({
          ok: true, repeat: true, name: pass.name, kind: pass.kind, tier: pass.tier,
          ticketRef: pass.ticket_ref, idRequired: !!pass.id_required, admits: pass.admits || 1,
        });
      }
      await record("REFUSED", "USED");
      return json({ ok: false, reason: "USED", name: pass.name, at: already.scanned_at });
    }

    await record("ADMITTED", null);
    return json({
      ok: true, name: pass.name, kind: pass.kind, tier: pass.tier,
      ticketRef: pass.ticket_ref,
      // The night-wide switch wins: if ID is required for everyone, the door
      // asks regardless of what the individual pass says.
      idRequired: settings.idOnEveryPass || !!pass.id_required,
      note: pass.note,
      admits: pass.admits || 1,
    });
  }

  /*
    The roster — everything the door needs to keep working without signal.

    Club basements kill reception, and a scanner that stops at 11pm with a
    queue outside is the worst possible failure. The door downloads this when
    it opens, then can admit people from its own copy.

    Note what is NOT here: the secret that generates the rotating numbers.
    Offline the door verifies the PASS CODE only. That is weaker, and it is
    the right trade — a door that works with a simpler check beats a door
    that has stopped.
  */
  if (path === "/roster" && method === "GET") {
    const who = await readSession(env, request);
    if (!who || !can(who, "scan")) return fail("Not allowed.", 401);

    const partyId = url.searchParams.get("party");
    if (!partyId) return fail("Which event?");

    const rows = await env.DB.prepare(
      "SELECT p.code, p.name, p.kind, p.tier, p.ticket_ref, p.id_required, p.status, p.admits, " +
      "  (SELECT scanned_at FROM scans s WHERE s.code = p.code AND s.result = 'ADMITTED' LIMIT 1) AS admitted_at " +
      "FROM passes p WHERE p.party_id = ?"
    ).bind(partyId).all();

    const party = await env.DB.prepare(
      "SELECT id, name, date_label, doors_close_at, capacity FROM parties WHERE id = ?"
    ).bind(partyId).first();

    // The door needs to know when to start warning, and it may go offline
    // straight after this, so the threshold travels with the roster.
    const cfg = await getSettings(env);
    return json({
      ok: true, party, passes: rows.results, fetchedAt: now(),
      capacityWarnAt: cfg.capacityWarnAt,
    });
  }

  /*
    Admissions recorded while the door was offline, sent up together once
    signal returns. Duplicates are expected — the same pass may have been
    queued twice — so each is checked against what is already recorded rather
    than blindly inserted.
  */
  if (path === "/sync" && method === "POST") {
    const who = await readSession(env, request);
    if (!who || !can(who, "scan")) return fail("Not allowed.", 401);

    const entries = Array.isArray(body.entries) ? body.entries.slice(0, 500) : [];
    let recorded = 0;
    const conflicts = [];

    /*
      WHICH ONES THIS SERVER HAS FINISHED WITH.

      The door used to empty its whole queue the moment a sync came back ok,
      and that quietly threw work away in two ways: anything past the 500-entry
      cap was never looked at, and an entry missing a code or a night was
      skipped here without a word. Both vanished on the phone regardless.

      So the answer now names the entries that were actually dealt with —
      written, already present, or malformed beyond saving — and the door
      removes exactly those and keeps the rest to try again.
    */
    const handled = [];
    const rejected = [];

    for (const e of entries) {
      if (!e.code || !e.party) { rejected.push(e.code || null); continue; }
      const already = await env.DB.prepare(
        "SELECT scanned_at FROM scans WHERE code = ? AND party_id = ? AND result = 'ADMITTED'"
      ).bind(e.code, e.party).first();

      if (already) {
        // Someone was admitted twice — once offline, once elsewhere. Worth
        // surfacing rather than silently dropping. Still "handled": retrying
        // it tomorrow would produce the same answer forever.
        conflicts.push({ code: e.code, at: already.scanned_at });
        handled.push(e.code);
        continue;
      }
      await env.DB.prepare(
        "INSERT INTO scans (code, party_id, result, reason, scanned_by, scanned_at) " +
        "VALUES (?, ?, 'ADMITTED', 'offline', ?, ?)"
      ).bind(e.code, e.party, who.username, e.at || now()).run();
      handled.push(e.code);
      recorded += 1;
    }

    return json({ ok: true, recorded, conflicts, handled, rejected });
  }

  // ── the door list ───────────────────────────────────────────────────────
  if (path === "/passes" && method === "GET") {
    const who = await readSession(env, request);
    const settings = await getSettings(env);
    // Door staff can be allowed the list without being promoted.
    const allowed = can(who, "seeList") || (settings.staffSeeDoorList && can(who, "scan"));
    if (!who || !allowed) return fail("Not allowed.", 403);

    const partyId = url.searchParams.get("party");
    const rows = await env.DB.prepare(
      "SELECT p.code, p.name, p.kind, p.tier, p.ticket_ref, p.note, p.status, p.email, p.admits, " +
      "  (SELECT scanned_at FROM scans s WHERE s.code = p.code AND s.result = 'ADMITTED' LIMIT 1) AS admitted_at, " +
      "  (SELECT COUNT(*) FROM scans s WHERE s.code = p.code AND s.result = 'REFUSED') AS refusals, " +
      "  (SELECT reason FROM scans s WHERE s.code = p.code AND s.result = 'REFUSED' ORDER BY s.id DESC LIMIT 1) AS last_reason " +
      "FROM passes p WHERE p.party_id = ? ORDER BY p.issued_at DESC"
    ).bind(partyId).all();

    return json({ ok: true, passes: rows.results });
  }

  // ── issuing a pass ──────────────────────────────────────────────────────
  if (path === "/passes" && method === "POST") {
    const who = await readSession(env, request);
    if (!who || !can(who, "issuePasses")) return fail("Only the boss can issue passes.", 403);
    if (!body.name || !body.party) return fail("A name and an event are required.");

    // Take the next unused code from the pool rather than inventing one, so
    // two passes can never collide.
    const cfgIssue = await getSettings(env);

    // Refill in the background if we are running low, so issuing never stops.
    ctx.waitUntil(getSettings(env).then((cfg) => topUpPool(env, cfg.poolLowWater)));

    const pooled = await env.DB.prepare(
      "SELECT code FROM code_pool WHERE used = 0 ORDER BY RANDOM() LIMIT 1"
    ).first();
    if (!pooled) {
      // Nothing left at all: generate immediately rather than refusing.
      await topUpPool(env);
      const retry = await env.DB.prepare(
        "SELECT code FROM code_pool WHERE used = 0 ORDER BY RANDOM() LIMIT 1"
      ).first();
      if (!retry) return fail("Couldn't allocate a code. Try again.", 409);
      pooled.code = retry.code;
    }

    await env.DB.batch([
      env.DB.prepare("UPDATE code_pool SET used = 1, used_at = ? WHERE code = ?").bind(now(), pooled.code),
      env.DB.prepare(
        "INSERT INTO passes (code, party_id, name, email, phone, kind, tier, ticket_ref, note, id_required, admits, issued_at, issued_by) " +
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      ).bind(
        pooled.code, body.party, body.name, body.email || null, body.phone || null,
        body.kind || cfgIssue.defaultKind, body.tier || cfgIssue.defaultTier, body.ticketRef || null, body.note || null,
        body.kind === "INVITATION" ? 0 : 1,
        // A couple ticket admits two, a family four unless told otherwise.
        body.admits || (body.kind === "COUPLE" ? 2 : body.kind === "FAMILY" ? 4 : 1),
        now(), who.username
      ),
    ]);

    // Email is best effort. The pass exists either way, and the console shows
    // the link so it can always be sent by hand.
    let email = { sent: false, reason: "no address" };
    if (body.email && cfgIssue.emailPassOnIssue) {
      const party = await env.DB.prepare(
        "SELECT name, date_label, venue, minimum_age FROM parties WHERE id = ?"
      ).bind(body.party).first();
      email = await sendPassEmail(env, {
        to: body.email, name: body.name, code: pooled.code,
        party: party || { name: body.party, date_label: "", venue: null, minimum_age: 16 },
        kind: body.kind,
      });
      if (email.sent) {
        await env.DB.prepare("UPDATE passes SET emailed_at = ? WHERE code = ?")
          .bind(now(), pooled.code).run();
      }
    }

    return json({ ok: true, code: pooled.code, email });
  }

  /*
    Issuing in bulk. One name per line, and a pass for each.

    Everything is done in a single pass over the list so a failure halfway
    through does not leave you unsure which names got through.
  */
  if (path === "/passes/bulk" && method === "POST") {
    const who = await readSession(env, request);
    if (!who || !can(who, "issuePasses")) return fail("Only the boss can issue passes.", 403);

    const lines = String(body.names || "").split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 200);
    if (!lines.length) return fail("No names given.");
    if (!body.party) return fail("Which event?");

    ctx.waitUntil(getSettings(env).then((cfg) => topUpPool(env, cfg.poolLowWater)));
    const issued = [];
    const failed = [];

    for (const line of lines) {
      // "Name, email" or just a name.
      const [name, email] = line.split(",").map((x) => (x || "").trim());
      if (!name) continue;

      const pooled = await env.DB.prepare(
        "SELECT code FROM code_pool WHERE used = 0 ORDER BY RANDOM() LIMIT 1"
      ).first();
      if (!pooled) { failed.push({ name, reason: "no codes left" }); continue; }

      try {
        await env.DB.batch([
          env.DB.prepare("UPDATE code_pool SET used = 1, used_at = ? WHERE code = ?").bind(now(), pooled.code),
          env.DB.prepare(
            "INSERT INTO passes (code, party_id, name, email, kind, tier, id_required, admits, issued_at, issued_by) " +
            "VALUES (?, ?, ?, ?, ?, ?, 1, 1, ?, ?)"
          ).bind(pooled.code, body.party, name, email || null,
                 body.kind || "GUEST", body.tier || null, now(), who.username),
        ]);
        issued.push({ name, email: email || null, code: pooled.code });
      } catch (err) {
        failed.push({ name, reason: "could not be saved" });
      }
    }

    return json({ ok: true, issued, failed });
  }

  /*
    Is this name or address already on the list? Called before issuing, so a
    second pass to the same person is caught rather than discovered at the
    door.
  */
  if (path === "/passes/check" && method === "POST") {
    const who = await readSession(env, request);
    if (!who || !can(who, "issuePasses")) return fail("Not allowed.", 403);

    // The warning can be switched off. Answering with no matches is the same
    // to the caller as there being none, so the console needs no special case.
    const cfgDup = await getSettings(env);
    if (!cfgDup.warnOnDuplicate) return json({ ok: true, matches: [] });

    const rows = await env.DB.prepare(
      "SELECT code, name, email, status FROM passes WHERE party_id = ? AND " +
      "(LOWER(name) = LOWER(?) OR (email IS NOT NULL AND LOWER(email) = LOWER(?)))"
    ).bind(body.party, body.name || "", body.email || "").all();

    return json({ ok: true, matches: rows.results });
  }

  // ── cancelling one ──────────────────────────────────────────────────────
  if (path.startsWith("/passes/") && method === "PATCH") {
    const who = await readSession(env, request);
    if (!who || !can(who, "revokePasses")) return fail("Only the boss can change passes.", 403);

    const code = decodeURIComponent(path.slice(8)).toUpperCase();
    const existing = await env.DB.prepare("SELECT * FROM passes WHERE code = ?").bind(code).first();
    if (!existing) return fail("No such pass.", 404);

    /*
      Cancelling and editing share this route but are different actions.

      Cancelling never deletes: the row stays so the history of a night is
      still readable afterwards, and a mistake can be undone.
    */
    if (body.status === "REVOKED" || body.status === "ACTIVE") {
      const status = body.status;
      await env.DB.prepare(
        "UPDATE passes SET status = ?, revoked_at = ?, revoked_by = ?, revoke_note = ? WHERE code = ?"
      ).bind(status, status === "REVOKED" ? now() : null, who.username, body.reason || null, code).run();
      return json({ ok: true, code, status });
    }

    /*
      Editing. Only the fields actually sent are touched, so changing a name
      cannot silently blank an email that was left out of the request.

      The CODE is deliberately not editable. It is printed on a physical
      ticket and may already be in a guest's hands; changing it would strip
      someone of the pass they are holding.
    */
    const map = {
      name: "name", email: "email", phone: "phone", kind: "kind", tier: "tier",
      ticketRef: "ticket_ref", note: "note", admits: "admits",
      idRequired: "id_required", party: "party_id",
    };
    const fields = [];
    const values = [];
    for (const [key, column] of Object.entries(map)) {
      if (body[key] === undefined) continue;
      fields.push(`${column} = ?`);
      values.push(typeof body[key] === "boolean" ? (body[key] ? 1 : 0) : body[key]);
    }
    if (!fields.length) return fail("Nothing to change.");

    values.push(code);
    await env.DB.prepare(`UPDATE passes SET ${fields.join(", ")} WHERE code = ?`).bind(...values).run();

    // Resend if asked, so a corrected name or a fixed address can go out
    // without issuing a second pass.
    let email = { sent: false, reason: "not requested" };
    if (body.resend) {
      const updated = await env.DB.prepare("SELECT * FROM passes WHERE code = ?").bind(code).first();
      const party = await env.DB.prepare(
        "SELECT name, date_label, venue, minimum_age FROM parties WHERE id = ?"
      ).bind(updated.party_id).first();
      email = await sendPassEmail(env, {
        to: updated.email, name: updated.name, code,
        party: party || { name: updated.party_id, date_label: "", venue: null, minimum_age: 16 },
        kind: updated.kind,
      });
      if (email.sent) {
        await env.DB.prepare("UPDATE passes SET emailed_at = ? WHERE code = ?").bind(now(), code).run();
      }
    }

    return json({ ok: true, code, email });
  }

  // ── events ──────────────────────────────────────────────────────────────
  if (path === "/parties" && method === "GET") {
    const who = await readSession(env, request);
    if (!who) return fail("Not signed in.", 401);
    const pool = await env.DB.prepare("SELECT COUNT(*) AS n FROM code_pool WHERE used = 0").first();
    const rows = await env.DB.prepare(
      "SELECT y.*, (SELECT COUNT(*) FROM passes p WHERE p.party_id = y.id) AS issued " +
      "FROM parties y WHERE y.archived = 0 ORDER BY y.doors_close_at DESC"
    ).all();
    return json({ ok: true, parties: rows.results, codesLeft: pool ? pool.n : 0 });
  }

  if (path === "/parties" && method === "POST") {
    const who = await readSession(env, request);
    if (!who || !can(who, "issuePasses")) return fail("Only the boss can add events.", 403);
    if (!body.id || !body.name || !body.doorsCloseAt) {
      return fail("An id, a name and a closing time are required.");
    }
    await env.DB.prepare(
      "INSERT INTO parties (id, name, date_label, venue, starts_at, doors_close_at, minimum_age, " +
      "rotating, capacity, lineup, artwork, description, created_at, created_by) " +
      "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).bind(
      body.id, body.name, body.dateLabel || body.name, body.venue || null,
      body.startsAt || null, body.doorsCloseAt, body.minimumAge ?? 16,
      body.rotating === false ? 0 : 1, body.capacity || null,
      body.lineup || null, body.artwork || null, body.description || null,
      now(), who.username
    ).run();
    return json({ ok: true, id: body.id });
  }

  if (path.startsWith("/parties/") && method === "PATCH") {
    const who = await readSession(env, request);
    if (!who || !can(who, "issuePasses")) return fail("Only the boss can change events.", 403);

    const id = decodeURIComponent(path.slice(9));
    const fields = [];
    const values = [];
    const map = {
      name: "name", dateLabel: "date_label", venue: "venue",
      doorsCloseAt: "doors_close_at", startsAt: "starts_at",
      minimumAge: "minimum_age", rotating: "rotating",
      archived: "archived", capacity: "capacity", lineup: "lineup",
      artwork: "artwork", description: "description",
    };
    for (const [key, column] of Object.entries(map)) {
      if (body[key] !== undefined) {
        fields.push(`${column} = ?`);
        values.push(typeof body[key] === "boolean" ? (body[key] ? 1 : 0) : body[key]);
      }
    }
    if (!fields.length) return fail("Nothing to change.");
    values.push(id);
    await env.DB.prepare(`UPDATE parties SET ${fields.join(", ")} WHERE id = ?`).bind(...values).run();
    return json({ ok: true, id });
  }

  // Removing an event archives it. Deleting outright would orphan every pass
  // and every scan attached to it, losing the record of a night that happened.
  if (path.startsWith("/parties/") && method === "DELETE") {
    const who = await readSession(env, request);
    if (!who || !can(who, "issuePasses")) return fail("Only the boss can remove events.", 403);
    const id = decodeURIComponent(path.slice(9));
    await env.DB.prepare("UPDATE parties SET archived = 1 WHERE id = ?").bind(id).run();
    return json({ ok: true, id, archived: true });
  }

  /*
    The night in numbers, once it is over — or as it happens.

    Arrival times are the useful part: they tell you whether to open earlier
    or move the headline, which no amount of ticket counting will.
  */
  if (path === "/stats" && method === "GET") {
    const who = await readSession(env, request);
    if (!who || !can(who, "seeList")) return fail("Not allowed.", 403);

    const partyId = url.searchParams.get("party");
    if (!partyId) return fail("Which event?");

    const totals = await env.DB.prepare(
      "SELECT " +
      "  (SELECT COUNT(*) FROM passes WHERE party_id = ?1) AS issued, " +
      "  (SELECT COUNT(*) FROM passes WHERE party_id = ?1 AND status = 'REVOKED') AS cancelled, " +
      "  (SELECT COALESCE(SUM(p.admits),0) FROM passes p JOIN scans s ON s.code = p.code " +
      "     WHERE p.party_id = ?1 AND s.result = 'ADMITTED') AS admitted, " +
      "  (SELECT COUNT(*) FROM scans WHERE party_id = ?1 AND result = 'REFUSED') AS refusals"
    ).bind(partyId).first();

    // Arrivals by hour, so the shape of the night is visible.
    const byHour = await env.DB.prepare(
      "SELECT substr(scanned_at, 12, 2) AS hour, COUNT(*) AS n FROM scans " +
      "WHERE party_id = ? AND result = 'ADMITTED' GROUP BY hour ORDER BY hour"
    ).bind(partyId).all();

    const byKind = await env.DB.prepare(
      "SELECT kind, COUNT(*) AS n FROM passes WHERE party_id = ? GROUP BY kind ORDER BY n DESC"
    ).bind(partyId).all();

    const noShows = (totals?.issued || 0) - (totals?.cancelled || 0) - (totals?.admitted || 0);

    return json({
      ok: true,
      totals: { ...totals, noShows: Math.max(0, noShows) },
      byHour: byHour.results,
      byKind: byKind.results,
    });
  }

  // ── team accounts ───────────────────────────────────────────────────────
  if (path === "/team" && method === "GET") {
    const who = await readSession(env, request);
    if (!who || !can(who, "manageTeam")) return fail("Not allowed.", 403);
    const rows = await env.DB.prepare(
      "SELECT username, role, display_name, email, phone, photo_url, active, created_at FROM team ORDER BY role, username"
    ).all();
    return json({ ok: true, team: rows.results });
  }

  if (path === "/team" && method === "POST") {
    const who = await readSession(env, request);
    if (!who || !can(who, "manageTeam")) return fail("Only the boss can create accounts.", 403);
    if (!body.username || !body.password || !body.role) {
      return fail("A username, password and role are required.");
    }
    if (body.role === "BOSS") return fail("There can only be one boss account.", 400);

    const salt = randomHex(16);

    // Permissions given at creation, filtered to the ones that exist.
    let permissions = null;
    if (body.permissions) {
      const clean = {};
      for (const key of Object.keys(CAN.BOSS)) {
        if (body.permissions[key] !== undefined) clean[key] = !!body.permissions[key];
      }
      permissions = JSON.stringify(clean);
    }

    await env.DB.prepare(
      "INSERT INTO team (username, role, display_name, email, phone, photo_url, password_hash, salt, permissions, created_at, created_by) " +
      "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).bind(
      String(body.username).trim().toLowerCase(), body.role, body.displayName || body.username,
      body.email || null, body.phone || null, body.photoUrl || null,
      await hashPassword(body.password, salt), salt, permissions, now(), who.username
    ).run();

    // Best effort, as with passes: the account exists either way, and the
    // console reports whether the details went out.
    const settings = await getSettings(env);
    const email = await sendAccountEmail(env, {
      to: body.email,
      displayName: body.displayName || body.username,
      username: String(body.username).trim().toLowerCase(),
      password: body.password,
      role: body.role,
      // A copy to management, so there is always a second record of who was
      // given access and when.
      copyTo: settings.accountCopyTo,
    });

    return json({ ok: true, username: body.username, email });
  }

  if (path.startsWith("/team/") && method === "PATCH") {
    const who = await readSession(env, request);
    if (!who || !can(who, "manageTeam")) return fail("Not allowed.", 403);

    const username = decodeURIComponent(path.slice(6)).toLowerCase();
    const target = await env.DB.prepare("SELECT * FROM team WHERE username = ?").bind(username).first();
    if (!target) return fail("No such account.", 404);

    // Guardrails on your own account, so a slip cannot lock you out of your
    // own system.
    if (username === who.username) {
      if (body.active === false) return fail("You can't suspend your own account.", 400);
      if (body.permissions) return fail("You can't change your own permissions.", 400);
      if (body.role && body.role !== target.role) return fail("You can't change your own role.", 400);
    }
    if (target.role === "BOSS" && username !== who.username) {
      return fail("The boss account can't be changed from here.", 403);
    }

    // Suspending drops their sessions at once rather than letting them
    // finish the shift.
    if (body.active === false) {
      await env.DB.prepare("DELETE FROM sessions WHERE username = ?").bind(username).run();
    }

    const map = {
      displayName: "display_name", email: "email", phone: "phone",
      photoUrl: "photo_url", role: "role", active: "active",
    };
    const fields = [];
    const values = [];
    for (const [key, column] of Object.entries(map)) {
      if (body[key] === undefined) continue;
      fields.push(`${column} = ?`);
      values.push(typeof body[key] === "boolean" ? (body[key] ? 1 : 0) : body[key]);
    }

    // Permissions are stored as JSON, only the keys that actually exist.
    if (body.permissions) {
      const clean = {};
      for (const key of Object.keys(CAN.BOSS)) {
        if (body.permissions[key] !== undefined) clean[key] = !!body.permissions[key];
      }
      fields.push("permissions = ?");
      values.push(JSON.stringify(clean));
    }

    // A new password, hashed here and never stored readably.
    if (body.password) {
      const salt = randomHex(16);
      fields.push("password_hash = ?", "salt = ?");
      values.push(await hashPassword(body.password, salt), salt);
      // Changing a password ends every existing session for that person.
      await env.DB.prepare("DELETE FROM sessions WHERE username = ?").bind(username).run();
    }

    if (!fields.length) return fail("Nothing to change.");
    values.push(username);
    await env.DB.prepare(`UPDATE team SET ${fields.join(", ")} WHERE username = ?`).bind(...values).run();

    // Send the new details if a password was set and we have an address.
    let email = { sent: false, reason: "not needed" };
    if (body.password && (body.email || target.email)) {
      const settings = await getSettings(env);
      email = await sendAccountEmail(env, {
        to: body.email || target.email,
        displayName: body.displayName || target.display_name,
        username, password: body.password, role: body.role || target.role,
        copyTo: settings.accountCopyTo,
      });
    }

    return json({ ok: true, username, email });
  }

  if (path.startsWith("/team/") && method === "DELETE") {
    const who = await readSession(env, request);
    if (!who || !can(who, "manageTeam")) return fail("Not allowed.", 403);
    const username = decodeURIComponent(path.slice(6)).toLowerCase();
    if (username === who.username) return fail("You can't delete your own account.", 400);
    await env.DB.batch([
      env.DB.prepare("DELETE FROM sessions WHERE username = ?").bind(username),
      env.DB.prepare("DELETE FROM team WHERE username = ?").bind(username),
    ]);
    return json({ ok: true, username });
  }

  // ── settings ────────────────────────────────────────────────────────────
  if (path === "/settings" && method === "GET") {
    const who = await readSession(env, request);
    if (!who || !can(who, "manageTeam")) return fail("Not allowed.", 403);
    return json({ ok: true, settings: await getSettings(env), defaults: DEFAULT_SETTINGS });
  }

  if (path === "/settings" && method === "PATCH") {
    const who = await readSession(env, request);
    if (!who || !can(who, "manageTeam")) return fail("Only the boss can change settings.", 403);

    const changes = body.settings || {};
    const statements = [];
    for (const [key, value] of Object.entries(changes)) {
      // Only known keys, so a typo cannot quietly create a setting that
      // nothing reads.
      if (!(key in DEFAULT_SETTINGS)) continue;
      statements.push(
        env.DB.prepare(
          "INSERT INTO settings (key, value, updated_at, updated_by) VALUES (?, ?, ?, ?) " +
          "ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at, updated_by = excluded.updated_by"
        ).bind(key, String(value), now(), who.username)
      );
    }
    if (statements.length) await env.DB.batch(statements);
    return json({ ok: true, settings: await getSettings(env) });
  }

  /*
    MAINTENANCE. Destructive work, kept behind one route and one guard.

    Each of these requires the caller to type a confirmation phrase that names
    what is about to happen. A misplaced tap cannot delete a night's guest
    list; someone has to have read the sentence and typed it back.
  */
  if (path === "/maintenance" && method === "POST") {
    const who = await readSession(env, request);
    if (!who || !can(who, "manageTeam")) return fail("Only the boss can do this.", 403);

    const action = String(body.action || "");
    const confirm = String(body.confirm || "");

    const requires = (phrase) => {
      if (confirm !== phrase) {
        return fail(`Type "${phrase}" to confirm.`, 400);
      }
      return null;
    };

    // ── codes ──────────────────────────────────────────────────────────────
    if (action === "codes.add") {
      const many = Math.min(10000, Math.max(1, Number(body.count) || 1000));
      const statements = [];
      for (let i = 0; i < many; i += 100) {
        const values = [];
        for (let j = 0; j < Math.min(100, many - i); j++) values.push(makeCode());
        statements.push(
          env.DB.prepare("INSERT OR IGNORE INTO code_pool (code) VALUES " +
            values.map(() => "(?)").join(", ")).bind(...values)
        );
      }
      await env.DB.batch(statements);
      const left = await env.DB.prepare("SELECT COUNT(*) AS n FROM code_pool WHERE used = 0").first();
      return json({ ok: true, added: many, unused: left ? left.n : 0 });
    }

    if (action === "codes.purgeUnused") {
      const bad = requires("DELETE UNUSED CODES");
      if (bad) return bad;
      // Only unused ones. A used code must never be deleted: its pass points
      // at it, and reusing it later would show one guest another's details.
      const before = await env.DB.prepare("SELECT COUNT(*) AS n FROM code_pool WHERE used = 0").first();
      await env.DB.prepare("DELETE FROM code_pool WHERE used = 0").run();
      return json({ ok: true, deleted: before ? before.n : 0 });
    }

    if (action === "codes.regenerate") {
      const bad = requires("REGENERATE ALL CODES");
      if (bad) return bad;
      const before = await env.DB.prepare("SELECT COUNT(*) AS n FROM code_pool WHERE used = 0").first();
      await env.DB.prepare("DELETE FROM code_pool WHERE used = 0").run();
      const cfg = await getSettings(env);
      await topUpPool(env, Number.MAX_SAFE_INTEGER);   // force a full refill
      const after = await env.DB.prepare("SELECT COUNT(*) AS n FROM code_pool WHERE used = 0").first();
      return json({ ok: true, removed: before ? before.n : 0, unused: after ? after.n : 0 });
    }

    // ── passes ─────────────────────────────────────────────────────────────
    if (action === "passes.deleteForParty") {
      const bad = requires("DELETE ALL PASSES");
      if (bad) return bad;
      if (!body.party) return fail("Which event?");

      const count = await env.DB.prepare(
        "SELECT COUNT(*) AS n FROM passes WHERE party_id = ?"
      ).bind(body.party).first();

      /*
        Scans go too. Leaving them would mean a future pass on a recycled
        code inheriting someone else's admission record — which would read as
        "already used" for a person who has never been.
      */
      await env.DB.batch([
        env.DB.prepare("DELETE FROM scans WHERE party_id = ?").bind(body.party),
        env.DB.prepare("DELETE FROM passes WHERE party_id = ?").bind(body.party),
      ]);
      return json({ ok: true, deleted: count ? count.n : 0 });
    }

    if (action === "scans.clearForParty") {
      const bad = requires("CLEAR THE DOOR RECORD");
      if (bad) return bad;
      if (!body.party) return fail("Which event?");
      const count = await env.DB.prepare(
        "SELECT COUNT(*) AS n FROM scans WHERE party_id = ?"
      ).bind(body.party).first();
      await env.DB.prepare("DELETE FROM scans WHERE party_id = ?").bind(body.party).run();
      return json({ ok: true, deleted: count ? count.n : 0 });
    }

    if (action === "requests.clearDecided") {
      const bad = requires("CLEAR DECIDED REQUESTS");
      if (bad) return bad;
      const count = await env.DB.prepare(
        "SELECT COUNT(*) AS n FROM requests WHERE status != 'PENDING'"
      ).first();
      await env.DB.prepare("DELETE FROM requests WHERE status != 'PENDING'").run();
      return json({ ok: true, deleted: count ? count.n : 0 });
    }

    return fail("Unknown action.", 400);
  }

  // ── guest list requests ─────────────────────────────────────────────────

  /* ── THE SONG POOL ──────────────────────────────────────────────────────
     Public: see a pool, add to a pool. Team: moderate one.                */

  // The events a visitor may add songs to. Deliberately its own route rather
  // than opening /parties: that one carries capacity, closing times and who
  // created it, none of which is a stranger's business.
  /*
    Read a link and say what it is, without storing anything.

    The song pool already had to do this; the sessions editor needs exactly
    the same answer while someone is typing, so it shares the one resolver
    rather than growing a second, slightly different one that drifts.
  */
  if (path === "/resolve" && method === "GET") {
    const who = await readSession(env, request);
    if (!who || !(can(who, "issuePasses") || can(who, "manageTeam")))
      return fail("Sign in first.", 403);
    const raw = url.searchParams.get("url") || "";
    if (!/^https?:\/\//i.test(raw)) return fail("That doesn't look like a link.");
    const found = await resolveSong(raw);
    return json({ ok: true, provider: (found && found.provider) || "LINK",
                  title: (found && found.title) || nameFromUrl(raw),
                  artist: (found && found.artist) || "" });
  }

  /*
    ── READERSHIP ──────────────────────────────────────────────────────────

    Counting without watching anybody.

    What is stored is a day, a path and a number. There is no cookie, no
    identifier, no address, no third party and nothing that could be joined
    back to a person — which is also why no consent banner is needed. The
    cost of that honesty is that this counts VIEWS, not people, and it will
    never tell you how long anyone stayed. It answers one question well:
    is anybody reading the news page.

    The path is checked against the site's real shapes before it is written.
    Without that, anyone could POST arbitrary strings and fill the table.
  */
  if (path === "/hit" && method === "POST") {
    const raw = String(body.path || "").split("?")[0].split("#")[0];
    if (!raw.startsWith("/") || raw.length > 120) return json({ ok: true });

    // Detail pages collapse to their shape. Thirty separate rows for thirty
    // articles tells you less than one row saying the news is read at all,
    // and it keeps a slug out of the table.
    const shape = raw
      .replace(/^\/artists\/[^/]+$/, "/artists/:id")
      .replace(/^\/events\/[^/]+$/, "/events/:id")
      .replace(/^\/news\/[^/]+$/, "/news/:slug")
      .replace(/^\/mixes\/[^/]+$/, "/mixes/:slug")
      .replace(/^\/pass\/[^/]+$/, "/pass/:code");

    const KNOWN = new Set([
      "/", "/records", "/agency", "/artists", "/artists/:id", "/events",
      "/events/:id", "/news", "/news/:slug", "/mixes", "/mixes/:slug",
      "/about", "/contact", "/pool", "/mypass", "/pass/:code",
    ]);
    if (!KNOWN.has(shape)) return json({ ok: true });

    const day = new Date().toISOString().slice(0, 10);
    await env.DB.prepare(
      "INSERT INTO views (day, path, n) VALUES (?, ?, 1) " +
      "ON CONFLICT (day, path) DO UPDATE SET n = n + 1"
    ).bind(day, shape).run().catch(() => {});
    return json({ ok: true });
  }

  if (path === "/views" && method === "GET") {
    const who = await readSession(env, request);
    if (!who || !can(who, "manageTeam")) return fail("Not allowed.", 403);

    const days = Math.min(Math.max(Number(url.searchParams.get("days")) || 30, 1), 365);
    const from = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);

    const byPath = await env.DB.prepare(
      "SELECT path, SUM(n) AS n FROM views WHERE day >= ? GROUP BY path ORDER BY n DESC"
    ).bind(from).all();
    const byDay = await env.DB.prepare(
      "SELECT day, SUM(n) AS n FROM views WHERE day >= ? GROUP BY day ORDER BY day ASC"
    ).bind(from).all();

    const pages = byPath.results || [];
    return json({
      ok: true,
      days,
      total: pages.reduce((t, r) => t + Number(r.n || 0), 0),
      pages,
      daily: byDay.results || [],
    });
  }

  if (path === "/backups" && method === "GET") {
    const who = await readSession(env, request);
    if (!who || !can(who, "manageTeam")) return fail("Not allowed.", 403);
    if (!env.MEDIA) return json({ ok: true, backups: [] });

    const listed = await env.MEDIA.list({ prefix: PRIVATE_PREFIX, limit: 200 });
    const backups = (listed.objects || [])
      .map((o) => ({ key: o.key, name: o.key.slice(PRIVATE_PREFIX.length), size: o.size, taken: o.uploaded }))
      .sort((a, b) => new Date(b.taken) - new Date(a.taken));
    return json({ ok: true, backups });
  }

  if (path === "/backups" && method === "POST") {
    const who = await readSession(env, request);
    if (!who || !can(who, "manageTeam")) return fail("Only the boss can do this.", 403);
    return json(await backupDatabase(env));
  }

  /*
    Downloading one. Deliberately NOT served from /media — that route is
    public. This one checks the session on every request, and the file comes
    back as an attachment so a browser saves it rather than rendering the
    whole guest list into a tab.
  */
  if (path.startsWith("/backups/") && method === "GET") {
    const who = await readSession(env, request);
    if (!who || !can(who, "manageTeam")) return fail("Not allowed.", 403);
    if (!env.MEDIA) return fail("No bucket is connected.", 404);

    const name = decodeURIComponent(path.slice("/backups/".length));
    // Nothing from the request is allowed to walk out of the prefix.
    if (!/^[\w.-]+\.json$/.test(name)) return fail("No such backup.", 404);

    const object = await env.MEDIA.get(PRIVATE_PREFIX + name);
    if (!object) return fail("No such backup.", 404);

    return new Response(object.body, {
      headers: {
        "content-type": "application/json",
        "content-disposition": `attachment; filename="${name}"`,
        "cache-control": "no-store",
      },
    });
  }

  if (path === "/public-parties" && method === "GET") {
    const rows = await env.DB.prepare(
      "SELECT id, name, date_label FROM parties WHERE archived = 0 AND doors_close_at > ? " +
      "ORDER BY doors_close_at ASC LIMIT 12"
    ).bind(now()).all();
    return json({ ok: true, parties: rows.results || [] });
  }

  if (path === "/songs" && method === "GET") {
    const pool = url.searchParams.get("pool") === "HOUSE" ? "HOUSE" : "EVENT";
    const party = url.searchParams.get("party") || null;
    const who = await readSession(env, request);
    const team = !!who && (can(who, "issuePasses") || can(who, "manageTeam"));

    // A hidden song stays in the database and out of the public list; the
    // team sees everything, because moderating a list you cannot see is not
    // moderating.
    const where = pool === "HOUSE" ? "pool = 'HOUSE'" : "pool = 'EVENT' AND party_id = ?";
    const binds = pool === "HOUSE" ? [] : [party];
    const rows = await env.DB.prepare(
      `SELECT id, url, provider, title, artist, artwork, by_name, status, created_at` +
      (team ? ", by_contact" : "") +
      ` FROM songs WHERE ${where}` + (team ? "" : " AND status != 'HIDDEN'") +
      " ORDER BY created_at DESC LIMIT 300"
    ).bind(...binds).all();
    return json({ ok: true, songs: rows.results || [], team });
  }

  if (path === "/songs" && method === "POST") {
    const pool = body.pool === "HOUSE" ? "HOUSE" : "EVENT";
    const party = pool === "EVENT" ? String(body.party || "") : null;
    const raw = String(body.url || "").trim();
    const byName = String(body.name || "").trim().slice(0, 60);

    if (!raw) return fail("Paste a link to the song.");
    if (!/^https?:\/\//i.test(raw)) return fail("That doesn't look like a link. It should start with https://");
    if (pool === "EVENT" && !party) return fail("Pick which night this is for.");

    if (pool === "EVENT") {
      const ok = await env.DB.prepare(
        "SELECT id FROM parties WHERE id = ? AND archived = 0 AND doors_close_at > ?"
      ).bind(party, now()).first();
      if (!ok) return fail("That night isn't taking requests.");
    }

    /* Rate limit. One person with a playlist can fill a pool in a minute, and
       then it is their pool rather than everyone's. */
    const ip = request.headers.get("cf-connecting-ip") || "unknown";
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const recent = await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM songs WHERE ip = ? AND created_at > ?"
    ).bind(ip, since).first();
    if ((recent?.n || 0) >= 8) return fail("That's plenty for one hour — come back later and add more.");

    const found = await resolveSong(raw);
    const title = (found && found.title) || nameFromUrl(raw);
    const artist = (found && found.artist) || "";

    try {
      await env.DB.prepare(
        "INSERT INTO songs (pool, party_id, url, provider, title, artist, artwork, by_name, by_contact, status, created_at, ip) " +
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'NEW', ?, ?)"
      ).bind(pool, party, raw, (found && found.provider) || "LINK", title, artist,
             (found && found.artwork) || null, byName,
             String(body.contact || "").trim().slice(0, 120) || null, now(), ip).run();
    } catch (err) {
      // the unique index doing its job
      if (String(err && err.message).includes("UNIQUE")) {
        return json({ ok: true, duplicate: true, title, artist,
                      message: "That one's already in — good taste." });
      }
      throw err;
    }
    return json({ ok: true, title, artist, provider: (found && found.provider) || "LINK" });
  }

  if (path.startsWith("/songs/") && (method === "PATCH" || method === "DELETE")) {
    const who = await readSession(env, request);
    if (!who || !(can(who, "issuePasses") || can(who, "manageTeam")))
      return fail("Only the team can change the pool.", 403);
    const id = Number(path.split("/")[2]);
    if (!id) return fail("Which song?");

    if (method === "DELETE") {
      await env.DB.prepare("DELETE FROM songs WHERE id = ?").bind(id).run();
      return json({ ok: true });
    }
    const status = ["NEW", "PLAYED", "HIDDEN"].includes(body.status) ? body.status : null;
    if (!status) return fail("Unknown status.");
    await env.DB.prepare("UPDATE songs SET status = ? WHERE id = ?").bind(status, id).run();
    return json({ ok: true });
  }

  if (path === "/requests" && method === "POST") {
    // Public. Anyone can ask; nobody is added by asking.
    const cfg = await getSettings(env);
    if (!cfg.guestListOpen) {
      return fail("The guest list is closed at the moment.", 403);
    }
    if (!body.name || !body.email) return fail("A name and email are required.");
    const people = Math.max(1, Math.min(cfg.maxPeoplePerRequest, Number(body.people) || 1));
    const note = String(body.note || "").slice(0, 150);

    await env.DB.prepare(
      "INSERT INTO requests (party_id, name, email, phone, note, people, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).bind(body.party || null, body.name, body.email, body.phone || null, note, people, now()).run();

    // Tell someone. Sent in the background so the guest is not left waiting on
    // an email service to answer before their request is accepted.
    const party = body.party
      ? await env.DB.prepare("SELECT name, date_label FROM parties WHERE id = ?").bind(body.party).first()
      : null;
    ctx.waitUntil(sendRequestAlert(env, {
      to: cfg.accountCopyTo,
      request: { name: body.name, email: body.email, phone: body.phone, note, people },
      party,
    }));

    // The line to show them comes from settings, so it can be changed without
    // a deploy.
    return json({ ok: true, message: cfg.requestThanksMessage });
  }

  /*
    Approving a request turns it into a real pass in one step: take a code,
    create the pass, email it, and mark the request decided. Doing it as one
    action means a guest can never end up approved but passless.
  */
  if (path.startsWith("/requests/") && method === "PATCH") {
    const who = await readSession(env, request);
    if (!who || !can(who, "issuePasses")) return fail("Only the boss can decide requests.", 403);

    const id = decodeURIComponent(path.slice(10));
    const req = await env.DB.prepare("SELECT * FROM requests WHERE id = ?").bind(id).first();
    if (!req) return fail("No such request.", 404);

    if (body.decision === "DECLINED") {
      await env.DB.prepare(
        "UPDATE requests SET status = 'DECLINED', decided_at = ?, decided_by = ? WHERE id = ?"
      ).bind(now(), who.username, id).run();
      return json({ ok: true, status: "DECLINED" });
    }

    if (req.status === "APPROVED" && req.pass_code) {
      return json({ ok: true, status: "APPROVED", code: req.pass_code, already: true });
    }

    const partyId = body.party || req.party_id;
    if (!partyId) return fail("Which event is this for?");

    const pooled = await env.DB.prepare(
      "SELECT code FROM code_pool WHERE used = 0 ORDER BY RANDOM() LIMIT 1"
    ).first();
    if (!pooled) return fail("The code pool is empty.", 409);

    await env.DB.batch([
      env.DB.prepare("UPDATE code_pool SET used = 1, used_at = ? WHERE code = ?").bind(now(), pooled.code),
      env.DB.prepare(
        "INSERT INTO passes (code, party_id, name, email, phone, kind, note, id_required, admits, issued_at, issued_by) " +
        "VALUES (?, ?, ?, ?, ?, 'GUEST', ?, 1, ?, ?, ?)"
      ).bind(pooled.code, partyId, req.name, req.email, req.phone, req.note,
             Math.max(1, req.people || 1), now(), who.username),
      env.DB.prepare(
        "UPDATE requests SET status = 'APPROVED', pass_code = ?, decided_at = ?, decided_by = ? WHERE id = ?"
      ).bind(pooled.code, now(), who.username, id),
    ]);

    const party = await env.DB.prepare(
      "SELECT name, date_label, venue, minimum_age FROM parties WHERE id = ?"
    ).bind(partyId).first();

    const email = await sendPassEmail(env, {
      to: req.email, name: req.name, code: pooled.code,
      party: party || { name: partyId, date_label: "", venue: null, minimum_age: 16 },
      kind: "GUEST",
    });
    if (email.sent) {
      await env.DB.prepare("UPDATE passes SET emailed_at = ? WHERE code = ?").bind(now(), pooled.code).run();
    }

    return json({ ok: true, status: "APPROVED", code: pooled.code, email });
  }

  if (path === "/requests" && method === "GET") {
    const who = await readSession(env, request);
    if (!who || !can(who, "seeList")) return fail("Not allowed.", 403);
    const rows = await env.DB.prepare(
      "SELECT * FROM requests ORDER BY created_at DESC LIMIT 500"
    ).all();
    return json({ ok: true, requests: rows.results });
  }

  return fail("No such endpoint.", 404);
}

/*
  The reminder.

  Runs once a day. Anyone holding an active pass for an event happening
  tomorrow gets their link again — which does more to cut no-shows than
  anything else, because the commonest reason people miss a night is simply
  forgetting.

  Each pass is marked once sent, so a second run cannot send twice.
*/
async function sendReminders(env) {
  const cfg = await getSettings(env);
  if (!cfg.reminderHoursBefore) {
    console.log("Reminders are switched off.");
    return 0;
  }
  const tomorrow = new Date(Date.now() + cfg.reminderHoursBefore * 3600 * 1000);
  const dayStart = new Date(tomorrow); dayStart.setUTCHours(0, 0, 0, 0);
  const dayEnd = new Date(tomorrow); dayEnd.setUTCHours(23, 59, 59, 999);

  const rows = await env.DB.prepare(
    "SELECT p.code, p.name, p.email, p.kind, y.name AS party_name, y.date_label, y.venue, y.minimum_age " +
    "FROM passes p JOIN parties y ON y.id = p.party_id " +
    "WHERE p.status = 'ACTIVE' AND p.email IS NOT NULL AND p.reminded_at IS NULL " +
    "AND y.archived = 0 AND y.starts_at BETWEEN ? AND ?"
  ).bind(dayStart.toISOString(), dayEnd.toISOString()).all();

  let sent = 0;
  for (const r of rows.results) {
    const res = await sendPassEmail(env, {
      to: r.email, name: r.name, code: r.code,
      party: { name: r.party_name, date_label: r.date_label, venue: r.venue, minimum_age: r.minimum_age },
      kind: r.kind, reminder: true, signoff: cfg.emailSignoff,
    });
    if (res.sent) {
      await env.DB.prepare("UPDATE passes SET reminded_at = ? WHERE code = ?").bind(now(), r.code).run();
      sent += 1;
    }
  }
  console.log(`Reminders: ${sent} of ${rows.results.length} sent.`);
  return sent;
}

export default {
  // Cloudflare calls this on the schedule in wrangler.jsonc.
  /*
    Two schedules now, told apart by which one fired. Running the backup daily
    would keep twelve days rather than twelve weeks, which is the wrong window
    — a mistake is usually noticed within a day but sometimes within a month.
  */
  async scheduled(event, env, ctx) {
    if (event.cron === "0 4 * * 1") {
      ctx.waitUntil(
        backupDatabase(env).then((r) =>
          console.log(r.ok ? `Backup: ${r.rows} rows in ${r.tables} tables → ${r.key}` : `Backup failed: ${r.error}`)
        )
      );
      return;
    }
    ctx.waitUntil(sendReminders(env));
  },

  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/")) {
      try {
        return await handleApi(request, env, url, ctx);
      } catch (err) {
        // Never return the raw error: it can reveal table names and query
        // shapes. Log it for the dashboard, tell the caller nothing useful.
        console.error("API error:", err && err.message, err && err.stack);
        /*
          The message is normally hidden, because error text can reveal table
          names and query shapes. During setup that secrecy costs more than it
          buys: a bare "something went wrong" is impossible to act on. Set
          DEBUG_ERRORS to "1" as a Worker variable to see the real reason, and
          remove it once the system is running.
        */
        const detail = env.DEBUG_ERRORS === "1" && err ? String(err.message) : undefined;
        return json({ ok: false, error: "Something went wrong.", detail }, 500);
      }
    }

    /*
      Uploaded photographs. Served from here rather than a public bucket so
      the address stays on your own domain, and cached hard because an
      uploaded file never changes — a new upload gets a new name.
    */
    if (url.pathname.startsWith("/media/")) {
      if (!env.MEDIA) return new Response("Not found", { status: 404 });
      const key = decodeURIComponent(url.pathname.slice(7));

      /*
        THIS ROUTE IS PUBLIC AND HAS NO LOGIN ON IT — by design, because it
        serves the photographs on the site. It therefore hands out ANY object
        in the bucket to anyone who guesses its name.

        That is fine for pictures and catastrophic for anything else, so the
        bucket now has a reserved prefix that this route refuses outright.
        The database backups live under it. Without this line, adding backups
        to this bucket would have published every guest, every email address
        and every pass at a URL anyone could type.
      */
      if (key.startsWith(PRIVATE_PREFIX)) return new Response("Not found", { status: 404 });

      const object = await env.MEDIA.get(key);
      if (!object) return new Response("Not found", { status: 404 });

      const headers = new Headers();
      object.writeHttpMetadata(headers);
      headers.set("etag", object.httpEtag);
      headers.set("cache-control", "public, max-age=31536000, immutable");
      return new Response(object.body, { headers });
    }

    // Everything else is the website itself.
    return env.ASSETS.fetch(request);
  },
};
