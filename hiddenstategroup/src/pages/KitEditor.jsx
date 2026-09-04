import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Field, inputStyle, IndexBand, fontDisplay, fontUtility, fontText, theme }
  from "../components/Shared";
import { useSite } from "../lib/site";
import * as api from "../lib/api";

/*
  ── THE PRESS KIT EDITOR · K01–K07, K18, K20 ────────────────────────────────

  The kit used to be edited as text: one photograph per line, "address | credit
  | label". That works, and nobody was ever going to keep a roster current
  through it. This is a place to PUT THINGS — drag a photograph in, drop the
  rider PDF, and see what is still missing before you send anyone a link.

  THREE RULES IT FOLLOWS THROUGHOUT, all learned elsewhere in this console:

    · NOTHING IS SAVED BY SURPRISE. Uploads happen immediately, because an
      upload that waits for a save is an upload that loses the writing when it
      fails. Everything else waits for a button.
    · NO NATIVE DIALOGUES. confirm() blocks the whole page on iOS. A
      destructive button changes to say what a second press will do.
    · THE SERVER DECIDES. Every limit shown here is also enforced there.
*/

/* ── small pieces, shared with the other panels ──────────────────────────── */

const Btn = ({ on, wide, danger, children, ...rest }) => (
  <button type="button" {...rest} style={{
    ...fontUtility, fontSize: "9px", letterSpacing: "0.16em", cursor: "pointer",
    padding: wide ? "11px 20px" : "8px 12px",
    color: on ? theme.onInk : danger ? theme.bad : theme.ink,
    background: on ? (danger ? theme.bad : theme.ink) : "transparent",
    border: `1px solid ${danger ? theme.bad : on ? theme.ink : theme.rule}`,
    ...(rest.style || {}),
  }}>{children}</button>
);

const Head = ({ children, right }) => (
  <div className="flex items-baseline gap-3"
       style={{ borderBottom: `1px solid ${theme.ink}`, paddingBottom: "6px", marginTop: "30px" }}>
    <h3 className="m-0" style={{ ...fontUtility, fontSize: "10px", letterSpacing: "0.2em", fontWeight: 700 }}>
      {children}
    </h3>
    {right != null && (
      <span className="flex-1 text-right"
            style={{ ...fontUtility, fontSize: "9px", letterSpacing: "0.16em", color: theme.ink2 }}>
        {right}
      </span>
    )}
  </div>
);

const Empty = ({ children }) => (
  <p className="m-0 py-2" style={{ ...fontText, fontSize: "17px", lineHeight: 1.55, color: theme.ink2 }}>
    {children}
  </p>
);

const Note = ({ children, tone = "bad" }) =>
  children ? (
    <p className="m-0 my-3 px-3 py-2.5" style={{
      ...fontText, fontSize: "15px", lineHeight: 1.5,
      color: tone === "bad" ? theme.bad : theme.ink,
      border: `1px solid ${tone === "bad" ? theme.badLine : theme.rule}`,
      background: tone === "bad" ? "transparent" : theme.sunk,
    }}>{children}</p>
  ) : null;

/*
  ── K01 · A GRID YOU DROP PHOTOGRAPHS ONTO ────────────────────────────────

  Reordering is by dragging, and the FIRST TILE IS THE PRIMARY — which is why
  the order matters at all. It leads the kit page, it is what the share
  preview shows when the link is pasted into a message, and it is the one a
  promoter takes when they only take one.

  The drag uses the browser's own HTML5 drag events rather than pointer maths.
  It is less fashionable and it is the right call here: it gives keyboard and
  screen-reader behaviour for free, it does not fight the page's scrolling on
  a phone, and there is no chance of the pointer-capture bug that has bitten
  the floating bar twice.
*/
function PhotoGrid({ photos, onChange, folder, watermark }) {
  const [busy, setBusy] = useState(0);
  const [error, setError] = useState("");
  const [picked, setPicked] = useState(0);
  const [over, setOver] = useState(false);
  const dragFrom = useRef(null);
  const input = useRef(null);

  const add = async (files) => {
    const list = [...files].filter((f) => /^image\//.test(f.type));
    if (!list.length) {
      setError("Photographs only here — the rider and the logos have their own places below.");
      return;
    }
    setError("");
    setBusy(list.length);
    const made = [];
    for (const file of list) {
      const res = await api.uploadPicture(file, folder);
      if (res.ok) made.push(res.photo);
      else setError(res.error || `${file.name} did not upload.`);
      setBusy((n) => n - 1);
    }
    if (made.length) onChange([...photos, ...made]);
  };

  const move = (from, to) => {
    if (from === to || from == null) return;
    const next = [...photos];
    const [one] = next.splice(from, 1);
    next.splice(to, 0, one);
    onChange(next);
    setPicked(to);
  };

  const set = (i, k, v) => onChange(photos.map((p, j) => (j === i ? { ...p, [k]: v } : p)));
  const drop = (i) => {
    onChange(photos.filter((_, j) => j !== i));
    setPicked(0);
  };

  const current = photos[picked];

  return (
    <div>
      <Head right={`${photos.length} · FIRST IS THE PRIMARY`}>PHOTOGRAPHS</Head>

      <div
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          if (e.dataTransfer.files?.length) add(e.dataTransfer.files);
        }}
        className="mt-4 px-4 py-6 text-center"
        style={{
          border: `1px dashed ${over ? theme.ink : theme.ink2}`,
          background: over ? theme.sunk : "transparent",
          transition: "background 140ms ease",
        }}
      >
        <p className="m-0" style={{ ...fontUtility, fontSize: "9.5px", letterSpacing: "0.18em", color: theme.ink }}>
          {busy > 0 ? `UPLOADING ${busy}…` : "DROP PHOTOGRAPHS HERE"}
        </p>
        <p className="m-0 mt-2" style={{ ...fontText, fontSize: "15px", lineHeight: 1.5, color: theme.ink2 }}>
          Big files are fine — up to 40MB each. The web-sized copies are made
          here in your browser before anything is sent, so the original goes up
          untouched for print and the page still loads quickly on a phone.
        </p>
        <div className="mt-3">
          <Btn onClick={() => input.current && input.current.click()}>CHOOSE FILES</Btn>
        </div>
        <input ref={input} type="file" accept="image/*" multiple hidden
               onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
      </div>

      <Note>{error}</Note>

      {photos.length > 0 && (
        <div className="grid gap-2 mt-4"
             style={{ gridTemplateColumns: "repeat(auto-fill,minmax(96px,1fr))" }}>
          {photos.map((p, i) => (
            <div
              key={i}
              draggable
              onDragStart={() => { dragFrom.current = i; }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => { move(dragFrom.current, i); dragFrom.current = null; }}
              onClick={() => setPicked(i)}
              title="Drag to reorder"
              style={{
                position: "relative", aspectRatio: "1", cursor: "grab",
                border: `2px solid ${i === picked ? theme.ink : theme.rule}`,
                background: `#2b2721 center/cover no-repeat url(${p.thumb || p.web || p.url})`,
              }}
            >
              {i === 0 && (
                <span style={{
                  position: "absolute", top: 0, left: 0, ...fontUtility, fontSize: "7px",
                  letterSpacing: "0.14em", background: theme.brass, color: theme.onInk,
                  padding: "3px 5px",
                }}>PRIMARY</span>
              )}
              {!p.credit && (
                <span style={{
                  position: "absolute", bottom: 0, left: 0, right: 0, ...fontUtility,
                  fontSize: "7px", letterSpacing: "0.12em", background: theme.bad,
                  color: theme.onInk, padding: "3px 4px", textAlign: "center",
                }}>NO CREDIT</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/*
        ── K02 · THE CREDIT LIVES ON THE PHOTOGRAPH ───────────────────────

        Not the second field of a pipe-separated line. A credit is a condition
        of use rather than a courtesy — a photographer can ask for a shot to be
        taken down over a missing one — which is why an uncredited tile is
        marked in red above rather than left to be noticed.
      */}
      {current && (
        <div className="mt-4 px-4 py-4" style={{ background: theme.sunk, border: `1px solid ${theme.rule}` }}>
          <div className="flex items-start gap-4">
            <img src={current.thumb || current.url} alt=""
                 style={{ width: "92px", height: "92px", objectFit: "cover", flex: "none",
                          border: `1px solid ${theme.rule}` }} />
            <div className="flex-1 min-w-0">
              <p className="m-0 mb-2" style={{ ...fontUtility, fontSize: "8px",
                 letterSpacing: "0.16em", color: theme.ink2 }}>
                PHOTOGRAPH {picked + 1} OF {photos.length} · {current.note || ""}
              </p>
              <Field label="Credit — who took it">
                <input value={current.credit || ""} maxLength={100}
                       placeholder="M. Ionescu"
                       onChange={(e) => set(picked, "credit", e.target.value)}
                       style={{ ...inputStyle, width: "100%" }} />
              </Field>
              <div className="mt-3">
                <Field label="Caption (optional)">
                  <input value={current.caption || ""} maxLength={140}
                         onChange={(e) => set(picked, "caption", e.target.value)}
                         style={{ ...inputStyle, width: "100%" }} />
                </Field>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-3">
                {picked > 0 && <Btn onClick={() => move(picked, 0)}>MAKE IT THE PRIMARY</Btn>}
                <Btn onClick={() => move(picked, Math.max(0, picked - 1))}>← EARLIER</Btn>
                <Btn onClick={() => move(picked, Math.min(photos.length - 1, picked + 1))}>LATER →</Btn>
                <Btn danger onClick={() => drop(picked)}>REMOVE</Btn>
              </div>
            </div>
          </div>
          {watermark && (
            <p className="m-0 mt-3" style={{ ...fontText, fontSize: "14px", lineHeight: 1.5, color: theme.ink2 }}>
              Watermarking is on in settings — the page shows a faint mark over
              these, and the downloads stay clean.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/*
  ── K03 · LOGO FILES, AND K04 · THE RIDER ─────────────────────────────────

  One control for both, because the difference between them is only where the
  file ends up. A logo is public — a promoter is going to put it on a poster.
  A rider is SEALED: it says what an artist needs backstage and often where
  they will be, and it should be readable only through a live kit link.
*/
function FileDrop({ label, help, accept, folder, sealed, value, onChange, one }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [over, setOver] = useState(false);
  const input = useRef(null);

  const add = async (files) => {
    const list = [...files];
    if (!list.length) return;
    setError(""); setBusy(true);
    const made = [];
    for (const file of list.slice(0, one ? 1 : 12)) {
      const res = await api.uploadFile(file, { folder, sealed });
      if (!res.ok) { setError(res.error || `${file.name} did not upload.`); continue; }
      made.push({
        url: res.path, key: res.key, name: res.name || file.name,
        bytes: res.bytes || file.size, sealed: !!res.sealed,
        label: (file.name || "").replace(/\.[^.]+$/, "").slice(0, 40),
      });
    }
    setBusy(false);
    if (!made.length) return;
    onChange(one ? made[0] : [...(value || []), ...made]);
  };

  const items = one ? (value ? [value] : []) : (value || []);

  return (
    <div className="mt-5">
      <p className="m-0 mb-1" style={{ ...fontUtility, fontSize: "9px", letterSpacing: "0.18em", color: theme.brass }}>
        {label}
      </p>
      {help && (
        <p className="m-0 mb-2" style={{ ...fontText, fontSize: "14.5px", lineHeight: 1.5, color: theme.ink2 }}>
          {help}
        </p>
      )}

      <div
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); if (e.dataTransfer.files?.length) add(e.dataTransfer.files); }}
        className="px-4 py-4 text-center"
        style={{ border: `1px dashed ${over ? theme.ink : theme.rule}`,
                 background: over ? theme.sunk : "transparent" }}
      >
        <p className="m-0" style={{ ...fontUtility, fontSize: "9px", letterSpacing: "0.16em", color: theme.ink2 }}>
          {busy ? "UPLOADING…" : "DROP HERE"}
        </p>
        <div className="mt-2"><Btn onClick={() => input.current && input.current.click()}>CHOOSE</Btn></div>
        <input ref={input} type="file" accept={accept} multiple={!one} hidden
               onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
      </div>

      <Note>{error}</Note>

      {items.length > 0 && (
        <div className="mt-2" style={{ borderTop: `1px solid ${theme.rule}` }}>
          {items.map((f, i) => (
            <div key={i} className="flex items-center gap-3 py-2.5"
                 style={{ borderBottom: `1px solid ${theme.rule}` }}>
              <span style={{ ...fontUtility, fontSize: "8px", letterSpacing: "0.14em",
                             color: f.sealed ? theme.brass : theme.ink2, width: "52px", flex: "none" }}>
                {f.sealed ? "SEALED" : "PUBLIC"}
              </span>
              <span className="flex-1 min-w-0 truncate" style={{ ...fontText, fontSize: "16px", color: theme.ink }}>
                {f.name}
              </span>
              <span style={{ ...fontUtility, fontSize: "8px", letterSpacing: "0.1em", color: theme.ink2 }}>
                {f.bytes ? `${Math.max(1, Math.round(f.bytes / 1024))}KB` : ""}
              </span>
              <Btn danger onClick={() => onChange(one ? null : items.filter((_, j) => j !== i))}>×</Btn>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/*
  ── K07 · WHAT IS STILL MISSING ───────────────────────────────────────────

  Sending a promoter a kit with three empty sections is worse than sending
  them an email, and the only reason it happens is that the gaps are invisible
  from inside a form. Ten things, weighted by how much a promoter actually
  notices their absence — a kit with no photograph is not a kit, and a kit
  with no hospitality is merely incomplete.
*/
const CHECKLIST = [
  ["A photograph", (k) => (k.photos || []).length > 0],
  ["Every photograph credited", (k) => (k.photos || []).length > 0 && (k.photos || []).every((p) => p.credit)],
  ["The short biography", (k) => !!(k.bioShort || "").trim()],
  ["The long biography", (k) => !!(k.bioLong || "").trim()],
  ["A logo", (k) => (k.logos || []).length > 0],
  ["The rider", (k, x) => !!(k.rider || "").trim() || !!(x.riderFile)],
  ["Who to write to", (k) => !!(k.contact || "").trim()],
  ["Somewhere to listen", (k, x) => (x.listen || []).length > 0],
  ["Where they have played", (k, x) => (x.dates || []).length > 0],
  ["A live link to send", (k, x, links) => links.some((l) => !l.revoked)],
];

/* ══════════════════════════════════════════════════════════════════════════
   THE PANEL ITSELF
   ══════════════════════════════════════════════════════════════════════════ */

const EMPTY_KIT = {
  bioShort: "", bioLong: "", rider: "", hospitality: "", contact: "",
  photos: [], logos: [], links: [],
};
const EMPTY_EXTRA = {
  stagePlot: null, riderFile: null, dates: [], quotes: [], listen: [],
  video: "", territories: "",
};

export function Kits({ artists = [] }) {
  // Whether the page marks its previews is a setting, so it is read from the
  // same place the kit page reads it rather than passed down from a console
  // that has no other reason to know about it.
  const watermark = !!useSite().kitWatermark;
  const [id, setId] = useState(artists[0] ? String(artists[0].id) : "");
  const [kit, setKit] = useState(null);
  const [extra, setExtra] = useState(EMPTY_EXTRA);
  const [links, setLinks] = useState([]);
  const [msg, setMsg] = useState("");
  const [tone, setTone] = useState("bad");
  const [busy, setBusy] = useState(false);
  const [made, setMade] = useState("");
  const [opens, setOpens] = useState(null);
  const [word, setWord] = useState({});
  const [copyFrom, setCopyFrom] = useState("");
  const [preview, setPreview] = useState(false);
  const [killing, setKilling] = useState("");

  const say = (text, good) => { setTone(good ? "ok" : "bad"); setMsg(text); };

  const load = useCallback(() => {
    if (!id) return;
    setMade(""); setOpens(null);
    const arr = (v) => { try { return JSON.parse(v || "[]"); } catch { return []; } };
    api.readKit(id).then((res) => {
      if (!res.ok) { say(res.error || "Could not read that kit."); return; }
      const k = res.kit;
      setKit({
        bioShort: k?.bio_short || "", bioLong: k?.bio_long || "",
        rider: k?.rider || "", hospitality: k?.hospitality || "",
        contact: k?.contact || "",
        photos: arr(k?.photos), logos: arr(k?.logos), links: arr(k?.links),
      });
      setLinks(res.links || []);
    });
    api.readKitExtra(id).then((res) => {
      if (res.ok) setExtra({ ...EMPTY_EXTRA, ...(res.extra || {}) });
    });
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setBusy(true);
    const a = await api.saveKit(id, kit);
    const b = await api.saveKitExtra(id, extra);
    setBusy(false);
    say(a.ok && b.ok ? "Saved." : (a.error || b.error || "Could not save."), a.ok && b.ok);
  };

  const artist = artists.find((x) => String(x.id) === String(id));

  // ── links ───────────────────────────────────────────────────────────────
  const makeLink = async () => {
    const res = await api.makeShareLink("EPK", String(id), artist ? artist.name : "");
    if (!res.ok) { say(res.error || "Could not make a link."); return; }
    setMade(`${window.location.origin}/kit/${res.token}`);
    say(res.expires
      ? `Made. It stops working on ${new Date(res.expires).toLocaleDateString()}.`
      : "Made. It works until you revoke it.", true);
    load();
  };

  const kill = async (token) => {
    if (killing !== token) {
      setKilling(token);
      setTimeout(() => setKilling((t) => (t === token ? "" : t)), 4000);
      return;
    }
    setKilling("");
    await api.revokeShareLink(token);
    say("Revoked. Anyone holding it now gets nothing.", true);
    load();
  };

  const saveWord = async (token) => {
    const res = await api.setShareWord(token, word[token] || "");
    say(res.ok
      ? (word[token] ? "The link now asks for that word." : "The word is off — the link opens straight away.")
      : (res.error || "Could not set it."), res.ok);
  };

  const showOpens = async (token) => {
    const res = await api.kitOpens(token);
    if (res.ok) setOpens({ token, at: res.opens || [] });
  };

  // ── K06 · copy ──────────────────────────────────────────────────────────
  const doCopy = async () => {
    if (!copyFrom) return;
    const res = await api.copyKit(copyFrom, id);
    if (!res.ok) { say(res.error || "Could not copy."); return; }
    say(`Copied the ${res.copied.join(", ")}. The biography and the photographs were not — those belong to whoever earned them.`, true);
    setCopyFrom("");
    load();
  };

  // ── K07 · completeness ──────────────────────────────────────────────────
  const done = useMemo(() => {
    if (!kit) return { got: 0, missing: [] };
    const missing = CHECKLIST.filter(([, test]) => !test(kit, extra, links)).map(([name]) => name);
    return { got: CHECKLIST.length - missing.length, missing };
  }, [kit, extra, links]);

  if (!artists.length) return <Empty>No artists yet — add them under ARTISTS first.</Empty>;

  const live = links.filter((l) => !l.revoked);
  const set = (k, v) => setKit((s) => ({ ...s, [k]: v }));
  const setX = (k, v) => setExtra((s) => ({ ...s, [k]: v }));

  return (
    <div>
      <IndexBand items={[
        { label: "ARTIST", value: (artist?.name || "—").toUpperCase() },
        { label: "READY", value: `${done.got} / ${CHECKLIST.length}` },
        { label: "LIVE LINKS", value: String(live.length).padStart(2, "0") },
      ]} />

      <Note tone={tone}>{msg}</Note>

      <div className="mt-6">
        <Field label="Whose kit">
          <select value={id} onChange={(e) => setId(e.target.value)} style={{ ...inputStyle, width: "100%" }}>
            {artists.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </Field>
      </div>

      {/* ── K07 · what is missing ──────────────────────────────────────── */}
      {kit && (
        <div className="mt-5 px-4 py-4" style={{ background: theme.sunk, border: `1px solid ${theme.rule}` }}>
          <div style={{ height: "5px", background: theme.rule }}>
            <div style={{
              height: "100%", width: `${(done.got / CHECKLIST.length) * 100}%`,
              background: done.missing.length ? theme.warn : theme.good,
              transition: "width 300ms ease",
            }} />
          </div>
          <p className="m-0 mt-2.5" style={{ ...fontUtility, fontSize: "9px", letterSpacing: "0.14em",
             color: done.missing.length ? theme.ink2 : theme.good }}>
            {done.missing.length
              ? `${done.got} OF ${CHECKLIST.length} — MISSING: ${done.missing.join(" · ").toUpperCase()}`
              : "READY TO SEND"}
          </p>
        </div>
      )}

      {kit && (
        <>
          {/* ── K18, K20, K17 · the link ─────────────────────────────── */}
          <Head right={live.length ? `${links.reduce((n, l) => n + (l.uses || 0), 0)} OPENS` : null}>
            THE LINK YOU SEND
          </Head>
          <p className="m-0 mt-3" style={{ ...fontText, fontSize: "16px", lineHeight: 1.55, color: theme.ink2 }}>
            Make a second one if you want to know which of two promoters passed
            it on — each is counted separately, and either can be killed without
            touching the other.
          </p>

          {made && (
            <p className="m-0 mt-3 px-3 py-3" style={{
              ...fontUtility, fontSize: "12px", wordBreak: "break-all", color: theme.ink,
              background: theme.sunk, border: `1px solid ${theme.ink}` }}>{made}</p>
          )}

          <div className="mt-3"><Btn wide on onClick={makeLink}>MAKE A LINK</Btn></div>

          {links.length > 0 && (
            <div className="mt-4" style={{ borderTop: `1px solid ${theme.rule}` }}>
              {links.map((l) => (
                <div key={l.token} className="py-3" style={{ borderBottom: `1px solid ${theme.rule}`,
                     opacity: l.revoked ? 0.45 : 1 }}>
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="flex-1 min-w-0 truncate"
                          style={{ ...fontUtility, fontSize: "10px", color: theme.ink2 }}>
                      /kit/{l.token.slice(0, 12)}…
                    </span>
                    <span style={{ ...fontUtility, fontSize: "8.5px", letterSpacing: "0.14em", color: theme.brass }}>
                      {l.uses || 0} OPENS
                    </span>
                    {l.expires_at && (
                      <span style={{ ...fontUtility, fontSize: "8.5px", letterSpacing: "0.12em", color: theme.ink2 }}>
                        UNTIL {new Date(l.expires_at).toLocaleDateString()}
                      </span>
                    )}
                    {!l.revoked ? (
                      <>
                        <Btn onClick={() => showOpens(l.token)}>WHEN</Btn>
                        <Btn danger={killing === l.token} on={killing === l.token}
                             onClick={() => kill(l.token)}>
                          {killing === l.token ? "TAP AGAIN TO REVOKE" : "REVOKE"}
                        </Btn>
                      </>
                    ) : (
                      <span style={{ ...fontUtility, fontSize: "8.5px", letterSpacing: "0.14em", color: theme.bad }}>
                        DEAD
                      </span>
                    )}
                  </div>

                  {!l.revoked && (
                    <div className="flex items-end gap-2 mt-2.5 flex-wrap">
                      <div style={{ flex: "1 1 200px" }}>
                        <Field label="A word on the door (optional)">
                          <input value={word[l.token] ?? ""} maxLength={40}
                                 placeholder="Leave empty for no password"
                                 onChange={(e) => setWord((w) => ({ ...w, [l.token]: e.target.value }))}
                                 style={{ ...inputStyle, width: "100%" }} />
                        </Field>
                      </div>
                      <Btn onClick={() => saveWord(l.token)}>SET IT</Btn>
                    </div>
                  )}

                  {opens && opens.token === l.token && (
                    <div className="mt-3 px-3 py-2.5" style={{ background: theme.sunk, border: `1px solid ${theme.rule}` }}>
                      <p className="m-0 mb-1.5" style={{ ...fontUtility, fontSize: "8px",
                         letterSpacing: "0.16em", color: theme.brass }}>
                        OPENED {opens.at.length} TIME{opens.at.length === 1 ? "" : "S"} — TIMES ONLY, NEVER WHO
                      </p>
                      {opens.at.slice(0, 12).map((t, i) => (
                        <p key={i} className="m-0" style={{ ...fontUtility, fontSize: "10px", color: theme.ink2 }}>
                          {new Date(t).toLocaleString()}
                        </p>
                      ))}
                      {opens.at.length === 0 && (
                        <p className="m-0" style={{ ...fontText, fontSize: "15px", color: theme.ink2 }}>
                          Nobody has opened it yet.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ── K01, K02 ──────────────────────────────────────────────── */}
          <PhotoGrid photos={kit.photos} folder="kits" watermark={watermark}
                     onChange={(v) => set("photos", v)} />

          {/* ── the words ─────────────────────────────────────────────── */}
          <Head>THE WORDS</Head>
          <div className="mt-3">
            <Field label="Short biography — for a flyer, about forty words">
              <textarea rows={3} value={kit.bioShort} maxLength={600}
                        onChange={(e) => set("bioShort", e.target.value)}
                        style={{ ...inputStyle, width: "100%", resize: "vertical", lineHeight: 1.5 }} />
            </Field>
          </div>
          <div className="mt-4">
            <Field label="Long biography — for a programme">
              <textarea rows={7} value={kit.bioLong} maxLength={3000}
                        onChange={(e) => set("bioLong", e.target.value)}
                        style={{ ...inputStyle, width: "100%", resize: "vertical", lineHeight: 1.55 }} />
            </Field>
          </div>

          {/* ── K03, K04, K09 ─────────────────────────────────────────── */}
          <Head>FILES</Head>
          <FileDrop label="LOGOS" folder="logos"
                    accept=".png,.zip,.pdf,.eps,.ai,image/png,application/zip,application/pdf,application/postscript"
                    value={kit.logos} onChange={(v) => set("logos", v)}
                    help="PNG for the web, and the vector inside a ZIP for print. An SVG on its own is refused on purpose — it is the one file type that can carry code, and served from this domain it would run as you." />

          <FileDrop label="THE RIDER, AS A FILE" folder="riders" sealed one
                    accept=".pdf,application/pdf"
                    value={extra.riderFile} onChange={(v) => setX("riderFile", v)}
                    help="Sealed: readable only through a live kit link, and unreadable the moment that link is revoked. Type it below as well — the production manager prints the PDF, the promoter reads the text on a phone." />

          <div className="mt-4">
            <Field label="The rider, as text">
              <textarea rows={7} value={kit.rider} maxLength={4000}
                        placeholder={"2 × CDJ-3000 — linked\n1 × DJM-A9\nBooth monitor on its own send"}
                        onChange={(e) => set("rider", e.target.value)}
                        style={{ ...inputStyle, width: "100%", resize: "vertical", lineHeight: 1.6 }} />
            </Field>
          </div>
          <div className="mt-4">
            <Field label="Hospitality">
              <textarea rows={4} value={kit.hospitality} maxLength={2000}
                        onChange={(e) => set("hospitality", e.target.value)}
                        style={{ ...inputStyle, width: "100%", resize: "vertical", lineHeight: 1.55 }} />
            </Field>
          </div>

          <FileDrop label="STAGE PLOT" folder="riders" sealed one
                    accept="image/*,.pdf,application/pdf"
                    value={extra.stagePlot} onChange={(v) => setX("stagePlot", v)}
                    help="A drawing of what goes where. For a live act this is the document that decides whether load-in goes well." />

          {/* ── K10, K11, K12, K13, K14 ───────────────────────────────── */}
          <Rows label="WHERE THEY HAVE PLAYED" hint="The section a promoter reads first, and the one that decides the fee."
                value={extra.dates} onChange={(v) => setX("dates", v)} max={40}
                blank={{ venue: "", city: "", year: "" }}
                fields={[["venue", "Venue"], ["city", "City"], ["year", "Year"]]} />

          <Rows label="WHAT PEOPLE HAVE SAID" hint="Real ones only. A made-up quote in a press kit gets found out, and it gets found out by the one promoter you most wanted."
                value={extra.quotes} onChange={(v) => setX("quotes", v)} max={20}
                blank={{ text: "", who: "", where: "" }}
                fields={[["text", "The quote"], ["who", "Who said it"], ["where", "Where"]]} />

          <Rows label="SOMEWHERE TO LISTEN" hint="Embedded on the page, so they can hear it without leaving the page they are deciding on."
                value={extra.listen} onChange={(v) => setX("listen", v)} max={6}
                blank={{ label: "", url: "" }}
                fields={[["label", "Label"], ["url", "SoundCloud or Spotify address"]]} />

          <div className="mt-5">
            <Field label="A showreel — one YouTube or Vimeo address">
              <input value={extra.video || ""} maxLength={500}
                     onChange={(e) => setX("video", e.target.value)}
                     style={{ ...inputStyle, width: "100%" }} />
            </Field>
          </div>

          <Head>WHO TO WRITE TO</Head>
          <div className="mt-3">
            <Field label="Booking contact for this artist">
              <input value={kit.contact} maxLength={200}
                     onChange={(e) => set("contact", e.target.value)}
                     style={{ ...inputStyle, width: "100%" }} />
            </Field>
          </div>
          <div className="mt-4">
            <Field label="Territories that contact covers">
              <input value={extra.territories || ""} maxLength={300}
                     placeholder="Worldwide except Romania"
                     onChange={(e) => setX("territories", e.target.value)}
                     style={{ ...inputStyle, width: "100%" }} />
            </Field>
          </div>

          {/* ── K06 · copy from another ───────────────────────────────── */}
          <Head>START FROM SOMEBODY ELSE'S</Head>
          <p className="m-0 mt-3" style={{ ...fontText, fontSize: "16px", lineHeight: 1.55, color: theme.ink2 }}>
            The rider, the hospitality, the contact and the logos are copied.
            The biography and the photographs never are — a kit that silently
            arrives holding another artist's biography is how the wrong name
            ends up on a poster.
          </p>
          <div className="flex items-end gap-2 mt-3 flex-wrap">
            <div style={{ flex: "1 1 220px" }}>
              <Field label="Copy from">
                <select value={copyFrom} onChange={(e) => setCopyFrom(e.target.value)}
                        style={{ ...inputStyle, width: "100%" }}>
                  <option value="">Choose an artist</option>
                  {artists.filter((a) => String(a.id) !== String(id))
                    .map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </Field>
            </div>
            <Btn onClick={doCopy} disabled={!copyFrom}>COPY IT IN</Btn>
          </div>

          {/* ── save, and K05 · see it as they will ───────────────────── */}
          <div className="flex flex-wrap gap-2 mt-8">
            <Btn wide on onClick={save} disabled={busy}>{busy ? "SAVING…" : "SAVE THE KIT"}</Btn>
            {live[0] && (
              <Btn onClick={() => setPreview((p) => !p)}>
                {preview ? "HIDE THE PREVIEW" : "SEE IT AS THEY WILL"}
              </Btn>
            )}
          </div>

          {/*
            ── K05 · THE KIT, AS THE PROMOTER GETS IT ──────────────────────

            The real page in a frame, not a reproduction — a mock-up would
            drift from the thing it is mocking within a month. It loads a live
            link, so what is shown is exactly what is sent, including anything
            you have not saved yet being absent. That is the useful truth.
          */}
          {preview && live[0] && (
            <div className="mt-4">
              <p className="m-0 mb-2" style={{ ...fontUtility, fontSize: "8.5px",
                 letterSpacing: "0.16em", color: theme.ink2 }}>
                THE REAL PAGE — SAVE FIRST, OR CHANGES WILL NOT BE IN IT
              </p>
              <iframe
                title="The kit as a promoter sees it"
                src={`/kit/${live[0].token}`}
                style={{ width: "100%", height: "620px", border: `1px solid ${theme.ink}`,
                         background: theme.bg }}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}

/*
  A list of small records, edited in place. Used for the dates, the quotes and
  the players — three sections that are the same shape and would otherwise be
  three nearly-identical blocks of markup drifting apart.
*/
function Rows({ label, hint, value = [], onChange, fields, blank, max = 20 }) {
  const set = (i, k, v) => onChange(value.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  const move = (i, by) => {
    const next = [...value];
    const j = i + by;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  return (
    <div className="mt-6">
      <p className="m-0 mb-1" style={{ ...fontUtility, fontSize: "9px", letterSpacing: "0.18em", color: theme.brass }}>
        {label}
      </p>
      {hint && (
        <p className="m-0 mb-2" style={{ ...fontText, fontSize: "14.5px", lineHeight: 1.5, color: theme.ink2 }}>
          {hint}
        </p>
      )}

      {value.map((row, i) => (
        <div key={i} className="flex gap-2 items-start py-2"
             style={{ borderBottom: `1px solid ${theme.rule}` }}>
          <span style={{ ...fontUtility, fontSize: "9px", color: theme.brass, paddingTop: "11px",
                         width: "22px", flex: "none", fontVariantNumeric: "tabular-nums" }}>
            {String(i + 1).padStart(2, "0")}
          </span>
          <div className="flex-1 grid gap-2"
               style={{ gridTemplateColumns: `repeat(auto-fit,minmax(${fields.length > 2 ? 110 : 160}px,1fr))` }}>
            {fields.map(([key, place]) => (
              <input key={key} placeholder={place} value={row[key] || ""}
                     onChange={(e) => set(i, key, e.target.value)} style={inputStyle} />
            ))}
          </div>
          <div className="flex flex-col gap-1" style={{ paddingTop: "3px" }}>
            <Btn onClick={() => move(i, -1)} aria-label="Move up">↑</Btn>
            <Btn onClick={() => move(i, 1)} aria-label="Move down">↓</Btn>
            <Btn danger onClick={() => onChange(value.filter((_, j) => j !== i))} aria-label="Remove">×</Btn>
          </div>
        </div>
      ))}

      {value.length < max && (
        <div className="mt-2">
          <Btn onClick={() => onChange([...value, { ...blank }])}>ADD ONE</Btn>
        </div>
      )}
    </div>
  );
}
