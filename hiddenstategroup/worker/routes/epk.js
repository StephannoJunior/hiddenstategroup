/*
  ══ THE PRESS KIT ═══════════════════════════════════════════════════════

  Lifted out of index.js unchanged. Every route below is the route that was
  there, with its comments and its logic intact — only its address in the
  repository has changed.

  It is handed one object rather than seven arguments, so adding something a
  route needs later does not mean editing every call site. Returning null
  means "not one of mine": index.js carries on down the list, exactly as
  falling through the if-chain used to.
*/
import {
  SEALED_PREFIX, can, fail, getSettings, hashPassword, isReserved, json, makeZip, now, randomHex, readSession, safeEqual, safeName,
} from "../lib/core.js";

export async function epkRoutes(c) {
  const { request, env, url, ctx, path, method, body } = c;

  /*
    ── L02 · THE PRESS KIT ──────────────────────────────────────────────────

    WHAT THE PUBLIC LINK RETURNS is deliberately not the row. `contact` is an
    address and belongs to whoever we put in it, and a press kit link ends up
    in forwarded email threads with people we have never met. It is sent only
    when the artist's own record says it should be.
  */
  /*
    ═══════════════════════════════════════════════════════════════════════
    THE PRESS KIT · K01–K20
    ═══════════════════════════════════════════════════════════════════════
  */

  /*
    ── THE REST OF THE KIT ─────────────────────────────────────────────────
    One JSON document per artist — the stage plot, selected dates, quotes,
    the players, the contact. See migrate-kit.sql for why it is one column.
  */
  if (path.startsWith("/epk/extra/") && method === "GET") {
    const who = await readSession(env, request);
    if (!who || !can(who, "issuePasses")) return fail("Not allowed.", 403);
    const id = decodeURIComponent(path.slice(11));
    const row = await env.DB.prepare("SELECT data FROM epk_extra WHERE artist_id = ?")
      .bind(id).first().catch(() => null);
    let data = {};
    try { data = JSON.parse(row?.data || "{}"); } catch { data = {}; }
    return json({ ok: true, extra: data });
  }

  if (path.startsWith("/epk/extra/") && method === "PUT") {
    const who = await readSession(env, request);
    if (!who || !can(who, "issuePasses")) return fail("Not allowed.", 403);
    const id = Number(decodeURIComponent(path.slice(11)));
    if (!id) return fail("Which artist?");

    /*
      SHAPED, NOT TRUSTED. The column is JSON, which means the browser could
      put anything at all in it — and a document that is read back and drawn
      into a page is exactly the wrong place to keep whatever arrives. Every
      field is named here, capped here, and anything unrecognised is dropped.
    */
    const t = (v, n) => (v == null ? null : String(v).slice(0, n));
    const list = (v, n, shape) =>
      (Array.isArray(v) ? v : []).slice(0, n).map(shape).filter(Boolean);

    const shaped = {
      stagePlot: body.stagePlot ? {
        url: t(body.stagePlot.url, 400),
        key: t(body.stagePlot.key, 300),
        name: t(body.stagePlot.name, 120),
        sealed: !!body.stagePlot.sealed,
      } : null,
      riderFile: body.riderFile ? {
        key: t(body.riderFile.key, 300),
        name: t(body.riderFile.name, 120),
        bytes: Number(body.riderFile.bytes) || 0,
      } : null,
      dates: list(body.dates, 40, (d) => {
        const venue = t(d && d.venue, 100);
        return venue ? { venue, city: t(d.city, 60), year: t(d.year, 12) } : null;
      }),
      quotes: list(body.quotes, 20, (q) => {
        const text = t(q && q.text, 400);
        return text ? { text, who: t(q.who, 100), where: t(q.where, 100) } : null;
      }),
      listen: list(body.listen, 6, (l) => {
        const url = t(l && l.url, 500);
        return url && /^https?:\/\//i.test(url) ? { url, label: t(l.label, 60) } : null;
      }),
      video: t(body.video, 500),
      territories: t(body.territories, 300),
      updatedNote: t(body.updatedNote, 200),
    };

    await env.DB.prepare(
      "INSERT INTO epk_extra (artist_id, data, updated_at, updated_by) VALUES (?, ?, ?, ?) " +
      "ON CONFLICT (artist_id) DO UPDATE SET data = excluded.data, " +
      "  updated_at = excluded.updated_at, updated_by = excluded.updated_by"
    ).bind(id, JSON.stringify(shaped), now(), who.username).run();
    return json({ ok: true });
  }

  /*
    ── K06 · START FROM ANOTHER ARTIST'S KIT ───────────────────────────────

    WHAT IS COPIED AND WHAT IS NOT, deliberately. The rider, the hospitality
    and the contact are usually identical across a roster and are the tedious
    part. The biographies and the photographs are NEVER copied: a kit that
    silently arrives holding another artist's biography is how the wrong name
    ends up on a poster, and it would be found out by the one promoter who
    read both.
  */
  if (path === "/epk/copy" && method === "POST") {
    const who = await readSession(env, request);
    if (!who || !can(who, "issuePasses")) return fail("Not allowed.", 403);
    const from = Number(body.from), to = Number(body.to);
    if (!from || !to || from === to) return fail("Copy from which artist, to which?");

    const src = await env.DB.prepare("SELECT * FROM epk WHERE artist_id = ?").bind(from).first();
    if (!src) return fail("That artist has no kit to copy.", 404);

    const existing = await env.DB.prepare("SELECT * FROM epk WHERE artist_id = ?").bind(to).first();
    await env.DB.prepare(
      "INSERT INTO epk (artist_id, bio_short, bio_long, rider, hospitality, photos, logos, links, " +
      "  contact, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) " +
      "ON CONFLICT (artist_id) DO UPDATE SET rider = excluded.rider, " +
      "  hospitality = excluded.hospitality, contact = excluded.contact, " +
      "  logos = excluded.logos, updated_at = excluded.updated_at, updated_by = excluded.updated_by"
    ).bind(to,
      existing?.bio_short || null, existing?.bio_long || null,
      src.rider, src.hospitality,
      existing?.photos || "[]",          // never the photographs
      src.logos || "[]",
      existing?.links || "[]",
      src.contact, now(), who.username).run();

    const extra = await env.DB.prepare("SELECT data FROM epk_extra WHERE artist_id = ?")
      .bind(from).first().catch(() => null);
    if (extra?.data) {
      let d = {};
      try { d = JSON.parse(extra.data); } catch { d = {}; }
      // The dates and the quotes belong to the artist who earned them.
      const carried = JSON.stringify({
        stagePlot: null, riderFile: d.riderFile || null,
        dates: [], quotes: [], listen: [], video: null,
        territories: d.territories || null,
      });
      await env.DB.prepare(
        "INSERT INTO epk_extra (artist_id, data, updated_at, updated_by) VALUES (?, ?, ?, ?) " +
        "ON CONFLICT (artist_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at"
      ).bind(to, carried, now(), who.username).run();
    }
    return json({ ok: true, copied: ["rider", "hospitality", "contact", "logos", "territories"] });
  }

  /*
    ── K17 · WHEN THE LINK WAS OPENED ──────────────────────────────────────
    Times, and nothing else. See migrate-kit.sql.
  */
  if (path.match(/^\/share\/[^/]+\/opens$/) && method === "GET") {
    const who = await readSession(env, request);
    if (!who || !can(who, "issuePasses")) return fail("Not allowed.", 403);
    const token = decodeURIComponent(path.split("/")[2]);
    const rows = await env.DB.prepare(
      "SELECT at FROM share_opens WHERE token = ? ORDER BY at DESC LIMIT 200"
    ).bind(token).all().catch(() => ({ results: [] }));
    return json({ ok: true, opens: (rows.results || []).map((r) => r.at) });
  }

  /*
    ── K20 · A WORD ON THE DOOR ────────────────────────────────────────────
    Hashed and salted like any other password. An empty word removes it.
  */
  if (path.match(/^\/share\/[^/]+\/word$/) && method === "PUT") {
    const who = await readSession(env, request);
    if (!who || !can(who, "issuePasses")) return fail("Not allowed.", 403);
    const token = decodeURIComponent(path.split("/")[2]);
    const word = String(body.word || "").trim();

    if (!word) {
      await env.DB.prepare("DELETE FROM share_secrets WHERE token = ?").bind(token).run();
      return json({ ok: true, cleared: true });
    }
    if (word.length < 4) return fail("A word of at least four letters, please.");

    const salt = randomHex(16);
    const hash = await hashPassword(word, salt);
    await env.DB.prepare(
      "INSERT INTO share_secrets (token, hash, salt, created_at, created_by) VALUES (?, ?, ?, ?, ?) " +
      "ON CONFLICT (token) DO UPDATE SET hash = excluded.hash, salt = excluded.salt, " +
      "  created_at = excluded.created_at, created_by = excluded.created_by"
    ).bind(token, hash, salt, now(), who.username).run();
    return json({ ok: true });
  }

  /*
    ── OPENING A KIT LINK ──────────────────────────────────────────────────

    One function, because there are now four ways in — the page, a sealed
    file, the ZIP and the one-sheet — and every one of them has to answer the
    same questions in the same order. Written once, they cannot drift apart;
    written four times, one of them eventually forgets the password.
  */
  const openKit = async (token, given) => {
    const row = await env.DB.prepare("SELECT * FROM share_links WHERE token = ?")
      .bind(token).first();
    if (!row || row.revoked || row.kind !== "EPK") return { error: "This link is not working.", status: 404 };
    if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
      return { error: "This link has expired. Ask for a new one.", status: 410 };
    }

    const secret = await env.DB.prepare("SELECT hash, salt FROM share_secrets WHERE token = ?")
      .bind(token).first().catch(() => null);
    if (secret) {
      if (!given) return { needsWord: true, status: 401 };
      const tried = await hashPassword(String(given), secret.salt);
      if (!safeEqual(tried, secret.hash)) {
        return { needsWord: true, wrong: true, error: "That is not the word.", status: 401 };
      }
    }
    return { link: row };
  };

  const noteOpen = async (token) => {
    await env.DB.prepare(
      "UPDATE share_links SET uses = uses + 1, last_used = ? WHERE token = ?"
    ).bind(now(), token).run().catch(() => {});
    await env.DB.prepare("INSERT INTO share_opens (token, at) VALUES (?, ?)")
      .bind(token, now()).run().catch(() => {});
  };

  /*
    ── K24 · A SEALED FILE ─────────────────────────────────────────────────

    The rider and the stage plot. Reachable only through a live kit link, and
    unreachable the moment that link is revoked or expires — which is the
    whole difference between this and putting them in the public bucket.

    The key is checked against the sealed prefix rather than trusted: without
    that line this route would happily hand out a database backup to anyone
    who put its name in the address.
  */
  if (path.match(/^\/kit\/[^/]+\/file\//) && method === "GET") {
    const parts = path.split("/");
    const token = decodeURIComponent(parts[2]);
    const key = decodeURIComponent(parts.slice(4).join("/"));

    const gate = await openKit(token, url.searchParams.get("word"));
    if (gate.error || gate.needsWord) {
      return new Response(gate.error || "A word is needed.", { status: gate.status });
    }
    if (!key.startsWith(SEALED_PREFIX)) return new Response("Not found", { status: 404 });
    if (!env.MEDIA) return new Response("Not found", { status: 404 });

    const object = await env.MEDIA.get(key);
    if (!object) return new Response("Not found", { status: 404 });

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    // Never in a shared cache: access is decided per request by a link that
    // can be killed, and a cached copy would outlive the killing.
    headers.set("cache-control", "private, max-age=0, no-store");
    headers.set("content-disposition",
      `inline; filename="${(object.customMetadata?.originalName || "file").replace(/["\\]/g, "")}"`);
    return new Response(object.body, { headers });
  }

  /*
    ── K15 · EVERYTHING, IN ONE DOWNLOAD ───────────────────────────────────

    The single most asked-for thing in any press kit, and the reason promoters
    ask for a Dropbox folder instead of using the link you sent.

    BUILT BY HAND, STORED, NOT DEFLATED. A ZIP with no compression is a
    container: a header, each file's bytes, then a directory at the end. That
    is a hundred lines here and needs no library — and there is nothing to
    gain by compressing anyway, because JPEGs and PDFs are already compressed
    and would come out fractionally larger.

    THE LIMIT IS MEMORY, honestly. A Worker holds this in memory while it
    builds, so it caps at a sensible total and says so rather than dying
    halfway through a download somebody is waiting on.
  */
  if (path.match(/^\/kit\/[^/]+\/all\.zip$/) && method === "GET") {
    const token = decodeURIComponent(path.split("/")[2]);
    const gate = await openKit(token, url.searchParams.get("word"));
    if (gate.error || gate.needsWord) {
      return new Response(gate.error || "A word is needed.", { status: gate.status });
    }
    const cfg = await getSettings(env);
    if (!cfg.kitZip) return new Response("Not available.", { status: 404 });

    const artist = await env.DB.prepare("SELECT name FROM artists WHERE id = ?")
      .bind(gate.link.ref).first();
    const kit = await env.DB.prepare("SELECT * FROM epk WHERE artist_id = ?")
      .bind(gate.link.ref).first();
    if (!kit) return new Response("Nothing to download yet.", { status: 404 });

    const parse = (v) => { try { return JSON.parse(v || "[]"); } catch { return []; } };
    const extraRow = await env.DB.prepare("SELECT data FROM epk_extra WHERE artist_id = ?")
      .bind(gate.link.ref).first().catch(() => null);
    let extra = {};
    try { extra = JSON.parse(extraRow?.data || "{}"); } catch { extra = {}; }

    const wanted = [];
    parse(kit.photos).forEach((p, i) => {
      if (p.url) wanted.push({ name: `photographs/${String(i + 1).padStart(2, "0")}${p.credit ? " - " + safeName(p.credit) : ""}`, path: p.url });
    });
    parse(kit.logos).forEach((l, i) => {
      if (l.url) wanted.push({ name: `logos/${safeName(l.label || "logo-" + (i + 1))}`, path: l.url });
    });
    if (extra.riderFile?.key) wanted.push({ name: "rider", key: extra.riderFile.key });
    if (extra.stagePlot?.key) wanted.push({ name: "stage-plot", key: extra.stagePlot.key });
    if (extra.stagePlot?.url) wanted.push({ name: "stage-plot", path: extra.stagePlot.url });

    const files = [];
    // The words, so a kit without a single photograph is still worth taking.
    const words =
      `${artist?.name || "Artist"}\n\n` +
      (kit.bio_short ? `SHORT BIOGRAPHY\n\n${kit.bio_short}\n\n` : "") +
      (kit.bio_long ? `LONG BIOGRAPHY\n\n${kit.bio_long}\n\n` : "") +
      (kit.rider ? `TECHNICAL RIDER\n\n${kit.rider}\n\n` : "") +
      (kit.hospitality ? `HOSPITALITY\n\n${kit.hospitality}\n\n` : "") +
      (kit.contact ? `CONTACT\n\n${kit.contact}\n` : "");
    files.push({ name: "read-me.txt", bytes: new TextEncoder().encode(words) });

    const MAX_TOTAL = 90 * 1024 * 1024;
    let total = words.length;
    for (const w of wanted) {
      const key = w.key || (w.path || "").replace(/^\/media\//, "");
      if (!key || (!w.key && isReserved(key))) continue;
      const object = await env.MEDIA.get(key);
      if (!object) continue;
      const buf = new Uint8Array(await object.arrayBuffer());
      if (total + buf.length > MAX_TOTAL) break;
      total += buf.length;
      const ext = key.split(".").pop().slice(0, 5);
      files.push({ name: `${w.name}.${ext}`, bytes: buf });
    }

    const zip = makeZip(files);
    return new Response(zip, {
      headers: {
        "content-type": "application/zip",
        "content-disposition":
          `attachment; filename="${safeName(artist?.name || "press-kit")}-press-kit.zip"`,
        "cache-control": "private, max-age=0, no-store",
      },
    });
  }

  /*
    ── K16 · THE ONE-SHEET ─────────────────────────────────────────────────

    One page: the primary photograph, the short biography, selected dates and
    the contact. What you attach when somebody wants a PDF rather than a link,
    and what goes in a folder at a conference.

    IT IS HTML, NOT A PDF, and that is the whole design. Generating a real PDF
    inside a Worker means a typesetting library, embedded fonts, and a
    dependency that would be by far the largest thing in this project — to
    produce a worse-looking page than the browser makes for free. This opens
    with the print dialogue already up; the reader presses Save as PDF and
    gets a better file than we could have made, with real text in it that can
    be searched and copied.

    GENERATED FROM THE KIT, so it can never disagree with the kit. A one-sheet
    kept as its own document is a one-sheet that is out of date by the second
    booking.
  */
  if (path.match(/^\/kit\/[^/]+\/one-sheet\.html$/) && method === "GET") {
    const token = decodeURIComponent(path.split("/")[2]);
    const gate = await openKit(token, url.searchParams.get("word"));
    if (gate.error || gate.needsWord) {
      return new Response(gate.error || "A word is needed.", { status: gate.status });
    }
    const cfg = await getSettings(env);
    if (!cfg.kitOnesheet) return new Response("Not available.", { status: 404 });

    const id = gate.link.ref;
    const artist = await env.DB.prepare(
      "SELECT name, alias, type, country, location, genres FROM artists WHERE id = ?"
    ).bind(id).first();
    const kit = await env.DB.prepare("SELECT * FROM epk WHERE artist_id = ?").bind(id).first();
    if (!artist) return new Response("Not found", { status: 404 });

    const parse = (v) => { try { return JSON.parse(v || "[]"); } catch { return []; } };
    const extraRow = await env.DB.prepare("SELECT data FROM epk_extra WHERE artist_id = ?")
      .bind(id).first().catch(() => null);
    let extra = {};
    try { extra = JSON.parse(extraRow?.data || "{}"); } catch { extra = {}; }

    const photos = parse(kit?.photos);
    const hero = photos[0];
    const genres = parse(artist.genres);
    const dates = (extra.dates || []).slice(0, 8);

    // Everything that reaches the page goes through this. A biography is
    // typed by a person into a form, and a person can type a < .
    const esc = (t) => String(t == null ? "" : t)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

    const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>${esc(artist.name)} — one sheet</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bodoni+Moda:opsz,wght@6..96,400;6..96,900&family=EB+Garamond&family=Space+Mono&display=swap">
<style>
  @page { size: A4; margin: 14mm; }
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'EB Garamond',Georgia,serif;color:#14120E;background:#EDE4D0;
       font-size:11pt;line-height:1.5;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .sheet{max-width:190mm;margin:0 auto;padding:14mm 10mm;background:#EDE4D0}
  .kicker{font-family:'Space Mono',monospace;font-size:7pt;letter-spacing:.22em;color:#6E2118}
  .rule2{border-top:2px solid #14120E;margin-top:3mm}
  .rule1{border-top:1px solid #14120E;margin-top:1mm}
  h1{font-family:'Bodoni Moda',Georgia,serif;font-weight:900;font-size:34pt;line-height:.98;
     letter-spacing:-.02em;margin-top:6mm}
  .alias{font-style:italic;font-size:13pt;color:#4A443A;margin-top:1mm}
  .tags{margin-top:3mm}
  .tags span{font-family:'Space Mono',monospace;font-size:6.5pt;letter-spacing:.14em;
             border:1px solid #C9BCA0;padding:1.4mm 2.4mm;margin-right:1.6mm;color:#4A443A}
  .grid{display:grid;grid-template-columns:62mm 1fr;gap:8mm;margin-top:7mm;align-items:start}
  .hero{width:100%;display:block;border:1px solid #C9BCA0}
  .credit{font-family:'Space Mono',monospace;font-size:6pt;letter-spacing:.12em;
          color:#4A443A;margin-top:1.4mm}
  h2{font-family:'Space Mono',monospace;font-size:7.5pt;letter-spacing:.2em;font-weight:400;
     border-bottom:1px solid #14120E;padding-bottom:1.2mm;margin-top:6mm;color:#14120E}
  h2:first-of-type{margin-top:0}
  p.body{margin-top:2.5mm;color:#4A443A;font-size:10.5pt;line-height:1.55}
  .dates{margin-top:2.5mm}
  .dates div{display:flex;gap:3mm;border-bottom:1px solid #C9BCA0;padding:1.4mm 0;font-size:9.5pt}
  .dates b{font-weight:400;flex:1}
  .dates i{font-style:normal;color:#4A443A;font-family:'Space Mono',monospace;font-size:7pt;
           letter-spacing:.1em}
  .foot{border-top:2px solid #14120E;margin-top:8mm;padding-top:2.5mm;
        font-family:'Space Mono',monospace;font-size:6.5pt;letter-spacing:.16em;color:#4A443A;
        display:flex;justify-content:space-between;gap:4mm}
  @media screen{ body{padding:18px} .sheet{box-shadow:0 2px 30px rgba(0,0,0,.16)} }
</style></head>
<body><div class="sheet">
  <p class="kicker">HIDDEN STATE · PRESS</p>
  <div class="rule2"></div><div class="rule1"></div>
  <h1>${esc(artist.name)}</h1>
  ${artist.alias ? `<p class="alias">${esc(artist.alias)}</p>` : ""}
  <div class="tags">${[artist.type, artist.country, artist.location, ...genres]
      .filter(Boolean).map((t) => `<span>${esc(String(t).toUpperCase())}</span>`).join("")}</div>

  <div class="grid">
    <div>
      ${hero ? `<img class="hero" src="${esc(hero.web || hero.url)}" alt="">
                ${hero.credit ? `<p class="credit">© ${esc(hero.credit)}</p>` : ""}` : ""}
    </div>
    <div>
      <h2>BIOGRAPHY</h2>
      <p class="body">${esc(kit?.bio_short || kit?.bio_long || "").slice(0, 900)}</p>

      ${dates.length ? `<h2>SELECTED DATES</h2><div class="dates">${
        dates.map((d) => `<div><b>${esc(d.venue)}</b><i>${
          esc([d.city, d.year].filter(Boolean).join(" · "))}</i></div>`).join("")
      }</div>` : ""}

      ${kit?.contact || cfg.kitContactFallback
        ? `<h2>BOOKINGS</h2><p class="body">${esc(kit?.contact || cfg.kitContactFallback)}</p>`
        : ""}
    </div>
  </div>

  <div class="foot">
    <span>HIDDENSTATEGROUP.COM</span>
    <span>${esc(new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" }).toUpperCase())}</span>
  </div>
</div>
<script>
  /*
    The print dialogue, once the photograph has actually loaded — printing
    before it arrives produces a sheet with a hole where the artist should be.
    Guarded so that opening this to read it does not fight the reader.
  */
  addEventListener("load", function () {
    if (location.search.indexOf("print") !== -1 || !document.images.length) {
      setTimeout(function () { window.print(); }, 350);
    } else {
      var img = document.images[0];
      var go = function () { setTimeout(function () { window.print(); }, 250); };
      if (img.complete) go(); else { img.onload = go; img.onerror = go; }
    }
  });
</script>
</body></html>`;

    return new Response(html, {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "private, max-age=0, no-store",
      },
    });
  }

  if (path.startsWith("/epk/link/") && method === "GET") {
    const token = decodeURIComponent(path.slice(10));

    /*
      Through openKit, which is the one place that knows the four questions a
      kit link has to answer: does it exist, has it been revoked, has it
      expired, and does it want a word. The page, the sealed files, the ZIP
      and the one-sheet all ask the same function, so they cannot drift apart.
    */
    const gate = await openKit(token, url.searchParams.get("word"));
    if (gate.needsWord) {
      // Not an error — a state the page draws a form for. `wrong` tells the
      // difference between arriving and getting it wrong, which is the
      // difference between a prompt and a correction.
      return json({ ok: false, needsWord: true, wrong: !!gate.wrong,
                    error: gate.error || null }, 401);
    }
    if (gate.error) return fail(gate.error, gate.status || 404);

    const link = gate.link;
    await noteOpen(token);

    const artist = await env.DB.prepare(
      "SELECT id, name, alias, type, genres, country, location, descr, bio, photo, poster, instagram " +
      "FROM artists WHERE id = ?"
    ).bind(link.ref).first();
    if (!artist) return fail("No such artist.", 404);

    const kit = await env.DB.prepare("SELECT * FROM epk WHERE artist_id = ?")
      .bind(link.ref).first().catch(() => null);
    const extraRow = await env.DB.prepare("SELECT data FROM epk_extra WHERE artist_id = ?")
      .bind(link.ref).first().catch(() => null);

    const jsonish = (v) => { try { return JSON.parse(v || "[]"); } catch { return []; } };
    let extra = {};
    try { extra = JSON.parse(extraRow?.data || "{}"); } catch { extra = {}; }

    const cfg = await getSettings(env);
    return json({
      ok: true,
      artist,
      kit: kit ? {
        bioShort: kit.bio_short, bioLong: kit.bio_long,
        rider: kit.rider, hospitality: kit.hospitality,
        photos: jsonish(kit.photos), logos: jsonish(kit.logos), links: jsonish(kit.links),
        contact: kit.contact || cfg.kitContactFallback || null,
        updatedAt: kit.updated_at,
      } : null,
      /*
        The sealed files are described but never addressed: the reader is given
        a key to ask for through /kit/<token>/file/, not a path they could keep
        after the link is revoked.
      */
      extra: {
        dates: extra.dates || [],
        quotes: extra.quotes || [],
        listen: extra.listen || [],
        video: extra.video || null,
        territories: extra.territories || null,
        stagePlot: extra.stagePlot || null,
        riderFile: extra.riderFile ? { key: extra.riderFile.key, name: extra.riderFile.name } : null,
      },
      // What this particular kit is allowed to offer, decided here rather
      // than by the page drawing buttons that would 404.
      offers: {
        zip: !!cfg.kitZip,
        onesheet: !!cfg.kitOnesheet,
        watermark: !!cfg.kitWatermark,
        watermarkText: cfg.kitWatermarkText || "",
        footer: cfg.kitFooterNote || "",
      },
    });
  }

  if (path.startsWith("/epk/artist/") && method === "GET") {
    const who = await readSession(env, request);
    if (!who || !can(who, "issuePasses")) return fail("Not allowed.", 403);
    const id = decodeURIComponent(path.slice(12));
    const kit = await env.DB.prepare("SELECT * FROM epk WHERE artist_id = ?").bind(id).first();
    const links = await env.DB.prepare(
      "SELECT token, label, uses, last_used, revoked, created_at FROM share_links " +
      "WHERE kind = 'EPK' AND ref = ? ORDER BY created_at DESC"
    ).bind(String(id)).all().catch(() => ({ results: [] }));
    return json({ ok: true, kit: kit || null, links: links.results || [] });
  }

  if (path.startsWith("/epk/artist/") && method === "PUT") {
    const who = await readSession(env, request);
    if (!who || !can(who, "issuePasses")) return fail("Not allowed.", 403);
    const id = Number(decodeURIComponent(path.slice(12)));
    if (!id) return fail("Which artist?");

    const asJson = (v) => JSON.stringify(Array.isArray(v) ? v.slice(0, 40) : []);
    await env.DB.prepare(
      "INSERT INTO epk (artist_id, bio_short, bio_long, rider, hospitality, photos, logos, links, " +
      "  contact, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) " +
      "ON CONFLICT (artist_id) DO UPDATE SET bio_short = excluded.bio_short, " +
      "  bio_long = excluded.bio_long, rider = excluded.rider, hospitality = excluded.hospitality, " +
      "  photos = excluded.photos, logos = excluded.logos, links = excluded.links, " +
      "  contact = excluded.contact, updated_at = excluded.updated_at, updated_by = excluded.updated_by"
    ).bind(id, String(body.bioShort || "").slice(0, 600) || null,
           String(body.bioLong || "").slice(0, 3000) || null,
           String(body.rider || "").slice(0, 4000) || null,
           String(body.hospitality || "").slice(0, 2000) || null,
           asJson(body.photos), asJson(body.logos), asJson(body.links),
           String(body.contact || "").slice(0, 200) || null, now(), who.username).run();
    return json({ ok: true });
  }


  return null;
}
