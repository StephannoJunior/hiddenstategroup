import { usePageMeta } from "../lib/seo";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Nothing,
  Nav, Footer, useGoogleFonts, PageHead, IndexBand, Field, inputStyle,
  fontDisplay, fontUtility, fontText, theme,
} from "../components/Shared";
import * as api from "../lib/api";
import { useSite } from "../lib/site";

/*
  THE POOL — what people want to hear.

  Two lists, and the difference between them is the whole idea:

    THE NIGHT   songs for one specific event. It closes when that night does,
                which is what stops it becoming a graveyard of requests for
                parties that already happened.
    THE HOUSE   the standing list. Always open, never tied to a date — the one
                that is really a record of what the room likes.

  PASTE A LINK, GET A NAME. Nobody types "Black Coffee — Drive" correctly at
  two in the morning, and asking them to is how you end up with a list you
  cannot search. So the only required field is the link, and the server reads
  the song's name out of it. Everything else — even who you are — is optional,
  because every extra required field is a person who does not bother.
*/

const POOLS = [
  { id: "EVENT", label: "FOR A NIGHT" },
  { id: "HOUSE", label: "THE HOUSE LIST" },
];

function Entry({ s, team, onStatus, onDelete, mode, showVotes, onVote, busy }) {
  const dim = s.status === "HIDDEN";
  return (
    <div className="flex items-center gap-4 py-3.5"
         style={{ borderBottom: `1px solid ${theme.rule}`, opacity: dim ? 0.45 : 1 }}>
      {s.artwork ? (
        <img src={s.artwork} alt="" loading="lazy" className="block shrink-0"
             style={{ width: "54px", height: "54px", objectFit: "cover",
                      background: theme.raised, filter: "grayscale(1) contrast(1.06)" }} />
      ) : (
        <span className="shrink-0 flex items-center justify-center"
              style={{ width: "54px", height: "54px", background: theme.ink, color: theme.bg,
                       ...fontUtility, fontSize: "8px", letterSpacing: "0.1em" }}>
          {(s.provider || "LINK").slice(0, 4)}
        </span>
      )}

      <span className="flex-1 min-w-0">
        <a href={s.url} target="_blank" rel="noopener noreferrer" className="block"
           style={{ ...fontDisplay, fontWeight: 700, fontSize: "19px", lineHeight: 1.2, color: theme.ink }}>
          {s.title || s.url}
        </a>
        <span className="block mt-0.5" style={{ ...fontText, fontSize: "15px", color: theme.ink2 }}>
          {[s.artist, s.by_name && `asked by ${s.by_name}`].filter(Boolean).join(" · ")}
        </span>
      </span>

      {mode === "VOTE" && (
        /*
          A ballot line. The count sits with the button rather than beside the
          title, so the thing you press and the thing that changes are the
          same object — press it again to take the vote back.
        */
        <button onClick={() => onVote(s)} disabled={busy}
                aria-pressed={!!s.mine}
                aria-label={s.mine ? `Take back your vote for ${s.title || "this"}` : `Vote for ${s.title || "this"}`}
                className="flex items-center gap-2 shrink-0"
                style={{ ...fontUtility, fontSize: "9.5px", letterSpacing: "0.12em",
                         cursor: busy ? "default" : "pointer", padding: "8px 12px",
                         color: s.mine ? theme.bg : theme.ink,
                         background: s.mine ? theme.ink : "transparent",
                         border: `1px solid ${s.mine ? theme.ink : theme.rule}`,
                         opacity: busy ? 0.55 : 1,
                         transition: "background 180ms ease, color 180ms ease" }}>
          <span>{s.mine ? "PICKED" : "PICK"}</span>
          {showVotes && (
            <span style={{ fontVariantNumeric: "tabular-nums",
                           color: s.mine ? theme.bg : theme.brass }}>
              {String(s.votes ?? 0).padStart(2, "0")}
            </span>
          )}
        </button>
      )}

      {s.status === "PLAYED" && (
        <span style={{ ...fontUtility, fontSize: "8.5px", letterSpacing: "0.18em", color: theme.brass }}>
          PLAYED
        </span>
      )}

      {team && (
        <span className="flex gap-2 shrink-0">
          <button onClick={() => onStatus(s, s.status === "PLAYED" ? "NEW" : "PLAYED")}
                  style={{ ...fontUtility, fontSize: "8.5px", letterSpacing: "0.14em", cursor: "pointer",
                           padding: "6px 9px", background: "transparent",
                           border: `1px solid ${theme.rule}`, color: theme.ink }}>
            {s.status === "PLAYED" ? "UNPLAY" : "PLAYED"}
          </button>
          <button onClick={() => onStatus(s, s.status === "HIDDEN" ? "NEW" : "HIDDEN")}
                  style={{ ...fontUtility, fontSize: "8.5px", letterSpacing: "0.14em", cursor: "pointer",
                           padding: "6px 9px", background: "transparent",
                           border: `1px solid ${theme.rule}`, color: theme.ink }}>
            {s.status === "HIDDEN" ? "SHOW" : "HIDE"}
          </button>
          <button onClick={() => onDelete(s)}
                  style={{ ...fontUtility, fontSize: "8.5px", letterSpacing: "0.14em", cursor: "pointer",
                           padding: "6px 9px", background: theme.ink, border: 0, color: theme.bg }}>
            DELETE
          </button>
        </span>
      )}
    </div>
  );
}

export default function SongPool() {
  useGoogleFonts();
  usePageMeta({
    title: "The pool",
    description: "Put a song in the pool — paste a link and we'll take it from there.",
  });

  const site = useSite();

  const [params, setParams] = useSearchParams();
  const [pool, setPool] = useState(params.get("pool") === "HOUSE" ? "HOUSE" : "EVENT");
  const [listHidden, setListHidden] = useState(false);

  /*
    Only the pools that are open are offered. If the night's pool is closed
    but the house list is not, the tabs collapse to one rather than showing a
    choice that refuses you after you have typed a link.
  */
  const pools = useMemo(
    () => POOLS.filter((p) =>
      p.id === "HOUSE" ? site.poolHouseOpen !== false : site.poolEventOpen !== false),
    [site.poolHouseOpen, site.poolEventOpen]
  );

  useEffect(() => {
    if (pools.length && !pools.some((p) => p.id === pool)) setPool(pools[0].id);
  }, [pools, pool]);

  /*
    Closed is closed however it happened. The master switch is one way to get
    there; turning off both pools individually is another, and it has to look
    the same from outside — otherwise the page offers a form that the server
    is certain to refuse.
  */
  const closed = site.poolOpen === false || pools.length === 0;
  const [parties, setParties] = useState([]);
  const [party, setParty] = useState(params.get("party") || "");
  const [songs, setSongs] = useState([]);
  const [team, setTeam] = useState(false);
  const [mode, setMode] = useState("ADD");
  const [showVotes, setShowVotes] = useState(true);
  const [votesPer, setVotesPer] = useState(3);
  const [voting, setVoting] = useState(0);

  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [tone, setTone] = useState("good");

  useEffect(() => {
    api.publicParties().then((res) => {
      if (!res.ok) return;
      setParties(res.parties || []);
      setParty((p) => p || (res.parties?.[0]?.id ?? ""));
    });
  }, []);

  const load = useCallback(() => {
    if (pool === "EVENT" && !party) { setSongs([]); return; }
    api.listSongs(pool, party).then((res) => {
      if (!res.ok) return;
      setSongs(res.songs || []);
      setTeam(!!res.team);
      setListHidden(!!res.listHidden);
      setMode(res.mode || "ADD");
      setShowVotes(res.showVotes !== false);
      setVotesPer(Number(res.votesPerPerson) || 0);
    });
  }, [pool, party]);

  useEffect(() => { load(); }, [load]);

  // The address remembers which pool you were looking at, so the link you send
  // someone opens on the same list you were on.
  useEffect(() => {
    const next = {};
    if (pool === "HOUSE") next.pool = "HOUSE";
    else if (party) next.party = party;
    setParams(next, { replace: true });
  }, [pool, party, setParams]);

  const submit = async (e) => {
    e.preventDefault();
    setMsg("");
    if (!url.trim()) { setTone("bad"); setMsg("Paste a link to the song first."); return; }
    setBusy(true);
    const res = await api.addSong({
      pool, party, url: url.trim(), name: name.trim(),
      // Sent only so the server can check it. It decides; this just supplies.
      pass: api.getGuestPass() || "",
    });
    setBusy(false);
    if (!res.ok) { setTone("bad"); setMsg(res.error || "That didn't go through."); return; }
    setTone("good");
    setMsg(res.duplicate
      ? res.message
      : `Added — ${[res.artist, res.title].filter(Boolean).join(" — ")}.`);
    setUrl("");
    load();
  };

  /*
    Optimistic, because a vote that takes a moment to register feels broken —
    and then reconciled with what the server actually says, because the limit
    and the one-vote rule are decided there.
  */
  const vote = async (song) => {
    setVoting(song.id);
    setSongs((list) => list.map((x) =>
      x.id === song.id
        ? { ...x, mine: !x.mine, votes: Math.max(0, (x.votes ?? 0) + (x.mine ? -1 : 1)) }
        : x));
    const res = await api.voteSong(song.id);
    setVoting(0);
    if (!res.ok) { setTone("bad"); setMsg(res.error || "That vote did not go through."); }
    load();
  };

  const setStatus = async (s, status) => {
    await api.editSong(s.id, status);
    load();
  };
  const remove = async (s) => {
    await api.deleteSong(s.id);
    load();
  };

  const chosen = parties.find((p) => p.id === party);
  const played = songs.filter((s) => s.status === "PLAYED").length;

  return (
    <div data-page style={{ background: theme.bg, minHeight: "100vh" }}>
      <Nav />
      {/* where the skip link lands */}
      <span id="main" tabIndex={-1} />

      <IndexBand top items={[
        { label: "POOL", value: pool === "HOUSE" ? "THE HOUSE LIST" : (chosen?.name || "A NIGHT") },
        /* When the list is not public the server sends none of it, so a
           count here would read 00 — which is not "hidden", it is a lie
           about how many people have put something in. */
        { label: "IN THE POOL", value: listHidden ? "—" : String(songs.length).padStart(2, "0") },
        { label: "PLAYED", value: listHidden ? "—" : String(played).padStart(2, "0") },
      ]} />

      <PageHead flush kicker="PUT A SONG IN"
                title={site.poolHeadline || "The Pool"}
                sub={site.poolSub || "PASTE A LINK — WE'LL FIND THE NAME"} />

      {/* Shut entirely. The page still exists, because a link to it may have
          gone out already, and a dead link reads worse than a closed door. */}
      {closed && (
        <Nothing note="Nothing has been lost — anything already in the pool is still there.">
          {site.poolClosedMessage || "The pool is closed right now."}
        </Nothing>
      )}

      <section className="max-w-[760px] mx-auto px-[18px] pb-4"
               hidden={closed}>
        <div className="flex gap-1.5 mb-7" hidden={pools.length < 2}>
          {pools.map((p) => {
            const on = pool === p.id;
            return (
              <button key={p.id} onClick={() => setPool(p.id)}
                      style={{ ...fontUtility, fontSize: "9.5px", letterSpacing: "0.16em",
                               padding: "12px 16px", cursor: "pointer",
                               color: on ? theme.bg : theme.ink,
                               background: on ? theme.ink : "transparent",
                               border: `1px solid ${on ? theme.ink : theme.rule}` }}>
                {p.label}
              </button>
            );
          })}
        </div>

        {pool === "EVENT" && (
          parties.length ? (
            <Field label="Which night">
              <select style={inputStyle} value={party} onChange={(e) => setParty(e.target.value)}>
                {parties.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} — {p.date_label}</option>
                ))}
              </select>
            </Field>
          ) : (
            <p className="m-0 mb-6" style={{ ...fontText, fontSize: "17px", color: theme.ink2 }}>
              No nights are taking requests right now. The house list below is always open.
            </p>
          )
        )}

        {mode === "VOTE" && (
          <div className="mb-6 px-3 py-3" style={{ border: `1px solid ${theme.ink}`,
               borderLeft: `3px solid ${theme.brass}` }}>
            <p className="m-0" style={{ ...fontUtility, fontSize: "9px",
               letterSpacing: "0.2em", color: theme.brass }}>
              THIS ONE IS A VOTE
            </p>
            <p className="m-0 mt-1.5" style={{ ...fontText, fontSize: "16px",
               lineHeight: 1.5, color: theme.ink2 }}>
              {votesPer > 0
                ? `Pick up to ${votesPer} — press again to take one back.`
                : "Pick as many as you like — press again to take one back."}
              {team ? " You can also add options below." : ""}
            </p>
          </div>
        )}

        {(mode !== "VOTE" || team) && (pool === "HOUSE" || parties.length > 0) && (
          <form onSubmit={submit} className="mt-2">
            {/* Said BEFORE the link is typed, not after it is refused. The
                server still decides; this only saves somebody the trouble. */}
            {site.poolNeedPass && !api.getGuestPass() && (
              <p className="m-0 mb-4 px-3 py-2.5" style={{ ...fontText, fontSize: "16px",
                 lineHeight: 1.5, color: theme.ink, border: `1px solid ${theme.rule}`,
                 background: theme.sunk }}>
                The pool is open to ticket holders. Open your pass on this
                phone first and this page will know you.
              </p>
            )}

            <Field label="Link to the song">
              <input value={url} onChange={(e) => setUrl(e.target.value)}
                     placeholder="Spotify, YouTube, SoundCloud, Apple Music…"
                     inputMode="url" autoCapitalize="none" autoCorrect="off"
                     style={inputStyle} />
            </Field>
            <Field label={site.poolRequireName ? "Your name" : "Your name (optional)"}>
              <input value={name} onChange={(e) => setName(e.target.value)}
                     placeholder="So we know who asked" style={inputStyle}
                     required={!!site.poolRequireName} />
            </Field>

            <button type="submit" disabled={busy} className="w-full mt-4 py-3.5"
                    style={{ ...fontUtility, fontSize: "10.5px", letterSpacing: "0.2em",
                             background: theme.ink, color: theme.bg, border: 0,
                             cursor: "pointer", opacity: busy ? 0.6 : 1 }}>
              {busy ? "READING THE LINK…" : "PUT IT IN THE POOL"}
            </button>

            {site.poolNote && (
              <p className="m-0 mt-3" style={{ ...fontText, fontSize: "15.5px",
                 lineHeight: 1.5, color: theme.ink2 }}>
                {site.poolNote}
              </p>
            )}

            {msg && (
              <p className="m-0 mt-3 px-3 py-2.5"
                 style={{ ...fontText, fontSize: "16px",
                          color: tone === "good" ? theme.ink : theme.bad,
                          border: `1px solid ${tone === "good" ? theme.rule : theme.badLine}` }}>
                {msg}
              </p>
            )}
          </form>
        )}
      </section>

      <section className="max-w-[760px] mx-auto px-[18px] pb-16"
               hidden={closed || listHidden}>
        <p className="m-0 mt-9 mb-2" style={{ ...fontUtility, fontSize: "9.5px",
           letterSpacing: "0.2em", color: theme.brass }}>
          {mode === "VOTE" ? "ON THE BALLOT" : pool === "HOUSE" ? "THE HOUSE LIST" : "IN THE POOL"}
        </p>
        <div style={{ borderTop: `1px solid ${theme.ink}` }}>
          {songs.length === 0 ? (
            <p className="m-0 py-12 text-center"
               style={{ ...fontUtility, fontSize: "10.5px", letterSpacing: "0.16em", color: theme.ink2 }}>
              {mode === "VOTE" ? "NO OPTIONS YET — THE TEAM SETS THESE" : "NOTHING IN HERE YET — BE FIRST"}
            </p>
          ) : (
            songs.map((s) => (
              <Entry key={s.id} s={s} team={team} onStatus={setStatus} onDelete={remove}
                     mode={mode} showVotes={showVotes} onVote={vote} busy={voting === s.id} />
            ))
          )}
        </div>
      </section>

      <Footer />
    </div>
  );
}
