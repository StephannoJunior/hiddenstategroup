/*
  ══ THE FOUNDATION ══════════════════════════════════════════════════════════

  Everything the routes are built out of: the response helpers, hashing,
  sessions, permissions, the settings and their defaults, the shape of the
  content tables, email, the code pool, backups, and the security headers.

  IT LIVES HERE BECAUSE ROUTE MODULES MUST NOT IMPORT THE ENTRY POINT. Leaving
  it in index.js and importing back from a route file would be a cycle — the
  kind that works until the day the evaluation order changes and something is
  undefined at exactly the wrong moment. Nothing in this file imports anything
  of ours, so nothing can point back at it.

  It was extracted from index.js unchanged. Every declaration is the same
  declaration, in the same order, with `export` in front of it.
*/
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

export const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

export const fail = (message, status = 400) => json({ ok: false, error: message }, status);

export const now = () => new Date().toISOString();

// ─── crypto helpers ────────────────────────────────────────────────────────

export const enc = new TextEncoder();

export async function sha256Hex(text) {
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
export const PBKDF2_ROUNDS = 100000;

export async function hashPassword(password, salt) {
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
export function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/*
  ARTISTS, RECORDS AND MIXES — the shape of all three, at module scope.

  It lived inside the fetch handler, which was fine while one route used it.
  The drafts route publishes into these same tables and needs the same column
  list, the same JSON columns and the same key; declaring it out here is what
  stops that being a second copy that drifts the first time a column is added.
*/
export const CONTENT = {
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
  /*
    PAGES BUILT IN THE CONSOLE. Deliberately the same shape as the three
    above, which is what lets drafts, the preview token and publishing work on
    them without a line of new code in any of those routes. A page is a slug,
    some words, and an ordered list of blocks.
  */
  pages: {
    table: "pages", key: "slug",
    cols: ["slug","title","kicker","sub","blocks","in_nav","nav_label",
           "seo_description","sort_order","published"],
    json: ["blocks"],
  },
  /*
    BLOCKS DROPPED INTO A PAGE THAT ALREADY EXISTS. The id is the place —
    "home:top", "about:bottom" — which is what makes a two-part key fit a
    one-column primary key, and therefore fit everything above.
  */
  slots: {
    table: "slots", key: "id",
    cols: ["id","blocks","sort_order","published"],
    json: ["blocks"],
  },
};

/*
  ── SLUGS A PAGE MAY NOT HAVE ───────────────────────────────────────────────

  A built page lives at /<slug>, which is the same namespace every real route
  lives in. Without this list somebody could publish a page called "console"
  or "scan" and, depending on which route matched first, either shadow the
  door tools or produce a page nobody can reach and nobody can explain.

  It is checked when a page is PUBLISHED rather than when it is typed, because
  the check belongs where the consequence is. A draft called "console" harms
  nothing; publishing one does.

  Kept as an explicit list rather than derived, because the routes live in the
  front end and this is the back: a list that has to be updated by hand when a
  route is added is worse than one that cannot be, but it is much better than
  a clever rule that is wrong.
*/
export const RESERVED_SLUGS = new Set([
  "", "api", "assets", "static",
  "news", "records", "agency", "artists", "events", "mixes", "about", "contact",
  "pool", "polls", "demos", "bookings", "wall", "kit", "pass", "mypass", "scan",
  "guestlist", "doorlist", "admin", "console", "admins-staff-boss", "p", "preview",
]);

/*
  ── HEADERS EVERY RESPONSE CARRIES ──────────────────────────────────────────

  The site shipped without a single one of these. Four of them are free and
  have no failure mode, so they are simply on:

    X-Content-Type-Options   stops a browser second-guessing a content type and
                             deciding an uploaded file is really a script.
    Referrer-Policy          stops the full address of a private page — a kit
                             link, a preview token — being sent to whatever a
                             visitor clicks through to. This one matters here
                             more than on most sites, because several of this
                             site's addresses ARE the permission.
    Permissions-Policy       nothing on this site needs a camera, a microphone
                             or a location, so nothing may ask.
    X-Frame-Options          another site cannot put this one in a frame and
                             collect clicks meant for it.

  Strict-Transport-Security is set for two years. It is the one header here
  that is hard to undo — a browser that has seen it will refuse plain HTTP for
  that long — which is the point of it and also the reason to say so out loud.
*/
export const SAFE_HEADERS = {
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  "x-frame-options": "SAMEORIGIN",
  "strict-transport-security": "max-age=63072000; includeSubDomains",
};

/*
  ── THE CONTENT SECURITY POLICY ─────────────────────────────────────────────

  WHY frame-ancestors IS 'self' AND NOT 'none'. The Studio previews a draft by
  loading the real page in a frame beside the form. 'none' would break that,
  and the failure would look like the preview being broken rather than like a
  header being wrong — so this is a deliberate 'self' rather than a weakened
  'none'.

  WHY img-src ALLOWS ANY https: HOST. Artist photographs, record covers and
  every image block in the page builder take a URL somebody types. Restricting
  this to 'self' would mean the only usable images were ones uploaded here,
  which is not how the console works. The exposure is that a page can load a
  picture from elsewhere, which is what a picture from elsewhere does.

  WHY script-src ALLOWS 'unsafe-inline'. Honestly: because this policy has not
  been proved against a real build yet, and a strict script-src that turns out
  to be wrong takes the whole site down rather than degrading. See below.
*/
export const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "form-action 'self'",
  "frame-ancestors 'self'",
  "img-src 'self' data: blob: https:",
  "media-src 'self' https:",
  "font-src 'self' https://fonts.gstatic.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "script-src 'self' 'unsafe-inline'",
  "connect-src 'self'",
  // exactly the four hosts an embed block may point at
  "frame-src https://open.spotify.com https://w.soundcloud.com " +
    "https://www.youtube-nocookie.com https://player.vimeo.com",
  "report-uri /api/csp",
].join("; ");

/*
  REPORT-ONLY UNTIL YOU SAY OTHERWISE, and that is not timidity — it is the
  only honest way to ship a policy that has never been run against the real
  build. An enforcing CSP that is subtly wrong does not degrade: it blanks the
  site for everyone at once, and you find out from a person rather than from a
  log.

  So it reports first. Violations arrive at /api/csp and are filed exactly
  where a JavaScript error is filed, which means they show up in FAULTS in the
  console. Watch it for a week; when nothing is arriving, turn on cspEnforce in
  settings and the same policy starts blocking instead of reporting.
*/
export const securityHeaders = (enforce) => ({
  ...SAFE_HEADERS,
  [enforce ? "content-security-policy" : "content-security-policy-report-only"]: CSP,
});

export const randomHex = (bytes = 32) =>
  [...crypto.getRandomValues(new Uint8Array(bytes))].map((b) => b.toString(16).padStart(2, "0")).join("");

// ─── the rotating door code ────────────────────────────────────────────────

export const WINDOW_SECONDS = 30;
export const currentWindow = () => Math.floor(Date.now() / 1000 / WINDOW_SECONDS);

export async function rotatingCode(secret, code, window) {
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
export async function sendPassEmail(env, { to, name, code, party, kind, reminder = false, signoff = "Hidden State" }) {
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
/*
  A plain note, for the messages that are not passes: the health check, and
  telling somebody what happened to their guest list request. The pass email
  has its own function because it is a designed thing with a code in it; this
  one is deliberately just words.
*/
export async function sendNote(env, { to, subject, text }) {
  if (!env.RESEND_API_KEY) {
    console.error("Note skipped: RESEND_API_KEY is not set.");
    return false;
  }
  if (!to) return false;
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
        subject,
        text,
      }),
    });
    if (!res.ok) console.error("Note failed:", res.status, await res.text());
    return res.ok;
  } catch (err) {
    console.error("Note failed:", err && err.message);
    return false;
  }
}

export async function sendAccountEmail(env, { to, displayName, username, password, role, copyTo }) {
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
export async function sendRequestAlert(env, { to, request, party }) {
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

export async function createSession(env, member, hours) {
  const token = randomHex(32);
  // Comes from settings, so changing it in the console actually takes effect.
  const span = Number(hours) > 0 ? Number(hours) : DEFAULT_SETTINGS.sessionHours;
  const expires = new Date(Date.now() + span * 3600 * 1000).toISOString();
  await env.DB.prepare(
    "INSERT INTO sessions (token_hash, username, role, created_at, expires_at) VALUES (?, ?, ?, ?, ?)"
  ).bind(await sha256Hex(token), member.username, member.role, now(), expires).run();
  return { token, expires };
}

export async function readSession(env, request) {
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

export const OEMBED = {
  "open.spotify.com":   "https://open.spotify.com/oembed?url=",
  "youtube.com":        "https://www.youtube.com/oembed?format=json&url=",
  "m.youtube.com":      "https://www.youtube.com/oembed?format=json&url=",
  "music.youtube.com":  "https://www.youtube.com/oembed?format=json&url=",
  "youtu.be":           "https://www.youtube.com/oembed?format=json&url=",
  "soundcloud.com":     "https://soundcloud.com/oembed?format=json&url=",
  "m.soundcloud.com":   "https://soundcloud.com/oembed?format=json&url=",
};

// Services with no oEmbed, where the page's own metadata is read instead.
export const SCRAPE = new Set([
  "music.apple.com", "geo.music.apple.com",
  "bandcamp.com", "www.bandcamp.com",
  "beatport.com", "www.beatport.com",
  "deezer.com", "www.deezer.com", "link.deezer.com",
  "tidal.com", "listen.tidal.com",
  "audius.co",
]);

export const PROVIDER = (host) =>
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
export function splitTitle(raw, author, provider) {
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

export const meta = (html, prop) => {
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`, "i");
  const alt = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`, "i");
  return (html.match(re) || html.match(alt) || [])[1] || "";
};

export async function resolveSong(rawUrl) {
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
export function nameFromUrl(rawUrl) {
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
export const DEFAULT_SETTINGS = {
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

  /*
    ── S06 · AND WHAT HAPPENS WHEN IT IS FULL ─────────────────────────────

    Capacity was watched and warned about, and nothing decided what to do at
    a hundred percent — which meant it was decided at the door, by whoever
    was holding the phone, differently each time.

    WARN    admit, and say the room is full. The door keeps moving and the
            decision stays with the person, informed.
    REFUSE  refuse, and say so. For a hard legal or licence limit, where
            "one more" is not yours to give.
    IGNORE  the count is information and nothing else.
  */
  capacityFullAction: "WARN",

  // How long before the night the reminder goes out. 0 turns it off.
  reminderHoursBefore: 24,

  // Refuse everyone this many minutes after doors open. 0 means no cut-off
  // and the event's own closing time still applies.
  autoCloseAfterMinutes: 0,

  // Whether the public guest list form accepts requests.
  guestListOpen: true,

  /*
    ── THE WAITING LIST — N05 ───────────────────────────────────────────────

    A full night used to turn every later request away permanently. Now the
    request joins a queue instead, in the order it arrived, which is the only
    order anyone accepts as fair.

    Offering a place is deliberate and stays deliberate: there is no automatic
    promotion when a pass is cancelled. Someone else's pass issuing itself a
    second after you revoke one is the kind of thing you want to have chosen.
  */
  waitlistOpen: true,
  waitlistMessage: "The list is full for this one — you are on the waiting list, and we will write if a place comes free.",

  // Ask for ID on every pass, not only sold tickets.
  idOnEveryPass: false,

  // Shown at the foot of every email.
  emailSignoff: "Hidden State",

  /*
    ── DEMOS AND BOOKINGS — L01, L04 ────────────────────────────────────────
    Both refused on the server when closed. The page hides the form as a
    courtesy; this is what actually says no.
  */
  /*
    ── PRESS KITS ───────────────────────────────────────────────────────────

    Everything about a kit that should be changeable without a deploy. The
    two that matter most are at the top: whether a promoter can take the whole
    thing in one download, and how long a link you make today keeps working.
  */
  kitZip: true,               // K15 · offer everything as one download
  kitOnesheet: true,          // K16 · offer the printable one page
  kitWatermark: false,        // K19 · mark the previews, never the downloads
  kitWatermarkText: "HIDDEN STATE — PRESS USE",
  // K18 · how long a new link lasts. 0 means it does not expire and is
  // revoked by hand instead, which is right for a kit and wrong for anything
  // else. Days.
  kitLinkDays: 0,
  kitFooterNote: "Private link — please do not publish it.",
  // Used on a kit whose artist has no contact of their own, so a promoter is
  // never left with no way to reach anybody.
  kitContactFallback: "",

  demosOpen: true,
  demosClosedMessage: "We are not listening to demos at the moment. Try again in a few weeks.",
  demosNote: "One link — SoundCloud, Drive, wherever it lives. We listen to everything and answer what we can.",
  bookingsOpen: true,
  bookingsNote: "Tell us the date, the room and the budget and we can answer in one reply instead of five.",

  /*
    ── THE SONG POOL ────────────────────────────────────────────────────────

    Every rule the pool runs on, so a night can be opened, tightened or shut
    without a deploy. The defaults below are what it did before any of this
    was configurable.

    The two pools are switched separately on purpose: the house list is a
    standing record of what the room likes and usually stays open, while the
    per-night pool wants closing the moment a set starts.
  */
  /*
    ── HOW EACH POOL WORKS ─────────────────────────────────────────────────

    ADD   anybody puts songs in. The pool is a suggestion box, and its
          contents are whatever the room brought.
    VOTE  only the team puts songs in; everybody else chooses between them.
          The pool is a ballot, and the list is a set of options you decided
          on. This is the mode for "which of these five closes the night".

    Set per pool, because the two usually want different answers: a ballot
    for the night and an open box for the house list.
  */
  poolEventMode: "ADD",
  poolHouseMode: "ADD",
  // How many different songs one person may vote for. 1 makes it a straight
  // choice; more makes it an approval vote, which is friendlier and produces
  // a more useful ranking.
  poolVotesPerPerson: 3,
  // Whether the public sees the tallies, or only that they have voted.
  // Hiding them until the night is how you stop early votes snowballing.
  poolShowVotes: true,

  poolOpen: true,              // the master switch — off hides the page entirely
  poolEventOpen: true,         // the pool tied to a specific night
  poolHouseOpen: true,         // the standing house list

  // Who may put something in.
  poolNeedPass: false,         // only people holding a pass for a night
  poolRequireName: false,      // a name is required rather than optional

  // How much one person may add. perHour is the burst; maxPerPerson is the
  // total in a single pool, counted the same way (by address).
  poolPerHour: 8,
  poolMaxPerPerson: 0,         // 0 = no total cap, only the hourly one

  // Whether the same song may be added twice to one pool.
  poolAllowDuplicates: false,

  // What the public sees. The team always sees everything.
  poolShowList: true,          // off = you can add, but not read what others added
  poolShowNames: true,         // off = the list is there, the names are not
  poolShowPlayed: true,        // off = PLAYED marks are the team's business

  // The page's own words.
  poolHeadline: "",            // empty = "The Pool"
  poolSub: "",                 // empty = "PASTE A LINK — WE'LL FIND THE NAME"
  poolNote: "",                // a line under the form; empty = nothing
  poolClosedMessage: "The pool is closed right now. It opens again before the next night.",
  /*
    ── THE STAFF DOOR ───────────────────────────────────────────────────────

    Press and hold the wordmark and the staff login opens. Nothing on the
    public site says so, which is the point: it replaced a visible link that
    was both findable by guests and, worse, disappeared entirely the moment
    the boss happened to be holding a ticket.

    THIS CANNOT LOCK YOU OUT. /admins-staff-boss is a real address and always
    works, typed straight into a browser, whatever these are set to. Switching
    the hold off removes the shortcut, not the door.
  */
  staffDoorHold: true,
  // How long to hold, in milliseconds. Under about 500 and an ordinary slow
  // tap starts opening it; over about 1500 and it feels broken while you wait.
  staffDoorHoldMs: 900,
  // A short buzz when it triggers. On a control with no appearance it is the
  // only confirmation there is — but not every phone obliges.
  staffDoorBuzz: true,

  /*
    ── MOVEMENT ─────────────────────────────────────────────────────────────

    How much the site moves. Each of these is a separate thing you may want
    off on its own, rather than one blunt switch.

    A visitor whose system asks for reduced motion gets none of it regardless
    of what is set here — that setting is theirs, not yours, and it wins.
  */
  motionReveals: true,     // sections arrive as you reach them
  motionDevelop: true,     // photographs come up flat and resolve into tone
  motionRoll: true,        // the countdown's digits roll rather than snap
  motionLogoInk: true,     // the mark inks itself onto the sleeve, once a visit
  showFolio: true,         // section name and position in the left margin

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
  /*
     The bar's glass finish. LENS carries almost no colour of its own and
     works by squeezing the backdrop toward a middle tone, so it holds up over
     paper and over photographs alike; CLEAR is the most transparent and the
     least forgiving; INK leans dark and belongs over photography.
  */
  barFinish: "INK",
  barTabWidth: 64,
  // Label size. Smaller fits more; larger is readable in a dark room.
  barLabelSize: 7.5,
  // Labels off leaves icons only, which fits far more across.
  barShowLabels: true,

  /*
    ── HOW DARK THE GLASS IS ──────────────────────────────────────────────

    Nought to a hundred, where a hundred is nearly opaque. It moves the tint
    AND the backdrop brightness together on one curve, which is the whole
    reason it exists: those were two separate hardcoded numbers, and they
    were both doing the darkening at once. Multiplied out, about fourteen per
    cent of the page was reaching the eye through the bar — a black slab, not
    dark glass — and neither number looked wrong on its own.

    The console shows what this actually means next to the slider, as the
    percentage of the page that still comes through, because "62" tells you
    nothing about a thing you are judging by eye.
  */
  barDarkness: 62,
  /*
    The blur radius, in pixels. This is the expensive one: the compositor
    re-samples everything behind the bar through it, and the cost climbs
    fast. Twenty-two is a long way past the point where more is visible.
  */
  barBlur: 22,
  // How much colour survives the backdrop. Under 100 drains it; over 200 is
  // where glass starts to read as glass rather than as tracing paper.
  barSaturation: 175,
  /*
    A multiplier on how quickly everything moves, not a duration. Above 1 is
    quicker. It scales the response of every spring at once, so the bar keeps
    its character — the selection still leads, the corners still arrive last —
    and only the tempo changes.
  */
  barSpeed: 1,

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

  /*
    ── THE POLLS ──────────────────────────────────────────────────────────

    A poll's own audience and pick limit live on the poll, because they are
    decisions about THAT question rather than about the site. What is here is
    only what applies to all of them at once.
  */
  pollsOpen: true,             // the master switch — off hides the page entirely
  pollsHeadline: "",           // empty = "Polls"
  pollsSub: "",                // empty = the built-in line
  pollsNote: "",               // a line under the list; empty = nothing
  pollsClosedMessage: "Nothing to vote on right now. There will be.",
  /*
    How many different people may vote from one address in an hour. The
    browser id is the honest half of one-person-one-vote and a private window
    clears it; this is what stops the same person doing it forty times.

    NOT published to the page, like every other limit here: a limit nobody can
    read is a limit nobody games.
  */
  pollsPerHour: 6,

  /*
    Turns the content security policy from REPORTING into BLOCKING.

    Leave it off until FAULTS has been quiet for a week. On, the policy stops
    anything it disagrees with; off, it only files a report. The difference
    between the two is the difference between finding out from a log and
    finding out from a person.
  */
  cspEnforce: false,

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
export const PUBLIC_SETTINGS = [
  "announcement", "announcementLink",
  "showCountdown", "countdownTarget", "countdownLabel",
  "rosterNote", "eventsNote",
  "contactEmail", "bookingEmail",
  "guestListLinkVisible", "guestListOpen",
  "siteClosed", "siteClosedMessage",
  // requestThanksMessage is returned with the request that earns it, so it
  // does not need publishing to everyone who loads any page.
  "maxPeoplePerRequest",
  "barFinish", "barTabWidth", "barLabelSize", "barShowLabels",
  "barDarkness", "barBlur", "barSaturation", "barSpeed",
  "paperTone", "accentTone", "grainStrength", "photoHalftone", "photoDuotone",
  "heroImage", "heroHeightVw", "showContactSheet",
  "storyHeadline", "closingLine", "footerNote",
  /*
    The pool's PUBLIC settings only — the ones the page has to know to draw
    itself. The rest of its rules (the rate limits, the duplicate policy, and
    what the list is allowed to show) are deliberately NOT here: they are
    enforced on this side, and publishing them would hand every visitor the
    door policy. A limit nobody can read is a limit nobody games.
  */
  "staffDoorHold", "staffDoorHoldMs", "staffDoorBuzz",
  "motionReveals", "motionDevelop", "motionRoll", "motionLogoInk", "showFolio",
  // The ballot's own settings are NOT here: the page learns the mode, the
  // number of picks and whether tallies are visible from the /songs response
  // that it has to make anyway. Publishing them as well would send every
  // visitor a second copy of something they already have.
  "poolOpen", "poolEventOpen", "poolHouseOpen", "poolNeedPass", "poolRequireName",
  "poolHeadline", "poolSub", "poolNote", "poolClosedMessage",
  /*
    The polls' words and the master switch, so the page can draw itself and
    the nav can decide whether to offer the link at all. pollsPerHour is NOT
    here — see the note on it.
  */
  "pollsOpen", "pollsHeadline", "pollsSub", "pollsNote", "pollsClosedMessage",
  /*
    Demos and bookings publish only whether they are open and the line above
    each form. The rate limits are not here for the same reason the pool's are
    not: they are enforced on this side, and a limit nobody can read is a
    limit nobody games.
  */
  "demosOpen", "demosNote", "demosClosedMessage",
  "bookingsOpen", "bookingsNote",
];

export async function getSettings(env) {
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
export function withSettings(role, base, cfg) {
  const out = { ...base };
  if (role === "OWNER" && cfg.managementCanIssue) {
    out.issuePasses = true;
    out.revokePasses = true;
  }
  if (role === "STAFF" && cfg.staffSeeContacts) out.seeContacts = true;
  if (role === "STAFF" && cfg.staffSeeDoorList) out.seeList = true;
  return out;
}

export const CAN = {
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
export function permissionsFor(role, stored, cfg = DEFAULT_SETTINGS) {
  const base = withSettings(role, CAN[role] || CAN.STAFF, cfg);
  if (!stored) return base;
  try {
    // An account's own settings win over the role and over the switches.
    return { ...base, ...JSON.parse(stored) };
  } catch {
    return base;
  }
}

export const can = (who, action) => {
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
export const CODE_ALPHABET = "ABCDEFGHJKLMNPQRTUVWXYZ2346789";
export const TOP_UP_BY = 1000;

export function makeCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  let out = "HS-";
  for (const b of bytes) out += CODE_ALPHABET[b % CODE_ALPHABET.length];
  return out;
}

export async function topUpPool(env, lowWater) {
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
export const PRIVATE_PREFIX = "backups/";
export const KEEP_BACKUPS = 12;

/*
  ── K24 · THE RIDER IS NOT PUBLIC ──────────────────────────────────────────

  /media/ has no login on it, by design: it serves the photographs on the
  site. Anything in the bucket is therefore readable by anyone who knows its
  name, and `backups/` was carved out for exactly that reason.

  A press kit needs a second carve-out. A photograph is meant to be shared —
  that is what the kit is for. A RIDER IS NOT: it says what an artist needs
  backstage, and often where they will be and when. It should be readable only
  through a live, unrevoked kit link, and stop being readable the moment that
  link is killed.

  So files uploaded to a kit as documents go under `sealed/`, this route
  refuses them the same way it refuses backups, and /kit/<token>/file/<key>
  is the only way to them.
*/
export const SEALED_PREFIX = "sealed/";
export const isReserved = (key) =>
  key.startsWith(PRIVATE_PREFIX) || key.startsWith(SEALED_PREFIX);

// A table can grow without anyone watching. Rather than fail on a huge one,
// take the newest rows and say so in the file.
export const MAX_ROWS = 20000;

/*
  ── A ZIP, BY HAND ──────────────────────────────────────────────────────────

  K15 needs to hand a promoter one download with the photographs, the logos,
  the rider and the words in it. That means writing a ZIP, and there is no
  library here to do it — nothing can be installed into a Worker at runtime,
  and adding a dependency for this would be a strange trade.

  It turns out not to need one. A ZIP is three things in a row:

    · for each file: a small header, then the file's bytes
    · then a directory listing every file and where it started
    · then a record saying where the directory is

  STORED, NOT DEFLATED — compression method 0. Two reasons, and the second is
  the real one: implementing DEFLATE by hand would be a genuinely hard piece
  of code to get right, and everything going in here is a JPEG, a PNG or a
  PDF, all of which are already compressed. Deflating them would spend a lot
  of effort to make the file very slightly LARGER.

  The one fiddly part is CRC-32, which every entry must carry and which the
  reader checks. Get it wrong and the archive opens and then reports every
  file as corrupt, which is worse than not opening at all.
*/

export let CRC_TABLE = null;
export function crcTable() {
  if (CRC_TABLE) return CRC_TABLE;
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  CRC_TABLE = t;
  return t;
}

export function crc32(bytes) {
  const t = crcTable();
  let c = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) c = t[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

/*
  A name safe to put in an archive and on a stranger's disk. Not paranoia:
  a path separator or a leading dot in an archive entry is a real attack, and
  a colon in a filename simply fails to extract on Windows.
*/
export function safeName(text) {
  return String(text || "file")
    .normalize("NFKD")
    .replace(/[^\w\s.-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/^[.-]+/, "")
    .slice(0, 70) || "file";
}

export function makeZip(files) {
  const enc = new TextEncoder();
  const parts = [];
  const dir = [];
  let offset = 0;

  const u16 = (n) => [n & 0xFF, (n >>> 8) & 0xFF];
  const u32 = (n) => [n & 0xFF, (n >>> 8) & 0xFF, (n >>> 16) & 0xFF, (n >>> 24) & 0xFF];

  for (const file of files) {
    const nameBytes = enc.encode(file.name);
    const data = file.bytes;
    const crc = crc32(data);

    const local = [
      ...u32(0x04034b50),   // local file header
      ...u16(20),           // version needed
      ...u16(0x0800),       // flags — bit 11: the name is UTF-8
      ...u16(0),            // method 0: stored
      ...u16(0), ...u16(0), // time and date, left at zero
      ...u32(crc),
      ...u32(data.length),  // compressed size
      ...u32(data.length),  // uncompressed size
      ...u16(nameBytes.length),
      ...u16(0),            // no extra field
    ];
    parts.push(new Uint8Array(local), nameBytes, data);

    dir.push({ nameBytes, crc, size: data.length, offset });
    offset += local.length + nameBytes.length + data.length;
  }

  const central = [];
  for (const e of dir) {
    central.push(...[
      ...u32(0x02014b50),   // central directory header
      ...u16(20), ...u16(20),
      ...u16(0x0800), ...u16(0),
      ...u16(0), ...u16(0),
      ...u32(e.crc),
      ...u32(e.size), ...u32(e.size),
      ...u16(e.nameBytes.length),
      ...u16(0), ...u16(0), ...u16(0),
      ...u16(0), ...u32(0),
      ...u32(e.offset),
    ], ...e.nameBytes);
  }
  const centralBytes = new Uint8Array(central);

  const end = new Uint8Array([
    ...u32(0x06054b50),     // end of central directory
    ...u16(0), ...u16(0),
    ...u16(dir.length), ...u16(dir.length),
    ...u32(centralBytes.length),
    ...u32(offset),
    ...u16(0),
  ]);

  let total = centralBytes.length + end.length;
  for (const p of parts) total += p.length;

  const out = new Uint8Array(total);
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  out.set(centralBytes, at); at += centralBytes.length;
  out.set(end, at);
  return out;
}

export async function backupDatabase(env) {
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

/*
  ── S04 · IS ANYTHING BROKEN THAT NOBODY HAS NOTICED ────────────────────

  There is a health route and, until now, nothing ever asked it anything.

  WHAT THIS CAN AND CANNOT CATCH, honestly: if the Worker itself is down then
  this does not run either, so it cannot tell you the site is unreachable —
  that needs something outside Cloudflare watching from the internet. What it
  DOES catch is everything underneath: the database refusing queries, the
  bucket gone, the mail key expired. Those are the failures that actually
  happen, they are silent, and the way you currently find out is at a door.

  It only writes when something is WRONG, and only once per fault, because an
  email every hour saying everything is fine is an email nobody reads.
*/
/*
  ══ TAKING OUT THE BINS ═════════════════════════════════════════════════════

  Four tables grew without limit and nothing ever removed a row from any of
  them:

    sessions        every sign-in ever, including the expired ones. They have
                    an expires_at and an index on it and were never once
                    deleted — readSession simply refuses them and moves on, so
                    the table only ever got longer.
    login_attempts  every attempt, right and wrong, since the site opened. It
                    exists to rate-limit an address over the last few minutes;
                    a row from March cannot affect that answer and is only
                    making the index bigger.
    share_opens     a row per opening of a shared kit, and the console only
                    ever shows the recent ones.
    views           a row per page per day, forever.

  None of it was urgent and none of it was ever going to announce itself. A
  database that quietly grows is a database that is fine, fine, fine, and then
  slow at the exact moment somebody is standing at a door with a phone.

  ── WHAT IS DELIBERATELY NOT SWEPT ────────────────────────────────────────

  scans and poll_votes and passes and requests. Those are the RECORD — who
  came in, what was asked for, what was decided. A record that deletes itself
  after a while is not a record, and the honest way to shrink it is an archive
  somebody chooses, not a timer nobody sees.
*/
export async function pruneOldRows(env) {
  const ago = (days) => new Date(Date.now() - days * 86400000).toISOString();
  const swept = {};

  const jobs = [
    // An expired session is refused anyway. Kept a day past expiry so that a
    // clock skew between here and a browser cannot make a live one vanish.
    ["sessions", "DELETE FROM sessions WHERE expires_at < ?", ago(1)],
    // The rate limit looks at minutes. A month is already generous.
    ["login_attempts", "DELETE FROM login_attempts WHERE at < ?", ago(30)],
    // Openings are shown as "recently"; half a year is well past that.
    ["share_opens", "DELETE FROM share_opens WHERE at < ?", ago(180)],
    // Readership is compared year on year, so a little over a year stays.
    ["views", "DELETE FROM views WHERE day < ?", ago(400).slice(0, 10)],
  ];

  for (const [table, sql, cutoff] of jobs) {
    try {
      const r = await env.DB.prepare(sql).bind(cutoff).run();
      swept[table] = r?.meta?.changes ?? 0;
    } catch (err) {
      // A sweep that fails must never stop the backup that follows it.
      swept[table] = `failed: ${String(err && err.message).slice(0, 80)}`;
    }
  }
  return swept;
}

export async function healthSweep(env) {
  const bad = [];

  try {
    const r = await env.DB.prepare("SELECT COUNT(*) AS n FROM passes").first();
    if (!r) bad.push("The database answered, but with nothing.");
  } catch (err) {
    bad.push("The database refused a query: " + (err && err.message));
  }

  try {
    if (env.MEDIA) await env.MEDIA.list({ limit: 1 });
    else bad.push("No media bucket is connected — photographs and backups have nowhere to live.");
  } catch (err) {
    bad.push("The media bucket refused: " + (err && err.message));
  }

  if (!env.RESEND_API_KEY) bad.push("No mail key is set — passes cannot be emailed.");

  // Codes run out quietly, and then passes cannot be issued at all.
  try {
    const left = await env.DB.prepare("SELECT COUNT(*) AS n FROM code_pool WHERE used = 0").first();
    const cfg = await getSettings(env);
    if ((left?.n ?? 0) < (cfg.poolLowWater || 200) / 4) {
      bad.push(`Only ${left?.n ?? 0} unused pass codes are left.`);
    }
  } catch { /* the codes table may not exist on an old database */ }

  if (!bad.length) {
    console.log("Health: everything answered.");
    return { ok: true };
  }

  console.log("Health: " + bad.join(" | "));
  const cfg = await getSettings(env);
  await sendNote(env, {
    to: cfg.accountCopyTo,
    subject: "Hidden State — something needs looking at",
    text:
      "The hourly check found this:\n\n" +
      bad.map((b) => "  · " + b).join("\n") +
      "\n\nThe site itself may well be fine — this is the machinery behind it.\n",
  }).catch(() => {});
  return { ok: false, bad };
}


// ─── routes ────────────────────────────────────────────────────────────────


