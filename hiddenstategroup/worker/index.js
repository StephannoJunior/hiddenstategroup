/*
  ══ THE WORKER ══════════════════════════════════════════════════════════════

  The routes. Everything they are built out of lives in lib/core.js, which was
  this file's first sixteen hundred lines until it became the thing standing
  between anybody and finding a route.
*/
import {
  CAN, CONTENT, DEFAULT_SETTINGS, PRIVATE_PREFIX, PUBLIC_SETTINGS,
  RESERVED_SLUGS, SAFE_HEADERS, SEALED_PREFIX, WINDOW_SECONDS, backupDatabase,
  can, createSession, currentWindow, fail, getSettings, hashPassword,
  healthSweep, isReserved, json, makeCode, makeZip, nameFromUrl, now,
  permissionsFor, pruneOldRows, randomHex, readSession, resolveSong,
  rotatingCode, safeEqual, safeName, securityHeaders, sendAccountEmail,
  sendNote, sendPassEmail, sendRequestAlert, sha256Hex, topUpPool,
} from "./lib/core.js";

/*
  ── ROUTES THAT LIVE BESIDE THIS FILE ───────────────────────────────────────

  Three subsystems that were nine hundred lines in the middle of handleApi. A
  module is asked in the same order it used to appear in the if-chain, and
  returning null means "not one of mine" — so the behaviour is the fall-through
  that was already there, with the reading order preserved.
*/
import { epkRoutes } from "./routes/epk.js";
import { pollsRoutes } from "./routes/polls.js";
import { songsRoutes } from "./routes/songs.js";

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
        /*
          ── G06 · THE RUNNING ORDER ────────────────────────────────────

          Two sources, on purpose and only for now. `set_times` is where the
          console writes, and it wins whenever it has anything; the `lineup`
          column is what existed before and is kept as a fallback so a night
          set up under the old scheme does not lose its times the day this
          ships. Once every live night has been re-entered, the column can go.
        */
        lineup: await (async () => {
          const rows = await env.DB.prepare(
            "SELECT name, at_label, room FROM set_times WHERE party_id = ? ORDER BY sort_order ASC, id ASC"
          ).bind(pass.party_id).all().catch(() => ({ results: [] }));
          const live = rows.results || [];
          if (live.length) {
            return live.map((r) => ({
              artist: r.name,
              time: r.at_label || "",
              room: r.room || null,
            }));
          }
          try { return JSON.parse(pass.lineup || "[]"); } catch { return []; }
        })(),
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

    /*
      ── THE BAR'S EXTRA TABS COME FREE WITH THIS ────────────────────────────

      The floating bar is this site's navigation, so it has to know whether any
      built page has asked for a tab. It used to find out by asking
      /content/pages — on EVERY page load, for a list that is usually empty,
      one extra round trip on the critical path before the bar could finish
      drawing itself.

      This response is already fetched once when the application boots. Four
      columns of at most four rows cost nothing to add to it, and the request
      that used to pay for them disappears entirely.

      It is NOT a setting: it is derived from the pages table, and check 3 in
      scripts/check.mjs knows that by name.
    */
    const nav = await env.DB.prepare(
      "SELECT slug, title, nav_label FROM pages WHERE published = 1 AND in_nav = 1 " +
      "ORDER BY sort_order, slug LIMIT 4"
    ).all().catch(() => ({ results: [] }));

    return json({
      ok: true,
      settings: out,
      navPages: (nav.results || []).map((r) => ({
        slug: r.slug,
        label: r.nav_label || r.title || r.slug,
      })),
    });
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

    /*
      ── K22 · WHAT MAY BE UPLOADED, AND THE ONE TYPE THAT IS DIFFERENT ─────

      Pictures were the only thing allowed, which is why a press kit had to be
      assembled out of pasted addresses. Documents and archives are added here:
      a rider is a PDF, and a promoter putting your mark on a poster wants the
      vector, not a screenshot of it.

      SVG IS NOT IN THIS LIST, and its absence is the whole point.

      An SVG is a document that can contain JavaScript. Served from
      hiddenstategroup.com it runs with this site's privileges — it can read
      the signed-in session and act as whoever opened it. "Only the team can
      upload" is not a defence: the team is the target worth attacking.

      Of the three ways to have SVG safely, this takes the second: it does not
      arrive as an SVG at all. A designer's .svg goes inside a ZIP, which
      cannot execute anything and which every design tool opens without
      thinking about it. That costs a promoter one double-click and costs us
      no attack surface. Serving uploads from a separate domain is the fuller
      answer and is a DNS change plus an afternoon; if that is ever done, SVG
      can be allowed directly and this comment should be revisited.
    */
    const PICTURES = {
      "image/jpeg": "jpg", "image/png": "png",
      "image/webp": "webp", "image/gif": "gif",
    };
    const DOCUMENTS = {
      "application/pdf": "pdf",
      "application/zip": "zip",
      "application/x-zip-compressed": "zip",
      "application/postscript": "eps",     // .eps and .ai are both this
      "font/otf": "otf", "font/ttf": "ttf",
      "text/plain": "txt",
    };
    const ext = PICTURES[file.type] || DOCUMENTS[file.type];
    if (!ext) {
      return fail(
        /^image\/svg/.test(file.type)
          ? "An SVG cannot be uploaded on its own — put it in a ZIP and upload that."
          : "Pictures (JPEG, PNG, WebP, GIF) and files (PDF, ZIP, EPS, AI) only."
      );
    }

    /*
      ── K21 · BIGGER FILES ────────────────────────────────────────────────

      The cap was 8MB, which is under half of what comes out of a real camera,
      and "shrink it first" is precisely the step nobody does. The browser now
      makes the web-sized copies before uploading, so what arrives here at full
      size is the print original — and that is the one worth keeping whole.

      Storage is not the reason for a cap; a roster's worth of photographs is
      pennies a month. The reason is that a Worker holds the request while it
      streams, so this is the size beyond which an upload on a hotel wifi
      starts failing in ways that are hard to explain to anybody.
    */
    const MAX = 40 * 1024 * 1024;
    if (file.size > MAX) {
      return fail(`That file is ${(file.size / 1048576).toFixed(0)}MB. The limit is 40MB.`);
    }

    /*
      The stored name is ours, not theirs. A filename from a phone can contain
      anything, and letting it decide the path is how an upload folder ends up
      with surprises in it.
    */
    const folder = (form.get("folder") || "uploads").toString().replace(/[^a-z0-9-]/gi, "").slice(0, 24) || "uploads";
    const stamp = new Date().toISOString().slice(0, 10);

    /*
      `sealed` puts the file behind a kit link instead of on the open web —
      see SEALED_PREFIX. The caller asks for it; the prefix is built here so a
      folder name can never reach into it by accident.
    */
    const sealed = form.get("sealed") === "1" || form.get("sealed") === "true";
    const key = sealed
      ? `${SEALED_PREFIX}${folder}/${stamp}-${randomHex(10)}.${ext}`
      : `${folder}/${stamp}-${randomHex(6)}.${ext}`;

    await env.MEDIA.put(key, file.stream(), {
      httpMetadata: {
        contentType: file.type,
        // A sealed file must not sit in a shared cache — the whole point is
        // that access is decided per request, by a link that can be revoked.
        cacheControl: sealed ? "private, max-age=0, no-store"
                             : "public, max-age=31536000, immutable",
      },
      customMetadata: {
        uploadedBy: who.username,
        originalName: String(file.name || "").slice(0, 120),
      },
    });

    return json({
      ok: true,
      key,
      sealed,
      bytes: file.size,
      kind: PICTURES[file.type] ? "picture" : "file",
      // A sealed file has no public address at all. Giving it one that 404s
      // would be worse than giving it none.
      path: sealed ? null : `/media/${key}`,
      name: String(file.name || "").slice(0, 120),
    });
  }

  // What has been uploaded, so the editor can offer them.
  /*
    The picture list the console's picker shows. Sealed files are deliberately
    absent: they are documents behind a kit link, not photographs to choose
    from, and offering them here would put a rider one click from a blog post.
  */
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

  /*
    ── ONE WRITE PATH, TWO DOORS ───────────────────────────────────────────

    These were the bodies of the POST and PATCH branches below. They are
    functions now because the STUDIO publishes a draft through exactly this
    code — and the alternative was a second copy of the column mapping, the
    JSON encoding and the boolean coercion, living somewhere else and drifting
    the first time a column is added. A publish that writes a record slightly
    differently from a save is a bug that only appears on the records you
    published, which is the worst possible distribution.
  */
  const contentInsert = async (def, source) => {
    const fields = [], marks = [], values = [];
    for (const col of def.cols) {
      // Accept either the column name or its camelCase form.
      const camel = col.replace(/_(\w)/g, (m, c) => c.toUpperCase());
      let v = source[col] !== undefined ? source[col] : source[camel];
      if (v === undefined) continue;
      if (def.json.includes(col)) v = JSON.stringify(v);
      if (typeof v === "boolean") v = v ? 1 : 0;
      fields.push(col); marks.push("?"); values.push(v);
    }
    if (!fields.length) return { ok: false, error: "Nothing to save." };
    await env.DB.prepare(
      `INSERT INTO ${def.table} (${fields.join(", ")}, updated_at) VALUES (${marks.join(", ")}, ?)`
    ).bind(...values, now()).run();
    return { ok: true };
  };

  const contentUpdate = async (def, id, source) => {
    const sets = [], values = [];
    for (const col of def.cols) {
      if (col === def.key) continue;   // the key itself is never rewritten
      const camel = col.replace(/_(\w)/g, (m, c) => c.toUpperCase());
      let v = source[col] !== undefined ? source[col] : source[camel];
      if (v === undefined) continue;
      if (def.json.includes(col)) v = JSON.stringify(v);
      if (typeof v === "boolean") v = v ? 1 : 0;
      sets.push(`${col} = ?`); values.push(v);
    }
    if (!sets.length) return { ok: false, error: "Nothing to change." };
    await env.DB.prepare(
      `UPDATE ${def.table} SET ${sets.join(", ")}, updated_at = ? WHERE ${def.key} = ?`
    ).bind(...values, now(), id).run();
    return { ok: true };
  };


  /*
    ══ DRAFTS, AND THE PREVIEW ═══════════════════════════════════════════════

    A draft is a set of edits that have not been applied to the real record
    yet. It is NOT the same thing as `published = 0`, and keeping the two
    apart is the point:

      published = 0   the record exists and is hidden. A finished thing,
                      waiting for a date.
      a draft         the record may not exist at all, or may exist and be
                      live, and these are the changes somebody is part-way
                      through making to it. Applying them is a separate act.

    Conflating them is how a CMS ends up publishing half a sentence: you edit
    the live record directly, and every keystroke is on the site.

    ── THE PREVIEW TOKEN ────────────────────────────────────────────────────

    Each draft carries 32 random hex characters that serve it, and ONLY it, to
    the site. That is what makes a preview link sendable to a photographer or
    a promoter who has no login and should never get one.

    Which also means the token IS the permission, so:

      · it is from crypto.getRandomValues, never Math.random;
      · the route returns ONE draft — never a list, never a neighbouring
        record, never anything about who wrote it;
      · it is noindex and no-store, so an unpublished page cannot be found in
        a search engine because somebody forwarded a link;
      · and it dies with the draft. Publishing or discarding removes the row,
        and the link stops working the moment the work is finished, which is
        the moment it should.
  */

  /*
    Where a blocked — or, for now, merely noticed — resource is reported.

    Filed into the same table as a JavaScript error, so it appears in FAULTS
    rather than in a place nobody has a reason to look. A report that goes
    somewhere nobody reads is the same as no report.

    Browsers send this as a fire-and-forget beacon with an odd content type and
    they do not read the answer, so it always says yes.
  */
  if (path === "/csp" && method === "POST") {
    try {
      const r = (body && (body["csp-report"] || body)) || {};
      const blocked = String(r["blocked-uri"] || r.blockedURL || "?").slice(0, 200);
      const directive = String(r["violated-directive"] || r.effectiveDirective || "?").slice(0, 80);
      const where = String(r["document-uri"] || r.documentURL || "?").slice(0, 200);
      await env.DB.prepare(
        "INSERT INTO oops (at, message, where_at, path, agent, n) VALUES (?, ?, ?, ?, ?, 1) " +
        "ON CONFLICT(message, path) DO UPDATE SET n = n + 1, at = excluded.at"
      ).bind(now(), `CSP: ${directive} blocked ${blocked}`, "content-security-policy",
             where, String(request.headers.get("user-agent") || "").slice(0, 160)).run();
    } catch {
      /* A malformed report is not worth an error. */
    }
    return json({ ok: true });
  }

  if (path === "/drafts" && method === "GET") {
    const whoD = await readSession(env, request);
    if (!whoD || !can(whoD, "issuePasses")) return fail("Not allowed.", 403);
    const rows = await env.DB.prepare(
      "SELECT kind, ref, token, updated_at, updated_by FROM drafts ORDER BY updated_at DESC LIMIT 200"
    ).all();
    return json({ ok: true, drafts: rows.results || [] });
  }

  const draftMatch = path.match(/^\/drafts\/(\w+)\/([^/]+)(\/publish)?$/);
  if (draftMatch) {
    const whoD = await readSession(env, request);
    if (!whoD || !can(whoD, "issuePasses")) return fail("Not allowed.", 403);

    const kind = draftMatch[1];
    const ref = decodeURIComponent(draftMatch[2]);
    const publishing = !!draftMatch[3];

    if (method === "GET" && !publishing) {
      const row = await env.DB.prepare(
        "SELECT * FROM drafts WHERE kind = ? AND ref = ?"
      ).bind(kind, ref).first();
      if (!row) return json({ ok: true, draft: null });
      let data = {};
      try { data = JSON.parse(row.data); } catch { data = {}; }
      return json({ ok: true, draft: { kind, ref, data, token: row.token, updated_at: row.updated_at } });
    }

    if (method === "PUT" && !publishing) {
      /*
        Upserted, and the TOKEN IS KEPT. Re-rolling it on every autosave would
        break a preview link the moment its author typed another character —
        which is exactly when somebody else is looking at it.
      */
      const had = await env.DB.prepare(
        "SELECT token FROM drafts WHERE kind = ? AND ref = ?"
      ).bind(kind, ref).first();
      const token = had?.token || randomHex(16);
      const data = JSON.stringify(body.data ?? {});

      if (had) {
        await env.DB.prepare(
          "UPDATE drafts SET data = ?, updated_at = ?, updated_by = ? WHERE kind = ? AND ref = ?"
        ).bind(data, now(), whoD.username || null, kind, ref).run();
      } else {
        await env.DB.prepare(
          "INSERT INTO drafts (kind, ref, data, token, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?)"
        ).bind(kind, ref, data, token, now(), whoD.username || null).run();
      }
      return json({ ok: true, token });
    }

    if (method === "DELETE" && !publishing) {
      await env.DB.prepare("DELETE FROM drafts WHERE kind = ? AND ref = ?").bind(kind, ref).run();
      return json({ ok: true });
    }

    /*
      ── PUBLISHING ────────────────────────────────────────────────────────

      Down the SAME write path an ordinary save uses — contentInsert and
      contentUpdate above — rather than a second implementation. A publish
      that wrote a record even slightly differently from a save would produce
      a bug visible only on published records, which is the worst place for
      one to hide.

      The draft is removed only after the write has succeeded. Removing it
      first would mean a failed write loses the work, and the work is the
      thing the person came here with.
    */
    if (method === "POST" && publishing) {
      const def = CONTENT[kind];
      if (!def) return fail("That cannot be published from here.", 400);

      const row = await env.DB.prepare(
        "SELECT data FROM drafts WHERE kind = ? AND ref = ?"
      ).bind(kind, ref).first();
      if (!row) return fail("There is no draft to publish.", 404);

      let data = {};
      try { data = JSON.parse(row.data); } catch { return fail("That draft is unreadable."); }

      const key = String(data[def.key] ?? "").trim();
      if (!key) return fail(`This needs a ${def.key} before it can go out.`);

      /*
        A page cannot take a name the site already answers to. Checked here,
        at the moment it would start mattering, and checked on this side
        because the console can be lied to about what routes exist but the
        worker cannot.
      */
      if (kind === "pages" && RESERVED_SLUGS.has(key.toLowerCase())) {
        return fail(`"${key}" is a name the site already uses. Pick another.`);
      }

      const exists = await env.DB.prepare(
        `SELECT ${def.key} AS k FROM ${def.table} WHERE ${def.key} = ?`
      ).bind(key).first();

      const done = exists
        ? await contentUpdate(def, key, data)
        : await contentInsert(def, data);
      if (!done.ok) return fail(done.error);

      await env.DB.prepare("DELETE FROM drafts WHERE kind = ? AND ref = ?").bind(kind, ref).run();
      return json({ ok: true, key, created: !exists });
    }

    return fail("Unknown request.", 400);
  }

  /*
    The token's own route. No session, by design — that is the whole feature.

    NOTE WHAT IS NOT RETURNED: no username, no timestamp, no id, no hint that
    any other draft exists. Somebody holding one link learns about one piece of
    work and nothing else about the operation.
  */
  if (path.startsWith("/preview/") && method === "GET") {
    const token = decodeURIComponent(path.slice("/preview/".length));
    if (!token || token.length < 24) return fail("No such preview.", 404);

    const row = await env.DB.prepare(
      "SELECT kind, ref, data FROM drafts WHERE token = ?"
    ).bind(token).first();
    if (!row) return fail("That preview has expired.", 404);

    let data = {};
    try { data = JSON.parse(row.data); } catch { data = {}; }
    return new Response(JSON.stringify({ ok: true, kind: row.kind, ref: row.ref, data }), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        // Unfinished work must never be findable, and must never be held in
        // a shared cache after the draft it describes has gone.
        "cache-control": "private, no-store",
        "x-robots-tag": "noindex, nofollow",
        "access-control-allow-origin": "*",
      },
    });
  }

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
      const made = await contentInsert(def, body);
      return made.ok ? json({ ok: true }) : fail(made.error);
    }

    if (method === "PATCH" && id) {
      const done = await contentUpdate(def, decodeURIComponent(id), body);
      return done.ok ? json({ ok: true }) : fail(done.error);
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
      "SELECT p.*, y.name AS party_name, y.doors_close_at, y.rotating, y.starts_at, y.capacity FROM passes p " +
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

    /*
      ── N02 + N03 · HOW MANY OF THEM ARE IN, AND ARE THEY STILL IN ──────

      This used to be one question — "has this code been admitted?" — enforced
      by a UNIQUE index in the database. That was correct while a pass meant
      one person who came in once, and it makes both of the things below
      impossible:

        N02  a pass that admits four people is scanned four times
        N03  someone steps outside for a cigarette and comes back

      So the index is dropped and the rule moves here, where it can COUNT
      rather than simply refuse. `inHere` is admissions minus exits for this
      code: it goes up when one of the party comes in and down when one of
      them leaves, and the door refuses only once all `admits` places are
      taken. Nothing is weakened — a screenshotted single pass still stops
      working the moment its one place is used.

      Every scan is still one row in `scans`. The history is unchanged, and a
      run of refusals against one code still stands out exactly as before.
    */
    const tally = await env.DB.prepare(
      "SELECT " +
      "  SUM(CASE WHEN result = 'ADMITTED' THEN 1 ELSE 0 END) AS ins, " +
      "  SUM(CASE WHEN result = 'EXIT' THEN 1 ELSE 0 END) AS outs, " +
      "  MAX(CASE WHEN result = 'ADMITTED' THEN scanned_at END) AS last_in " +
      "FROM scans WHERE code = ? AND party_id = ?"
    ).bind(code, pass.party_id).first();

    const admits = Math.max(1, Number(pass.admits) || 1);
    const inHere = Math.max(0, Number(tally?.ins || 0) - Number(tally?.outs || 0));
    const already = tally && tally.last_in ? { scanned_at: tally.last_in } : null;

    /*
      A NOTE ON A NAME — N04.

      Read before any decision is returned, so it travels with a refusal as
      well as an admission. A STOP note on someone who is being turned away
      anyway still tells the door WHY, which is the difference between an
      awkward conversation and an argument.
    */
    const doorNote = await env.DB.prepare(
      "SELECT note, tone FROM door_notes WHERE code = ?"
    ).bind(code).first().catch(() => null);

    /*
      GOING OUT — N03.

      An explicit direction, sent by the scanner, never inferred. Inferring it
      from "they are already inside, so this must be them leaving" turns the
      camera-reads-it-twice case into an accidental exit, and then the next
      real scan lets a stranger in on a used code.
    */
    if (String(body.direction || "IN").toUpperCase() === "OUT") {
      if (inHere <= 0) {
        await record("REFUSED", "NOT_INSIDE");
        return json({ ok: false, reason: "NOT_INSIDE", name: pass.name, doorNote });
      }
      await record("EXIT", null);
      return json({
        ok: true, out: true, name: pass.name, kind: pass.kind,
        stillIn: inHere - 1, admits, doorNote,
      });
    }

    if (already && inHere >= admits) {
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
          ticketRef: pass.ticket_ref, idRequired: !!pass.id_required, admits,
          inHere, doorNote,
        });
      }
      await record("REFUSED", "USED");
      return json({
        ok: false, reason: "USED", name: pass.name, at: already.scanned_at,
        // On a pass for more than one, "used" needs to say how many — a door
        // told only "already used" cannot tell a fifth person on a four-pass
        // from a stranger with a screenshot.
        admits, inHere, doorNote,
      });
    }

    /*
      ── S06 · THE ROOM IS FULL ──────────────────────────────────────────
      ── D05 · AND BOTH PHONES SHOULD KNOW IT ────────────────────────────

      Counted here, on the server, which is the only place that can see both
      door phones at once. Each phone was previously counting its own
      admissions and neither knew the other's, so a capacity figure on either
      screen was half the truth.

      What happens at a hundred percent is now a decision made in advance
      rather than at the door by whoever is holding the phone.
    */
    const capacity = Number(pass.capacity) || 0;
    let inside = 0;
    if (capacity > 0) {
      /*
        Now that people can leave and come back, a headcount that only adds up
        admissions is wrong within an hour of doors — and it is wrong in the
        dangerous direction, reporting a room fuller than it is and turning
        people away from space that exists.
      */
      const cnt = await env.DB.prepare(
        "SELECT " +
        "  SUM(CASE WHEN result = 'ADMITTED' THEN 1 ELSE 0 END) AS ins, " +
        "  SUM(CASE WHEN result = 'EXIT' THEN 1 ELSE 0 END) AS outs " +
        "FROM scans WHERE party_id = ?"
      ).bind(pass.party_id).first();
      inside = Math.max(0, Number(cnt?.ins || 0) - Number(cnt?.outs || 0));

      if (inside >= capacity && settings.capacityFullAction === "REFUSE") {
        await record("REFUSED", "FULL");
        return json({
          ok: false, reason: "FULL", name: pass.name,
          inside, capacity,
        });
      }
    }

    await record("ADMITTED", null);
    return json({
      ok: true, name: pass.name, kind: pass.kind, tier: pass.tier,
      ticketRef: pass.ticket_ref,
      // Sent on every admission so both phones agree on the count without
      // either of them having to ask separately.
      inside: capacity > 0 ? inside + 1 : undefined,
      capacity: capacity || undefined,
      full: capacity > 0 && inside + 1 >= capacity && settings.capacityFullAction !== "IGNORE",
      // The night-wide switch wins: if ID is required for everyone, the door
      // asks regardless of what the individual pass says.
      idRequired: settings.idOnEveryPass || !!pass.id_required,
      note: pass.note,
      admits,
      // How many of this pass's places are now taken, so a door holding a
      // pass for four can say "2 of 4 in" instead of just "admitted".
      inHere: inHere + 1,
      doorNote,
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
      /*
        COUNTS, NOT A FLAG.

        The roster used to carry `admitted_at` — one timestamp, meaning "this
        pass has been used". A pass that admits four cannot be described that
        way, and neither can somebody who has stepped outside. So the door
        gets the same two numbers the server works from: how many have come
        in on this code, and how many have gone back out.

        The door note travels with it. A note that only exists online is a
        note that is missing at exactly the moment the basement kills the
        signal, which is when the door is least able to go and ask someone.
      */
      "SELECT p.code, p.name, p.kind, p.tier, p.ticket_ref, p.id_required, p.status, p.admits, " +
      "  (SELECT COUNT(*) FROM scans s WHERE s.code = p.code AND s.party_id = p.party_id AND s.result = 'ADMITTED') AS ins, " +
      "  (SELECT COUNT(*) FROM scans s WHERE s.code = p.code AND s.party_id = p.party_id AND s.result = 'EXIT') AS outs, " +
      "  (SELECT MIN(scanned_at) FROM scans s WHERE s.code = p.code AND s.party_id = p.party_id AND s.result = 'ADMITTED') AS admitted_at, " +
      "  (SELECT n.note FROM door_notes n WHERE n.code = p.code) AS door_note, " +
      "  (SELECT n.tone FROM door_notes n WHERE n.code = p.code) AS door_tone " +
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

    /*
      ── THREE QUERIES, NOT THREE PER ENTRY ──────────────────────────────────

      This loop used to ask the database two questions and write one answer for
      EVERY entry. At the 500-entry cap that is fifteen hundred sequential
      round trips inside a single request — and the moment it happens is the
      worst possible one: the door has just come back online at a busy event,
      there is a queue, and the phone is waiting on this to know what it may
      forget.

      Everything the loop needs is now fetched once for all the codes at once,
      and the writes go down as one batch.

      ── THE SUBTLE PART, WHICH IS EASY TO BREAK ────────────────────────────

      The old loop re-read the scan counts on every iteration, so a second
      queued admission for the SAME pass saw the first one already recorded and
      counted against the pass's places. Pre-fetching loses that for free: read
      the counts once and four queued entries for a pass admitting one all look
      like the first.

      So admissions granted during THIS request are tracked in `extra` and
      added to what the database already knew. The behaviour is identical; the
      bookkeeping is now explicit rather than a side effect of asking again.
    */
    const usable = entries.filter((e) => e.code && e.party);
    for (const e of entries) {
      if (!e.code || !e.party) rejected.push(e.code || null);
    }

    const codes = [...new Set(usable.map((e) => e.code))];
    const seenBy = new Map();
    const admitsBy = new Map();

    if (codes.length) {
      const marks = codes.map(() => "?").join(",");
      const [counts, rooms] = await Promise.all([
        env.DB.prepare(
          "SELECT code, party_id, " +
          "  SUM(CASE WHEN result = 'ADMITTED' THEN 1 ELSE 0 END) AS ins, " +
          "  SUM(CASE WHEN result = 'EXIT' THEN 1 ELSE 0 END) AS outs, " +
          "  MAX(CASE WHEN result = 'ADMITTED' THEN scanned_at END) AS last_in " +
          `FROM scans WHERE code IN (${marks}) GROUP BY code, party_id`
        ).bind(...codes).all(),
        env.DB.prepare(
          `SELECT code, admits FROM passes WHERE code IN (${marks})`
        ).bind(...codes).all(),
      ]);
      for (const r of counts.results || []) seenBy.set(`${r.code}:${r.party_id}`, r);
      for (const r of rooms.results || []) admitsBy.set(r.code, r.admits);
    }

    // Admissions this request has granted but not yet written.
    const extra = new Map();
    const writes = [];

    for (const e of usable) {
      /*
        A QUEUED ADMISSION IS ONLY A CONFLICT ONCE THE PLACES ARE FULL.

        A pass admitting four must not have its second, third and fourth
        people thrown away because the door went offline — they were let in at
        the door and would otherwise vanish from the record.
      */
      const seen = seenBy.get(`${e.code}:${e.party}`) || {};
      const mine = extra.get(e.code) || { n: 0, at: null };
      const allowed = Math.max(1, Number(admitsBy.get(e.code)) || 1);
      const held = Math.max(0, Number(seen.ins || 0) - Number(seen.outs || 0)) + mine.n;
      const lastIn = mine.at || seen.last_in;
      const already = held >= allowed && lastIn ? { scanned_at: lastIn } : null;

      if (already) {
        // Someone was admitted twice — once offline, once elsewhere. Worth
        // surfacing rather than silently dropping. Still "handled": retrying
        // it tomorrow would produce the same answer forever.
        conflicts.push({ code: e.code, at: already.scanned_at });
        handled.push(e.code);
        continue;
      }

      const at = e.at || now();
      writes.push(
        env.DB.prepare(
          "INSERT INTO scans (code, party_id, result, reason, scanned_by, scanned_at) " +
          "VALUES (?, ?, 'ADMITTED', 'offline', ?, ?)"
        ).bind(e.code, e.party, who.username, at)
      );
      extra.set(e.code, { n: mine.n + 1, at });
      handled.push(e.code);
      recorded += 1;
    }

    /*
      D1 caps a batch, so this goes down in chunks rather than as one
      statement list. Still two orders of magnitude fewer round trips than
      before, and a chunk that fails leaves the earlier ones written — which
      is correct here: an admission recorded is a fact, and the door keeps
      whatever this response does not say it handled.
    */
    for (let i = 0; i < writes.length; i += 50) {
      await env.DB.batch(writes.slice(i, i + 50));
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
      "SELECT p.code, p.name, p.kind, p.tier, p.note, p.status, p.email, p.admits, p.ticket_ref, " +
      "  (SELECT COUNT(*) FROM scans s WHERE s.code = p.code AND s.result = 'ADMITTED') AS ins, " +
      "  (SELECT COUNT(*) FROM scans s WHERE s.code = p.code AND s.result = 'EXIT') AS outs, " +
      "  (SELECT n.note FROM door_notes n WHERE n.code = p.code) AS door_note, " +
      "  (SELECT n.tone FROM door_notes n WHERE n.code = p.code) AS door_tone, " +
      "  (SELECT MIN(scanned_at) FROM scans s WHERE s.code = p.code AND s.result = 'ADMITTED') AS admitted_at, " +
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

  /*
    ══ THE RESTORE DRILL, ON REAL DATA ═══════════════════════════════════════

    A backup nobody has restored is a belief, not a backup. There was already a
    drill — twelve checks — but it validated the SHAPE of a dump. Nothing had
    ever taken a real backup and rebuilt a working database out of it, and the
    night you find out is the night you needed it.

    This does the real thing: reads the newest backup out of R2, empties the
    database, replays every row, and reports what it put back against what the
    file said it should.

    ── WHY THIS CANNOT RUN IN PRODUCTION, AND HOW THAT IS ENFORCED ──────────

    It begins by deleting everything. Run against the live database it would be
    the single most destructive route in this file — worse than any of the
    delete endpoints, because it is all of them at once.

    So it refuses unless env.ENVIRONMENT is exactly "preview", which is set as
    a variable ONLY in the preview environment in wrangler.jsonc. Production
    has no such variable, so the check fails closed: a missing value is a
    refusal, not a default. The R2 bucket is shared between the two, which is
    what lets the preview worker read a backup production wrote.

    That is deliberately not a permission check. Being the boss should not be
    enough to empty the live database by pressing a button in a console; being
    in the right environment has to be.
  */
  if (path === "/restore/drill" && method === "POST") {
    const whoDrill = await readSession(env, request);
    if (!whoDrill || !can(whoDrill, "manageTeam")) return fail("Not allowed.", 403);

    if (env.ENVIRONMENT !== "preview") {
      return fail(
        "The drill only runs on the preview deploy, which has its own database. " +
        "Run it from the preview URL rather than from the live site.", 400
      );
    }
    if (!env.MEDIA) return fail("No bucket is connected.", 400);

    // The newest backup, whatever it is called.
    const listed = await env.MEDIA.list({ prefix: PRIVATE_PREFIX });
    const files = (listed.objects || [])
      .filter((o) => o.key.endsWith(".json"))
      .sort((a, b) => String(b.key).localeCompare(String(a.key)));
    if (!files.length) return fail("There are no backups to restore.", 404);

    const chosen = String(body.key || files[0].key);
    if (!chosen.startsWith(PRIVATE_PREFIX)) return fail("That is not a backup.", 400);

    const object = await env.MEDIA.get(chosen);
    if (!object) return fail("That backup is gone.", 404);

    let dump;
    try { dump = JSON.parse(await object.text()); }
    catch { return fail("That backup will not parse. This is what a drill is for."); }
    if (!dump || !dump.tables) return fail("That backup has no tables in it.");

    /*
      The order matters on the way in and on the way out. Parties before
      passes, passes before scans — and the reverse when emptying, so nothing
      is ever orphaned mid-flight. Anything not named here goes last, in
      whatever order the file lists it, which is fine for tables nothing points
      at.
    */
    const FIRST = ["parties", "team", "artists", "records", "mixes", "posts",
                   "pages", "settings"];
    const names = Object.keys(dump.tables);
    const order = [...FIRST.filter((t) => names.includes(t)),
                   ...names.filter((t) => !FIRST.includes(t))];

    for (const table of [...order].reverse()) {
      await env.DB.prepare(`DELETE FROM "${table}"`).run().catch(() => {});
    }

    const report = [];
    let restored = 0, failed = 0;

    for (const table of order) {
      const rows = dump.tables[table] || [];
      let wrote = 0;
      for (const row of rows) {
        const cols = Object.keys(row);
        if (!cols.length) continue;
        const marks = cols.map(() => "?").join(", ");
        const quoted = cols.map((c) => `"${c}"`).join(", ");
        try {
          await env.DB.prepare(
            `INSERT OR REPLACE INTO "${table}" (${quoted}) VALUES (${marks})`
          ).bind(...cols.map((c) => row[c])).run();
          wrote++;
        } catch (err) {
          // Recorded rather than thrown: one bad row must not hide the state
          // of the other thirty tables, and knowing WHICH table refused is
          // the entire value of running this.
          failed++;
          if (report.length < 400) {
            report.push({ table, error: String(err && err.message).slice(0, 160) });
          }
        }
      }
      restored += wrote;

      const back = await env.DB.prepare(`SELECT COUNT(*) AS n FROM "${table}"`)
        .first().catch(() => ({ n: -1 }));
      report.push({
        table,
        inTheFile: rows.length,
        nowInTheDatabase: back ? back.n : -1,
        ok: back && back.n === rows.length,
      });
    }

    const bad = report.filter((r) => r.ok === false);
    return json({
      ok: true,
      from: chosen,
      taken: dump.taken || null,
      truncated: dump.truncated || [],
      tables: order.length,
      restored,
      failed,
      matched: bad.length === 0,
      report,
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

  /*
    ── D03 · FIND A GUEST BY NAME, AND REISSUE ─────────────────────────────

    A code written on a physical ticket gets smudged, soaked, or the ticket is
    left on a kitchen table. Until now the door could answer a code and
    nothing else, so a real guest with a real pass had no way through except
    an argument.

    Search is deliberately narrow: this night only, name only, and it returns
    the same shape the door already understands.
  */
  if (path === "/passes/search" && method === "GET") {
    const who = await readSession(env, request);
    if (!who || !can(who, "scan")) return fail("Not signed in.", 401);

    const q = String(url.searchParams.get("q") || "").trim();
    const party = url.searchParams.get("party") || "";
    if (q.length < 2) return json({ ok: true, passes: [] });

    const rows = await env.DB.prepare(
      "SELECT p.code, p.name, p.kind, p.tier, p.status, p.admits, p.id_required, p.ticket_ref, " +
      "  (SELECT scanned_at FROM scans s WHERE s.code = p.code AND s.result = 'ADMITTED' LIMIT 1) AS admitted_at " +
      "FROM passes p WHERE p.party_id = ? AND p.name LIKE ? COLLATE NOCASE " +
      "ORDER BY p.name LIMIT 20"
    ).bind(party, `%${q}%`).all();

    return json({ ok: true, passes: rows.results || [] });
  }

  /*
    Admitting somebody by hand, with a reason.

    Kept separate from a scan on purpose: this is a JUDGEMENT, not a reading,
    and the record should say which it was. "Admitted manually by Ana because
    the ticket was unreadable" is a different fact from "the camera saw a
    valid code", and a month later the difference is the whole story.
  */
  if (path === "/passes/admit" && method === "POST") {
    const who = await readSession(env, request);
    if (!who || !can(who, "scan")) return fail("Not signed in.", 401);

    const code = String(body.code || "").toUpperCase();
    const why = String(body.reason || "").trim().slice(0, 120) || "no reason given";
    const pass = await env.DB.prepare("SELECT * FROM passes WHERE code = ?").bind(code).first();
    if (!pass) return fail("No such pass.", 404);
    if (pass.status === "REVOKED") return fail("That pass has been cancelled.", 409);

    const already = await env.DB.prepare(
      "SELECT scanned_at FROM scans WHERE code = ? AND result = 'ADMITTED'"
    ).bind(code).first();
    if (already) return json({ ok: false, reason: "USED", name: pass.name, at: already.scanned_at });

    await env.DB.prepare(
      "INSERT INTO scans (code, party_id, result, reason, scanned_by, scanned_at) " +
      "VALUES (?, ?, 'ADMITTED', ?, ?, ?)"
    ).bind(code, pass.party_id, "by hand: " + why, who.username, now()).run();

    return json({ ok: true, name: pass.name, admits: pass.admits || 1 });
  }

  /*
    A replacement code. The old one is cancelled in the same breath — a lost
    ticket that still works is two people with one pass, and the door cannot
    tell which of them is the guest.
  */
  if (path === "/passes/reissue" && method === "POST") {
    const who = await readSession(env, request);
    if (!who || !can(who, "issuePasses")) return fail("Only the boss can reissue.", 403);

    const code = String(body.code || "").toUpperCase();
    const old = await env.DB.prepare("SELECT * FROM passes WHERE code = ?").bind(code).first();
    if (!old) return fail("No such pass.", 404);

    const pooled = await env.DB.prepare(
      "SELECT code FROM code_pool WHERE used = 0 ORDER BY RANDOM() LIMIT 1"
    ).first();
    if (!pooled) return fail("The code pool is empty.", 409);

    await env.DB.batch([
      env.DB.prepare("UPDATE code_pool SET used = 1, used_at = ? WHERE code = ?").bind(now(), pooled.code),
      env.DB.prepare(
        "INSERT INTO passes (code, party_id, name, email, phone, kind, tier, note, id_required, admits, ticket_ref, issued_at, issued_by) " +
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      ).bind(pooled.code, old.party_id, old.name, old.email, old.phone, old.kind, old.tier,
             `replaces ${old.code}`, old.id_required, old.admits || 1, old.ticket_ref, now(), who.username),
      env.DB.prepare(
        "UPDATE passes SET status = 'REVOKED', revoke_note = ? WHERE code = ?"
      ).bind(`replaced by ${pooled.code}`, code),
    ]);

    return json({ ok: true, code: pooled.code, name: old.name });
  }

  /*
    ── D04 · THE RECORD YOU WERE ALREADY KEEPING ───────────────────────────

    Every admission stores who scanned it. Every setting stores who changed
    it. Every account stores who made it. None of it was ever shown anywhere,
    which meant "who let them in" was answered from memory.

    Three tables, one list, newest first.
  */
  if (path === "/activity" && method === "GET") {
    const who = await readSession(env, request);
    if (!who || !can(who, "manageTeam")) return fail("Not allowed.", 403);

    const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 120, 1), 400);

    const scans = await env.DB.prepare(
      "SELECT s.scanned_at AS at, s.result, s.reason, s.scanned_by AS by_who, s.code, p.name " +
      "FROM scans s LEFT JOIN passes p ON p.code = s.code ORDER BY s.scanned_at DESC LIMIT ?"
    ).bind(limit).all().catch(() => ({ results: [] }));

    const settings = await env.DB.prepare(
      "SELECT key, value, updated_at AS at, updated_by AS by_who FROM settings " +
      "WHERE updated_at IS NOT NULL ORDER BY updated_at DESC LIMIT 60"
    ).all().catch(() => ({ results: [] }));

    const team = await env.DB.prepare(
      "SELECT username, role, created_at AS at, created_by AS by_who FROM team " +
      "ORDER BY created_at DESC LIMIT 40"
    ).all().catch(() => ({ results: [] }));

    const feed = [
      ...(scans.results || []).map((r) => ({
        at: r.at, who: r.by_who, kind: "DOOR",
        what: r.result === "ADMITTED"
          ? `admitted ${r.name || r.code}${r.reason ? ` (${r.reason})` : ""}`
          : `refused ${r.name || r.code}${r.reason ? ` — ${r.reason}` : ""}`,
        tone: r.result === "ADMITTED" ? "good" : "bad",
      })),
      ...(settings.results || []).map((r) => ({
        at: r.at, who: r.by_who, kind: "SETTING",
        what: `set ${r.key} to ${String(r.value).slice(0, 40)}`, tone: "plain",
      })),
      ...(team.results || []).map((r) => ({
        at: r.at, who: r.by_who || "—", kind: "TEAM",
        what: `created the ${String(r.role).toLowerCase()} account ${r.username}`, tone: "plain",
      })),
    ].filter((r) => r.at)
     .sort((a, b) => String(b.at).localeCompare(String(a.at)))
     .slice(0, limit);

    return json({ ok: true, feed });
  }

  /*
    ── S03 · FINDING OUT WHEN IT BREAKS FOR SOMEBODY ELSE ──────────────────

    When the site failed for a visitor, the error went to a console nobody was
    looking at. You found out by chance, from a screen recording, or never.

    That was a deliberate choice and the reason still stands: sending errors
    to a third party means routing your visitors' browsing off-site to a
    company neither of you chose. This is the version that does not — it goes
    to YOUR server and YOUR database, and nothing leaves.

    WHAT IS DELIBERATELY NOT COLLECTED. No address, no identifier, no session,
    no referrer, nothing that could pick a person out. A message, where in the
    code, which page, and what kind of browser. That is enough to fix things
    and not enough to follow anybody.

    Errors are COUNTED, not listed: one row per distinct message per page,
    with a tally. A broken component can fire five hundred times in a minute,
    and five hundred identical rows is a database bill and a page you cannot
    read.
  */
  if (path === "/oops" && method === "POST") {
    const message = String(body.message || "").slice(0, 300).trim();
    if (!message) return json({ ok: true });

    const where = String(body.where || "").slice(0, 200);
    const stack = String(body.stack || "").slice(0, 900);
    const page = String(body.path || "").split("?")[0].slice(0, 120);

    // The browser family only — the full string is a fingerprint.
    const ua = request.headers.get("user-agent") || "";
    const agent =
      /iPhone|iPad/.test(ua) ? "iOS Safari"
      : /Android/.test(ua) ? "Android"
      : /Safari/.test(ua) && !/Chrome/.test(ua) ? "Safari"
      : /Chrome/.test(ua) ? "Chrome"
      : /Firefox/.test(ua) ? "Firefox" : "other";

    await env.DB.prepare(
      "INSERT INTO oops (at, message, where_at, stack, agent, path, n) VALUES (?, ?, ?, ?, ?, ?, 1) " +
      "ON CONFLICT (message, path) DO UPDATE SET n = n + 1, at = excluded.at"
    ).bind(now(), message, where, stack, agent, page).run().catch(() => {});
    return json({ ok: true });
  }

  if (path === "/oops" && method === "GET") {
    const who = await readSession(env, request);
    if (!who || !can(who, "manageTeam")) return fail("Not allowed.", 403);
    const rows = await env.DB.prepare(
      "SELECT at, message, where_at, stack, agent, path, n FROM oops ORDER BY at DESC LIMIT 120"
    ).all().catch(() => ({ results: [] }));
    return json({ ok: true, errors: rows.results || [] });
  }

  if (path === "/oops" && method === "DELETE") {
    const who = await readSession(env, request);
    if (!who || !can(who, "manageTeam")) return fail("Not allowed.", 403);
    await env.DB.prepare("DELETE FROM oops").run().catch(() => {});
    return json({ ok: true });
  }

  /*
    ═══════════════════════════════════════════════════════════════════════
    THE SECOND EIGHTEEN.

    Everything below was added in one pass, so it shares three ideas rather
    than inventing three of each:

      · SHARE LINKS. A door display on a wall, an artist's press kit sent to
        a promoter, and a guest forwarding an invite are the same problem —
        read access to one object, no login, revocable. One table, one
        lookup, one place to get the security right.
      · PUBLIC FORMS ARE RATE-LIMITED AND SETTING-GATED, always on the
        server. The page hiding a closed form is a courtesy; the refusal is
        here.
      · NOTHING PUBLIC RETURNS AN EMAIL ADDRESS. Not a demo's, not a
        booking's, not a guest's. The console sees them; the internet does
        not, whatever a page chooses to draw.
    ═══════════════════════════════════════════════════════════════════════
  */

  /*
    ── N04 · A NOTE ON A NAME ───────────────────────────────────────────────
    Written by whoever can issue passes, read by the door at the moment a code
    scans. Kept in its own table so the migration that adds it cannot half
    apply, and so removing a note is a delete rather than a nulled column.
  */
  if (path.match(/^\/passes\/[^/]+\/note$/) && method === "PUT") {
    const who = await readSession(env, request);
    if (!who || !can(who, "issuePasses")) return fail("Not allowed.", 403);
    const code = decodeURIComponent(path.split("/")[2]).toUpperCase();

    const note = String(body.note || "").slice(0, 200).trim();
    const tone = ["INFO", "GOOD", "WARN", "STOP"].includes(body.tone) ? body.tone : "INFO";
    if (!note) {
      await env.DB.prepare("DELETE FROM door_notes WHERE code = ?").bind(code).run();
      return json({ ok: true, cleared: true });
    }
    await env.DB.prepare(
      "INSERT INTO door_notes (code, note, tone, created_at, created_by) VALUES (?, ?, ?, ?, ?) " +
      "ON CONFLICT (code) DO UPDATE SET note = excluded.note, tone = excluded.tone, " +
      "  created_at = excluded.created_at, created_by = excluded.created_by"
    ).bind(code, note, tone, now(), who.username).run();
    return json({ ok: true });
  }

  /*
    ── SHARE LINKS ──────────────────────────────────────────────────────────

    THE TOKEN. 32 characters from crypto.getRandomValues, not Math.random and
    not a hash of anything guessable. This string IS the authorisation — there
    is nothing else to get past — so it has to be long enough that guessing is
    hopeless and random enough that seeing one tells you nothing about the
    next.
  */
  if (path === "/share" && method === "POST") {
    const who = await readSession(env, request);
    if (!who || !can(who, "issuePasses")) return fail("Not allowed.", 403);

    const kind = ["DOOR", "EPK", "INVITE"].includes(body.kind) ? body.kind : null;
    if (!kind) return fail("What kind of link?");
    const ref = String(body.ref || "").slice(0, 120);
    if (!ref) return fail("A link has to point at something.");

    const bytes = crypto.getRandomValues(new Uint8Array(24));
    const token = [...bytes].map((b) => b.toString(36).padStart(2, "0")).join("").slice(0, 32);

    /*
      A DOOR LINK DIES WITH THE NIGHT. It is pasted into a group chat and
      forgotten, and a headcount that is still readable next March is a small
      leak that nobody will ever remember to close. An EPK link is meant to
      live in a promoter's inbox for a year, so it does not expire — it gets
      revoked instead, which is a decision someone makes rather than a
      surprise.
    */
    let expires = body.expires || null;
    if (!expires && kind === "DOOR") {
      expires = new Date(Date.now() + 36 * 3600 * 1000).toISOString();
    }
    /*
      ── K18 · A KIT LINK'S OWN CLOCK ─────────────────────────────────────
      From the setting rather than hardcoded, because how long a kit link
      should live is a decision about how you work — a link for one promoter
      and a link on a roster page want different answers. Zero means it does
      not expire and is revoked by hand instead, which is the default and the
      right one for a kit.
    */
    if (!expires && kind === "EPK") {
      const cfgLink = await getSettings(env);
      const days = Math.max(0, Number(cfgLink.kitLinkDays) || 0);
      if (days > 0) expires = new Date(Date.now() + days * 86400000).toISOString();
    }

    await env.DB.prepare(
      "INSERT INTO share_links (token, kind, ref, label, expires_at, created_at, created_by) " +
      "VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).bind(token, kind, ref, String(body.label || "").slice(0, 80) || null,
           expires, now(), who.username).run();

    return json({ ok: true, token, expires });
  }

  if (path === "/share" && method === "GET") {
    const who = await readSession(env, request);
    if (!who || !can(who, "issuePasses")) return fail("Not allowed.", 403);
    const kind = url.searchParams.get("kind");
    const rows = kind
      ? await env.DB.prepare(
          "SELECT * FROM share_links WHERE kind = ? ORDER BY created_at DESC LIMIT 100"
        ).bind(kind).all()
      : await env.DB.prepare(
          "SELECT * FROM share_links ORDER BY created_at DESC LIMIT 100"
        ).all();
    return json({ ok: true, links: rows.results || [] });
  }

  // Revoking rather than deleting: the row stays, so "this link was made,
  // used eleven times, and killed on the 4th" remains answerable.
  if (path.startsWith("/share/") && method === "DELETE") {
    const who = await readSession(env, request);
    if (!who || !can(who, "issuePasses")) return fail("Not allowed.", 403);
    const token = decodeURIComponent(path.slice(7));
    await env.DB.prepare("UPDATE share_links SET revoked = 1 WHERE token = ?").bind(token).run();
    return json({ ok: true });
  }

  /*
    One reader for all three kinds, so the checks — does it exist, is it
    revoked, has it expired — are written once and cannot drift apart.
  */
  const openShare = async (token, kind) => {
    const row = await env.DB.prepare(
      "SELECT * FROM share_links WHERE token = ?"
    ).bind(token).first();
    if (!row || row.revoked) return null;
    if (row.kind !== kind) return null;
    if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) return null;
    // Counted, so a link that is being passed around shows it.
    await env.DB.prepare(
      "UPDATE share_links SET uses = uses + 1, last_used = ? WHERE token = ?"
    ).bind(now(), token).run().catch(() => {});
    return row;
  };

  /*
    ── N01 · THE NUMBER ON THE WALL ─────────────────────────────────────────

    Everything a screen propped up in a corner needs and nothing else: how
    many are in, how many are expected, and the room's limit. No names — a
    display in a public room must not be a guest list anyone can photograph.
  */
  if (path.startsWith("/wall/") && method === "GET") {
    const link = await openShare(decodeURIComponent(path.slice(6)), "DOOR");
    if (!link) return fail("This link is not working.", 404);

    const party = await env.DB.prepare(
      "SELECT id, name, date_label, capacity, doors_close_at FROM parties WHERE id = ?"
    ).bind(link.ref).first();
    if (!party) return fail("No such night.", 404);

    const cnt = await env.DB.prepare(
      "SELECT " +
      "  SUM(CASE WHEN result = 'ADMITTED' THEN 1 ELSE 0 END) AS ins, " +
      "  SUM(CASE WHEN result = 'EXIT' THEN 1 ELSE 0 END) AS outs " +
      "FROM scans WHERE party_id = ?"
    ).bind(link.ref).first();

    const expected = await env.DB.prepare(
      "SELECT SUM(admits) AS n FROM passes WHERE party_id = ? AND status = 'ACTIVE'"
    ).bind(link.ref).first();

    const ins = Number(cnt?.ins || 0);
    const outs = Number(cnt?.outs || 0);
    return json({
      ok: true,
      party: { name: party.name, date: party.date_label },
      inside: Math.max(0, ins - outs),
      admitted: ins,
      outside: outs,
      expected: Number(expected?.n || 0),
      capacity: Number(party.capacity) || 0,
      closed: new Date(party.doors_close_at).getTime() < Date.now(),
      at: now(),
    });
  }

  /*
    ── G06 · THE RUNNING ORDER ──────────────────────────────────────────────
    Public to read, because it is the thing guests refresh all night.
  */
  if (path === "/settimes" && method === "GET") {
    const partyId = url.searchParams.get("party");
    if (!partyId) return json({ ok: true, sets: [] });
    const rows = await env.DB.prepare(
      "SELECT id, name, at_label, room, note, sort_order FROM set_times " +
      "WHERE party_id = ? ORDER BY sort_order ASC, id ASC"
    ).bind(partyId).all().catch(() => ({ results: [] }));
    return json({ ok: true, sets: rows.results || [] });
  }

  if (path === "/settimes" && method === "PUT") {
    const who = await readSession(env, request);
    if (!who || !can(who, "issuePasses")) return fail("Not allowed.", 403);
    const partyId = String(body.party || "");
    if (!partyId) return fail("Which event?");

    /*
      REPLACED WHOLE, not patched row by row. A running order is edited as a
      list — reordered, one line deleted, two added — and sending the finished
      list is the only version of that which cannot end up half-applied when
      the phone loses signal between the third and fourth request.
    */
    const sets = Array.isArray(body.sets) ? body.sets.slice(0, 40) : [];
    await env.DB.prepare("DELETE FROM set_times WHERE party_id = ?").bind(partyId).run();
    let i = 0;
    for (const s of sets) {
      const name = String(s.name || "").slice(0, 80).trim();
      if (!name) continue;
      await env.DB.prepare(
        "INSERT INTO set_times (party_id, name, at_label, room, note, sort_order, updated_at) " +
        "VALUES (?, ?, ?, ?, ?, ?, ?)"
      ).bind(partyId, name, String(s.at || "").slice(0, 40) || null,
             String(s.room || "").slice(0, 40) || null,
             String(s.note || "").slice(0, 120) || null, i++, now()).run();
    }
    return json({ ok: true, saved: i });
  }

  /*
    ── G07 · ADD TO CALENDAR ────────────────────────────────────────────────

    An .ics file, built here rather than in the browser, because the phone
    that most needs this is the one being handed a link in a message and it
    should not have to run any JavaScript to save a date.

    THE FOLDING. iCalendar lines are limited to 75 octets and a long venue
    name silently breaks a file that no calendar will then open. `fold` is not
    a nicety.
  */
  if (path.startsWith("/ics/") && method === "GET") {
    const partyId = decodeURIComponent(path.slice(5)).replace(/\.ics$/, "");
    const party = await env.DB.prepare(
      "SELECT id, name, date_label, venue, starts_at, doors_close_at FROM parties WHERE id = ? AND archived = 0"
    ).bind(partyId).first();
    if (!party) return new Response("Not found", { status: 404 });

    const stamp = (iso) => {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return null;
      return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    };
    const start = stamp(party.starts_at || party.doors_close_at);
    const end = stamp(party.doors_close_at);
    if (!start) return new Response("No date", { status: 404 });

    const esc = (t) => String(t || "").replace(/([,;\\])/g, "\\$1").replace(/\n/g, "\\n");
    const fold = (line) => {
      const out = [];
      let s = line;
      while (s.length > 74) { out.push(s.slice(0, 74)); s = " " + s.slice(74); }
      out.push(s);
      return out.join("\r\n");
    };

    const body_ = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Hidden State//EN",
      "CALSCALE:GREGORIAN",
      "BEGIN:VEVENT",
      `UID:${party.id}@hiddenstategroup.com`,
      `DTSTAMP:${stamp(now())}`,
      `DTSTART:${start}`,
      end ? `DTEND:${end}` : null,
      fold(`SUMMARY:${esc("Hidden State — " + party.name)}`),
      party.venue ? fold(`LOCATION:${esc(party.venue)}`) : null,
      fold(`DESCRIPTION:${esc("Doors and details: https://hiddenstategroup.com/events")}`),
      "END:VEVENT",
      "END:VCALENDAR",
    ].filter(Boolean).join("\r\n");

    return new Response(body_, {
      headers: {
        "content-type": "text/calendar; charset=utf-8",
        "content-disposition": `attachment; filename="hidden-state-${party.id}.ics"`,
        "cache-control": "public, max-age=300",
      },
    });
  }

  /*
    ── L01 · DEMOS ──────────────────────────────────────────────────────────

    A LINK, NOT A FILE. Accepting uploads would mean storing strangers' audio,
    deciding how long to keep it, and answering for it — for a queue that is
    read once and mostly answered no. Everyone sends a link anyway.
  */
  if (path === "/demos" && method === "POST") {
    const cfg = await getSettings(env);
    if (!cfg.demosOpen) return fail(cfg.demosClosedMessage || "Demos are closed at the moment.", 403);

    const artist = String(body.artist || "").slice(0, 80).trim();
    const email = String(body.email || "").slice(0, 160).trim();
    const link = String(body.url || "").slice(0, 500).trim();
    if (!artist || !email || !link) return fail("A name, an address and a link, please.");
    if (!/^https?:\/\//i.test(link)) return fail("That does not look like a link.");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail("That address does not look right.");

    /*
      ONE PER ADDRESS PER DAY. Not a general rate limit — a specific one, and
      the honest reason is that the same person sends the same link four times
      when they get no answer within an hour. Counting by address rather than
      by connection is what actually stops that.
    */
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const recent = await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM demos WHERE email = ? AND created_at > ?"
    ).bind(email, since).first();
    if (Number(recent?.n || 0) >= 2) {
      return fail("We already have yours — give us a few days to listen.", 429);
    }

    await env.DB.prepare(
      "INSERT INTO demos (artist, email, url, title, note, socials, created_at) " +
      "VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).bind(artist, email, link, String(body.title || "").slice(0, 120) || null,
           String(body.note || "").slice(0, 600) || null,
           String(body.socials || "").slice(0, 200) || null, now()).run();

    return json({ ok: true });
  }

  if (path === "/demos" && method === "GET") {
    const who = await readSession(env, request);
    if (!who || !can(who, "issuePasses")) return fail("Not allowed.", 403);
    const status = url.searchParams.get("status");
    const rows = status && status !== "ALL"
      ? await env.DB.prepare(
          "SELECT * FROM demos WHERE status = ? ORDER BY created_at DESC LIMIT 300"
        ).bind(status).all()
      : await env.DB.prepare("SELECT * FROM demos ORDER BY created_at DESC LIMIT 300").all();
    return json({ ok: true, demos: rows.results || [] });
  }

  if (path.startsWith("/demos/") && method === "PATCH") {
    const who = await readSession(env, request);
    if (!who || !can(who, "issuePasses")) return fail("Not allowed.", 403);
    const id = decodeURIComponent(path.slice(7));
    const status = ["NEW", "HEARD", "YES", "MAYBE", "NO"].includes(body.status) ? body.status : null;
    if (!status) return fail("Unknown verdict.");

    const row = await env.DB.prepare("SELECT * FROM demos WHERE id = ?").bind(id).first();
    if (!row) return fail("No such demo.", 404);

    await env.DB.prepare(
      "UPDATE demos SET status = ?, verdict = ?, decided_by = ?, heard_at = COALESCE(heard_at, ?) WHERE id = ?"
    ).bind(status, String(body.verdict || row.verdict || "").slice(0, 500) || null,
           who.username, now(), id).run();

    /*
      ANSWERING IS A SEPARATE, DELIBERATE ACT.

      Marking something NO and having a letter leave immediately is how you
      send a rejection you meant to reconsider. `reply: true` has to be asked
      for, and it is recorded, so nobody is ever answered twice.
    */
    let told = false;
    if (body.reply && row.email && !row.replied_at) {
      const cfg = await getSettings(env);
      const yes = status === "YES" || status === "MAYBE";
      told = true;
      ctx.waitUntil(sendNote(env, {
        to: row.email,
        subject: yes ? "About your demo" : "Thank you for the demo",
        text: yes
          ? `${row.artist},\n\nWe listened, and we would like to talk. Someone will write ` +
            `to you properly in the next few days.\n\n${cfg.emailSignoff || "Hidden State"}\n`
          : `${row.artist},\n\nThank you for sending it — we listened. It is not right for ` +
            `us at the moment, which is a decision about fit and not about the work.\n\n` +
            `Please do send us the next one.\n\n${cfg.emailSignoff || "Hidden State"}\n`,
      }));
      await env.DB.prepare("UPDATE demos SET replied_at = ? WHERE id = ?").bind(now(), id).run();
    }
    return json({ ok: true, told });
  }

  /*
    ── L04 · BOOKINGS ───────────────────────────────────────────────────────
    The questions you would have to ask anyway, asked once, up front.
  */
  if (path === "/bookings" && method === "POST") {
    const cfg = await getSettings(env);
    if (!cfg.bookingsOpen) return fail("Bookings are closed at the moment.", 403);

    const promoter = String(body.promoter || "").slice(0, 100).trim();
    const email = String(body.email || "").slice(0, 160).trim();
    if (!promoter || !email) return fail("A name and an address, please.");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail("That address does not look right.");

    const since = new Date(Date.now() - 3600 * 1000).toISOString();
    const recent = await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM bookings WHERE email = ? AND created_at > ?"
    ).bind(email, since).first();
    if (Number(recent?.n || 0) >= 3) return fail("We have your enquiry.", 429);

    const t = (v, n) => String(v || "").slice(0, n) || null;
    await env.DB.prepare(
      "INSERT INTO bookings (promoter, company, email, phone, artist, date_label, city, country, " +
      "  venue, capacity, budget, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).bind(promoter, t(body.company, 100), email, t(body.phone, 40), t(body.artist, 80),
           t(body.date, 60), t(body.city, 60), t(body.country, 60), t(body.venue, 100),
           t(body.capacity, 40), t(body.budget, 60), t(body.note, 800), now()).run();

    // Told immediately, because a booking enquiry that sits unseen for a week
    // is a date that has gone to somebody else.
    const cfgB = await getSettings(env);
    if (cfgB.accountCopyTo) {
      ctx.waitUntil(sendNote(env, {
        to: cfgB.accountCopyTo,
        subject: `Booking enquiry — ${promoter}${body.artist ? " for " + body.artist : ""}`,
        text: `${promoter}${body.company ? " (" + body.company + ")" : ""}\n` +
              `${email}${body.phone ? " · " + body.phone : ""}\n\n` +
              `Artist: ${body.artist || "—"}\nWhen: ${body.date || "—"}\n` +
              `Where: ${[body.venue, body.city, body.country].filter(Boolean).join(", ") || "—"}\n` +
              `Capacity: ${body.capacity || "—"}\nBudget: ${body.budget || "—"}\n\n` +
              `${body.note || ""}\n`,
      }));
    }
    return json({ ok: true });
  }

  if (path === "/bookings" && method === "GET") {
    const who = await readSession(env, request);
    if (!who || !can(who, "issuePasses")) return fail("Not allowed.", 403);
    const rows = await env.DB.prepare(
      "SELECT * FROM bookings ORDER BY created_at DESC LIMIT 200"
    ).all();
    return json({ ok: true, bookings: rows.results || [] });
  }

  if (path.startsWith("/bookings/") && method === "PATCH") {
    const who = await readSession(env, request);
    if (!who || !can(who, "issuePasses")) return fail("Not allowed.", 403);
    const id = decodeURIComponent(path.slice(10));
    const status = ["NEW", "TALKING", "HELD", "CONFIRMED", "NO"].includes(body.status)
      ? body.status : null;
    if (!status) return fail("Unknown status.");
    await env.DB.prepare(
      "UPDATE bookings SET status = ?, reply_note = ?, decided_by = ?, decided_at = ? WHERE id = ?"
    ).bind(status, String(body.note || "").slice(0, 600) || null, who.username, now(), id).run();
    return json({ ok: true });
  }

  {
    const handled = await epkRoutes({ request, env, url, ctx, path, method, body });
    if (handled) return handled;
  }
  /*
    ── L03 · WHERE A RECORD LIVES ───────────────────────────────────────────

    `presave` rows are shown before the release date and hidden after it, and
    the ordinary ones the other way round. The switch is the date on the
    record, so release day happens by itself at midnight in whatever timezone
    the reader is in, and nobody has to be awake for it.
  */
  if (path === "/links" && method === "GET") {
    const slug = url.searchParams.get("record");
    if (!slug) return json({ ok: true, links: [] });
    const rows = await env.DB.prepare(
      "SELECT id, label, url, presave, sort_order FROM release_links " +
      "WHERE record_slug = ? ORDER BY sort_order ASC, id ASC"
    ).bind(slug).all().catch(() => ({ results: [] }));
    return json({ ok: true, links: rows.results || [] });
  }

  if (path === "/links" && method === "PUT") {
    const who = await readSession(env, request);
    if (!who || !can(who, "issuePasses")) return fail("Not allowed.", 403);
    const slug = String(body.record || "");
    if (!slug) return fail("Which record?");
    const list = Array.isArray(body.links) ? body.links.slice(0, 20) : [];

    await env.DB.prepare("DELETE FROM release_links WHERE record_slug = ?").bind(slug).run();
    let i = 0;
    for (const l of list) {
      const label = String(l.label || "").slice(0, 40).trim();
      const href = String(l.url || "").slice(0, 500).trim();
      if (!label || !/^https?:\/\//i.test(href)) continue;
      await env.DB.prepare(
        "INSERT INTO release_links (record_slug, label, url, presave, sort_order) VALUES (?, ?, ?, ?, ?)"
      ).bind(slug, label, href, l.presave ? 1 : 0, i++).run();
    }
    return json({ ok: true, saved: i });
  }

  /*
    ── U01 · SOMETHING WATCHING FROM OUTSIDE ────────────────────────────────

    /api/health tells you whether the database, the bucket and the mail key
    are answering. It cannot tell you the site is up, because if the Worker is
    gone then so is the check — that answer has to come from outside
    Cloudflare.

    This is what an external monitor should point at. Plain text, no database
    query, no JSON to parse, cache explicitly forbidden: it is up if and only
    if these four characters come back. A monitor that watched /api/health
    instead would go red every time the mail key expired, and a monitor that
    cries wolf is worse than none.
  */
  if (path === "/up") {
    return new Response("UP\n", {
      headers: { "content-type": "text/plain", "cache-control": "no-store" },
    });
  }

  if (path === "/public-parties" && method === "GET") {
    const rows = await env.DB.prepare(
      "SELECT id, name, date_label FROM parties WHERE archived = 0 AND doors_close_at > ? " +
      "ORDER BY doors_close_at ASC LIMIT 12"
    ).bind(now()).all();
    return json({ ok: true, parties: rows.results || [] });
  }

  {
    const handled = await pollsRoutes({ request, env, url, ctx, path, method, body });
    if (handled) return handled;
  }
  {
    const handled = await songsRoutes({ request, env, url, ctx, path, method, body });
    if (handled) return handled;
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

    /*
      ── G09 · WHO BROUGHT THEM ───────────────────────────────────────────

      A guest forwards their invite; the person who accepts arrives with the
      forwarder's pass code in the link. It is never shown to the person
      filling the form and never asked for — it rides along in the address,
      which is the only way this is ever going to be filled in honestly.

      Checked against the passes table rather than stored as given, so the
      column holds a real code or nothing at all.
    */
    let referrer = null;
    if (body.from) {
      const src = await env.DB.prepare(
        "SELECT code FROM passes WHERE code = ? AND status = 'ACTIVE'"
      ).bind(String(body.from).toUpperCase().slice(0, 20)).first().catch(() => null);
      referrer = src ? src.code : null;
    }

    /*
      ── N05 · THE WAITING LIST ───────────────────────────────────────────

      Counted in PLACES, not passes: a pass that admits four takes four of the
      room. Counting rows here would have let a full night keep accepting
      requests until it was several hundred people over.

      A night with no capacity set is not full — it is unlimited, and treating
      an unset number as zero would put every request straight onto a waiting
      list for a room with no limit.
    */
    let waiting = false;
    let position = 0;
    if (body.party) {
      const room = await env.DB.prepare(
        "SELECT capacity FROM parties WHERE id = ?"
      ).bind(body.party).first();
      const cap = Number(room?.capacity) || 0;
      if (cap > 0 && cfg.waitlistOpen) {
        const taken = await env.DB.prepare(
          "SELECT SUM(admits) AS n FROM passes WHERE party_id = ? AND status = 'ACTIVE'"
        ).bind(body.party).first();
        if (Number(taken?.n || 0) + people > cap) {
          waiting = true;
          const ahead = await env.DB.prepare(
            "SELECT COUNT(*) AS n FROM requests WHERE party_id = ? AND status = 'WAITING'"
          ).bind(body.party).first();
          position = Number(ahead?.n || 0) + 1;
        }
      }
    }

    await env.DB.prepare(
      "INSERT INTO requests (party_id, name, email, phone, note, people, status, referrer, created_at) " +
      "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).bind(body.party || null, body.name, body.email, body.phone || null, note, people,
           waiting ? "WAITING" : "PENDING", referrer, now()).run();

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

    /*
      Telling someone they are ninth is worth more than telling them the list
      is full. A number is a thing to wait for; "full" is a door closing.
    */
    if (waiting) {
      return json({
        ok: true, waiting: true, position,
        message: cfg.waitlistMessage,
      });
    }

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

      /*
        ── G05 · SAY SO ─────────────────────────────────────────────────────

        An approved request already sends a pass, so those people find out.
        A declined one sent nothing at all: the person heard silence and then
        found out at the door, in front of everyone, which is the worst place
        and the worst moment to learn it.

        Being told no in advance is a small kindness that costs one email, and
        it is also the difference between someone who might come next time and
        someone who will not.

        Sent in the background, and its failure never fails the decision — a
        mail key that has expired must not stop the boss working through a
        list.
      */
      const cfgReq = await getSettings(env);
      if (req.email) {
        ctx.waitUntil(sendNote(env, {
          to: req.email,
          subject: "About your guest list request",
          text:
            `${req.name ? req.name + "," : "Hello,"}\n\n` +
            "Thank you for asking — we could not fit you in this time. " +
            "It is not a judgement on you; the list is simply full.\n\n" +
            "Tickets are usually still available, and asking again for another " +
            "night is very welcome.\n\n" +
            (cfgReq.emailSignoff || "Hidden State") + "\n",
        }));
      }
      return json({ ok: true, status: "DECLINED", told: !!req.email });
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

  /*
    ── N05 · THE QUEUE, AND OFFERING A PLACE ────────────────────────────────

    The waiting list is not a table. It is the requests for a night whose
    status is WAITING, in the order they arrived — which is the only ordering
    anyone has ever accepted as fair, and the only one that needs no
    explaining.
  */
  if (path === "/waitlist" && method === "GET") {
    const who = await readSession(env, request);
    if (!who || !can(who, "seeList")) return fail("Not allowed.", 403);
    const partyId = url.searchParams.get("party");
    if (!partyId) return json({ ok: true, queue: [], room: 0 });

    const rows = await env.DB.prepare(
      "SELECT id, name, email, phone, people, note, referrer, created_at FROM requests " +
      "WHERE party_id = ? AND status = 'WAITING' ORDER BY created_at ASC LIMIT 200"
    ).bind(partyId).all().catch(() => ({ results: [] }));

    const party = await env.DB.prepare(
      "SELECT capacity FROM parties WHERE id = ?"
    ).bind(partyId).first();
    const taken = await env.DB.prepare(
      "SELECT SUM(admits) AS n FROM passes WHERE party_id = ? AND status = 'ACTIVE'"
    ).bind(partyId).first();

    const cap = Number(party?.capacity) || 0;
    return json({
      ok: true,
      queue: rows.results || [],
      // How many places have actually come free. This is the number that
      // decides whether offering the next person is honest.
      room: cap > 0 ? Math.max(0, cap - Number(taken?.n || 0)) : 0,
      capacity: cap,
      issued: Number(taken?.n || 0),
    });
  }

  /*
    OFFERING A PLACE ISSUES THE PASS.

    There is no accept-or-decline step, and that is a decision rather than a
    shortcut. A guest list place is not a ticket: nobody else is kept out
    while one person decides, so an offer that has to be claimed adds a
    deadline, a reminder, an expiry and a second failure mode in exchange for
    nothing. "A place came free — here is your pass" is the whole flow, and if
    they do not come it costs exactly what any other no-show costs.
  */
  if (path === "/waitlist/offer" && method === "POST") {
    const who = await readSession(env, request);
    if (!who || !can(who, "issuePasses")) return fail("Only the boss can offer a place.", 403);

    const partyId = String(body.party || "");
    if (!partyId) return fail("Which event?");

    const req = body.id
      ? await env.DB.prepare(
          "SELECT * FROM requests WHERE id = ? AND status = 'WAITING'"
        ).bind(body.id).first()
      : await env.DB.prepare(
          "SELECT * FROM requests WHERE party_id = ? AND status = 'WAITING' ORDER BY created_at ASC LIMIT 1"
        ).bind(partyId).first();
    if (!req) return fail("Nobody is waiting.", 404);

    /*
      CHECKED AGAIN HERE, not trusted from the screen that asked. The console
      may have been showing a room that had space when it loaded and none by
      the time the button was pressed — two people at two phones working
      through the same queue is exactly how a room ends up over its limit.
    */
    const party = await env.DB.prepare(
      "SELECT name, date_label, venue, minimum_age, capacity FROM parties WHERE id = ?"
    ).bind(partyId).first();
    const cap = Number(party?.capacity) || 0;
    if (cap > 0 && !body.anyway) {
      const taken = await env.DB.prepare(
        "SELECT SUM(admits) AS n FROM passes WHERE party_id = ? AND status = 'ACTIVE'"
      ).bind(partyId).first();
      if (Number(taken?.n || 0) + Math.max(1, req.people || 1) > cap) {
        return fail("There is no room for that many yet.", 409);
      }
    }

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
      ).bind(pooled.code, now(), who.username, req.id),
    ]);

    const email = await sendPassEmail(env, {
      to: req.email, name: req.name, code: pooled.code,
      party: party || { name: partyId, date_label: "", venue: null, minimum_age: 16 },
      kind: "GUEST",
    });
    if (email.sent) {
      await env.DB.prepare("UPDATE passes SET emailed_at = ? WHERE code = ?")
        .bind(now(), pooled.code).run();
    }

    return json({ ok: true, code: pooled.code, name: req.name, email });
  }

  /*
    ── G08 · THE MORNING AFTER ──────────────────────────────────────────────

    One letter, the day after, to the people who ACTUALLY CAME — not to
    everyone who was issued a pass, and certainly not to a mailing list. The
    difference matters: a list of people who turned up is worth something and
    a list of people who once clicked a form is not.

    WHAT STOPS IT BEING SPAM, in order of how much it matters:
      · it goes only to addresses that scanned in at that specific night;
      · it is recorded in `afters`, and a night that has been written to
        cannot be written to again by accident;
      · it is sent by hand from the console, never on a schedule. Nobody has
        ever wanted an automatic letter about a party.
  */
  if (path === "/afters" && method === "POST") {
    const who = await readSession(env, request);
    if (!who || !can(who, "manageTeam")) return fail("Not allowed.", 403);

    const partyId = String(body.party || "");
    const subject = String(body.subject || "").slice(0, 160).trim();
    const text = String(body.body || "").slice(0, 4000).trim();
    if (!partyId || !subject || !text) return fail("An event, a subject and something to say.");

    const done = await env.DB.prepare(
      "SELECT sent_at, sent_to FROM afters WHERE party_id = ? ORDER BY id DESC LIMIT 1"
    ).bind(partyId).first().catch(() => null);
    if (done && !body.anyway) {
      return json({
        ok: false, already: true, at: done.sent_at, to: done.sent_to,
        error: `Already sent to ${done.sent_to} people. Send it again only if you mean to.`,
      });
    }

    /*
      DISTINCT, because a pass that admits four scans four times and its one
      address must not receive four letters. This is the entire reason the
      query is not a simple join.
    */
    const rows = await env.DB.prepare(
      "SELECT DISTINCT p.email, p.name FROM passes p " +
      "JOIN scans s ON s.code = p.code AND s.party_id = p.party_id " +
      "WHERE p.party_id = ? AND s.result = 'ADMITTED' AND p.email IS NOT NULL AND p.email != ''"
    ).bind(partyId).all().catch(() => ({ results: [] }));

    const people = rows.results || [];
    if (!people.length) return fail("Nobody who came left an address.", 404);
    if (body.dryRun) return json({ ok: true, would: people.length });

    const cfg = await getSettings(env);
    /*
      Sent in the background and one at a time. A hundred letters is a hundred
      requests to the mail service, and firing them all at once is how an
      account gets rate-limited into sending forty of them.
    */
    ctx.waitUntil((async () => {
      for (const person of people) {
        await sendNote(env, {
          to: person.email,
          subject,
          text: `${person.name ? person.name.split(" ")[0] + "," : "Hello,"}\n\n${text}\n\n` +
                `${cfg.emailSignoff || "Hidden State"}\n`,
        }).catch(() => {});
      }
    })());

    await env.DB.prepare(
      "INSERT INTO afters (party_id, sent_to, subject, body, sent_at, sent_by) VALUES (?, ?, ?, ?, ?, ?)"
    ).bind(partyId, people.length, subject, text, now(), who.username).run();

    return json({ ok: true, sent: people.length });
  }

  if (path === "/afters" && method === "GET") {
    const who = await readSession(env, request);
    if (!who || !can(who, "manageTeam")) return fail("Not allowed.", 403);
    const rows = await env.DB.prepare(
      "SELECT a.*, y.name AS party_name FROM afters a LEFT JOIN parties y ON y.id = a.party_id " +
      "ORDER BY a.sent_at DESC LIMIT 50"
    ).all().catch(() => ({ results: [] }));
    return json({ ok: true, letters: rows.results || [] });
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
  /*
    ONE AT A TIME, ON PURPOSE — and the database write stays inside the loop.

    It looks like the other places a query sat in a loop and it is not one.
    The email is the slow part, batching the UPDATE would save almost nothing,
    and marking each pass IMMEDIATELY after its own email is what makes this
    safe to interrupt: if the cron runs out of time halfway through, everybody
    already written to is already marked, and tomorrow's run does not email
    them a second time. Collecting the updates and writing them at the end
    would trade that for nothing worth having.
  */
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

/*
  ═══════════════════════════════════════════════════════════════════════════
  G01 + G04 · WHAT THE PAGE SAYS BEFORE THE JAVASCRIPT RUNS
  ═══════════════════════════════════════════════════════════════════════════

  Two problems with one cause.

  THE SHARE PREVIEWS. Every page sets its own title, description and image —
  in JavaScript, on mount. WhatsApp, Facebook, Instagram, iMessage, Slack and
  Google do not run JavaScript. They fetch the HTML, read the tags that are in
  it, and leave. So every link ever shared from this site has previewed with
  the same generic square logo, no matter what the page itself set, and no
  amount of work inside React could ever have fixed it.

  THE BLANK FIRST PAINT. The same HTML has an empty <div id="root">, so a
  visitor sees nothing at all until roughly 400KB of JavaScript has arrived,
  parsed and run. On a laptop that is imperceptible. On a phone at a venue it
  is several seconds of blank cream, and people leave.

  Both are fixed in the same place: this Worker already sits in front of every
  request, so it can put the right words INTO the HTML on the way past.

  WHAT IS DELIBERATELY NOT DONE. This is not server-side rendering — it does
  not run React, and it does not try to reproduce the page. It writes the
  correct metadata and one honest opening: the heading and, where there is
  one, the photograph. React then takes over and draws the real thing. Trying
  to render the whole page twice, in two languages, is how that kind of thing
  becomes a source of bugs nobody can reproduce.
*/

// Content changes rarely and this runs on every page view, so the lookup is
// held for a minute per isolate. A stale minute on a share preview is
// nothing; a database round trip on every page load is not.
const LOOKUP_TTL = 60_000;
let lookupCache = { at: 0, data: null };

async function contentIndex(env) {
  if (lookupCache.data && Date.now() - lookupCache.at < LOOKUP_TTL) return lookupCache.data;
  const data = { events: [], posts: [], artists: [], mixes: [] };
  try {
    const [ev, po, ar, mx] = await Promise.all([
      env.DB.prepare("SELECT id, name, subtitle, description, artwork FROM events WHERE published = 1").all().catch(() => ({ results: [] })),
      env.DB.prepare("SELECT slug, headline, summary, photo, poster FROM posts WHERE published = 1").all().catch(() => ({ results: [] })),
      env.DB.prepare("SELECT id, name, alias, bio, photo FROM artists WHERE published = 1").all().catch(() => ({ results: [] })),
      env.DB.prepare("SELECT slug, name, intro, photo FROM mixes WHERE published = 1").all().catch(() => ({ results: [] })),
    ]);
    data.events = ev.results || [];
    data.posts = po.results || [];
    data.artists = ar.results || [];
    data.mixes = mx.results || [];
  } catch {
    /* the site still works with generic tags; it is a preview, not a page */
  }
  lookupCache = { at: Date.now(), data };
  return data;
}

const SECTIONS = {
  "/": ["Hidden State", "Records, agency, booking, events and artists — from another state of mind.", "/club.webp"],
  "/records": ["Records", "The label — releases, tracks and sleeves.", null],
  "/agency": ["Agency", "Booking and representation.", null],
  "/artists": ["The Roster", "The artists Hidden State represents.", null],
  "/events": ["Events", "Nights and festivals.", null],
  "/news": ["Dispatches", "News from Hidden State.", null],
  "/mixes": ["Sessions", "Recorded sets from the roster.", null],
  "/about": ["About", "What Hidden State is and what it does.", null],
  "/contact": ["Contact", "Bookings, press and everything else.", null],
  "/pool": ["The Pool", "Put a song in — paste a link and we will find the name.", null],
};

const esc = (v) => String(v == null ? "" : v)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;");

const clip = (v, n) => {
  const t = String(v || "").replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n - 1).trimEnd() + "…" : t;
};

async function pageFacts(env, path) {
  if (SECTIONS[path]) {
    const [title, desc, image] = SECTIONS[path];
    return { title, desc, image, kind: "website" };
  }

  const at = (re) => path.match(re)?.[1];
  const data = await contentIndex(env);

  const ev = at(/^\/events\/([^/]+)$/);
  if (ev) {
    const x = data.events.find((r) => String(r.id) === decodeURIComponent(ev));
    if (x) return { title: x.subtitle ? `${x.name} — ${x.subtitle}` : x.name,
                    desc: clip(x.description, 180), image: x.artwork, kind: "article" };
  }
  const po = at(/^\/news\/([^/]+)$/);
  if (po) {
    const x = data.posts.find((r) => r.slug === decodeURIComponent(po));
    if (x) return { title: x.headline, desc: clip(x.summary, 180),
                    image: x.photo || x.poster, kind: "article" };
  }
  const ar = at(/^\/artists\/([^/]+)$/);
  if (ar) {
    const x = data.artists.find((r) => String(r.id) === decodeURIComponent(ar));
    if (x) return { title: x.alias ? `${x.name} — ${x.alias}` : x.name,
                    desc: clip(x.bio, 180), image: x.photo, kind: "profile" };
  }
  const mx = at(/^\/mixes\/([^/]+)$/);
  if (mx) {
    const x = data.mixes.find((r) => r.slug === decodeURIComponent(mx));
    if (x) return { title: `${x.name} — Sessions`, desc: clip(x.intro, 180),
                    image: x.photo, kind: "profile" };
  }
  return null;
}

/*
  Rewrites the tags that are already in index.html rather than appending new
  ones. Two og:title tags is not "the second one wins" — different scrapers
  pick different ones, and a preview that is right on WhatsApp and wrong on
  Facebook is worse than one that is consistently generic.
*/
async function shapeHtml(request, env, url) {
  const facts = await pageFacts(env, url.pathname);
  if (!facts) return env.ASSETS.fetch(request);

  const res = await env.ASSETS.fetch(request);
  const type = res.headers.get("content-type") || "";
  if (!type.includes("text/html")) return res;

  const origin = url.origin;
  const img = facts.image ? (facts.image.startsWith("http") ? facts.image : origin + facts.image)
                          : origin + "/icons/icon-512.jpg";
  const full = facts.title === "Hidden State" ? "Hidden State" : `${facts.title} — Hidden State`;

  let html = await res.text();
  html = html
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(full)}</title>`)
    .replace(/<meta name="description" content="[^"]*"\s*\/?>/,
             `<meta name="description" content="${esc(facts.desc)}" />`)
    .replace(/<meta property="og:title" content="[^"]*"\s*\/?>/,
             `<meta property="og:title" content="${esc(full)}" />`)
    .replace(/<meta property="og:description" content="[^"]*"\s*\/?>/,
             `<meta property="og:description" content="${esc(facts.desc)}" />`)
    .replace(/<meta property="og:image" content="[^"]*"\s*\/?>/,
             `<meta property="og:image" content="${esc(img)}" />`)
    .replace(/<meta property="og:type" content="[^"]*"\s*\/?>/,
             `<meta property="og:type" content="${esc(facts.kind)}" />`);

  // The canonical address, and the one thing every scraper wants and none of
  // them can work out for themselves.
  html = html.replace("</head>",
    `  <link rel="canonical" href="${esc(origin + url.pathname)}" />\n` +
    `  <meta property="og:url" content="${esc(origin + url.pathname)}" />\n` +
    `</head>`);

  /*
    THE OPENING, IN THE HTML ITSELF.

    Painted immediately, outside #root so React never has to reconcile with
    it, and removed by main.jsx on the first render with a short fade. If the
    JavaScript never arrives at all, this stays — which is a better broken
    site than a blank one.
  */
  const opening =
    `<div id="hs-first" aria-hidden="true">` +
    (facts.image ? `<div class="hs-first-img" style="background-image:url('${esc(img)}')"></div>` : "") +
    `<h1>${esc(facts.title)}</h1>` +
    (facts.desc ? `<p>${esc(facts.desc)}</p>` : "") +
    `</div>`;

  html = html.replace('<div id="root"></div>', `${opening}\n    <div id="root"></div>`);

  return new Response(html, {
    status: res.status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      // Short, because the content behind it is editable from the console.
      // Long enough that a link posted to a group chat is not sixty database
      // lookups as sixty people open it.
      "cache-control": "public, max-age=0, s-maxage=60, stale-while-revalidate=600",
    },
  });
}


export default {
  // Cloudflare calls this on the schedule in wrangler.jsonc.
  /*
    Two schedules now, told apart by which one fired. Running the backup daily
    would keep twelve days rather than twelve weeks, which is the wrong window
    — a mistake is usually noticed within a day but sometimes within a month.
  */
  async scheduled(event, env, ctx) {
    if (event.cron === "17 * * * *") {
      ctx.waitUntil(healthSweep(env));
      return;
    }
    if (event.cron === "0 4 * * 1") {
      ctx.waitUntil((async () => {
        /*
          THE BACKUP GOES FIRST, and the sweep after it. That order is the
          whole point: whatever the sweep removes this morning is still in
          the copy taken a moment earlier, so a week of expired sessions is
          recoverable for three months even though it is gone from the
          database.
        */
        const b = await backupDatabase(env);
        console.log(b.ok
          ? `Backup: ${b.rows} rows in ${b.tables} tables → ${b.key}`
          : `Backup failed: ${b.error}`);

        const swept = await pruneOldRows(env);
        console.log("Swept: " + Object.entries(swept)
          .map(([t, n]) => `${t} ${n}`).join(", "));
      })());
      return;
    }
    ctx.waitUntil(sendReminders(env));
  },

  /*
    ── ONE PLACE THE HEADERS GO ON ─────────────────────────────────────────

    Wrapping the handler rather than editing every `return new Response(...)`
    in this file — there are dozens, and a header applied in dozens of places
    is a header missing from one of them. The one that gets missed is never
    the one you would have guessed.

    The body is streamed through untouched; only the headers are rebuilt.
  */
  async fetch(request, env, ctx) {
    const response = await this.route(request, env, ctx);

    let enforce = false;
    try {
      const cfg = await getSettings(env);
      enforce = !!cfg.cspEnforce;
    } catch {
      // A settings read that fails must never cost the page. Report-only is
      // the safe answer to not knowing.
    }

    const headers = new Headers(response.headers);
    for (const [k, v] of Object.entries(securityHeaders(enforce))) {
      // Never overwrite something a route set on purpose — the preview route
      // sets its own x-robots-tag and the media route its own cache-control.
      if (!headers.has(k)) headers.set(k, v);
    }
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },

  async route(request, env, ctx) {
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
      if (isReserved(key)) return new Response("Not found", { status: 404 });

      const object = await env.MEDIA.get(key);
      if (!object) return new Response("Not found", { status: 404 });

      const headers = new Headers();
      object.writeHttpMetadata(headers);
      headers.set("etag", object.httpEtag);
      headers.set("cache-control", "public, max-age=31536000, immutable");
      return new Response(object.body, { headers });
    }

    /*
      ── THE SITEMAP, BUILT WHEN IT IS ASKED FOR ─────────────────────────────

      It used to be a file generated at build time from a hardcoded list. That
      was fine until the console could create pages: a page published on
      Tuesday was never in a file written on Monday, and there was no deploy in
      between to notice. The failure was silent in the worst way — no error, no
      missing page, just a page search engines were never told about.

      Now it is assembled from that same list PLUS whatever is published, at
      the moment a crawler asks. The static file stays in dist as the fallback
      for the case where this route fails; it can only ever be out of date, and
      being out of date beats being absent.

      Deliberately absent, still: /wall/… and /kit/… and anything reached by a
      token. Those are private because their address is unguessable, and a
      sitemap is a list of addresses.
    */
    /*
      ── THE SITEMAP: THE BUILT FILE, PLUS WHAT ONLY THE DATABASE KNOWS ──────

      This started as "generate the whole thing live" and that was wrong twice,
      both times in the direction of quietly losing pages.

      FIRST it listed thirteen URLs where the built file lists forty-five,
      because scripts/sitemap.mjs walks the bundled JSON and I had only
      thought about the sections.

      THEN, having added the detail pages, it read EVENTS OUT OF THE parties
      TABLE — and /events and /events/:id do not render from parties at all.
      They render from the bundled events.json. parties is the door system: a
      different thing, with one row in it where the bundle has seven. So the
      "fix" dropped six reachable pages and invented one that may not resolve.

      The lesson both times: the built file was doing more than it looked like
      it was doing, and anything that REPLACES it is one oversight away from
      deleting real pages from the index — silently, with no error and no
      missing page, just traffic that stops arriving.

      So it does not replace it. It takes the built file as the floor and adds
      what the database knows and the bundle cannot: pages built in the
      console since the last deploy. Nothing that was listed can be lost,
      because nothing is ever removed.
    */
    if (url.pathname === "/sitemap.xml") {
      try {
        const builtFile = await env.ASSETS.fetch(
          new Request(new URL("/sitemap.xml", url.origin), { method: "GET" })
        );
        let xml = await builtFile.text();
        if (!xml.includes("</urlset>")) throw new Error("the built sitemap is not a sitemap");

        const today = new Date().toISOString().slice(0, 10);
        const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;");

        const pages = await env.DB.prepare(
          "SELECT slug, updated_at FROM pages WHERE published = 1 ORDER BY sort_order, slug"
        ).all().catch(() => ({ results: [] }));

        const extra = (pages.results || [])
          .filter((pg) => pg.slug && !xml.includes(`/${pg.slug}</loc>`))
          .map((pg) =>
            `  <url><loc>https://hiddenstategroup.com/${esc(pg.slug)}</loc>` +
            `<lastmod>${esc(String(pg.updated_at || today).slice(0, 10))}</lastmod>` +
            `<priority>0.6</priority></url>`
          );

        if (extra.length) {
          xml = xml.replace("</urlset>", extra.join("\n") + "\n</urlset>");
        }

        return new Response(xml, {
          headers: {
            "content-type": "application/xml; charset=utf-8",
            "cache-control": "public, max-age=3600",
            ...SAFE_HEADERS,
          },
        });
      } catch (err) {
        console.log("sitemap merge failed, serving the built file:", err && err.message);
        // The built file alone is complete for everything except pages made
        // in the console since the last deploy. A good fallback.
      }
    }

    // Everything else is the website itself.
    /*
      Everything else is a page. Only GET requests that actually want HTML are
      shaped — a request for a stylesheet or a photograph must never pay for a
      content lookup.
    */
    if (request.method === "GET" &&
        (request.headers.get("accept") || "").includes("text/html")) {
      try {
        return await shapeHtml(request, env, url);
      } catch (err) {
        console.log("shapeHtml failed:", err && err.message);
        // A preview is never worth a broken page.
        return env.ASSETS.fetch(request);
      }
    }
    return env.ASSETS.fetch(request);
  },
};
