import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { IndexBand, fontDisplay, fontUtility, fontText, theme, inputStyle }
  from "../components/Shared";
import * as api from "../lib/api";
import Blocks from "../components/Blocks";
import BlockEditor from "../components/BlockEditor";
import { SLOTS } from "../lib/pages";

/*
  ══ THE STUDIO ══════════════════════════════════════════════════════════════

  One door onto everything the site holds: pick a kind, pick a record, change
  it, watch it change, publish when it is right.

  ── WHAT MAKES THIS DIFFERENT FROM THE EDITORS IT SITS BESIDE ─────────────

  Those write straight to the live record. Every keystroke is on the site, and
  the only way to see what you have done is to save it and go and look — which
  means the first person to read your half-written sentence is a visitor.

  Here, editing writes to a DRAFT. The live record is untouched until you press
  publish, the draft survives closing the laptop, the rest of the team can see
  it, and it has a link you can send to somebody with no login at all.

  ── TWO PREVIEWS, AND WHY BOTH ───────────────────────────────────────────

  INLINE is a small rendering of the record, updating as you type. It is
  instant, and it is a SECOND composition of the page — over months it will
  quietly stop matching the site, which is the failure mode of every preview
  that lies. So it is deliberately kept to a card: enough to see a photograph
  is missing or a name is too long, and not enough to be mistaken for the page.

  THE REAL PAGE is the actual route in a frame, with the draft laid over the
  live data by lib/preview. It cannot drift, because it is not a copy — it is
  the site. It costs a save and a reload, which is why it is a button rather
  than something that happens on every keystroke.

  The honest division of labour: the fast one for writing, the true one for
  deciding.
*/

/* ── what can be edited, and how each field behaves ───────────────────────── */

const KINDS = {
  artists: {
    label: "ARTISTS", key: "id", route: (r) => `/artists/${r.id}`,
    title: (r) => r.name || "Untitled",
    blank: { id: "", name: "", alias: "", type: "DJ", genres: [], country: "", location: "",
             descr: "", bio: "", photo: "", poster: "", instagram: "", sort_order: 0, published: false },
    fields: [
      { k: "name", label: "Name" },
      { k: "alias", label: "Also known as" },
      { k: "type", label: "Type", options: ["DJ", "Producer", "Live Act"] },
      { k: "genres", label: "Genres", list: true },
      { k: "country", label: "Country" },
      { k: "location", label: "Location" },
      { k: "descr", label: "One line for the roster" },
      { k: "bio", label: "Biography", long: true },
      { k: "instagram", label: "Instagram key" },
      { k: "photo", label: "Photograph", image: true },
      { k: "poster", label: "Poster", image: true },
      { k: "sort_order", label: "Order", number: true },
    ],
  },
  records: {
    label: "RECORDS", key: "slug", route: () => "/records",
    title: (r) => r.title || "Untitled",
    blank: { slug: "", title: "", artist: "", kind: "SINGLE", tagline: "", catalog: "",
             release_date: "", cover: "", playlist: "", note: "", tracks: [], sort_order: 0, published: false },
    fields: [
      { k: "title", label: "Title" },
      { k: "artist", label: "Artist" },
      { k: "kind", label: "Kind", options: ["ALBUM", "EP", "SINGLE"] },
      { k: "tagline", label: "Tagline" },
      { k: "catalog", label: "Catalogue number" },
      { k: "release_date", label: "Release date" },
      { k: "playlist", label: "Playlist link" },
      { k: "note", label: "Note", long: true },
      { k: "cover", label: "Cover", image: true },
      { k: "sort_order", label: "Order", number: true },
    ],
  },
  /*
    ── PAGES BUILT HERE ────────────────────────────────────────────────────

    `blocks: true` is what tells the editor below to show the block arranger
    instead of a list of fields, and to preview through <Blocks> rather than
    through the card. Everything else — drafts, the preview token, publishing
    — is unchanged, because the worker treats a page as one more content kind.
  */
  pages: {
    label: "PAGES", key: "slug", route: (r) => `/${r.slug}`, blocks: true,
    title: (r) => r.title || "Untitled",
    blank: { slug: "", title: "", kicker: "", sub: "", blocks: [], in_nav: false,
             nav_label: "", seo_description: "", sort_order: 0, published: false },
    fields: [
      { k: "title", label: "Title" },
      { k: "slug", label: "Address", help: "The page lives at /this. Letters, numbers and hyphens." },
      { k: "kicker", label: "The small line above the title" },
      { k: "sub", label: "The line under it" },
      { k: "seo_description", label: "Description for search engines", long: true },
      { k: "nav_label", label: "Label in the bar", help: "Only used when it is in the bar. Keep it short." },
      { k: "sort_order", label: "Order", number: true },
    ],
  },
  /*
    ── BLOCKS ON THE PAGES THAT ALREADY EXIST ──────────────────────────────

    Not new pages: named seams in the hand-built ones. Chosen from a list
    rather than typed, because a slot that does not exist in any page is a
    slot whose contents nobody will ever see, and the person who typed it
    would have no way of finding that out.
  */
  slots: {
    label: "ON EXISTING PAGES", key: "id", route: (r) => `/${String(r.id || "").split(":")[0].replace(/^home$/, "")}`,
    blocks: true, slot: true,
    title: (r) => {
      const found = SLOTS.find((x) => x.id === r.id);
      return found ? `${found.page} — ${found.label}` : (r.id || "A place");
    },
    blank: { id: "", blocks: [], sort_order: 0, published: false },
    fields: [],
  },
  mixes: {
    label: "SESSIONS", key: "slug", route: (r) => `/mixes/${r.slug}`,
    title: (r) => r.name || "Untitled",
    blank: { slug: "", artist_id: "", name: "", alias: "", photo: "", genres: [], intro: "",
             coming_soon: false, coming_soon_note: "", sections: [], sort_order: 0, published: false },
    fields: [
      { k: "name", label: "Name" },
      { k: "alias", label: "Also known as" },
      { k: "genres", label: "Genres", list: true },
      { k: "intro", label: "Intro", long: true },
      { k: "coming_soon_note", label: "Coming-soon note" },
      { k: "photo", label: "Photograph", image: true },
      { k: "sort_order", label: "Order", number: true },
    ],
  },
};

const KIND_LIST = Object.keys(KINDS);

/*
  A key made from the title, for a record that has none yet.

  Kept to letters, digits and hyphens because it becomes a URL, and trimmed of
  leading and trailing hyphens because "—the-night—" is not a slug, it is a
  slug with punctuation in it.
*/
const slugify = (s) => String(s || "").toLowerCase().trim()
  .replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-")
  .replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 50);

/* ── small pieces ─────────────────────────────────────────────────────────── */

const Btn = ({ on, wide, danger, children, ...rest }) => (
  <button {...rest} style={{
    ...fontUtility, fontSize: "9px", letterSpacing: "0.16em",
    cursor: rest.disabled ? "default" : "pointer",
    padding: wide ? "11px 20px" : "8px 12px",
    color: on ? theme.onInk : danger ? theme.bad : theme.ink,
    background: on ? (danger ? theme.bad : theme.ink) : "transparent",
    border: `1px solid ${danger ? theme.bad : on ? theme.ink : theme.rule}`,
    opacity: rest.disabled ? 0.45 : 1,
    ...(rest.style || {}),
  }}>{children}</button>
);

/*
  Declared out here, not inside the editor, for the reason the console learned
  once already: a component defined in a render is a new type every render, so
  React unmounts and remounts it — and a remounted text field loses focus after
  every keystroke.
*/
const Field = ({ field, value, onChange }) => {
  const common = { ...inputStyle, width: "100%" };
  return (
    <div className="py-2.5" style={{ borderBottom: `1px solid ${theme.rule}` }}>
      <p className="m-0 mb-1.5" style={{ ...fontUtility, fontSize: "8px",
                                         letterSpacing: "0.16em", color: theme.ink2 }}>
        {field.label.toUpperCase()}
      </p>

      {field.options ? (
        <div className="flex flex-wrap" style={{ gap: "5px" }}>
          {field.options.map((o) => (
            <Btn key={o} on={value === o} onClick={() => onChange(o)}>{o}</Btn>
          ))}
        </div>
      ) : field.long ? (
        <textarea value={value || ""} rows={5}
                  onChange={(e) => onChange(e.target.value)}
                  style={{ ...common, resize: "vertical", lineHeight: 1.5 }} />
      ) : field.list ? (
        <input value={Array.isArray(value) ? value.join(", ") : value || ""}
               placeholder="comma separated"
               onChange={(e) => onChange(e.target.value.split(",").map((x) => x.trim()).filter(Boolean))}
               style={common} />
      ) : field.number ? (
        <input type="number" value={value ?? 0}
               onChange={(e) => onChange(Number(e.target.value) || 0)}
               style={{ ...common, width: "110px" }} />
      ) : (
        <input value={value || ""} onChange={(e) => onChange(e.target.value)}
               placeholder={field.image ? "a path or a full URL" : undefined}
               style={common} />
      )}
    </div>
  );
};

/*
  The fast preview. A CARD, on purpose — see the note at the top of the file:
  it is a second composition of the page, so it is kept small enough that
  nobody mistakes it for the page, and useful enough to catch the things you
  catch by looking rather than by reading.
*/
function Card({ kind, record }) {
  const def = KINDS[kind];
  const img = record.photo || record.cover;
  return (
    <div style={{ border: `1px solid ${theme.rule}`, background: theme.bg }}>
      <div style={{
        width: "100%", aspectRatio: "4 / 5",
        background: img ? `center/cover no-repeat url(${img})` : theme.sunk,
        borderBottom: `1px solid ${theme.rule}`,
      }} aria-hidden="true">
        {!img && (
          <p className="m-0 h-full flex items-center justify-center text-center px-4"
             style={{ ...fontUtility, fontSize: "8px", letterSpacing: "0.16em", color: theme.ink2 }}>
            NO PHOTOGRAPH YET
          </p>
        )}
      </div>
      <div className="p-3.5">
        <p className="m-0" style={{ ...fontUtility, fontSize: "7.5px", letterSpacing: "0.2em",
                                    color: theme.brass }}>
          {[record.type, record.kind, record.country].filter(Boolean).join(" · ").toUpperCase() || def.label}
        </p>
        <p className="m-0 mt-1.5" style={{ ...fontDisplay, fontSize: "23px", lineHeight: 1.05,
                                           letterSpacing: "-0.01em", color: theme.ink }}>
          {def.title(record)}
        </p>
        {record.alias && (
          <p className="m-0 mt-0.5" style={{ ...fontText, fontSize: "14px", fontStyle: "italic",
                                             color: theme.ink2 }}>{record.alias}</p>
        )}
        {(record.descr || record.tagline) && (
          <p className="m-0 mt-2" style={{ ...fontText, fontSize: "14.5px", lineHeight: 1.5,
                                           color: theme.ink2 }}>
            {record.descr || record.tagline}
          </p>
        )}
        {Array.isArray(record.genres) && record.genres.length > 0 && (
          <p className="m-0 mt-2.5 flex flex-wrap" style={{ gap: "5px" }}>
            {record.genres.map((g) => (
              <span key={g} style={{ ...fontUtility, fontSize: "6.5px", letterSpacing: "0.14em",
                                     border: `1px solid ${theme.rule}`, padding: "3px 6px",
                                     color: theme.ink2 }}>
                {String(g).toUpperCase()}
              </span>
            ))}
          </p>
        )}
      </div>
    </div>
  );
}

/* ── the desk ─────────────────────────────────────────────────────────────── */

export default function Studio() {
  const [kind, setKind] = useState("artists");
  const [rows, setRows] = useState([]);
  const [drafts, setDrafts] = useState([]);
  const [ref, setRef] = useState(null);          // which record is open
  const [form, setForm] = useState(null);
  const [token, setToken] = useState(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const [msg, setMsg] = useState("");
  const [tone, setTone] = useState("bad");
  const [showReal, setShowReal] = useState(false);
  const [frameKey, setFrameKey] = useState(0);
  const [arming, setArming] = useState(false);

  const def = KINDS[kind];

  const loadRows = useCallback(() => {
    api.listContent(kind).then((res) => { if (res.ok) setRows(res.items || []); });
  }, [kind]);

  const loadDrafts = useCallback(() => {
    api.listDrafts().then((res) => { if (res.ok) setDrafts(res.drafts || []); });
  }, []);

  useEffect(() => { loadRows(); }, [loadRows]);
  useEffect(() => { loadDrafts(); }, [loadDrafts]);
  useEffect(() => { setRef(null); setForm(null); setToken(null); setShowReal(false); }, [kind]);

  const draftFor = (k, r) => drafts.find((d) => d.kind === k && String(d.ref) === String(r));

  /*
    Opening a record prefers its DRAFT over the live row. Anything else means
    coming back to work you saved and being shown the old version, which is
    the single most alarming thing an editor can do.
  */
  const open = async (record) => {
    const key = record ? String(record[def.key]) : `new-${Date.now().toString(36)}`;
    setMsg(""); setShowReal(false);
    const existing = await api.readDraft(kind, key);
    if (existing.ok && existing.draft) {
      setForm({ ...def.blank, ...(record || {}), ...existing.draft.data });
      setToken(existing.draft.token);
    } else {
      setForm({ ...def.blank, ...(record || {}) });
      setToken(null);
    }
    setRef(key);
  };

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  /*
    AUTOSAVE, DEBOUNCED.

    Saving on every keystroke would be a request per character; saving only on
    a button would mean a closed laptop loses the work, which is the thing
    server-side drafts exist to prevent. A second of quiet is the compromise,
    and the state below says plainly which of the three it is in — because an
    editor that claims to autosave and does not say when is an editor you
    cannot trust with anything long.
  */
  const timer = useRef(null);
  const dirty = useRef(false);
  useEffect(() => {
    if (!form || !ref) return undefined;
    dirty.current = true;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setSaving(true);
      const payload = { ...form };
      // A record with no key cannot be published later, and the moment to
      // give it one is while the title is fresh rather than at the end.
      if (!payload[def.key]) {
        /*
          A slot's key is the place it goes, which is chosen from a list — it
          can never be invented from a title, and inventing one would create a
          slot no page renders.
        */
        if (!def.slot) {
          payload[def.key] = def.key === "slug"
            ? slugify(def.title(payload))
            : String(Math.max(0, ...rows.map((r) => Number(r.id) || 0)) + 1);
        }
      }
      const res = await api.saveDraft(kind, ref, payload);
      setSaving(false);
      if (res.ok) {
        dirty.current = false;
        setToken(res.token);
        setSavedAt(new Date());
        loadDrafts();
      } else {
        setMsg(res.error || "Couldn't keep that draft."); setTone("bad");
      }
    }, 1000);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [form, ref, kind, def.key, rows, loadDrafts]);

  const publish = async () => {
    setMsg("");
    if (!form[def.key] && !slugify(def.title(form))) {
      setMsg(`Give it a ${def.key === "slug" ? "title" : "name"} first.`); setTone("bad"); return;
    }
    const res = await api.publishDraft(kind, ref);
    if (!res.ok) { setMsg(res.error || "Couldn't publish that."); setTone("bad"); return;}
    setMsg(res.created ? "Published — it is on the site now." : "Published — the change is live.");
    setTone("good");
    setRef(null); setForm(null); setToken(null); setShowReal(false);
    loadRows(); loadDrafts();
  };

  const discard = async () => {
    await api.discardDraft(kind, ref);
    setRef(null); setForm(null); setToken(null); setShowReal(false);
    setMsg("Draft discarded. The live record is untouched."); setTone("good");
    loadDrafts();
  };

  useEffect(() => {
    if (!arming) return undefined;
    const t = setTimeout(() => setArming(false), 4000);
    return () => clearTimeout(t);
  }, [arming]);

  // The real page needs the draft ON THE SERVER before it can show it, so the
  // frame is only offered once a token exists.
  const previewUrl = useMemo(() => {
    if (!token || !form) return null;
    return `${def.route(form)}?preview=${encodeURIComponent(token)}`;
  }, [token, form, def]);

  const state = saving ? "SAVING…"
    : dirty.current ? "UNSAVED"
    : savedAt ? `KEPT ${savedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
    : "";

  return (
    <>
      <IndexBand items={[
        { label: "EDITING", value: def.label },
        { label: "RECORDS", value: String(rows.length).padStart(2, "0") },
        { label: "DRAFTS", value: String(drafts.filter((d) => d.kind === kind).length).padStart(2, "0") },
        { label: "STATE", value: state || "READY" },
      ]} />

      <section className="mb-10">
        <div className="flex items-baseline gap-3" style={{ borderBottom: `1px solid ${theme.ink}`, paddingBottom: "7px" }}>
          <h2 className="m-0" style={{ ...fontUtility, fontSize: "11px", letterSpacing: "0.2em", fontWeight: 700 }}>
            THE STUDIO
          </h2>
          <span className="flex-1 text-right" style={{ ...fontUtility, fontSize: "9px",
                letterSpacing: "0.16em", color: theme.ink2 }}>
            {drafts.length ? `${drafts.length} DRAFT${drafts.length === 1 ? "" : "S"} IN HAND` : ""}
          </span>
        </div>

        <p className="m-0 mt-4 mb-4" style={{ ...fontText, fontSize: "15px", lineHeight: 1.55, color: theme.ink2 }}>
          Everything the site holds, in one place. Changes here are kept as a
          draft — the live record is untouched until you publish, the work
          survives closing this window, and each draft has a link you can send
          to somebody who has no login at all.
        </p>

        <div className="flex flex-wrap mb-5" style={{ gap: "5px" }}>
          {KIND_LIST.map((k) => (
            <Btn key={k} on={kind === k} onClick={() => setKind(k)}>{KINDS[k].label}</Btn>
          ))}
        </div>

        {msg && (
          <p className="m-0 mb-4 px-3 py-2.5" style={{
            ...fontText, fontSize: "15px", lineHeight: 1.5,
            color: tone === "bad" ? theme.bad : theme.ink,
            border: `1px solid ${tone === "bad" ? theme.badLine : theme.rule}`,
            background: tone === "bad" ? "transparent" : theme.sunk,
          }}>{msg}</p>
        )}

        {/* ── nothing open: the list ── */}
        {!form && (
          <>
            <Btn wide on onClick={() => open(null)} style={{ marginBottom: "14px" }}>
              START A NEW {def.label.replace(/S$/, "")}
            </Btn>

            {rows.map((r) => {
              const d = draftFor(kind, String(r[def.key]));
              return (
                <button key={r[def.key]} onClick={() => open(r)}
                        className="w-full text-left flex items-center gap-3 py-3"
                        style={{ borderBottom: `1px solid ${theme.rule}`, background: "transparent",
                                 border: "none", borderBottomWidth: "1px", borderBottomStyle: "solid",
                                 cursor: "pointer" }}>
                  <span className="shrink-0" style={{
                    width: "38px", height: "38px", border: `1px solid ${theme.rule}`,
                    background: (r.photo || r.cover)
                      ? `center/cover no-repeat url(${r.photo || r.cover})` : theme.sunk,
                  }} aria-hidden="true" />
                  <span className="flex-1" style={{ minWidth: 0 }}>
                    <span className="block" style={{ ...fontText, fontSize: "16px", color: theme.ink }}>
                      {def.title(r)}
                    </span>
                    <span className="block" style={{ ...fontUtility, fontSize: "8px",
                          letterSpacing: "0.14em", color: theme.ink2 }}>
                      {r[def.key]}
                      {!r.published && " · HIDDEN"}
                    </span>
                  </span>
                  {d && (
                    <span style={{ ...fontUtility, fontSize: "8px", letterSpacing: "0.16em",
                                   color: theme.brass }}>
                      DRAFT
                    </span>
                  )}
                </button>
              );
            })}

            {/* Drafts for records that do not exist yet have nowhere else to
                appear, and a draft you cannot find again is a draft you lost. */}
            {drafts.filter((d) => d.kind === kind && String(d.ref).startsWith("new-")).map((d) => (
              <button key={d.ref} onClick={async () => {
                        const got = await api.readDraft(kind, d.ref);
                        if (got.ok && got.draft) {
                          setForm({ ...def.blank, ...got.draft.data });
                          setToken(got.draft.token); setRef(d.ref); setShowReal(false);
                        }
                      }}
                      className="w-full text-left flex items-center gap-3 py-3"
                      style={{ borderBottom: `1px solid ${theme.rule}`, background: "transparent",
                               border: "none", borderBottomWidth: "1px", borderBottomStyle: "solid",
                               cursor: "pointer" }}>
                <span className="shrink-0" style={{ width: "38px", height: "38px",
                      border: `1px dashed ${theme.rule}`, background: "transparent" }} aria-hidden="true" />
                <span className="flex-1" style={{ ...fontText, fontSize: "16px", color: theme.ink2 }}>
                  Unfinished — never published
                </span>
                <span style={{ ...fontUtility, fontSize: "8px", letterSpacing: "0.16em", color: theme.brass }}>
                  DRAFT
                </span>
              </button>
            ))}
          </>
        )}

        {/* ── something open: the form, and the two previews ── */}
        {form && (
          <div className="flex flex-wrap" style={{ gap: "26px" }}>
            <div style={{ flex: "1 1 340px", minWidth: "300px" }}>
              <div className="flex flex-wrap items-center mb-3" style={{ gap: "6px" }}>
                <Btn onClick={() => { setRef(null); setForm(null); setShowReal(false); }}>← ALL {def.label}</Btn>
                <span className="flex-1" />
                <span style={{ ...fontUtility, fontSize: "8px", letterSpacing: "0.16em",
                               color: saving ? theme.brass : theme.ink2 }}>
                  {state}
                </span>
              </div>

              {def.slot && (
                <div className="py-2.5" style={{ borderBottom: `1px solid ${theme.rule}` }}>
                  <p className="m-0 mb-1.5" style={{ ...fontUtility, fontSize: "8px",
                        letterSpacing: "0.16em", color: theme.ink2 }}>
                    WHICH PLACE
                  </p>
                  <div className="flex flex-wrap" style={{ gap: "5px" }}>
                    {SLOTS.map((sl) => (
                      <Btn key={sl.id} on={form.id === sl.id} onClick={() => set("id", sl.id)}>
                        {`${sl.page.toUpperCase()} · ${sl.label.toUpperCase()}`}
                      </Btn>
                    ))}
                  </div>
                </div>
              )}

              {def.fields.map((f) => (
                <Field key={f.k} field={f} value={form[f.k]} onChange={(v) => set(f.k, v)} />
              ))}

              {def.blocks && (
                <div className="mt-5">
                  <p className="m-0 mb-2" style={{ ...fontUtility, fontSize: "8.5px",
                        letterSpacing: "0.2em", color: theme.brass,
                        borderBottom: `1px solid ${theme.rule}`, paddingBottom: "6px" }}>
                    WHAT IS ON IT
                  </p>
                  <BlockEditor blocks={form.blocks} onChange={(v) => set("blocks", v)} />
                </div>
              )}

              {def.label === "PAGES" && (
                <label className="flex items-start gap-3 py-3" style={{ cursor: "pointer" }}>
                  <input type="checkbox" checked={!!form.in_nav} style={{ marginTop: "4px" }}
                         onChange={(e) => set("in_nav", e.target.checked)} />
                  <span>
                    <span className="block" style={{ ...fontText, fontSize: "16px", color: theme.ink }}>
                      Give it a tab in the floating bar
                    </span>
                    <span className="block mt-1" style={{ ...fontText, fontSize: "14px",
                          lineHeight: 1.5, color: theme.ink2 }}>
                      That bar is the site's navigation — the masthead carries
                      the wordmark and nothing else — so this is what makes a
                      page findable rather than only linkable. Off means it
                      exists at its address for people you send it to. Four
                      pages at most, and they sit before the pass and the
                      console so those can never be pushed off the end.
                    </span>
                  </span>
                </label>
              )}

              <label className="flex items-start gap-3 py-3" style={{ cursor: "pointer" }}>
                <input type="checkbox" checked={!!form.published} style={{ marginTop: "4px" }}
                       onChange={(e) => set("published", e.target.checked)} />
                <span>
                  <span className="block" style={{ ...fontText, fontSize: "16px", color: theme.ink }}>
                    Visible on the site once published
                  </span>
                  <span className="block mt-1" style={{ ...fontText, fontSize: "14px",
                        lineHeight: 1.5, color: theme.ink2 }}>
                    Off means it exists but nobody outside the team can see it —
                    useful for something finished that is waiting for a date.
                    This is separate from the draft: the draft is the change,
                    this is whether the record shows at all.
                  </span>
                </span>
              </label>

              <div className="flex flex-wrap items-center mt-4" style={{ gap: "6px" }}>
                <Btn wide on onClick={publish} disabled={saving}>PUBLISH</Btn>
                <Btn danger onClick={() => { if (arming) discard(); else setArming(true); }}>
                  {arming ? "PRESS AGAIN — THE DRAFT GOES" : "DISCARD THE DRAFT"}
                </Btn>
              </div>

              {token && (
                <div className="mt-4 p-3" style={{ border: `1px solid ${theme.rule}`, background: theme.sunk }}>
                  <p className="m-0" style={{ ...fontUtility, fontSize: "8px",
                        letterSpacing: "0.16em", color: theme.brass }}>
                    A LINK FOR SOMEBODY WITHOUT A LOGIN
                  </p>
                  <p className="m-0 mt-1.5 break-all" style={{ ...fontText, fontSize: "13.5px",
                        lineHeight: 1.45, color: theme.ink2 }}>
                    {typeof window !== "undefined" ? window.location.origin : ""}{previewUrl}
                  </p>
                  <p className="m-0 mt-2" style={{ ...fontText, fontSize: "13.5px",
                        lineHeight: 1.5, color: theme.ink2 }}>
                    It shows this draft on the real page and nothing else, and it
                    stops working the moment you publish or discard.
                  </p>
                </div>
              )}
            </div>

            <div style={{ flex: "1 1 300px", minWidth: "280px" }}>
              <div className="flex flex-wrap items-center mb-2.5" style={{ gap: "5px" }}>
                <Btn on={!showReal} onClick={() => setShowReal(false)}>AS A CARD</Btn>
                <Btn on={showReal} disabled={!token}
                     onClick={() => { setShowReal(true); setFrameKey((n) => n + 1); }}>
                  THE REAL PAGE
                </Btn>
                {showReal && (
                  <Btn onClick={() => setFrameKey((n) => n + 1)}>REFRESH</Btn>
                )}
              </div>

              {showReal && previewUrl ? (
                <>
                  <iframe key={frameKey} src={previewUrl} title="The real page, with this draft"
                          style={{ width: "100%", height: "620px", border: `1px solid ${theme.rule}`,
                                   background: theme.bg }} />
                  <p className="m-0 mt-2" style={{ ...fontText, fontSize: "13.5px",
                        lineHeight: 1.5, color: theme.ink2 }}>
                    The actual route with this draft laid over it — not a
                    reproduction, so it cannot drift from the site. It shows the
                    last autosave, so give it a second and press refresh.
                  </p>
                </>
              ) : (
                <>
                  {def.blocks ? (
                    /*
                      A BUILT PAGE PREVIEWS THROUGH THE REAL RENDERER even
                      inline. There is no second composition to drift here —
                      <Blocks> is the component the live page uses, so this IS
                      the page's body at a smaller width. The card exists for
                      the record kinds, where the real page is a bespoke layout
                      this cannot honestly reproduce.
                    */
                    <div style={{ border: `1px solid ${theme.rule}`, background: theme.bg,
                                  padding: "18px 14px", maxHeight: "620px", overflowY: "auto" }}>
                      {form.kicker && (
                        <p className="m-0" style={{ ...fontUtility, fontSize: "7.5px",
                              letterSpacing: "0.2em", color: theme.brass }}>
                          {String(form.kicker).toUpperCase()}
                        </p>
                      )}
                      {form.title && (
                        <p className="m-0 mt-1.5 mb-4" style={{ ...fontDisplay, fontSize: "30px",
                              lineHeight: 1.03, letterSpacing: "-0.02em", color: theme.ink }}>
                          {form.title}
                        </p>
                      )}
                      <Blocks blocks={form.blocks} gap="20px" />
                      {!(form.blocks || []).length && (
                        <p className="m-0 py-6" style={{ ...fontText, fontSize: "15px", color: theme.ink2 }}>
                          Nothing on it yet.
                        </p>
                      )}
                    </div>
                  ) : (
                    <Card kind={kind} record={form} />
                  )}
                  <p className="m-0 mt-2" style={{ ...fontText, fontSize: "13.5px",
                        lineHeight: 1.5, color: theme.ink2 }}>
                    {def.blocks
                      ? "Drawn by the same component the live page uses, so this is the page's body rather than an impression of it. Only the width differs."
                      : "Updates as you type. Deliberately only a card — it is drawn here rather than by the site, so it is the right thing for catching a missing photograph or a name that runs long, and the wrong thing for deciding. Use the real page for that."}
                  </p>
                </>
              )}
            </div>
          </div>
        )}
      </section>
    </>
  );
}
