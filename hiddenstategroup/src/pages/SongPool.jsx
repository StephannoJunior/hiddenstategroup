import { usePageMeta } from "../lib/seo";
import React, { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Nav, Footer, useGoogleFonts, PageHead, IndexBand, Field, inputStyle,
  fontDisplay, fontUtility, fontText, theme,
} from "../components/Shared";
import * as api from "../lib/api";

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

function Entry({ s, team, onStatus, onDelete }) {
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

  const [params, setParams] = useSearchParams();
  const [pool, setPool] = useState(params.get("pool") === "HOUSE" ? "HOUSE" : "EVENT");
  const [parties, setParties] = useState([]);
  const [party, setParty] = useState(params.get("party") || "");
  const [songs, setSongs] = useState([]);
  const [team, setTeam] = useState(false);

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
    const res = await api.addSong({ pool, party, url: url.trim(), name: name.trim() });
    setBusy(false);
    if (!res.ok) { setTone("bad"); setMsg(res.error || "That didn't go through."); return; }
    setTone("good");
    setMsg(res.duplicate
      ? res.message
      : `Added — ${[res.artist, res.title].filter(Boolean).join(" — ")}.`);
    setUrl("");
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
        { label: "IN THE POOL", value: String(songs.length).padStart(2, "0") },
        { label: "PLAYED", value: String(played).padStart(2, "0") },
      ]} />

      <PageHead flush kicker="PUT A SONG IN" title="The Pool"
                sub="PASTE A LINK — WE'LL FIND THE NAME" />

      <section className="max-w-[760px] mx-auto px-[18px] pb-4">
        <div className="flex gap-1.5 mb-7">
          {POOLS.map((p) => {
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

        {(pool === "HOUSE" || parties.length > 0) && (
          <form onSubmit={submit} className="mt-2">
            <Field label="Link to the song">
              <input value={url} onChange={(e) => setUrl(e.target.value)}
                     placeholder="Spotify, YouTube, SoundCloud, Apple Music…"
                     inputMode="url" autoCapitalize="none" autoCorrect="off"
                     style={inputStyle} />
            </Field>
            <Field label="Your name (optional)">
              <input value={name} onChange={(e) => setName(e.target.value)}
                     placeholder="So we know who asked" style={inputStyle} />
            </Field>

            <button type="submit" disabled={busy} className="w-full mt-4 py-3.5"
                    style={{ ...fontUtility, fontSize: "10.5px", letterSpacing: "0.2em",
                             background: theme.ink, color: theme.bg, border: 0,
                             cursor: "pointer", opacity: busy ? 0.6 : 1 }}>
              {busy ? "READING THE LINK…" : "PUT IT IN THE POOL"}
            </button>

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

      <section className="max-w-[760px] mx-auto px-[18px] pb-16">
        <p className="m-0 mt-9 mb-2" style={{ ...fontUtility, fontSize: "9.5px",
           letterSpacing: "0.2em", color: theme.brass }}>
          {pool === "HOUSE" ? "THE HOUSE LIST" : "IN THE POOL"}
        </p>
        <div style={{ borderTop: `1px solid ${theme.ink}` }}>
          {songs.length === 0 ? (
            <p className="m-0 py-12 text-center"
               style={{ ...fontUtility, fontSize: "10.5px", letterSpacing: "0.16em", color: theme.ink2 }}>
              NOTHING IN HERE YET — BE FIRST
            </p>
          ) : (
            songs.map((s) => (
              <Entry key={s.id} s={s} team={team} onStatus={setStatus} onDelete={remove} />
            ))
          )}
        </div>
      </section>

      <Footer />
    </div>
  );
}
