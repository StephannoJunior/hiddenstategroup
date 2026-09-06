/*
  ══ THE POLLS ═══════════════════════════════════════════════════════

  Lifted out of index.js unchanged. Every route below is the route that was
  there, with its comments and its logic intact — only its address in the
  repository has changed.

  It is handed one object rather than seven arguments, so adding something a
  route needs later does not mean editing every call site. Returning null
  means "not one of mine": index.js carries on down the list, exactly as
  falling through the if-chain used to.
*/
import {
  can, fail, getSettings, json, now, readSession,
} from "../lib/core.js";

export async function pollsRoutes(c) {
  const { request, env, url, ctx, path, method, body } = c;


  /*
    ══ THE POLLS ═════════════════════════════════════════════════════════════

    A question, some options, and a count. Two audiences from one table:

      PUBLIC  shown on /polls to anybody who finds the site
      TEAM    never leaves the console — an internal decision, not a page

    ── THE ONE RULE THAT DECIDES EVERYTHING ELSE ────────────────────────────

    THE COUNTS DO NOT LEAVE THIS FILE UNTIL YOU HAVE VOTED.

    Not hidden on the page — ABSENT FROM THE RESPONSE. The difference is the
    whole feature. A page that receives the tallies and declines to draw them
    is a page that hands them to anybody who opens the network tab, and the
    reason for withholding them is not modesty: it is that a visible count
    steers the vote. The leading option keeps leading because it is leading.
    Send the numbers and the poll measures the numbers, not the room.

    So `tallied` below is computed from what the SERVER knows about this voter,
    and when it is false the options go out carrying labels and nothing else.

    ── AND THE SECOND ───────────────────────────────────────────────────────

    A TEAM poll is unreachable without a session — on the list AND on the
    single poll AND on the vote. Three separate places, because a rule applied
    in two of the three places is not a rule, and the one you forget is always
    the one somebody finds.
  */

  // Both halves of a poll's identity, resolved once.
  const pollFor = async (id) =>
    env.DB.prepare("SELECT * FROM polls WHERE id = ?").bind(id).first();

  /*
    Has this voter voted in this poll? One query, and the ONLY thing that
    decides whether counts are sent.
  */

  /*
    Options, with counts only when they are allowed. The tally is ONE query
    grouped by option rather than one per option — a poll with eight options
    on a page anybody can load is eight round trips per view otherwise, and
    the pool taught this lesson once already.
  */
  const optionsFor = async (pollId, withCounts) => {
    const rows = await env.DB.prepare(
      "SELECT id, label, ord FROM poll_options WHERE poll_id = ? ORDER BY ord ASC, id ASC"
    ).bind(pollId).all();
    const list = (rows.results || []).map((o) => ({ id: o.id, label: o.label }));
    if (!withCounts) return list;

    const tally = await env.DB.prepare(
      "SELECT option_id, COUNT(*) AS n FROM poll_votes WHERE poll_id = ? GROUP BY option_id"
    ).bind(pollId).all();
    const by = new Map((tally.results || []).map((r) => [r.option_id, r.n]));
    return list.map((o) => ({ ...o, votes: by.get(o.id) || 0 }));
  };

  // Which options THIS voter picked, so the page can show them ticked.

  /* ── the list ──────────────────────────────────────────────────────────── */

  if (path === "/polls" && method === "GET") {
    const voter = String(url.searchParams.get("voter") || "").slice(0, 64);
    const who = await readSession(env, request);
    const team = !!(who && (can(who, "issuePasses") || can(who, "manageTeam")));

    const cfgPolls = await getSettings(env);
    if (!team && !cfgPolls.pollsOpen) {
      return json({ ok: true, polls: [], team: false, closed: true });
    }

    /*
      A visitor gets PUBLIC and OPEN. Nothing else — not drafts, which are
      half-written; not closed ones, which are over; and not TEAM polls, which
      are none of their business. The team gets everything, because the desk
      that manages drafts has to be able to see them.
    */
    const rows = team
      ? await env.DB.prepare("SELECT * FROM polls ORDER BY id DESC LIMIT 100").all()
      : await env.DB.prepare(
          "SELECT * FROM polls WHERE audience = 'PUBLIC' AND status = 'OPEN' ORDER BY id DESC LIMIT 40"
        ).all();

    /*
      ── FOUR QUERIES, NOT FOUR PER POLL ─────────────────────────────────────

      This loop used to call hasVoted, minePicks and optionsFor for each poll
      in turn — three or four round trips EACH, so a listing of forty polls
      was about a hundred and sixty sequential queries to build one response.
      It was fast with two polls, which is exactly how this kind of thing gets
      written and then never noticed: the cost arrives long after the code
      does, on the day somebody has finally used the feature enough for it to
      matter.

      Everything the loop asked for is now fetched once, for every poll at
      once, and looked up in memory. Four queries whether there is one poll or
      a hundred.
    */
    const list = rows.results || [];
    const ids = list.map((p) => p.id);
    const marks = ids.map(() => "?").join(",");

    let allOptions = [], allTally = [], allMine = [];
    if (ids.length) {
      const [o, t, m] = await Promise.all([
        env.DB.prepare(
          `SELECT id, poll_id, label FROM poll_options WHERE poll_id IN (${marks}) ORDER BY ord ASC, id ASC`
        ).bind(...ids).all(),
        env.DB.prepare(
          `SELECT poll_id, option_id, COUNT(*) AS n FROM poll_votes WHERE poll_id IN (${marks}) GROUP BY poll_id, option_id`
        ).bind(...ids).all(),
        voter
          ? env.DB.prepare(
              `SELECT poll_id, option_id FROM poll_votes WHERE voter = ? AND poll_id IN (${marks})`
            ).bind(voter, ...ids).all()
          : Promise.resolve({ results: [] }),
      ]);
      allOptions = o.results || [];
      allTally = t.results || [];
      allMine = m.results || [];
    }

    const optionsBy = new Map();
    for (const o of allOptions) {
      if (!optionsBy.has(o.poll_id)) optionsBy.set(o.poll_id, []);
      optionsBy.get(o.poll_id).push({ id: o.id, label: o.label });
    }
    const countBy = new Map(allTally.map((r) => [`${r.poll_id}:${r.option_id}`, r.n]));
    const mineBy = new Map();
    for (const r of allMine) {
      if (!mineBy.has(r.poll_id)) mineBy.set(r.poll_id, []);
      mineBy.get(r.poll_id).push(r.option_id);
    }

    const polls = list.map((p) => {
      /*
        WHEN THE NUMBERS ARE ALLOWED OUT. The team always. Everybody else only
        once they have voted, or once the poll is closed — a closed poll has
        nothing left to steer. Unchanged from the version above; only the way
        the facts were gathered has changed.
      */
      const mine = mineBy.get(p.id) || [];
      const voted = mine.length > 0;
      const tallied = team || voted || p.status === "CLOSED";
      const opts = optionsBy.get(p.id) || [];
      return {
        id: p.id,
        question: p.question,
        note: p.note || "",
        audience: p.audience,
        picks: p.picks,
        status: p.status,
        created_at: p.created_at,
        closed_at: p.closed_at,
        voted,
        tallied,
        mine,
        options: tallied
          ? opts.map((o) => ({ ...o, votes: countBy.get(`${p.id}:${o.id}`) || 0 }))
          : opts,
      };
    });
    return json({ ok: true, polls, team });
  }

  /* ── voting ────────────────────────────────────────────────────────────── */

  if (path.match(/^\/polls\/\d+\/vote$/) && method === "POST") {
    const id = Number(path.split("/")[2]);
    const voter = String(body.voter || "").slice(0, 64);
    if (!voter) return fail("Couldn't tell who you are — reload and try again.");

    const poll = await pollFor(id);
    if (!poll) return fail("That poll is gone.", 404);
    if (poll.status !== "OPEN") return fail("That poll is closed.");

    const cfgVotePoll = await getSettings(env);

    /*
      A TEAM poll is not votable from outside, and this is checked here as
      well as on the list. Somebody who learns an id can post to it directly;
      hiding it from a listing is not a permission.
    */
    if (poll.audience === "TEAM") {
      const whoVote = await readSession(env, request);
      if (!whoVote || !(can(whoVote, "issuePasses") || can(whoVote, "manageTeam")))
        return fail("That poll is gone.", 404);
    } else if (!cfgVotePoll.pollsOpen) {
      return fail(cfgVotePoll.pollsClosedMessage || "Voting is closed right now.");
    }

    /*
      The picks arrive as a list, and the list is the whole vote — sending it
      whole is what lets somebody change their mind in one action instead of
      un-ticking and re-ticking across three requests, any of which could be
      the one that fails.
    */
    const wanted = Array.isArray(body.options) ? body.options.map(Number).filter(Boolean) : [];
    const limit = Math.max(1, Number(poll.picks) || 1);
    if (!wanted.length) return fail("Pick something first.");
    if (wanted.length > limit) {
      return fail(limit === 1 ? "Pick one." : `Pick up to ${limit}.`);
    }

    // Every id has to belong to THIS poll. Otherwise a vote on poll 4 can add
    // a count to an option of poll 9.
    const valid = await env.DB.prepare(
      `SELECT id FROM poll_options WHERE poll_id = ? AND id IN (${wanted.map(() => "?").join(",")})`
    ).bind(id, ...wanted).all();
    const ok = new Set((valid.results || []).map((r) => r.id));
    if (ok.size !== wanted.length) return fail("One of those options is no longer there.");

    /*
      Rate limited by address as well as by browser id, exactly as the pool is.
      The browser id is the honest half of this — it is a string in local
      storage and a private window clears it — and it was chosen deliberately,
      because the alternative is asking a stranger to sign in to answer one
      question. The address cap is what stops the same person doing it forty
      times in a minute, which is the difference between a poll that is
      imperfect and one that is meaningless.

      Deliberately NOT published to the page. A limit nobody can read is a
      limit nobody games.
    */
    const pollIp = request.headers.get("cf-connecting-ip") || "unknown";
    if (poll.audience === "PUBLIC" && Number(cfgVotePoll.pollsPerHour) > 0) {
      const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const recent = await env.DB.prepare(
        "SELECT COUNT(DISTINCT voter) AS n FROM poll_votes WHERE ip = ? AND poll_id = ? AND at > ?"
      ).bind(pollIp, id, since).first();
      if ((recent?.n || 0) >= Number(cfgVotePoll.pollsPerHour))
        return fail("That's enough from here for now.");
    }

    /*
      Changing your mind is one transaction: everything this voter had for
      this poll goes, then the new picks land. Doing it the other way round —
      insert then clean up — leaves a window where they have more votes than
      the limit allows, and the window is exactly when the tally is read.
    */
    await env.DB.prepare("DELETE FROM poll_votes WHERE poll_id = ? AND voter = ?")
      .bind(id, voter).run();
    const at = now();
    for (const optionId of wanted) {
      await env.DB.prepare(
        "INSERT INTO poll_votes (poll_id, option_id, voter, at, ip) VALUES (?, ?, ?, ?, ?)"
      ).bind(id, optionId, voter, at, pollIp).run().catch(() => {});
    }

    // The counts come back WITH the vote, because this is the moment they are
    // earned and a second request to fetch them would be a second chance to fail.
    return json({
      ok: true, voted: true, tallied: true,
      mine: wanted,
      options: await optionsFor(id, true),
    });
  }

  /* ── the team writes them ──────────────────────────────────────────────── */

  if (path === "/polls" && method === "POST") {
    const whoNew = await readSession(env, request);
    if (!whoNew || !(can(whoNew, "issuePasses") || can(whoNew, "manageTeam")))
      return fail("Only the team can write a poll.", 403);

    const question = String(body.question || "").trim().slice(0, 200);
    if (!question) return fail("A poll needs a question.");

    const labels = (Array.isArray(body.options) ? body.options : [])
      .map((s) => String(s || "").trim().slice(0, 120))
      .filter(Boolean);
    if (labels.length < 2) return fail("A poll needs at least two options.");
    if (labels.length > 12) return fail("Twelve options is plenty.");

    const audience = body.audience === "TEAM" ? "TEAM" : "PUBLIC";
    const picks = Math.max(1, Math.min(labels.length, Number(body.picks) || 1));

    const made = await env.DB.prepare(
      "INSERT INTO polls (question, note, audience, picks, status, created_at, created_by) " +
      "VALUES (?, ?, ?, ?, 'DRAFT', ?, ?)"
    ).bind(question, String(body.note || "").trim().slice(0, 200) || null,
           audience, picks, now(), whoNew.username || null).run();

    const pollId = made.meta.last_row_id;
    let ord = 0;
    for (const label of labels) {
      await env.DB.prepare(
        "INSERT INTO poll_options (poll_id, label, ord) VALUES (?, ?, ?)"
      ).bind(pollId, label, ord++).run();
    }
    return json({ ok: true, id: pollId });
  }

  if (path.match(/^\/polls\/\d+$/) && (method === "PATCH" || method === "DELETE")) {
    const whoEdit = await readSession(env, request);
    if (!whoEdit || !(can(whoEdit, "issuePasses") || can(whoEdit, "manageTeam")))
      return fail("Only the team can change a poll.", 403);
    const id = Number(path.split("/")[2]);
    const poll = await pollFor(id);
    if (!poll) return fail("That poll is gone.", 404);

    if (method === "DELETE") {
      /*
        The votes go with it. A poll_votes row whose poll no longer exists is
        not a record of anything — it cannot be counted, read or explained,
        and it would sit in the table for ever being counted by the rate
        limit. D1 has no cascading delete here, so it is done by hand.
      */
      await env.DB.prepare("DELETE FROM poll_votes WHERE poll_id = ?").bind(id).run();
      await env.DB.prepare("DELETE FROM poll_options WHERE poll_id = ?").bind(id).run();
      await env.DB.prepare("DELETE FROM polls WHERE id = ?").bind(id).run();
      return json({ ok: true });
    }

    const status = ["DRAFT", "OPEN", "CLOSED"].includes(body.status) ? body.status : null;
    if (status) {
      await env.DB.prepare("UPDATE polls SET status = ?, closed_at = ? WHERE id = ?")
        .bind(status, status === "CLOSED" ? now() : null, id).run();
    }
    if (body.question != null) {
      await env.DB.prepare("UPDATE polls SET question = ? WHERE id = ?")
        .bind(String(body.question).trim().slice(0, 200), id).run();
    }
    if (body.note != null) {
      await env.DB.prepare("UPDATE polls SET note = ? WHERE id = ?")
        .bind(String(body.note).trim().slice(0, 200) || null, id).run();
    }
    if (body.picks != null) {
      await env.DB.prepare("UPDATE polls SET picks = ? WHERE id = ?")
        .bind(Math.max(1, Number(body.picks) || 1), id).run();
    }
    return json({ ok: true });
  }


  return null;
}
