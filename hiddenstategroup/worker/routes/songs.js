/*
  ══ THE SONG POOL ═══════════════════════════════════════════════════════

  Lifted out of index.js unchanged. Every route below is the route that was
  there, with its comments and its logic intact — only its address in the
  repository has changed.

  It is handed one object rather than seven arguments, so adding something a
  route needs later does not mean editing every call site. Returning null
  means "not one of mine": index.js carries on down the list, exactly as
  falling through the if-chain used to.
*/
import {
  can, fail, getSettings, json, nameFromUrl, now, readSession, resolveSong,
} from "../lib/core.js";

export async function songsRoutes(c) {
  const { request, env, url, ctx, path, method, body } = c;

  if (path === "/songs" && method === "GET") {
    const pool = url.searchParams.get("pool") === "HOUSE" ? "HOUSE" : "EVENT";
    const party = url.searchParams.get("party") || null;
    const who = await readSession(env, request);
    const team = !!who && (can(who, "issuePasses") || can(who, "manageTeam"));
    const cfgList = await getSettings(env);

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

    /*
      WHAT THE PUBLIC IS ALLOWED TO SEE.

      Applied here rather than in the page, because a field the browser is
      sent is a field anyone can read whatever the page chooses to draw. If
      names are switched off, the names do not leave this building.

      The team is never filtered — moderating a list you cannot see is not
      moderating.
    */
    let songs = rows.results || [];

    /*
      TALLIES, IN ONE QUERY.

      Counting votes per song by looping over the songs would be one query per
      row — thirty songs, thirty round trips to the database, on a page people
      open at a door on a phone. One grouped query and a lookup instead.
    */
    const mode = pool === "HOUSE" ? cfgList.poolHouseMode : cfgList.poolEventMode;
    if (mode === "VOTE" && songs.length) {
      const ids = songs.map((r) => r.id);
      const marks = ids.map(() => "?").join(",");
      const tally = await env.DB.prepare(
        `SELECT song_id, COUNT(*) AS n FROM song_votes WHERE song_id IN (${marks}) GROUP BY song_id`
      ).bind(...ids).all();
      const counts = new Map((tally.results || []).map((r) => [r.song_id, Number(r.n)]));

      // Which of these the person asking has already voted for. The voter id
      // is made by the browser and means nothing anywhere else — it is not a
      // login, it exists only to stop one person voting twice.
      const voter = String(url.searchParams.get("voter") || "").slice(0, 64);
      let mine = new Set();
      if (voter) {
        const got = await env.DB.prepare(
          `SELECT song_id FROM song_votes WHERE voter = ? AND song_id IN (${marks})`
        ).bind(voter, ...ids).all();
        mine = new Set((got.results || []).map((r) => r.song_id));
      }

      songs = songs.map((r) => ({
        ...r,
        votes: counts.get(r.id) || 0,
        mine: mine.has(r.id),
      }));
      // A ballot is ranked; a suggestion box is chronological.
      songs.sort((a, b) => b.votes - a.votes || String(a.created_at).localeCompare(b.created_at));
    }

    if (!team) {
      if (!cfgList.poolShowList) songs = [];
      else songs = songs.map((r) => ({
        ...r,
        by_name: cfgList.poolShowNames ? r.by_name : null,
        status: cfgList.poolShowPlayed ? r.status : (r.status === "PLAYED" ? "NEW" : r.status),
      }));
    }
    // The tallies are stripped when they are meant to be secret, rather than
    // sent and hidden by the page — a number the browser receives is a number
    // anyone can read.
    if (!team && mode === "VOTE" && !cfgList.poolShowVotes) {
      songs = songs.map(({ votes, ...rest }) => rest);
    }
    return json({
      ok: true, songs, team, mode,
      votesPerPerson: cfgList.poolVotesPerPerson,
      showVotes: team || cfgList.poolShowVotes,
      listHidden: !team && !cfgList.poolShowList,
    });
  }

  /*
    ── VOTING ────────────────────────────────────────────────────────────

    One song, one voter, toggled. The unique index is what actually enforces
    it; the count below is a courtesy that tells somebody they have used
    their picks rather than letting them find out from an error.

    THE VOTER ID IS NOT A LOGIN. The browser makes one up and keeps it. It
    identifies nobody, survives nothing but that browser, and exists purely
    so the same person cannot vote twice from the same phone. Anyone
    determined to vote twice can clear it — which is true of every poll that
    does not demand an account, and demanding an account for "which song
    closes the night" would cost more votes than it saved.
  */
  if (path === "/songs/vote" && method === "POST") {
    const cfgVote = await getSettings(env);
    const id = Number(body.id);
    const voter = String(body.voter || "").slice(0, 64);
    if (!id || !voter) return fail("Which song?");

    const song = await env.DB.prepare(
      "SELECT id, pool, party_id FROM songs WHERE id = ? AND status != 'HIDDEN'"
    ).bind(id).first();
    if (!song) return fail("That song is no longer in the pool.");

    const mode = song.pool === "HOUSE" ? cfgVote.poolHouseMode : cfgVote.poolEventMode;
    if (mode !== "VOTE") return fail("This pool is not a vote.");

    const had = await env.DB.prepare(
      "SELECT rowid FROM song_votes WHERE song_id = ? AND voter = ?"
    ).bind(id, voter).first();

    if (had) {
      await env.DB.prepare("DELETE FROM song_votes WHERE song_id = ? AND voter = ?")
        .bind(id, voter).run();
      return json({ ok: true, voted: false });
    }

    const limit = Number(cfgVote.poolVotesPerPerson) || 0;
    if (limit > 0) {
      const used = await env.DB.prepare(
        "SELECT COUNT(*) AS n FROM song_votes WHERE voter = ? AND pool = ? AND IFNULL(party_id,'') = ?"
      ).bind(voter, song.pool, song.party_id || "").first();
      if ((used?.n || 0) >= limit) {
        return fail(`That is all ${limit} of your picks. Take one back to change your mind.`);
      }
    }

    await env.DB.prepare(
      "INSERT INTO song_votes (song_id, voter, pool, party_id, created_at) VALUES (?, ?, ?, ?, ?)"
    ).bind(id, voter, song.pool, song.party_id || null, now()).run().catch(() => {});
    return json({ ok: true, voted: true });
  }

  if (path === "/songs" && method === "POST") {
    const pool = body.pool === "HOUSE" ? "HOUSE" : "EVENT";
    const party = pool === "EVENT" ? String(body.party || "") : null;
    const raw = String(body.url || "").trim();
    const byName = String(body.name || "").trim().slice(0, 60);

    /*
      THE POOL'S RULES, ALL OF THEM SETTINGS.

      Checked here and nowhere else. The page hides what is switched off, but
      hiding a form is a courtesy, not a rule — anything that actually decides
      whether a song is accepted has to be decided on this side, where the
      visitor cannot reach it.
    */
    const cfg = await getSettings(env);
    if (!cfg.poolOpen) return fail(cfg.poolClosedMessage || "The pool is closed.");
    if (pool === "EVENT" && !cfg.poolEventOpen) return fail("This night isn't taking songs.");
    if (pool === "HOUSE" && !cfg.poolHouseOpen) return fail("The house list is closed right now.");

    /*
      In a ballot, only the team puts options on it. Checked here and not
      merely hidden on the page: a form that is not drawn can still be posted
      to by anyone who looks.
    */
    const addMode = pool === "HOUSE" ? cfg.poolHouseMode : cfg.poolEventMode;
    if (addMode === "VOTE") {
      const whoAdds = await readSession(env, request);
      if (!whoAdds || !(can(whoAdds, "issuePasses") || can(whoAdds, "manageTeam")))
        return fail("This one is a vote — pick from the list rather than adding to it.");
    }

    if (!raw) return fail("Paste a link to the song.");
    if (!/^https?:\/\//i.test(raw)) return fail("That doesn't look like a link. It should start with https://");
    if (pool === "EVENT" && !party) return fail("Pick which night this is for.");
    if (cfg.poolRequireName && !byName) return fail("Add your name so we know who asked.");

    /*
      Pass holders only, when that is switched on. The team is exempt — door
      staff adding a song from the booth are not going to look up their own
      pass code first.
    */
    if (cfg.poolNeedPass) {
      const whoTeam = await readSession(env, request);
      if (!whoTeam) {
        const held = String(body.pass || "").trim();
        const valid = held && await env.DB.prepare(
          "SELECT code FROM passes WHERE code = ? AND status != 'REVOKED'"
        ).bind(held).first();
        if (!valid) return fail("The pool is open to ticket holders. Open your pass first, then come back.");
      }
    }

    if (pool === "EVENT") {
      const ok = await env.DB.prepare(
        "SELECT id FROM parties WHERE id = ? AND archived = 0 AND doors_close_at > ?"
      ).bind(party, now()).first();
      if (!ok) return fail("That night isn't taking requests.");
    }

    /* Rate limit. One person with a playlist can fill a pool in a minute, and
       then it is their pool rather than everyone's. */
    const ip = request.headers.get("cf-connecting-ip") || "unknown";

    // 0 in either figure means that limit is off rather than set to zero,
    // which would refuse everybody.
    if (cfg.poolPerHour > 0) {
      const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const recent = await env.DB.prepare(
        "SELECT COUNT(*) AS n FROM songs WHERE ip = ? AND created_at > ?"
      ).bind(ip, since).first();
      if ((recent?.n || 0) >= cfg.poolPerHour)
        return fail("That's plenty for one hour — come back later and add more.");
    }

    if (cfg.poolMaxPerPerson > 0) {
      const mine = await env.DB.prepare(
        "SELECT COUNT(*) AS n FROM songs WHERE ip = ? AND pool = ? AND IFNULL(party_id, '') = ?"
      ).bind(ip, pool, party || "").first();
      if ((mine?.n || 0) >= cfg.poolMaxPerPerson)
        return fail(`That's your ${cfg.poolMaxPerPerson} for this one. Somebody else's turn.`);
    }

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
      /*
        The unique index doing its job — and it stays in place even when
        duplicates are allowed, because an index cannot be switched off per
        request. When they ARE allowed the row is retried with a marker that
        makes it unique, so the same song can genuinely go in twice.
      */
      if (String(err && err.message).includes("UNIQUE") && cfg.poolAllowDuplicates) {
        await env.DB.prepare(
          "INSERT INTO songs (pool, party_id, url, provider, title, artist, artwork, by_name, by_contact, status, created_at, ip) " +
          "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'NEW', ?, ?)"
        ).bind(pool, party, `${raw}#${Date.now()}`, (found && found.provider) || "LINK", title, artist,
               (found && found.artwork) || null, byName,
               String(body.contact || "").trim().slice(0, 120) || null, now(), ip).run();
        return json({ ok: true, title, artist, provider: (found && found.provider) || "LINK" });
      }
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


  return null;
}
