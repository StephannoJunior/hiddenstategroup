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

    for (const e of entries) {
      if (!e.code || !e.party) continue;
      const already = await env.DB.prepare(
        "SELECT scanned_at FROM scans WHERE code = ? AND party_id = ? AND result = 'ADMITTED'"
      ).bind(e.code, e.party).first();

      if (already) {
        // Someone was admitted twice — once offline, once elsewhere. Worth
        // surfacing rather than silently dropping.
        conflicts.push({ code: e.code, at: already.scanned_at });
        continue;
      }
      await env.DB.prepare(
        "INSERT INTO scans (code, party_id, result, reason, scanned_by, scanned_at) " +
        "VALUES (?, ?, 'ADMITTED', 'offline', ?, ?)"
      ).bind(e.code, e.party, who.username, e.at || now()).run();
      recorded += 1;
    }

    return json({ ok: true, recorded, conflicts });
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
      "INSERT INTO parties (id, name, date_label, venue, doors_close_at, minimum_age, rotating, capacity, created_at, created_by) " +
      "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).bind(
      body.id, body.name, body.dateLabel || body.name, body.venue || null,
      body.doorsCloseAt, body.minimumAge ?? 16, body.rotating === false ? 0 : 1,
      body.capacity || null, now(), who.username
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
  async scheduled(event, env, ctx) {
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

    // Everything else is the website itself.
    return env.ASSETS.fetch(request);
  },
};
