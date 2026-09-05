import { usePageMeta } from "../lib/seo";
import React, { useCallback, useEffect, useState } from "react";
import {
  Nothing, Nav, Footer, useGoogleFonts, PageHead, IndexBand,
  fontUtility, fontText, theme,
} from "../components/Shared";
import * as api from "../lib/api";
import { useSite } from "../lib/site";

/*
  THE POLLS — a question, some options, and a count you have to earn.

  ── WHY THE RESULT IS HIDDEN UNTIL YOU HAVE VOTED ─────────────────────────

  Not coyness. A visible count STEERS the vote: shown that sixty per cent have
  picked the second option, most people pick the second option, and what the
  poll then measures is its own leading option rather than the room. It is the
  best-documented effect in polling and it is trivially avoidable — so the
  numbers arrive at the moment they stop being able to do any harm, which is
  the moment you have committed to an answer.

  This is enforced in the WORKER, not here. The tallies are absent from the
  response until the server knows this voter has voted; a page that received
  them and declined to draw them would be handing them to anyone who opens the
  network tab, and would make the rule a decoration.

  ── AND WHY THERE IS NO SIGN-IN ───────────────────────────────────────────

  One vote per browser, kept as an opaque id in local storage — the same one
  the song pool uses. It is beatable with a private window and that was chosen
  on purpose: the alternative is asking a stranger to make an account to
  answer one question, and the number of people who do that is approximately
  none. An address-based cap on the server catches the casual repeat. Anything
  that genuinely must not be gamed should not be a poll on a public page.
*/

/* One option: a button before you vote, a bar afterwards. */
function Option({ option, picked, tallied, total, disabled, onPick }) {
  const share = tallied && total > 0 ? Math.round((option.votes / total) * 100) : 0;

  return (
    <button
      onClick={onPick}
      disabled={disabled}
      aria-pressed={picked}
      className="relative w-full text-left block mb-1.5 overflow-hidden"
      style={{
        border: `1px solid ${picked ? theme.ink : theme.rule}`,
        background: "transparent",
        padding: "13px 15px",
        cursor: disabled ? "default" : "pointer",
      }}
    >
      {/*
        THE BAR IS BEHIND THE LABEL, NOT BESIDE IT.

        A separate bar under the text costs a line of height per option and
        makes a poll of eight into a scroll. Behind it, the row is the bar —
        and because it is a background rather than a border it cannot shift
        the text by a subpixel as it grows, which is what makes a list of
        these settle rather than shimmer.
      */}
      <span aria-hidden="true" style={{
        position: "absolute", left: 0, top: 0, bottom: 0,
        width: tallied ? `${share}%` : "0%",
        background: picked ? "rgba(110,33,24,0.16)" : theme.sunk,
        transition: "width 520ms cubic-bezier(.4,0,.2,1)",
      }} />

      <span className="relative flex items-baseline gap-3">
        <span className="flex-1" style={{ ...fontText, fontSize: "16.5px", color: theme.ink }}>
          {option.label}
        </span>
        {picked && (
          <span style={{ ...fontUtility, fontSize: "8px", letterSpacing: "0.16em", color: theme.brass }}>
            YOURS
          </span>
        )}
        {tallied && (
          <span style={{ ...fontUtility, fontSize: "10px", letterSpacing: "0.08em",
                         color: theme.ink, fontVariantNumeric: "tabular-nums" }}>
            {share}%
          </span>
        )}
      </span>
    </button>
  );
}

function Poll({ poll, onVoted }) {
  // What is ticked but not yet sent. Seeded from what the server says this
  // browser already chose, so coming back shows your own answer rather than
  // an empty form you have apparently never filled in.
  const [picked, setPicked] = useState(() => poll.mine || []);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => { setPicked(poll.mine || []); }, [poll.id, poll.mine]);

  const many = poll.picks > 1;
  const closed = poll.status === "CLOSED";
  const total = poll.tallied
    ? poll.options.reduce((n, o) => n + (o.votes || 0), 0)
    : 0;

  const tap = (id) => {
    if (closed) return;
    setErr("");
    setPicked((was) => {
      if (was.includes(id)) return was.filter((x) => x !== id);
      if (!many) return [id];
      if (was.length >= poll.picks) {
        setErr(`That is all ${poll.picks} — untick one to change your mind.`);
        return was;
      }
      return [...was, id];
    });
  };

  const send = async () => {
    if (!picked.length) { setErr("Pick something first."); return; }
    setBusy(true);
    const res = await api.votePoll(poll.id, picked);
    setBusy(false);
    if (res.ok) onVoted(poll.id, res);
    else setErr(res.error || "That didn't go through.");
  };

  /*
    A SINGLE-CHOICE POLL SENDS ON THE TAP. There is nothing to confirm — you
    have made the only decision the poll asks for, and a Vote button under one
    choice is a second press for no reason. A multiple-choice poll keeps the
    button, because until you say so nobody can tell whether you have finished
    choosing.
  */
  const tapOne = async (id) => {
    if (closed || busy) return;
    setPicked([id]);
    setBusy(true);
    const res = await api.votePoll(poll.id, [id]);
    setBusy(false);
    if (res.ok) onVoted(poll.id, res);
    else { setErr(res.error || "That didn't go through."); setPicked(poll.mine || []); }
  };

  return (
    <article className="mb-11">
      <div className="flex items-baseline gap-3 mb-1"
           style={{ borderBottom: `1px solid ${theme.ink}`, paddingBottom: "6px" }}>
        <span style={{ ...fontUtility, fontSize: "8px", letterSpacing: "0.2em", color: theme.brass }}>
          {closed ? "CLOSED" : many ? `PICK UP TO ${poll.picks}` : "PICK ONE"}
        </span>
        <span className="flex-1 text-right" style={{ ...fontUtility, fontSize: "8px",
              letterSpacing: "0.16em", color: theme.ink2 }}>
          {poll.tallied ? `${total} ${total === 1 ? "VOTE" : "VOTES"}` : ""}
        </span>
      </div>

      <h2 className="m-0 mt-3 mb-1" style={{ ...fontText, fontSize: "21px", lineHeight: 1.25,
                                             color: theme.ink, textWrap: "balance" }}>
        {poll.question}
      </h2>
      {poll.note && (
        <p className="m-0 mb-3" style={{ ...fontText, fontSize: "15px", lineHeight: 1.5, color: theme.ink2 }}>
          {poll.note}
        </p>
      )}

      <div className="mt-4">
        {poll.options.map((o) => (
          <Option key={o.id} option={o}
                  picked={picked.includes(o.id)}
                  tallied={poll.tallied}
                  total={total}
                  disabled={closed || busy}
                  onPick={() => (many ? tap(o.id) : tapOne(o.id))} />
        ))}
      </div>

      {err && (
        <p className="m-0 mt-2" style={{ ...fontText, fontSize: "14.5px", color: theme.bad }}>{err}</p>
      )}

      {many && !closed && (
        <button onClick={send} disabled={busy}
                className="mt-3"
                style={{ ...fontUtility, fontSize: "9px", letterSpacing: "0.16em",
                         padding: "11px 20px", cursor: busy ? "default" : "pointer",
                         color: theme.onInk, background: theme.ink, border: `1px solid ${theme.ink}`,
                         opacity: busy ? 0.5 : 1 }}>
          {busy ? "SENDING…" : poll.voted ? "CHANGE MY ANSWER" : "VOTE"}
        </button>
      )}

      {/*
        The line that explains the empty right-hand column, shown only while it
        IS empty. Somebody who has not voted is looking at a list of options
        with no numbers and no explanation, and "where are the results" is a
        reasonable thing to wonder rather than a thing to work out.
      */}
      {!poll.tallied && (
        <p className="m-0 mt-2.5" style={{ ...fontText, fontSize: "14px", lineHeight: 1.5, color: theme.ink2 }}>
          The count appears once you have voted — before that it would only
          tell you what everybody else thinks.
        </p>
      )}
    </article>
  );
}

export default function Polls() {
  useGoogleFonts();
  usePageMeta({
    title: "Polls",
    description: "Answer a question. The count appears once you have voted.",
  });

  const site = useSite();
  const [polls, setPolls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  const load = useCallback(() => {
    api.listPolls().then((res) => {
      setLoading(false);
      if (res.ok) setPolls((res.polls || []).filter((p) => p.audience === "PUBLIC"));
      else setMsg(res.error || "Couldn't load the polls.");
    });
  }, []);

  useEffect(() => { load(); }, [load]);

  /*
    The vote comes back carrying the counts it just earned, so the poll is
    updated in place from the response rather than by fetching the list again.
    A refetch here would be a second request that can fail AFTER a vote that
    succeeded — and the failure would look, to the person who just voted, like
    the vote not counting.
  */
  const onVoted = (id, res) => {
    setPolls((list) => list.map((p) => (p.id === id
      ? { ...p, voted: true, tallied: true, mine: res.mine || [], options: res.options || p.options }
      : p)));
  };

  const closed = site.pollsOpen === false;
  const answered = polls.filter((p) => p.voted).length;

  return (
    <div data-page style={{ background: theme.bg, minHeight: "100vh" }}>
      <Nav />
      <span id="main" tabIndex={-1} />

      <IndexBand top items={[
        { label: "OPEN", value: loading ? "—" : String(polls.length).padStart(2, "0") },
        { label: "ANSWERED", value: loading ? "—" : String(answered).padStart(2, "0") },
        { label: "ONE VOTE", value: "PER PERSON" },
      ]} />

      <PageHead flush kicker="HAVE A SAY"
                title={site.pollsHeadline || "Polls"}
                sub={site.pollsSub || "THE COUNT APPEARS ONCE YOU HAVE VOTED"} />

      {closed && (
        <Nothing note="Nothing has been lost — anything already answered is still counted.">
          {site.pollsClosedMessage || "Nothing to vote on right now."}
        </Nothing>
      )}

      <section className="max-w-[760px] mx-auto px-[18px] pb-16" hidden={closed}>
        {site.pollsNote && (
          <p className="m-0 mb-7" style={{ ...fontText, fontSize: "15px", lineHeight: 1.55, color: theme.ink2 }}>
            {site.pollsNote}
          </p>
        )}

        {msg && (
          <p className="m-0 mb-5" style={{ ...fontText, fontSize: "15px", color: theme.bad }}>{msg}</p>
        )}

        {loading ? (
          <p className="m-0 py-8" style={{ ...fontText, fontSize: "16px", color: theme.ink2 }}>Loading…</p>
        ) : !polls.length ? (
          <Nothing note="Worth checking back — they go up before a night as often as after one.">
            {site.pollsClosedMessage || "Nothing to vote on right now."}
          </Nothing>
        ) : (
          polls.map((p) => <Poll key={p.id} poll={p} onVoted={onVoted} />)
        )}
      </section>

      <Footer />
    </div>
  );
}
