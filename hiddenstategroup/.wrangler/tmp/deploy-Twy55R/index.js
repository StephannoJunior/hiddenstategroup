var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// worker/index.js
var json = /* @__PURE__ */ __name((data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
}), "json");
var fail = /* @__PURE__ */ __name((message, status = 400) => json({ ok: false, error: message }, status), "fail");
var now = /* @__PURE__ */ __name(() => (/* @__PURE__ */ new Date()).toISOString(), "now");
var enc = new TextEncoder();
async function sha256Hex(text) {
  const buf = await crypto.subtle.digest("SHA-256", enc.encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
__name(sha256Hex, "sha256Hex");
var PBKDF2_ROUNDS = 1e5;
async function hashPassword(password, salt) {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: enc.encode(salt), iterations: PBKDF2_ROUNDS, hash: "SHA-256" },
    key,
    256
  );
  return [...new Uint8Array(bits)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
__name(hashPassword, "hashPassword");
function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
__name(safeEqual, "safeEqual");
var randomHex = /* @__PURE__ */ __name((bytes = 32) => [...crypto.getRandomValues(new Uint8Array(bytes))].map((b) => b.toString(16).padStart(2, "0")).join(""), "randomHex");
var WINDOW_SECONDS = 30;
var currentWindow = /* @__PURE__ */ __name(() => Math.floor(Date.now() / 1e3 / WINDOW_SECONDS), "currentWindow");
async function rotatingCode(secret, code, window) {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(`${code}:${window}`));
  const bytes = new Uint8Array(sig);
  const offset = bytes[bytes.length - 1] & 15;
  const num = (bytes[offset] & 127) << 24 | (bytes[offset + 1] & 255) << 16 | (bytes[offset + 2] & 255) << 8 | bytes[offset + 3] & 255;
  return String(num % 1e6).padStart(6, "0");
}
__name(rotatingCode, "rotatingCode");
async function sendPassEmail(env, { to, name, code, party, kind }) {
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
  const text = [
    `${name},`,
    "",
    isInvite ? `You're invited to ${party.name}.` : `Your pass for ${party.name} is ready.`,
    "",
    `Date: ${party.date_label}`,
    party.venue ? `Venue: ${party.venue}` : "Venue: to be announced",
    "",
    "Open your pass here:",
    url,
    "",
    "Keep this link. At the door it shows a number that changes every thirty",
    "seconds, so a screenshot will not work \u2014 open the page when you arrive.",
    "",
    `${party.minimum_age}+. Bring ID matching the name on the pass.`,
    "",
    "Hidden State"
  ].join("\n");
  const html = `
    <div style="font-family:Georgia,serif;color:#16130E;background:#F3EBD9;padding:32px">
      <div style="max-width:480px;margin:0 auto">
        <p style="font-family:Helvetica,sans-serif;font-size:10px;letter-spacing:.2em;color:#8A6A28;margin:0">
          ${isInvite ? "YOU'RE INVITED" : "YOUR PASS"}
        </p>
        <div style="border-top:2px solid #16130E;margin-top:10px"></div>
        <div style="border-top:1px solid #16130E;margin-top:3px"></div>
        <h1 style="font-size:30px;font-weight:400;margin:24px 0 6px">${party.name}</h1>
        <p style="font-family:Helvetica,sans-serif;font-size:11px;letter-spacing:.16em;color:#463F35;margin:0">
          ${party.date_label}${party.venue ? " \xB7 " + party.venue : ""}
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
          thirty seconds, so a screenshot will not work \u2014 open the page when
          you arrive.
        </p>
        <p style="font-family:Helvetica,sans-serif;font-size:10px;letter-spacing:.16em;color:#463F35;margin:24px 0 0">
          ${party.minimum_age}+ \xB7 BRING ID MATCHING THE NAME
        </p>
      </div>
    </div>`;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${env.RESEND_API_KEY}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        from: "Hidden State <passes@hiddenstategroup.com>",
        to: [to],
        subject: isInvite ? `You're invited \u2014 ${party.name}` : `Your pass \u2014 ${party.name}`,
        text,
        html
      })
    });
    const detail = await res.text();
    if (!res.ok) {
      console.error("Resend refused:", res.status, detail);
      let reason = `email service returned ${res.status}`;
      try {
        const parsed = JSON.parse(detail);
        if (parsed.message) reason = parsed.message;
      } catch {
      }
      return { sent: false, reason };
    }
    console.log("Resend accepted:", detail);
    return { sent: true };
  } catch (err) {
    console.error("Email failed:", err && err.message);
    return { sent: false, reason: "could not reach the email service" };
  }
}
__name(sendPassEmail, "sendPassEmail");
var SESSION_HOURS = 12;
async function createSession(env, member) {
  const token = randomHex(32);
  const expires = new Date(Date.now() + SESSION_HOURS * 3600 * 1e3).toISOString();
  await env.DB.prepare(
    "INSERT INTO sessions (token_hash, username, role, created_at, expires_at) VALUES (?, ?, ?, ?, ?)"
  ).bind(await sha256Hex(token), member.username, member.role, now(), expires).run();
  return { token, expires };
}
__name(createSession, "createSession");
async function readSession(env, request) {
  const header = request.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return null;
  const row = await env.DB.prepare(
    "SELECT s.username, s.role, s.expires_at, t.display_name, t.active FROM sessions s JOIN team t ON t.username = s.username WHERE s.token_hash = ?"
  ).bind(await sha256Hex(token)).first();
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) return null;
  if (!row.active) return null;
  return { username: row.username, role: row.role, displayName: row.display_name };
}
__name(readSession, "readSession");
var CAN = {
  BOSS: { scan: true, seeList: true, reset: true, issue: true, revoke: true, team: true },
  OWNER: { scan: true, seeList: true, reset: true, issue: false, revoke: false, team: false },
  STAFF: { scan: true, seeList: false, reset: false, issue: false, revoke: false, team: false }
};
var can = /* @__PURE__ */ __name((role, action) => !!(CAN[role] && CAN[role][action]), "can");
async function handleApi(request, env, url) {
  const path = url.pathname.replace(/^\/api/, "");
  const method = request.method;
  const body = method === "POST" || method === "PATCH" ? await request.json().catch(() => ({})) : {};
  if (path === "/login" && method === "POST") {
    const username = String(body.username || "").trim().toLowerCase();
    const member = await env.DB.prepare(
      "SELECT * FROM team WHERE username = ? AND active = 1"
    ).bind(username).first();
    const salt = member ? member.salt : "no-such-account";
    const attempt = await hashPassword(String(body.password || ""), salt);
    if (!member || !safeEqual(attempt, member.password_hash)) {
      return fail("Those details weren't recognised.", 401);
    }
    const { token, expires } = await createSession(env, member);
    return json({
      ok: true,
      token,
      expires,
      user: { username: member.username, role: member.role, displayName: member.display_name, can: CAN[member.role] }
    });
  }
  if (path === "/me" && method === "GET") {
    const who = await readSession(env, request);
    if (!who) return fail("Not signed in.", 401);
    return json({ ok: true, user: { ...who, can: CAN[who.role] } });
  }
  if (path === "/logout" && method === "POST") {
    const header = request.headers.get("authorization") || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (token) {
      await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(await sha256Hex(token)).run();
    }
    return json({ ok: true });
  }
  if (path.startsWith("/pass/") && method === "GET") {
    const code = decodeURIComponent(path.slice(6)).toUpperCase();
    const pass = await env.DB.prepare(
      "SELECT p.*, y.name AS party_name, y.date_label, y.venue, y.doors_close_at, y.minimum_age, y.rotating FROM passes p JOIN parties y ON y.id = p.party_id WHERE p.code = ?"
    ).bind(code).first();
    if (!pass) return fail("We couldn't find that pass.", 404);
    if (pass.status === "REVOKED") {
      return json({ ok: false, revoked: true, error: "This pass has been cancelled." }, 200);
    }
    const over = new Date(pass.doors_close_at).getTime() < Date.now();
    const code6 = pass.rotating ? await rotatingCode(env.PASS_SECRET, pass.code, currentWindow()) : await rotatingCode(env.PASS_SECRET, pass.code, 0);
    return json({
      ok: true,
      pass: {
        code: pass.code,
        name: pass.name,
        kind: pass.kind,
        tier: pass.tier,
        ticketRef: pass.ticket_ref,
        note: pass.note,
        idRequired: !!pass.id_required
      },
      party: {
        name: pass.party_name,
        date: pass.date_label,
        venue: pass.venue,
        minimumAge: pass.minimum_age,
        rotating: !!pass.rotating,
        over
      },
      code: over ? null : code6,
      // Seconds until the number changes, so the page can show a countdown
      // without guessing.
      refreshIn: pass.rotating ? WINDOW_SECONDS - Math.floor(Date.now() / 1e3) % WINDOW_SECONDS : null
    });
  }
  if (path === "/health" && method === "GET") {
    const who = await readSession(env, request);
    if (!who || !can(who.role, "team")) return fail("Not allowed.", 403);
    const present = /* @__PURE__ */ __name((v) => typeof v === "string" && v.length > 0, "present");
    return json({
      ok: true,
      bindings: Object.keys(env).sort(),
      database: !!env.DB,
      assets: !!env.ASSETS,
      passSecret: present(env.PASS_SECRET),
      resendKey: present(env.RESEND_API_KEY),
      // Length only — enough to tell a real key from an empty string or a
      // stray space, without ever revealing the key itself.
      resendKeyLength: typeof env.RESEND_API_KEY === "string" ? env.RESEND_API_KEY.length : 0
    });
  }
  if (path === "/next-party" && method === "GET") {
    const party = await env.DB.prepare(
      "SELECT id, name, date_label, venue, minimum_age FROM parties WHERE archived = 0 AND doors_close_at > ? ORDER BY doors_close_at ASC LIMIT 1"
    ).bind(now()).first();
    return json({ ok: true, party: party || null });
  }
  if (path === "/scan" && method === "POST") {
    const who = await readSession(env, request);
    if (!who || !can(who.role, "scan")) return fail("Not signed in.", 401);
    const parts = String(body.payload || "").split("|");
    const code = (parts.length === 3 ? parts[1] : String(body.code || "")).toUpperCase();
    const given = parts.length === 3 ? parts[2] : null;
    const pass = await env.DB.prepare(
      "SELECT p.*, y.name AS party_name, y.doors_close_at, y.rotating FROM passes p JOIN parties y ON y.id = p.party_id WHERE p.code = ?"
    ).bind(code).first();
    const record = /* @__PURE__ */ __name(async (result, reason) => {
      await env.DB.prepare(
        "INSERT INTO scans (code, party_id, result, reason, scanned_by, scanned_at) VALUES (?, ?, ?, ?, ?, ?)"
      ).bind(code, pass ? pass.party_id : "unknown", result, reason || null, who.username, now()).run();
    }, "record");
    if (!pass) {
      await record("REFUSED", "UNKNOWN");
      return json({ ok: false, reason: "UNKNOWN" });
    }
    if (pass.status === "REVOKED") {
      await record("REFUSED", "REVOKED");
      return json({ ok: false, reason: "REVOKED", name: pass.name, note: pass.revoke_note });
    }
    if (new Date(pass.doors_close_at).getTime() < Date.now()) {
      await record("REFUSED", "PARTY_OVER");
      return json({ ok: false, reason: "PARTY_OVER", name: pass.name });
    }
    if (pass.rotating && given !== null) {
      const w = currentWindow();
      let matched = false;
      for (const win of [w, w - 1, w + 1]) {
        if (await rotatingCode(env.PASS_SECRET, code, win) === given) {
          matched = true;
          break;
        }
      }
      if (!matched) {
        let stale = false;
        for (let back = 2; back <= 20; back++) {
          if (await rotatingCode(env.PASS_SECRET, code, w - back) === given) {
            stale = true;
            break;
          }
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
      await record("REFUSED", "USED");
      return json({ ok: false, reason: "USED", name: pass.name, at: already.scanned_at });
    }
    await record("ADMITTED", null);
    return json({
      ok: true,
      name: pass.name,
      kind: pass.kind,
      tier: pass.tier,
      ticketRef: pass.ticket_ref,
      idRequired: !!pass.id_required,
      note: pass.note
    });
  }
  if (path === "/passes" && method === "GET") {
    const who = await readSession(env, request);
    if (!who || !can(who.role, "seeList")) return fail("Not allowed.", 403);
    const partyId = url.searchParams.get("party");
    const rows = await env.DB.prepare(
      "SELECT p.code, p.name, p.kind, p.tier, p.ticket_ref, p.note, p.status, p.email,   (SELECT scanned_at FROM scans s WHERE s.code = p.code AND s.result = 'ADMITTED' LIMIT 1) AS admitted_at,   (SELECT COUNT(*) FROM scans s WHERE s.code = p.code AND s.result = 'REFUSED') AS refusals,   (SELECT reason FROM scans s WHERE s.code = p.code AND s.result = 'REFUSED' ORDER BY s.id DESC LIMIT 1) AS last_reason FROM passes p WHERE p.party_id = ? ORDER BY p.issued_at DESC"
    ).bind(partyId).all();
    return json({ ok: true, passes: rows.results });
  }
  if (path === "/passes" && method === "POST") {
    const who = await readSession(env, request);
    if (!who || !can(who.role, "issue")) return fail("Only the boss can issue passes.", 403);
    if (!body.name || !body.party) return fail("A name and an event are required.");
    const pooled = await env.DB.prepare(
      "SELECT code FROM code_pool WHERE used = 0 ORDER BY RANDOM() LIMIT 1"
    ).first();
    if (!pooled) return fail("The code pool is empty. Generate more codes.", 409);
    await env.DB.batch([
      env.DB.prepare("UPDATE code_pool SET used = 1, used_at = ? WHERE code = ?").bind(now(), pooled.code),
      env.DB.prepare(
        "INSERT INTO passes (code, party_id, name, email, phone, kind, tier, ticket_ref, note, id_required, issued_at, issued_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      ).bind(
        pooled.code,
        body.party,
        body.name,
        body.email || null,
        body.phone || null,
        body.kind || "TICKET",
        body.tier || null,
        body.ticketRef || null,
        body.note || null,
        body.kind === "INVITATION" ? 0 : 1,
        now(),
        who.username
      )
    ]);
    let email = { sent: false, reason: "no address" };
    if (body.email) {
      const party = await env.DB.prepare(
        "SELECT name, date_label, venue, minimum_age FROM parties WHERE id = ?"
      ).bind(body.party).first();
      email = await sendPassEmail(env, {
        to: body.email,
        name: body.name,
        code: pooled.code,
        party: party || { name: body.party, date_label: "", venue: null, minimum_age: 16 },
        kind: body.kind
      });
      if (email.sent) {
        await env.DB.prepare("UPDATE passes SET emailed_at = ? WHERE code = ?").bind(now(), pooled.code).run();
      }
    }
    return json({ ok: true, code: pooled.code, email });
  }
  if (path.startsWith("/passes/") && method === "PATCH") {
    const who = await readSession(env, request);
    if (!who || !can(who.role, "revoke")) return fail("Only the boss can cancel passes.", 403);
    const code = decodeURIComponent(path.slice(8)).toUpperCase();
    const status = body.status === "ACTIVE" ? "ACTIVE" : "REVOKED";
    await env.DB.prepare(
      "UPDATE passes SET status = ?, revoked_at = ?, revoked_by = ?, revoke_note = ? WHERE code = ?"
    ).bind(status, status === "REVOKED" ? now() : null, who.username, body.reason || null, code).run();
    return json({ ok: true, code, status });
  }
  if (path === "/parties" && method === "GET") {
    const who = await readSession(env, request);
    if (!who) return fail("Not signed in.", 401);
    const rows = await env.DB.prepare(
      "SELECT y.*, (SELECT COUNT(*) FROM passes p WHERE p.party_id = y.id) AS issued FROM parties y WHERE y.archived = 0 ORDER BY y.doors_close_at DESC"
    ).all();
    return json({ ok: true, parties: rows.results });
  }
  if (path === "/parties" && method === "POST") {
    const who = await readSession(env, request);
    if (!who || !can(who.role, "issue")) return fail("Only the boss can add events.", 403);
    if (!body.id || !body.name || !body.doorsCloseAt) {
      return fail("An id, a name and a closing time are required.");
    }
    await env.DB.prepare(
      "INSERT INTO parties (id, name, date_label, venue, doors_close_at, minimum_age, rotating, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).bind(
      body.id,
      body.name,
      body.dateLabel || body.name,
      body.venue || null,
      body.doorsCloseAt,
      body.minimumAge ?? 16,
      body.rotating === false ? 0 : 1,
      now(),
      who.username
    ).run();
    return json({ ok: true, id: body.id });
  }
  if (path.startsWith("/parties/") && method === "PATCH") {
    const who = await readSession(env, request);
    if (!who || !can(who.role, "issue")) return fail("Only the boss can change events.", 403);
    const id = decodeURIComponent(path.slice(9));
    const fields = [];
    const values = [];
    const map = {
      name: "name",
      dateLabel: "date_label",
      venue: "venue",
      doorsCloseAt: "doors_close_at",
      minimumAge: "minimum_age",
      rotating: "rotating",
      archived: "archived"
    };
    for (const [key, column] of Object.entries(map)) {
      if (body[key] !== void 0) {
        fields.push(`${column} = ?`);
        values.push(typeof body[key] === "boolean" ? body[key] ? 1 : 0 : body[key]);
      }
    }
    if (!fields.length) return fail("Nothing to change.");
    values.push(id);
    await env.DB.prepare(`UPDATE parties SET ${fields.join(", ")} WHERE id = ?`).bind(...values).run();
    return json({ ok: true, id });
  }
  if (path.startsWith("/parties/") && method === "DELETE") {
    const who = await readSession(env, request);
    if (!who || !can(who.role, "issue")) return fail("Only the boss can remove events.", 403);
    const id = decodeURIComponent(path.slice(9));
    await env.DB.prepare("UPDATE parties SET archived = 1 WHERE id = ?").bind(id).run();
    return json({ ok: true, id, archived: true });
  }
  if (path === "/team" && method === "GET") {
    const who = await readSession(env, request);
    if (!who || !can(who.role, "team")) return fail("Not allowed.", 403);
    const rows = await env.DB.prepare(
      "SELECT username, role, display_name, email, phone, photo_url, active, created_at FROM team ORDER BY role, username"
    ).all();
    return json({ ok: true, team: rows.results });
  }
  if (path === "/team" && method === "POST") {
    const who = await readSession(env, request);
    if (!who || !can(who.role, "team")) return fail("Only the boss can create accounts.", 403);
    if (!body.username || !body.password || !body.role) {
      return fail("A username, password and role are required.");
    }
    if (body.role === "BOSS") return fail("There can only be one boss account.", 400);
    const salt = randomHex(16);
    await env.DB.prepare(
      "INSERT INTO team (username, role, display_name, email, phone, photo_url, password_hash, salt, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).bind(
      String(body.username).trim().toLowerCase(),
      body.role,
      body.displayName || body.username,
      body.email || null,
      body.phone || null,
      body.photoUrl || null,
      await hashPassword(body.password, salt),
      salt,
      now(),
      who.username
    ).run();
    return json({ ok: true, username: body.username });
  }
  if (path.startsWith("/team/") && method === "PATCH") {
    const who = await readSession(env, request);
    if (!who || !can(who.role, "team")) return fail("Not allowed.", 403);
    const username = decodeURIComponent(path.slice(6)).toLowerCase();
    if (username === who.username && body.active === false) {
      return fail("You can't suspend your own account.", 400);
    }
    if (body.active === false) {
      await env.DB.prepare("DELETE FROM sessions WHERE username = ?").bind(username).run();
    }
    await env.DB.prepare("UPDATE team SET active = ? WHERE username = ?").bind(body.active === false ? 0 : 1, username).run();
    return json({ ok: true, username });
  }
  if (path.startsWith("/team/") && method === "DELETE") {
    const who = await readSession(env, request);
    if (!who || !can(who.role, "team")) return fail("Not allowed.", 403);
    const username = decodeURIComponent(path.slice(6)).toLowerCase();
    if (username === who.username) return fail("You can't delete your own account.", 400);
    await env.DB.batch([
      env.DB.prepare("DELETE FROM sessions WHERE username = ?").bind(username),
      env.DB.prepare("DELETE FROM team WHERE username = ?").bind(username)
    ]);
    return json({ ok: true, username });
  }
  if (path === "/requests" && method === "POST") {
    if (!body.name || !body.email) return fail("A name and email are required.");
    await env.DB.prepare(
      "INSERT INTO requests (party_id, name, email, phone, note, created_at) VALUES (?, ?, ?, ?, ?, ?)"
    ).bind(
      body.party || null,
      body.name,
      body.email,
      body.phone || null,
      String(body.note || "").slice(0, 150),
      now()
    ).run();
    return json({ ok: true });
  }
  if (path.startsWith("/requests/") && method === "PATCH") {
    const who = await readSession(env, request);
    if (!who || !can(who.role, "issue")) return fail("Only the boss can decide requests.", 403);
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
        "INSERT INTO passes (code, party_id, name, email, phone, kind, note, id_required, issued_at, issued_by) VALUES (?, ?, ?, ?, ?, 'GUEST', ?, 1, ?, ?)"
      ).bind(pooled.code, partyId, req.name, req.email, req.phone, req.note, now(), who.username),
      env.DB.prepare(
        "UPDATE requests SET status = 'APPROVED', pass_code = ?, decided_at = ?, decided_by = ? WHERE id = ?"
      ).bind(pooled.code, now(), who.username, id)
    ]);
    const party = await env.DB.prepare(
      "SELECT name, date_label, venue, minimum_age FROM parties WHERE id = ?"
    ).bind(partyId).first();
    const email = await sendPassEmail(env, {
      to: req.email,
      name: req.name,
      code: pooled.code,
      party: party || { name: partyId, date_label: "", venue: null, minimum_age: 16 },
      kind: "GUEST"
    });
    if (email.sent) {
      await env.DB.prepare("UPDATE passes SET emailed_at = ? WHERE code = ?").bind(now(), pooled.code).run();
    }
    return json({ ok: true, status: "APPROVED", code: pooled.code, email });
  }
  if (path === "/requests" && method === "GET") {
    const who = await readSession(env, request);
    if (!who || !can(who.role, "seeList")) return fail("Not allowed.", 403);
    const rows = await env.DB.prepare(
      "SELECT * FROM requests ORDER BY created_at DESC LIMIT 500"
    ).all();
    return json({ ok: true, requests: rows.results });
  }
  return fail("No such endpoint.", 404);
}
__name(handleApi, "handleApi");
var index_default = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      try {
        return await handleApi(request, env, url);
      } catch (err) {
        console.error("API error:", err && err.message, err && err.stack);
        const detail = env.DEBUG_ERRORS === "1" && err ? String(err.message) : void 0;
        return json({ ok: false, error: "Something went wrong.", detail }, 500);
      }
    }
    return env.ASSETS.fetch(request);
  }
};
export {
  index_default as default
};
//# sourceMappingURL=index.js.map
