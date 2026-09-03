import { usePageMeta } from "../lib/seo";
import React, { useCallback, useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Nav, Footer, useGoogleFonts, Field, inputStyle,
  IndexBand, fontDisplay, fontUtility, fontText, theme,
} from "../components/Shared";
import DoorGate from "../components/DoorGate";
import * as api from "../lib/api";
import ImagePicker from "../components/ImagePicker";
import { useArtists } from "../lib/data";
/*
  The second eighteen's panels live in their own file. Console.jsx was three
  thousand lines before any of them, and a file nobody can hold in their head
  is a file where a change in one panel breaks another.
*/
import { Demos, Bookings, Waitlist, SetTimes, Kits, After } from "./ConsoleExtra";

/*
  The console.

  Four sections, each shown only to whoever is allowed it:
    Passes   — issue, cancel, restore
    Events   — add, edit, archive
    Team     — create, suspend, remove
    Requests — what came in from the public form

  Everything here writes to the server, so a pass issued on a phone is visible
  to the door on another phone a moment later. That is the whole reason the
  database exists.
*/

/*
  Tabs, each shown only to whoever may use it.

  The scanner and door list open as their own pages rather than living inside
  a tab: at a door you want the scanner filling the screen, not sharing it
  with a form. They belong here as ways in, not as panels.
*/
const TABS = [
  { id: "scan",     label: "SCANNER",   need: "scan",        to: "/scan", group: "door" },
  { id: "door",     label: "DOOR",      need: "seeList",     to: "/doorlist", group: "door" },
  { id: "passes",   label: "PASSES",    need: "seeList",     group: "door" },
  { id: "requests", label: "REQUESTS",  need: "seeList",     group: "door" },
  { id: "waiting",  label: "WAITING",   need: "seeList",     group: "door" },
  { id: "sets",     label: "SET TIMES", need: "issuePasses", group: "door" },
  { id: "stats",    label: "THE NIGHT", need: "seeList",     group: "door" },
  { id: "events",   label: "EVENTS",    need: "issuePasses", group: "content" },
  { id: "posts",    label: "POSTS",     need: "issuePasses", group: "content" },
  { id: "artists",  label: "ARTISTS",   need: "issuePasses", group: "content" },
  { id: "records",  label: "RECORDS",   need: "issuePasses", group: "content" },
  { id: "mixes",    label: "MIXES",     need: "issuePasses", group: "content" },
  { id: "kits",     label: "PRESS KITS",need: "issuePasses", group: "content" },
  { id: "demos",    label: "DEMOS",     need: "issuePasses", group: "content" },
  { id: "bookings", label: "BOOKINGS",  need: "issuePasses", group: "content" },
  { id: "activity", label: "ACTIVITY",  need: "manageTeam",  group: "system" },
  { id: "after",    label: "AFTER",     need: "manageTeam",  group: "system" },
  { id: "faults",   label: "FAULTS",    need: "manageTeam",  group: "system" },
  { id: "reading",  label: "READERSHIP",need: "manageTeam",  group: "system" },
  { id: "backups",  label: "BACKUPS",   need: "manageTeam",  group: "system" },
  { id: "team",     label: "TEAM",      need: "manageTeam",  group: "system" },
  { id: "settings", label: "SETTINGS",  need: "manageTeam",  group: "system" },
];

/*
  Why the tabs are grouped rather than listed.

  Twelve of them in one sideways-scrolling row meant the last four were simply
  out of sight — and nobody scrolls a row whose end they cannot see. Worse, a
  scrolling row hides exactly the tabs used least often, which are the ones
  most in need of being findable.

  Three groups, because there are three reasons to be here: something is
  happening at the door tonight; something needs writing or editing; something
  about the system itself needs changing. Each answers a different question,
  and grouping them means the eye goes to the right third before reading a
  single label.
*/
const GROUPS = [
  { id: "door",    label: "THE DOOR" },
  { id: "content", label: "CONTENT" },
  { id: "system",  label: "SYSTEM" },
];

/*
  What each permission actually means, in plain words. The names in the code
  are short; the person granting them should not have to guess.
*/
const PERMISSIONS = [
  { key: "scan",         label: "Scan at the door" },
  { key: "seeList",      label: "See the full door list" },
  { key: "seeReasons",   label: "See why someone was refused" },
  { key: "reset",        label: "Reset the night" },
  { key: "issuePasses",  label: "Issue passes and manage events" },
  { key: "revokePasses", label: "Cancel and edit passes" },
  { key: "manageTeam",   label: "Create and edit team accounts" },
  { key: "seeContacts",  label: "See guests' email and phone" },
];

/*
  READERSHIP — what people actually open.

  A bar per page, longest first, because the only question this answers is
  which pages get read and which do not. There is no line chart of visits over
  time: with these numbers a daily line is mostly noise, and a total plus a
  ranking is the part you would act on.

  Everything here is a count of views. Nobody is identified, nothing is
  followed between pages, and the door tools are not counted at all.
*/
const READABLE = {
  "/": "Home", "/records": "Records", "/agency": "Agency", "/artists": "Roster",
  "/artists/:id": "An artist", "/events": "Events", "/events/:id": "An event",
  "/news": "News", "/news/:slug": "An article", "/mixes": "Sessions",
  "/mixes/:slug": "A sessions page", "/about": "About", "/contact": "Contact",
  "/pool": "The pool", "/pass/:code": "A pass",
};

/*
  ── D04 · THE RECORD YOU WERE ALREADY KEEPING ──────────────────────────────

  Every admission has stored who scanned it since the day the door was built.
  Every setting stores who changed it. Every account stores who made it. None
  of it was ever shown anywhere, so "who let them in" was answered from
  memory, and "who turned that off" was answered with a shrug.

  This is one list, newest first, from all three. It is READ ONLY on purpose:
  a record you can edit is not a record.
*/
function Activity() {
  const [feed, setFeed] = useState([]);
  const [loading, setLoading] = useState(true);
  const [only, setOnly] = useState("ALL");

  useEffect(() => {
    api.activity(200).then((res) => {
      setLoading(false);
      if (res.ok) setFeed(res.feed || []);
    });
  }, []);

  const shown = only === "ALL" ? feed : feed.filter((r) => r.kind === only);
  const when = (iso) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    const today = new Date().toDateString() === d.toDateString();
    return today
      ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : d.toLocaleDateString([], { day: "2-digit", month: "short" }) + " " +
        d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div>
      <IndexBand items={[
        { label: "ENTRIES", value: loading ? "—" : String(shown.length).padStart(3, "0") },
        { label: "SHOWING", value: only === "ALL" ? "EVERYTHING" : only },
        { label: "NEWEST", value: feed[0] ? when(feed[0].at) : "—" },
      ]} />

      <div className="flex flex-wrap gap-1.5 mt-6 mb-6">
        {["ALL", "DOOR", "SETTING", "TEAM"].map((k) => {
          const on = only === k;
          return (
            <button key={k} onClick={() => setOnly(k)}
                    style={{ ...fontUtility, fontSize: "9px", letterSpacing: "0.16em",
                             cursor: "pointer", padding: "9px 13px",
                             color: on ? theme.bg : theme.ink,
                             background: on ? theme.ink : "transparent",
                             border: `1px solid ${on ? theme.ink : theme.rule}` }}>
              {k}
            </button>
          );
        })}
      </div>

      {loading ? (
        <p className="m-0" style={{ ...fontUtility, fontSize: "10px", letterSpacing: "0.16em", color: theme.ink2 }}>
          READING…
        </p>
      ) : shown.length === 0 ? (
        <p className="m-0" style={{ ...fontText, fontSize: "17px", lineHeight: 1.55, color: theme.ink2 }}>
          Nothing recorded yet. This fills up as passes are scanned and
          settings are changed.
        </p>
      ) : (
        <div style={{ borderTop: `1px solid ${theme.ink}` }}>
          {shown.map((r, i) => (
            <div key={i} className="flex items-baseline gap-3 py-3"
                 style={{ borderBottom: `1px solid ${theme.rule}` }}>
              <span style={{ ...fontUtility, fontSize: "9px", letterSpacing: "0.1em",
                             color: theme.ink2, width: "78px", flex: "none",
                             fontVariantNumeric: "tabular-nums" }}>
                {when(r.at)}
              </span>
              <span style={{ ...fontUtility, fontSize: "8px", letterSpacing: "0.14em",
                             width: "58px", flex: "none",
                             color: r.tone === "bad" ? theme.bad
                                  : r.tone === "good" ? theme.good : theme.brass }}>
                {r.kind}
              </span>
              <span className="flex-1 min-w-0" style={{ ...fontText, fontSize: "16.5px",
                    lineHeight: 1.45, color: theme.ink }}>
                <strong style={{ fontWeight: 400, color: theme.ink2 }}>{r.who || "—"}</strong>{" "}
                {r.what}
              </span>
            </div>
          ))}
        </div>
      )}

      <p className="m-0 mt-6" style={{ ...fontText, fontSize: "15px", lineHeight: 1.55, color: theme.ink2 }}>
        Read only, deliberately — a record you can edit is not a record. It is
        built from the door log, the settings table and the team list, all of
        which were already storing this and none of which ever showed it.
      </p>
    </div>
  );
}

/*
  FAULTS — what broke in somebody else's browser.

  Nobody reports a bug. They close the tab, and the fault stays invisible
  until it happens to us too, on our own phone, months later. So the browser
  reports it instead: anything thrown that reached the top, any promise that
  failed with nobody catching it, and any component that threw while
  rendering.

  Identical faults are counted rather than repeated — one line saying it
  happened forty times is the useful shape, and a render loop firing the same
  error every frame would otherwise bury everything else.

  What is stored is the message, where in the code, a trimmed stack, the page,
  and a coarse browser family. Not an address, not an identifier, not a
  session. Knowing something is broken does not require knowing who hit it.
*/
function Faults() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(null);
  const [note, setNote] = useState("");
  const [clearing, setClearing] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api.listOops().then((res) => {
      setLoading(false);
      if (res.ok) setRows(res.errors || []);
      else setNote(res.error || "Could not read the fault list.");
    });
  }, []);

  useEffect(() => { load(); }, [load]);

  const clear = async () => {
    /*
      No confirm() dialog: on iOS a native dialog blocks everything behind it
      and the site has been bitten by that before. Two taps instead — the
      button changes to say what the second tap does.
    */
    if (!clearing) { setClearing(true); setTimeout(() => setClearing(false), 4000); return; }
    setClearing(false);
    setNote("");
    const res = await api.clearOops();
    if (res.ok) { setRows([]); setOpen(null); }
    else setNote(res.error || "Could not clear the list.");
  };

  const when = (iso) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    const today = new Date().toDateString() === d.toDateString();
    return today
      ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : d.toLocaleDateString([], { day: "2-digit", month: "short" });
  };

  const total = rows.reduce((n, r) => n + (r.n || 1), 0);
  const worst = rows.slice().sort((a, b) => (b.n || 1) - (a.n || 1))[0];

  return (
    <div>
      <IndexBand items={[
        { label: "DISTINCT", value: loading ? "—" : String(rows.length).padStart(3, "0") },
        { label: "TIMES", value: loading ? "—" : String(total).padStart(3, "0") },
        { label: "MOST COMMON", value: worst ? String(worst.n || 1) + "×" : "NONE" },
      ]} />

      {note && <Notice message={note} />}

      <div className="flex flex-wrap gap-2 mt-6 mb-6">
        <button onClick={load}
                style={{ ...fontUtility, fontSize: "9px", letterSpacing: "0.16em",
                         cursor: "pointer", padding: "9px 15px", color: theme.ink,
                         background: "transparent", border: `1px solid ${theme.rule}` }}>
          REFRESH
        </button>
        {rows.length > 0 && (
          <button onClick={clear}
                  style={{ ...fontUtility, fontSize: "9px", letterSpacing: "0.16em",
                           cursor: "pointer", padding: "9px 15px",
                           color: clearing ? theme.onInk : theme.bad,
                           background: clearing ? theme.bad : "transparent",
                           border: `1px solid ${theme.bad}` }}>
            {clearing ? "TAP AGAIN TO CLEAR" : "CLEAR THE LIST"}
          </button>
        )}
      </div>

      {loading ? (
        <p className="m-0" style={{ ...fontUtility, fontSize: "10px", letterSpacing: "0.16em", color: theme.ink2 }}>
          READING…
        </p>
      ) : rows.length === 0 ? (
        <p className="m-0" style={{ ...fontText, fontSize: "17px", lineHeight: 1.55, color: theme.ink2 }}>
          Nothing has broken. This stays empty until a visitor's browser hits
          an error, at which point it says what, where and how often — without
          saying who.
        </p>
      ) : (
        <div style={{ borderTop: `1px solid ${theme.ink}` }}>
          {rows.map((r, i) => {
            const shown = open === i;
            return (
              <div key={i} style={{ borderBottom: `1px solid ${theme.rule}` }}>
                <button onClick={() => setOpen(shown ? null : i)}
                        className="w-full text-left flex items-baseline gap-3 py-3"
                        style={{ background: "transparent", border: 0, cursor: "pointer",
                                 padding: "12px 0" }}>
                  <span style={{ ...fontUtility, fontSize: "9px", letterSpacing: "0.1em",
                                 color: theme.ink2, width: "56px", flex: "none",
                                 fontVariantNumeric: "tabular-nums" }}>
                    {when(r.at)}
                  </span>
                  <span style={{ ...fontUtility, fontSize: "9px", letterSpacing: "0.1em",
                                 width: "38px", flex: "none", textAlign: "right",
                                 fontVariantNumeric: "tabular-nums",
                                 color: (r.n || 1) > 9 ? theme.bad : theme.brass }}>
                    {(r.n || 1)}×
                  </span>
                  <span className="flex-1 min-w-0" style={{ ...fontText, fontSize: "16.5px",
                        lineHeight: 1.45, color: theme.ink }}>
                    {r.message}
                    <span style={{ ...fontUtility, fontSize: "8.5px", letterSpacing: "0.12em",
                                   color: theme.ink2, marginLeft: "10px" }}>
                      {(r.path || "/") + " · " + (r.agent || "?")}
                    </span>
                  </span>
                </button>

                {shown && (
                  <div className="pb-4" style={{ paddingLeft: "94px" }}>
                    <p className="m-0 mb-2" style={{ ...fontUtility, fontSize: "9px",
                       letterSpacing: "0.14em", color: theme.brass }}>
                      {r.where_at || "NO LOCATION"}
                    </p>
                    <pre className="m-0" style={{ ...fontUtility, fontSize: "11px",
                         lineHeight: 1.65, color: theme.ink2, whiteSpace: "pre-wrap",
                         wordBreak: "break-word", background: theme.sunk,
                         padding: "12px 14px", border: `1px solid ${theme.rule}` }}>
                      {r.stack || "No stack was attached. Usually means the fault came from a resource that failed to load rather than from code."}
                    </pre>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p className="m-0 mt-6" style={{ ...fontText, fontSize: "15px", lineHeight: 1.55, color: theme.ink2 }}>
        Reported by the visitor's own browser to this site's server and nowhere
        else. A browser sends at most six a visit and never the same one twice,
        so a page failing over and over cannot flood this.
      </p>
    </div>
  );
}

function Readership() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    setLoading(true);
    api.readership(days).then((res) => {
      if (!live) return;
      setLoading(false);
      if (res.ok) setData(res);
    });
    return () => { live = false; };
  }, [days]);

  const pages = data?.pages || [];
  const top = pages.length ? Number(pages[0].n) : 0;
  const busiest = (data?.daily || []).reduce((a, b) => (Number(b.n) > Number(a?.n || 0) ? b : a), null);

  return (
    <div>
      <IndexBand items={[
        { label: "PERIOD", value: `${days} DAYS` },
        { label: "VIEWS", value: loading ? "—" : String(data?.total ?? 0) },
        { label: "PAGES READ", value: loading ? "—" : String(pages.length) },
        { label: "BUSIEST DAY", value: busiest ? busiest.day.slice(5).replace("-", ".") : "—" },
      ]} />

      <div className="flex gap-1.5 mt-6 mb-7">
        {[7, 30, 90, 365].map((d) => {
          const on = days === d;
          return (
            <button key={d} onClick={() => setDays(d)}
                    style={{ ...fontUtility, fontSize: "9px", letterSpacing: "0.16em", cursor: "pointer",
                             padding: "9px 13px", color: on ? theme.bg : theme.ink,
                             background: on ? theme.ink : "transparent",
                             border: `1px solid ${on ? theme.ink : theme.rule}` }}>
              {d === 365 ? "A YEAR" : `${d} DAYS`}
            </button>
          );
        })}
      </div>

      {loading ? (
        <p className="m-0" style={{ ...fontUtility, fontSize: "10px", letterSpacing: "0.16em", color: theme.ink2 }}>
          READING…
        </p>
      ) : pages.length === 0 ? (
        <p className="m-0" style={{ ...fontText, fontSize: "17px", lineHeight: 1.55, color: theme.ink2 }}>
          Nothing counted yet. Counting starts the moment this version is live —
          there is no history to fill in, because none was ever kept.
        </p>
      ) : (
        <div style={{ borderTop: `1px solid ${theme.ink}` }}>
          {pages.map((r) => {
            const n = Number(r.n) || 0;
            return (
              <div key={r.path} className="py-3" style={{ borderBottom: `1px solid ${theme.rule}` }}>
                <div className="flex items-baseline justify-between gap-4">
                  <span style={{ ...fontText, fontSize: "17px", color: theme.ink }}>
                    {READABLE[r.path] || r.path}
                  </span>
                  <span style={{ ...fontUtility, fontSize: "12px", color: theme.ink,
                                 fontVariantNumeric: "tabular-nums" }}>
                    {n}
                  </span>
                </div>
                {/* The bar is scaled to the busiest page, not to the total:
                    ranking is the point, and against a total every bar on a
                    site with a strong home page is a sliver. */}
                <div className="mt-1.5" style={{ height: "3px", background: theme.rule }}>
                  <div style={{ height: "100%", width: `${top ? (n / top) * 100 : 0}%`, background: theme.brass }} />
                </div>
                <span className="block mt-1" style={{ ...fontUtility, fontSize: "8.5px",
                      letterSpacing: "0.14em", color: theme.ink2 }}>
                  {r.path}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <p className="m-0 mt-6" style={{ ...fontText, fontSize: "15px", lineHeight: 1.55, color: theme.ink2 }}>
        Counted here, by us, with no cookie and no third party — which is why
        the site needs no consent banner. These are views, not people: one
        person reading three pages is three.
      </p>
    </div>
  );
}

/*
  BACKUPS — a copy of everything, taken every Monday.

  The list is the whole interface. There is no restore button and that is
  deliberate: putting a database back is not something anyone should be one
  mis-tap away from, and it is rare enough to be worth doing deliberately with
  the file in front of you. What this gives you is the file.
*/
function Backups() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    api.listBackups().then((res) => {
      setLoading(false);
      if (res.ok) setList(res.backups || []);
    });
  }, []);

  useEffect(load, [load]);

  const takeOne = async () => {
    setBusy(true);
    setMsg("");
    const res = await api.makeBackup();
    setBusy(false);
    setMsg(res.ok
      ? `Taken — ${res.rows} rows across ${res.tables} tables${res.dropped ? `, ${res.dropped} old one${res.dropped === 1 ? "" : "s"} dropped` : ""}.`
      : (res.error || "That did not work."));
    load();
  };

  const size = (n) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`);
  const latest = list[0];

  return (
    <div>
      <IndexBand items={[
        { label: "KEPT", value: loading ? "—" : String(list.length).padStart(2, "0") },
        { label: "MOST RECENT", value: latest ? latest.taken.slice(0, 10) : "NONE YET" },
        { label: "SCHEDULE", value: "MONDAY 04:00" },
      ]} />

      <p className="m-0 mt-6" style={{ ...fontText, fontSize: "17px", lineHeight: 1.55, color: theme.ink2 }}>
        The whole database is written out every Monday morning and the last
        twelve are kept — three months. They are stored where the site's photos
        are, behind a name the public side refuses to serve, and downloading one
        needs this login.
      </p>

      <button onClick={takeOne} disabled={busy} className="mt-5 px-4 py-3"
              style={{ ...fontUtility, fontSize: "9.5px", letterSpacing: "0.18em",
                       background: theme.ink, color: theme.bg, border: 0,
                       cursor: "pointer", opacity: busy ? 0.6 : 1 }}>
        {busy ? "TAKING A COPY…" : "TAKE ONE NOW"}
      </button>

      <Notice message={msg} tone={msg.startsWith("Taken") ? "good" : "bad"} />

      <div className="mt-7" style={{ borderTop: `1px solid ${theme.ink}` }}>
        {loading ? (
          <p className="m-0 py-8 text-center" style={{ ...fontUtility, fontSize: "10px",
             letterSpacing: "0.16em", color: theme.ink2 }}>READING…</p>
        ) : list.length === 0 ? (
          <p className="m-0 py-8 text-center" style={{ ...fontUtility, fontSize: "10px",
             letterSpacing: "0.16em", color: theme.ink2 }}>
            NONE YET — THE FIRST ONE ARRIVES MONDAY
          </p>
        ) : (
          list.map((b) => (
            <div key={b.key} className="flex items-center justify-between gap-4 py-3.5"
                 style={{ borderBottom: `1px solid ${theme.rule}` }}>
              <span className="min-w-0">
                <span className="block" style={{ ...fontText, fontSize: "17px", color: theme.ink }}>
                  {b.taken.slice(0, 10)}
                </span>
                <span className="block" style={{ ...fontUtility, fontSize: "8.5px",
                      letterSpacing: "0.14em", color: theme.ink2 }}>
                  {size(b.size)}
                </span>
              </span>
              <button onClick={() => api.downloadBackup(b.name)}
                      style={{ ...fontUtility, fontSize: "8.5px", letterSpacing: "0.14em",
                               cursor: "pointer", padding: "8px 11px", background: "transparent",
                               border: `1px solid ${theme.rule}`, color: theme.ink }}>
                DOWNLOAD
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function Notice({ message, tone = "bad" }) {
  if (!message) return null;
  const colour = tone === "good" ? theme.good : theme.bad;
  return (
    <p className="m-0 mt-3 px-3 py-2.5"
       style={{ ...fontText, fontSize: "15px", color: colour, border: `1px solid ${colour}55` }}>
      {message}
    </p>
  );
}

// A stable id from the title, so the index above can jump to a section
// without every call site having to invent one.
const sectionId = (title) =>
  "s-" + String(title).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function Section({ title, children, onSave, saving, saved }) {
  /*
    A save button at the FOOT OF EVERY SECTION, not only at the bottom of the
    page. Changing one thing in the first group meant scrolling past forty
    controls to reach a single button, and a long scroll between a decision
    and its confirmation is how people end up unsure whether it saved at all.

    Every button saves the whole settings object, so it does not matter which
    one is pressed — what matters is that one is always within reach.
  */
  return (
    <div className="mt-7" id={sectionId(title)} style={{ scrollMarginTop: "132px" }}>
      <p className="m-0 mb-3" style={{ ...fontUtility, fontSize: "9.5px", letterSpacing: "0.2em", color: theme.brass }}>
        {title}
      </p>
      {children}
      {onSave && (
        <div className="flex items-center gap-4 mt-4">
          <button onClick={onSave} disabled={saving}
                  style={{ ...btn, opacity: saving ? 0.6 : 1 }}>
            {saving ? "SAVING…" : "SAVE"}
          </button>
          {saved && (
            <span style={{ ...fontUtility, fontSize: "9px", letterSpacing: "0.18em", color: theme.brass }}>
              SAVED
            </span>
          )}
        </div>
      )}
    </div>
  );
}

const btn = {
  ...fontUtility, fontSize: "10px", letterSpacing: "0.18em",
  background: theme.ink, color: theme.bg, border: 0, padding: "12px 20px", cursor: "pointer",
};
const ghost = { ...btn, background: "transparent", color: theme.ink, border: `1px solid ${theme.ink}` };

// ── PASSES ──────────────────────────────────────────────────────────────────

function Passes({ role, parties, party, setParty }) {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState({ name: "", email: "", phone: "", kind: "TICKET", tier: "STANDARD", admits: 1, ticketRef: "", note: "" });
  const [issued, setIssued] = useState(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!party) return;
    const res = await api.listPasses(party);
    if (res.ok) setRows(res.passes || []);
    else setMsg(res.error || "Couldn't load the passes.");
  }, [party]);

  useEffect(() => { load(); }, [load]);

  const issue = async (e) => {
    e.preventDefault();
    setMsg(""); setIssued(null);
    if (!form.name.trim()) { setMsg("A name is required — it's what stops the ticket being resold."); return; }
    // Catch a second pass to the same person before it exists, rather than
    // discovering it at the door.
    const dup = await api.checkDuplicate(party, form.name, form.email);
    if (dup.ok && dup.matches?.length) {
      const who = dup.matches.map((m) => `${m.name} (${m.code})`).join(", ");
      if (!window.confirm(`Already on this list: ${who}.\n\nIssue another anyway?`)) return;
    }

    setBusy(true);
    const res = await api.issuePass({ ...form, party });
    setBusy(false);
    if (!res.ok) { setMsg(res.error || "Couldn't issue that pass."); return; }
    setIssued({ code: res.code, email: res.email });
    setForm({ name: "", email: "", phone: "", kind: "TICKET", tier: "STANDARD", admits: 1, ticketRef: "", note: "" });
    load();
  };

  /*
    Editing opens in place rather than on another screen. At a desk with a
    guest on the phone, losing the list to go and edit one row is exactly the
    wrong shape.
  */
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [resend, setResend] = useState(false);

  /*
    The door note is held apart from editForm on purpose — it saves on its own
    button, so it must not be tangled up with the form that saves everything
    else. Keyed by code rather than reset on open, so switching between two
    people does not silently discard a note half-typed for the first.
  */
  const [noteDraft, setNoteDraft] = useState({});
  const [noteTone, setNoteTone] = useState({});

  const saveNote = async (r) => {
    const text = noteDraft[r.code] ?? r.door_note ?? "";
    const tone = noteTone[r.code] ?? r.door_tone ?? "INFO";
    const res = await api.setDoorNote(r.code, text, tone);
    setMsg(res.ok
      ? (text.trim() ? `The door will see that when ${r.name}'s code scans.` : "Note removed.")
      : (res.error || "Could not save that note."));
    if (res.ok) load();
  };

  const startEdit = (r) => {
    setEditing(r.code);
    setResend(false);
    setEditForm({
      name: r.name || "", email: r.email || "", phone: r.phone || "",
      kind: r.kind || "TICKET", tier: r.tier || "", ticketRef: r.ticket_ref || "",
      note: r.note || "", admits: r.admits || 1,
    });
  };

  const saveEdit = async () => {
    setMsg("");
    const res = await api.editPass(editing, { ...editForm, resend });
    if (!res.ok) { setMsg(res.error || "Couldn't save that."); return; }
    setMsg(resend
      ? (res.email?.sent ? "Saved and emailed." : `Saved. Not emailed: ${res.email?.reason || "unknown"}.`)
      : "Saved.");
    setEditing(null);
    load();
  };

  const revoke = async (code, name) => {
    if (!window.confirm(`Cancel ${name}'s pass? They'll be refused at the door.`)) return;
    const reason = window.prompt("Why? (optional — shown to you, not to them)") || "";
    const res = await api.revokePass(code, reason);
    if (!res.ok) setMsg(res.error || "Couldn't cancel that pass.");
    load();
  };

  const restore = async (code) => {
    const res = await api.restorePass(code);
    if (!res.ok) setMsg(res.error || "Couldn't restore that pass.");
    load();
  };

  const [query, setQuery] = useState("");
  const [bulk, setBulk] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkResult, setBulkResult] = useState(null);

  const issueBulk = async () => {
    setMsg(""); setBulkResult(null);
    if (!bulk.trim()) { setMsg("Add some names first."); return; }
    setBulkBusy(true);
    const res = await api.issueBulk(party, bulk, form.kind, form.tier);
    setBulkBusy(false);
    if (!res.ok) { setMsg(res.error || "Couldn't issue those."); return; }
    setBulkResult(res);
    setBulk("");
    load();
  };

  const shown = rows.filter((r) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return [r.name, r.email, r.code].filter(Boolean).some((v) => String(v).toLowerCase().includes(q));
  });

  /*
    A spreadsheet of the list. Quoted properly, because a name containing a
    comma would otherwise split into two columns and quietly corrupt the file.
  */
  const exportCsv = () => {
    const cell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = [
      ["Code", "Name", "Email", "Phone", "Kind", "Tier", "Admits", "Ticket", "Status", "Admitted"].join(","),
      ...rows.map((r) => [r.code, r.name, r.email, r.phone, r.kind, r.tier, r.admits,
                          r.ticket_ref, r.status, r.admitted_at].map(cell).join(",")),
    ].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `hidden-state-${party}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /*
    A paper list. The last line of defence: phones die, both scanners break,
    and a printed sheet has saved more nights than any software.
  */
  const printList = () => {
    const win = window.open("", "_blank");
    if (!win) return;
    const live = rows.filter((r) => r.status !== "REVOKED")
                     .sort((a, b) => a.name.localeCompare(b.name));
    win.document.write(`
      <html><head><title>Door list</title><style>
        body{font-family:Georgia,serif;padding:28px;color:#000}
        h1{font-size:20px;margin:0 0 4px}
        p.sub{font-size:11px;letter-spacing:.1em;margin:0 0 18px;color:#555}
        table{width:100%;border-collapse:collapse;font-size:13px}
        th{text-align:left;font-size:9px;letter-spacing:.14em;border-bottom:2px solid #000;padding:6px 4px}
        td{padding:7px 4px;border-bottom:1px solid #ccc}
        .box{display:inline-block;width:12px;height:12px;border:1px solid #000}
        @media print{ @page { margin:14mm } }
      </style></head><body>
      <h1>Door list — ${live.length} passes</h1>
      <p class="sub">PRINTED ${new Date().toLocaleString().toUpperCase()}</p>
      <table><thead><tr><th>IN</th><th>NAME</th><th>CODE</th><th>KIND</th><th>ADMITS</th></tr></thead><tbody>
      ${live.map((r) => `<tr><td><span class="box"></span></td><td>${r.name}</td>
        <td>${r.code}</td><td>${r.kind}${r.tier ? " / " + r.tier : ""}</td><td>${r.admits || 1}</td></tr>`).join("")}
      </tbody></table></body></html>`);
    win.document.close();
    win.print();
  };

  const set = (k) => (e) => {
    const value = e.target.value;
    setForm((f) => {
      const next = { ...f, [k]: value };
      // Suggest the usual number when the kind changes, still editable.
      if (k === "kind") next.admits = value === "COUPLE" ? 2 : value === "FAMILY" ? 4 : 1;
      return next;
    });
  };

  return (
    <>
      <Section title="EVENT">
        <select value={party} onChange={(e) => setParty(e.target.value)} style={{ ...inputStyle, width: "100%" }}>
          {parties.map((p) => <option key={p.id} value={p.id}>{p.name} — {p.date_label}</option>)}
        </select>
      </Section>

      {role.can.issuePasses && (
        <Section title="ISSUE A PASS">
          <form onSubmit={issue} className="space-y-3">
            <Field label="Full name"><input required style={inputStyle} value={form.name} onChange={set("name")} /></Field>
            <Field label="Email"><input type="email" style={inputStyle} value={form.email} onChange={set("email")} /></Field>
            <Field label="Phone"><input type="tel" style={inputStyle} value={form.phone} onChange={set("phone")} /></Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Kind">
                <select style={inputStyle} value={form.kind} onChange={set("kind")}>
                  <option value="TICKET">Sold ticket</option>
                  <option value="COUPLE">Couple ticket (admits 2)</option>
                  <option value="FAMILY">Family ticket (admits 4)</option>
                  <option value="INVITATION">Invitation (free)</option>
                  <option value="GUEST">Guest list</option>
                  <option value="PRESS">Press</option>
                  <option value="ARTIST">Artist</option>
                  <option value="STAFF">Staff</option>
                </select>
              </Field>
              <Field label="Tier">
                <select style={inputStyle} value={form.tier} onChange={set("tier")}>
                  <option value="">—</option>
                  <option value="EARLY">Early</option>
                  <option value="STANDARD">Standard</option>
                  <option value="VIP">VIP</option>
                </select>
              </Field>
            </div>

            {(form.kind === "COUPLE" || form.kind === "FAMILY") && (
              <Field label="How many people it admits">
                <input type="number" min="1" max="12" style={inputStyle}
                       value={form.admits}
                       onChange={set("admits")} />
              </Field>
            )}

            <Field label="Number on the physical ticket">
              <input style={inputStyle} value={form.ticketRef} onChange={set("ticketRef")} placeholder="Optional" />
            </Field>
            <Field label="Note">
              <input maxLength={150} style={inputStyle} value={form.note} onChange={set("note")} placeholder="Birthday, plus-one, working the night…" />
            </Field>

            <button type="submit" disabled={busy} style={{ ...btn, opacity: busy ? 0.6 : 1 }}>
              {busy ? "ISSUING…" : "ISSUE PASS"}
            </button>
          </form>

          {issued && (
            <div className="mt-4 p-5 text-center" style={{ border: `1px solid ${theme.ink}`, background: theme.sunk }}>
              <p className="m-0" style={{ ...fontUtility, fontSize: "9px", letterSpacing: "0.2em", color: theme.brass }}>
                WRITE THIS ON THE TICKET
              </p>
              <p className="m-0 mt-2" style={{ ...fontDisplay, fontSize: "34px", letterSpacing: "0.14em", color: theme.ink }}>
                {issued.code}
              </p>

              {/* Say plainly whether it was emailed. Silence here would leave
                  you assuming a guest has their pass when they do not. */}
              <p className="m-0 mt-3" style={{ ...fontUtility, fontSize: "9px", letterSpacing: "0.16em",
                                               color: issued.email?.sent ? theme.good : theme.warn }}>
                {issued.email?.sent ? "EMAILED" : `NOT EMAILED — ${issued.email?.reason || "send it yourself"}`}
              </p>

              <p className="m-0 mt-3" style={{ ...fontText, fontSize: "14px", color: theme.ink2, wordBreak: "break-all" }}>
                hiddenstategroup.com/pass/{issued.code}
              </p>
              <button
                onClick={() => navigator.clipboard?.writeText(`https://hiddenstategroup.com/pass/${issued.code}`)}
                className="mt-3"
                style={{ ...fontUtility, fontSize: "9px", letterSpacing: "0.18em", color: theme.ink,
                         background: "transparent", border: `1px solid ${theme.ink}`, padding: "9px 16px", cursor: "pointer" }}>
                COPY THE LINK
              </button>
            </div>
          )}
          <Notice message={msg} />
        </Section>
      )}

      {role.can.issuePasses && (
        <Section title="ISSUE SEVERAL AT ONCE">
          <p className="m-0 mb-2" style={{ ...fontText, fontSize: "15px", lineHeight: 1.5, color: theme.ink2 }}>
            One per line. Add an email after a comma if you have it, and each
            person gets their pass sent.
          </p>
          <textarea
            rows={5}
            value={bulk}
            onChange={(e) => setBulk(e.target.value)}
            placeholder={"Ana Popescu, ana@example.com\nMihai Ionescu\nElena Radu, elena@example.com"}
            style={{ ...inputStyle, width: "100%", resize: "vertical", lineHeight: 1.5 }}
          />
          <button onClick={issueBulk} disabled={bulkBusy}
                  style={{ ...btn, marginTop: "12px", opacity: bulkBusy ? 0.6 : 1 }}>
            {bulkBusy ? "ISSUING…" : "ISSUE THEM ALL"}
          </button>

          {bulkResult && (
            <div className="mt-4 p-4" style={{ border: `1px solid ${theme.ink}`, background: theme.sunk }}>
              <p className="m-0 mb-2" style={{ ...fontUtility, fontSize: "9px", letterSpacing: "0.18em", color: theme.brass }}>
                {bulkResult.issued.length} ISSUED{bulkResult.failed.length ? ` · ${bulkResult.failed.length} FAILED` : ""}
              </p>
              {bulkResult.issued.map((i) => (
                <p key={i.code} className="m-0" style={{ ...fontText, fontSize: "15px", color: theme.ink }}>
                  {i.code} — {i.name}
                </p>
              ))}
              {bulkResult.failed.map((f, n) => (
                <p key={n} className="m-0" style={{ ...fontText, fontSize: "15px", color: theme.bad }}>
                  {f.name} — {f.reason}
                </p>
              ))}
            </div>
          )}
        </Section>
      )}

      <Section title={`ISSUED — ${rows.length}`}>
        {/* At 500 passes, scrolling is not a way to find someone. */}
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, email or code"
          style={{ ...inputStyle, width: "100%", marginBottom: "14px" }}
        />

        <div className="flex flex-wrap gap-4 mb-4">
          <button onClick={exportCsv}
                  style={{ ...fontUtility, fontSize: "9px", letterSpacing: "0.16em", color: theme.ink2,
                           background: "transparent", border: 0, borderBottom: `1px solid ${theme.rule}`, cursor: "pointer" }}>
            EXPORT AS SPREADSHEET
          </button>
          <button onClick={printList}
                  style={{ ...fontUtility, fontSize: "9px", letterSpacing: "0.16em", color: theme.ink2,
                           background: "transparent", border: 0, borderBottom: `1px solid ${theme.rule}`, cursor: "pointer" }}>
            PRINT THE DOOR LIST
          </button>
        </div>
        {rows.length === 0 && (
          <p className="m-0" style={{ ...fontText, fontSize: "16px", color: theme.ink2 }}>
            Nothing issued for this event yet.
          </p>
        )}
        {shown.map((r) => {
          const dead = r.status === "REVOKED";
          return (
            <div key={r.code}>
            <div className="flex items-center gap-3 py-3"
                 style={{ borderBottom: `1px solid ${theme.rule}`, opacity: dead ? 0.5 : 1 }}>
              <span style={{ ...fontUtility, fontSize: "9px", letterSpacing: "0.1em", color: theme.ink2, width: "78px" }}>
                {r.code}
              </span>
              <span className="flex-1 min-w-0">
                <span className="block" style={{ ...fontText, fontSize: "16px", color: theme.ink,
                                                 textDecoration: dead ? "line-through" : "none" }}>
                  {r.name}
                </span>
                <span className="block" style={{ ...fontUtility, fontSize: "8px", letterSpacing: "0.12em", color: theme.ink2 }}>
                  {r.kind}{r.tier ? ` · ${r.tier}` : ""}
                  {r.admitted_at ? " · IN" : ""}
                  {r.refusals > 0 ? ` · ${r.refusals} refused` : ""}
                </span>
              </span>
              {role.can.revokePasses && (
                <button onClick={() => (editing === r.code ? setEditing(null) : startEdit(r))}
                        style={{ ...fontUtility, fontSize: "8.5px", letterSpacing: "0.14em",
                                 color: theme.ink2, background: "transparent", border: 0, cursor: "pointer" }}>
                  {editing === r.code ? "CLOSE" : "EDIT"}
                </button>
              )}
              {role.can.revokePasses && (
                <button onClick={() => (dead ? restore(r.code) : revoke(r.code, r.name))}
                        style={{ ...fontUtility, fontSize: "8.5px", letterSpacing: "0.14em",
                                 color: dead ? theme.brass : theme.bad, background: "transparent", border: 0, cursor: "pointer" }}>
                  {dead ? "RESTORE" : "CANCEL"}
                </button>
              )}
            </div>

            {editing === r.code && (
              <div className="px-3 py-4 mb-3" style={{ border: `1px solid ${theme.ink}`, background: theme.sunk }}>
                <p className="m-0 mb-3" style={{ ...fontUtility, fontSize: "8.5px", letterSpacing: "0.18em", color: theme.brass }}>
                  EDITING {r.code} — THE CODE ITSELF CANNOT CHANGE
                </p>

                {/*
                  ── N04 · A NOTE FOR THE DOOR ────────────────────────────

                  Saved on its own, separately from everything else in this
                  form, and deliberately so: a note is written at four in the
                  afternoon when somebody remembers something, and making it
                  wait behind a form that also changes the person's email is
                  how it does not get written at all.

                  The tone is not decoration. In the dark, colour is read
                  before words are, and the difference between "give them a
                  drink" and "do not let them in" must not depend on anyone
                  reading a sentence at 2am.
                */}
                <div className="mb-4 pb-4" style={{ borderBottom: `1px solid ${theme.rule}` }}>
                  <Field label="A note the door sees when this code scans">
                    <input style={inputStyle} maxLength={200}
                           placeholder="Promoter's guest · artist +1 · do not admit"
                           value={noteDraft[r.code] ?? r.door_note ?? ""}
                           onChange={(e) => setNoteDraft((d) => ({ ...d, [r.code]: e.target.value }))} />
                  </Field>
                  <div className="flex flex-wrap gap-1.5 mt-2.5">
                    {[["INFO", "JUST SO THEY KNOW"], ["GOOD", "LOOK AFTER THEM"],
                      ["WARN", "CAREFUL"], ["STOP", "DO NOT ADMIT"]].map(([t, say]) => {
                      const on = (noteTone[r.code] ?? r.door_tone ?? "INFO") === t;
                      return (
                        <button key={t} onClick={() => setNoteTone((d) => ({ ...d, [r.code]: t }))}
                                style={{ ...fontUtility, fontSize: "8px", letterSpacing: "0.14em",
                                         padding: "7px 10px", cursor: "pointer",
                                         color: on ? theme.onInk : theme.ink2,
                                         background: on ? (t === "STOP" ? theme.bad : t === "WARN" ? theme.warn
                                                          : t === "GOOD" ? theme.good : theme.ink) : "transparent",
                                         border: `1px solid ${on ? "transparent" : theme.rule}` }}>
                          {say}
                        </button>
                      );
                    })}
                  </div>
                  <button onClick={() => saveNote(r)}
                          className="mt-3"
                          style={{ ...fontUtility, fontSize: "9px", letterSpacing: "0.16em", cursor: "pointer",
                                   padding: "9px 16px", background: theme.ink, color: theme.bg, border: 0 }}>
                    SAVE THE NOTE
                  </button>
                  <p className="m-0 mt-2" style={{ ...fontText, fontSize: "14px", lineHeight: 1.5, color: theme.ink2 }}>
                    Empty removes it. It travels with the offline list too, so
                    it is still there when the basement kills the signal.
                  </p>
                </div>

                <div className="space-y-3">
                  <Field label="Full name">
                    <input style={inputStyle} value={editForm.name}
                           onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} />
                  </Field>
                  <Field label="Email">
                    <input style={inputStyle} value={editForm.email}
                           onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))} />
                  </Field>
                  <Field label="Phone">
                    <input style={inputStyle} value={editForm.phone}
                           onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))} />
                  </Field>

                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Kind">
                      <select style={inputStyle} value={editForm.kind}
                              onChange={(e) => setEditForm((f) => ({
                                ...f, kind: e.target.value,
                                admits: e.target.value === "COUPLE" ? 2 : e.target.value === "FAMILY" ? 4 : 1,
                              }))}>
                        <option value="TICKET">Sold ticket</option>
                        <option value="COUPLE">Couple ticket</option>
                        <option value="FAMILY">Family ticket</option>
                        <option value="INVITATION">Invitation (free)</option>
                        <option value="GUEST">Guest list</option>
                        <option value="PRESS">Press</option>
                        <option value="ARTIST">Artist</option>
                        <option value="STAFF">Staff</option>
                      </select>
                    </Field>
                    <Field label="Tier">
                      <select style={inputStyle} value={editForm.tier}
                              onChange={(e) => setEditForm((f) => ({ ...f, tier: e.target.value }))}>
                        <option value="">—</option>
                        <option value="EARLY">Early</option>
                        <option value="STANDARD">Standard</option>
                        <option value="VIP">VIP</option>
                      </select>
                    </Field>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Admits">
                      <input type="number" min="1" max="12" style={inputStyle} value={editForm.admits}
                             onChange={(e) => setEditForm((f) => ({ ...f, admits: e.target.value }))} />
                    </Field>
                    <Field label="Ticket number">
                      <input style={inputStyle} value={editForm.ticketRef}
                             onChange={(e) => setEditForm((f) => ({ ...f, ticketRef: e.target.value }))} />
                    </Field>
                  </div>

                  <Field label="Note">
                    <input maxLength={150} style={inputStyle} value={editForm.note}
                           onChange={(e) => setEditForm((f) => ({ ...f, note: e.target.value }))} />
                  </Field>

                  <label className="flex items-center gap-2.5" style={{ cursor: "pointer" }}>
                    <input type="checkbox" checked={resend} onChange={(e) => setResend(e.target.checked)} />
                    <span style={{ ...fontText, fontSize: "15px", color: theme.ink }}>
                      Send them the pass again after saving
                    </span>
                  </label>

                  <div className="flex gap-3">
                    <button onClick={saveEdit} style={btn}>SAVE</button>
                    <button onClick={() => setEditing(null)} style={ghost}>CANCEL</button>
                  </div>
                </div>
              </div>
            )}
            </div>
          );
        })}
      </Section>
    </>
  );
}

// ── EVENTS ──────────────────────────────────────────────────────────────────

function Events({ parties, reload }) {
  const [form, setForm] = useState({ id: "", name: "", dateLabel: "", venue: "", doorsCloseAt: "", startsAt: "", startsAtLocal: "", lineupText: "", minimumAge: 16 });
  const [msg, setMsg] = useState("");
  const set = (k) => (e) => {
    const value = e.target.value;
    setForm((f) => {
      const next = { ...f, [k]: value };
      // Suggest the usual number when the kind changes, still editable.
      if (k === "kind") next.admits = value === "COUPLE" ? 2 : value === "FAMILY" ? 4 : 1;
      return next;
    });
  };

  const add = async (e) => {
    e.preventDefault();
    setMsg("");
    if (!form.id || !form.name || !form.doorsCloseAt) {
      setMsg("An id, a name and a closing time are needed.");
      return;
    }
    // "23:00 Artist" per line becomes the stored list.
    const lineup = String(form.lineupText || "").split("\n").map((l) => l.trim()).filter(Boolean)
      .map((line) => {
        const m = line.match(/^(\d{1,2}[:.]\d{2})\s+(.*)$/);
        return m ? { time: m[1].replace(".", ":"), artist: m[2] } : { time: "", artist: line };
      });

    const res = await api.createParty({ ...form, lineup: JSON.stringify(lineup) });
    if (!res.ok) { setMsg(res.error || "Couldn't add that event."); return; }
    setForm({ id: "", name: "", dateLabel: "", venue: "", doorsCloseAt: "", startsAt: "", startsAtLocal: "", lineupText: "", minimumAge: 16 });
    reload();
  };

  const archive = async (id, name) => {
    if (!window.confirm(`Remove ${name}? Its passes stop working, but the record of the night is kept.`)) return;
    const res = await api.archiveParty(id);
    if (!res.ok) setMsg(res.error || "Couldn't remove that event.");
    reload();
  };

  return (
    <>
      <Section title="ADD AN EVENT">
        <form onSubmit={add} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Short id"><input style={inputStyle} value={form.id} onChange={set("id")} placeholder="mar07" /></Field>
            <Field label="Name"><input style={inputStyle} value={form.name} onChange={set("name")} placeholder="07.03.2027" /></Field>
          </div>
          <Field label="Date as shown"><input style={inputStyle} value={form.dateLabel} onChange={set("dateLabel")} placeholder="7 March 2027" /></Field>
          <Field label="Venue"><input style={inputStyle} value={form.venue} onChange={set("venue")} placeholder="Leave empty if undisclosed" /></Field>
          <Field label="Doors open">
            <input type="datetime-local" style={inputStyle} value={form.startsAtLocal || ""}
                   onChange={(e) => setForm((f) => ({
                     ...f, startsAtLocal: e.target.value,
                     startsAt: e.target.value ? e.target.value + ":00+02:00" : "",
                   }))} />
          </Field>
          <Field label="Doors close">
            <input type="datetime-local" style={inputStyle} value={form.doorsCloseAt}
                   onChange={(e) => setForm((f) => ({ ...f, doorsCloseAt: e.target.value + ":00+02:00" }))} />
          </Field>
          <p className="m-0" style={{ ...fontText, fontSize: "14px", lineHeight: 1.5, color: theme.ink2 }}>
            Set this to the morning after, not the start of the night — passes stop
            working at this moment, and anyone arriving late would be refused by
            their own ticket.
          </p>
          {/* Set times, one per line. Shown on every guest's pass, so they
              know when to arrive rather than guessing. */}
          <ImagePicker label="ARTWORK" value={form.artwork || ""} folder="events"
                       onChange={(path) => setForm((f) => ({ ...f, artwork: path }))} />

          <Field label="Description">
            <textarea rows={3} style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }}
                      value={form.description || ""}
                      onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          </Field>

          <Field label="Capacity">
            <input type="number" style={inputStyle} value={form.capacity || ""}
                   onChange={(e) => setForm((f) => ({ ...f, capacity: Number(e.target.value) || null }))}
                   placeholder="Leave empty for no limit" />
          </Field>

          <Field label="Set times">
            <textarea
              rows={4}
              value={form.lineupText || ""}
              onChange={(e) => setForm((f) => ({ ...f, lineupText: e.target.value }))}
              placeholder={"23:00 Stephanno Jr.\n00:30 Mario Daniel\n02:00 CEASE"}
              style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }}
            />
          </Field>

          <button type="submit" style={btn}>ADD EVENT</button>
        </form>
        <Notice message={msg} />
      </Section>

      <Section title={`EVENTS — ${parties.length}`}>
        {parties.map((p) => (
          <div key={p.id} className="flex items-center gap-3 py-3" style={{ borderBottom: `1px solid ${theme.rule}` }}>
            <span className="flex-1 min-w-0">
              <span className="block" style={{ ...fontText, fontSize: "16px", color: theme.ink }}>{p.name}</span>
              <span className="block" style={{ ...fontUtility, fontSize: "8px", letterSpacing: "0.12em", color: theme.ink2 }}>
                {p.date_label} · {p.issued} ISSUED · CLOSES {new Date(p.doors_close_at).toLocaleString()}
              </span>
            </span>
            <button onClick={() => archive(p.id, p.name)}
                    style={{ ...fontUtility, fontSize: "8.5px", letterSpacing: "0.14em",
                             color: theme.bad, background: "transparent", border: 0, cursor: "pointer" }}>
              REMOVE
            </button>
          </div>
        ))}
      </Section>
    </>
  );
}

// ── TEAM ────────────────────────────────────────────────────────────────────

function Team() {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState({ username: "", password: "", role: "STAFF", displayName: "", email: "", phone: "", permissions: { scan: true } });
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const res = await api.listTeam();
    if (res.ok) setRows(res.team || []);
    else setMsg(res.error || "Couldn't load the team.");
  }, []);
  useEffect(() => { load(); }, [load]);

  /*
    Four random words and a number. Long enough to be strong, and typeable at
    a dark door — a string of symbols gets written on a hand and mistyped,
    which ends with staff sharing one login.
  */
  // Picking a role fills in its usual permissions, still editable.
  const ROLE_DEFAULTS = {
    STAFF: { scan: true },
    OWNER: { scan: true, seeList: true, seeReasons: true, reset: true, seeContacts: true },
  };

  const setRole = (e) => {
    const role = e.target.value;
    setForm((f) => ({ ...f, role, permissions: { ...(ROLE_DEFAULTS[role] || {}) } }));
  };

  const makePassword = () => {
    const words = ["amber","anchor","basalt","beacon","bronze","cedar","cipher","cobalt","comet",
                   "copper","coral","delta","ember","falcon","flint","forge","garnet","granite",
                   "harbor","indigo","ivory","jasper","lantern","linen","lunar","marble","mica",
                   "nectar","nickel","north","obsidian","onyx","orbit","pewter","pillar","prism",
                   "quartz","quill","raven","relic","ripple","river","sable","signal","silver",
                   "slate","spruce","summit","tempest","thistle","timber","topaz","tundra",
                   "umber","velvet","vessel","willow","zenith"];
    const pick = () => words[crypto.getRandomValues(new Uint32Array(1))[0] % words.length];
    const digits = 1000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 9000);
    setForm((f) => ({ ...f, password: `${pick()}-${pick()}-${pick()}-${pick()}-${digits}` }));
  };

  const set = (k) => (e) => {
    const value = e.target.value;
    setForm((f) => {
      const next = { ...f, [k]: value };
      // Suggest the usual number when the kind changes, still editable.
      if (k === "kind") next.admits = value === "COUPLE" ? 2 : value === "FAMILY" ? 4 : 1;
      return next;
    });
  };

  const add = async (e) => {
    e.preventDefault();
    setMsg("");
    if (form.password.length < 12) {
      setMsg("Use at least 12 characters — this login can open the door.");
      return;
    }
    const res = await api.createMember(form);
    if (!res.ok) { setMsg(res.error || "Couldn't create that account."); return; }
    setMsg(res.email?.sent
      ? `Created ${form.username} — their details have been emailed.`
      : `Created ${form.username}. NOT emailed (${res.email?.reason || "no address"}) — send the password yourself. It isn't stored anywhere readable.`);
    setForm({ username: "", password: "", role: "STAFF", displayName: "", email: "", phone: "", permissions: { scan: true } });
    load();
  };

  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState({});

  const startEdit = (m) => {
    setEditing(m.username);
    let perms = {};
    try { perms = m.permissions ? JSON.parse(m.permissions) : {}; } catch { perms = {}; }
    setEditForm({
      displayName: m.display_name || "", email: m.email || "", phone: m.phone || "",
      role: m.role, password: "", permissions: { ...(ROLE_DEFAULTS[m.role] || {}), ...perms },
    });
  };

  const saveEdit = async () => {
    setMsg("");
    const payload = { ...editForm };
    if (!payload.password) delete payload.password;   // only change it if asked
    const res = await api.editMember(editing, payload);
    if (!res.ok) { setMsg(res.error || "Couldn't save."); return; }
    setMsg(payload.password
      ? (res.email?.sent ? "Saved — new details emailed." : `Saved. Not emailed: ${res.email?.reason || "no address"}.`)
      : "Saved.");
    setEditing(null);
    load();
  };

  const suspend = async (username, active) => {
    const res = await api.setMemberActive(username, active);
    if (!res.ok) setMsg(res.error || "Couldn't change that account.");
    load();
  };

  const remove = async (username) => {
    if (!window.confirm(`Delete ${username}? Suspending is usually better — it keeps their history.`)) return;
    const res = await api.deleteMember(username);
    if (!res.ok) setMsg(res.error || "Couldn't delete that account.");
    load();
  };

  return (
    <>
      <Section title="ADD SOMEONE">
        <form onSubmit={add} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Username"><input style={inputStyle} value={form.username} onChange={set("username")} autoCapitalize="none" /></Field>
            <Field label="Role">
              <select style={inputStyle} value={form.role} onChange={setRole}>
                <option value="STAFF">Door staff</option>
                <option value="OWNER">Management</option>
              </select>
            </Field>
          </div>
          <Field label="Their name"><input style={inputStyle} value={form.displayName} onChange={set("displayName")} /></Field>
          <Field label="Email"><input type="email" style={inputStyle} value={form.email} onChange={set("email")} /></Field>
          <Field label="Phone"><input type="tel" style={inputStyle} value={form.phone} onChange={set("phone")} /></Field>
          {/* What this account may do. Defaults follow the role, and every
              box can be changed — a door supervisor can be given the list
              without being promoted to management. */}
          <div className="pt-1">
            <p className="m-0 mb-2" style={{ ...fontUtility, fontSize: "9px", letterSpacing: "0.18em", color: theme.brass }}>
              WHAT THIS ACCOUNT CAN DO
            </p>
            {PERMISSIONS.map((perm) => (
              <label key={perm.key} className="flex items-center gap-2.5 py-1.5" style={{ cursor: "pointer" }}>
                <input type="checkbox"
                       checked={!!(form.permissions || {})[perm.key]}
                       onChange={(e) => setForm((f) => ({
                         ...f, permissions: { ...(f.permissions || {}), [perm.key]: e.target.checked },
                       }))} />
                <span style={{ ...fontText, fontSize: "15.5px", color: theme.ink }}>{perm.label}</span>
              </label>
            ))}
          </div>

          <Field label="Password">
            <div className="flex gap-2">
              <input style={{ ...inputStyle, flex: 1 }} value={form.password} onChange={set("password")} />
              <button type="button" onClick={makePassword}
                      style={{ ...fontUtility, fontSize: "9px", letterSpacing: "0.14em", color: theme.ink,
                               background: "transparent", border: `1px solid ${theme.ink}`,
                               padding: "0 14px", cursor: "pointer" }}>
                GENERATE
              </button>
            </div>
          </Field>
          <button type="submit" style={btn}>CREATE ACCOUNT</button>
        </form>
        <Notice message={msg} tone={msg.startsWith("Created") ? "good" : "bad"} />
      </Section>

      <Section title={`TEAM — ${rows.length}`}>
        {rows.map((m) => (
          <div key={m.username}>
          <div className="flex items-center gap-3 py-3"
               style={{ borderBottom: `1px solid ${theme.rule}`, opacity: m.active ? 1 : 0.5 }}>
            <span className="flex-1 min-w-0">
              <span className="block" style={{ ...fontText, fontSize: "16px", color: theme.ink }}>
                {m.display_name}
              </span>
              <span className="block" style={{ ...fontUtility, fontSize: "8px", letterSpacing: "0.12em", color: theme.ink2 }}>
                {m.username} · {m.role}{m.active ? "" : " · SUSPENDED"}
              </span>
            </span>
            {m.role !== "BOSS" && (
              <>
                <button onClick={() => (editing === m.username ? setEditing(null) : startEdit(m))}
                        style={{ ...fontUtility, fontSize: "8.5px", letterSpacing: "0.14em",
                                 color: theme.ink, background: "transparent", border: 0, cursor: "pointer" }}>
                  {editing === m.username ? "CLOSE" : "EDIT"}
                </button>
                <button onClick={() => suspend(m.username, !m.active)}
                        style={{ ...fontUtility, fontSize: "8.5px", letterSpacing: "0.14em",
                                 color: theme.ink2, background: "transparent", border: 0, cursor: "pointer" }}>
                  {m.active ? "SUSPEND" : "RESTORE"}
                </button>
                <button onClick={() => remove(m.username)}
                        style={{ ...fontUtility, fontSize: "8.5px", letterSpacing: "0.14em",
                                 color: theme.bad, background: "transparent", border: 0, cursor: "pointer" }}>
                  DELETE
                </button>
              </>
            )}
          </div>

          {editing === m.username && (
            <div className="px-3 py-4 mb-3" style={{ border: `1px solid ${theme.ink}`, background: theme.sunk }}>
              <p className="m-0 mb-3" style={{ ...fontUtility, fontSize: "8.5px", letterSpacing: "0.18em", color: theme.brass }}>
                EDITING {m.username} — THE USERNAME ITSELF CANNOT CHANGE
              </p>

              <div className="space-y-3">
                <Field label="Their name">
                  <input style={inputStyle} value={editForm.displayName}
                         onChange={(e) => setEditForm((f) => ({ ...f, displayName: e.target.value }))} />
                </Field>
                <Field label="Email">
                  <input style={inputStyle} value={editForm.email}
                         onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))} />
                </Field>
                <Field label="Phone">
                  <input style={inputStyle} value={editForm.phone}
                         onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))} />
                </Field>
                <Field label="Role">
                  <select style={inputStyle} value={editForm.role}
                          onChange={(e) => setEditForm((f) => ({
                            ...f, role: e.target.value,
                            permissions: { ...(ROLE_DEFAULTS[e.target.value] || {}) },
                          }))}>
                    <option value="STAFF">Door staff</option>
                    <option value="OWNER">Management</option>
                  </select>
                </Field>

                <div>
                  <p className="m-0 mb-2" style={{ ...fontUtility, fontSize: "9px", letterSpacing: "0.18em", color: theme.brass }}>
                    WHAT THEY CAN DO
                  </p>
                  {PERMISSIONS.map((perm) => (
                    <label key={perm.key} className="flex items-center gap-2.5 py-1.5" style={{ cursor: "pointer" }}>
                      <input type="checkbox"
                             checked={!!(editForm.permissions || {})[perm.key]}
                             onChange={(e) => setEditForm((f) => ({
                               ...f, permissions: { ...(f.permissions || {}), [perm.key]: e.target.checked },
                             }))} />
                      <span style={{ ...fontText, fontSize: "15.5px", color: theme.ink }}>{perm.label}</span>
                    </label>
                  ))}
                </div>

                <Field label="New password (leave empty to keep theirs)">
                  <div className="flex gap-2">
                    <input style={{ ...inputStyle, flex: 1 }} value={editForm.password}
                           onChange={(e) => setEditForm((f) => ({ ...f, password: e.target.value }))} />
                    <button type="button"
                            onClick={() => {
                              makePassword();
                              setEditForm((f) => ({ ...f, password: form.password }));
                            }}
                            style={{ ...fontUtility, fontSize: "9px", letterSpacing: "0.14em", color: theme.ink,
                                     background: "transparent", border: `1px solid ${theme.ink}`,
                                     padding: "0 14px", cursor: "pointer" }}>
                      GENERATE
                    </button>
                  </div>
                </Field>
                <p className="m-0" style={{ ...fontText, fontSize: "14px", lineHeight: 1.5, color: theme.ink2 }}>
                  Setting a password signs them out everywhere and emails them
                  the new details.
                </p>

                <div className="flex gap-3">
                  <button onClick={saveEdit} style={btn}>SAVE</button>
                  <button onClick={() => setEditing(null)} style={ghost}>CANCEL</button>
                </div>
              </div>
            </div>
          )}
          </div>
        ))}
      </Section>
    </>
  );
}

// ── REQUESTS ────────────────────────────────────────────────────────────────

function Requests({ role, party }) {
  const [rows, setRows] = useState([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(null);

  const load = useCallback(async () => {
    const res = await api.listRequests();
    if (res.ok) setRows(res.requests || []);
    else setMsg(res.error || "Couldn't load the requests.");
  }, []);
  useEffect(() => { load(); }, [load]);

  const decide = async (id, decision) => {
    setBusy(id); setMsg("");
    const res = await api.decideRequest(id, decision, party);
    setBusy(null);
    if (!res.ok) { setMsg(res.error || "Couldn't record that."); return; }
    if (decision === "APPROVED") {
      setMsg(res.email?.sent
        ? `Approved — pass ${res.code} emailed.`
        : `Approved — pass ${res.code}. Not emailed: ${res.email?.reason || "send it yourself"}.`);
    }
    load();
  };

  const pending = rows.filter((r) => r.status === "PENDING");
  const decided = rows.filter((r) => r.status !== "PENDING");

  const card = (r) => (
    <div key={r.id} className="py-3.5" style={{ borderBottom: `1px solid ${theme.rule}` }}>
      <div className="flex items-start gap-3">
        <span className="flex-1 min-w-0">
          <span className="block" style={{ ...fontText, fontSize: "16px", color: theme.ink }}>{r.name}</span>
          <span className="block" style={{ ...fontUtility, fontSize: "8.5px", letterSpacing: "0.12em", color: theme.ink2 }}>
            {r.email}{r.phone ? ` · ${r.phone}` : ""}
            {r.people > 1 ? ` · ${r.people} people` : ""}
            {" · "}{new Date(r.created_at).toLocaleDateString()}
            {r.pass_code ? ` · ${r.pass_code}` : ""}
          </span>
        </span>
        {r.status === "PENDING" && role.can.issuePasses && (
          <span className="flex gap-3 shrink-0">
            <button disabled={busy === r.id} onClick={() => decide(r.id, "APPROVED")}
                    style={{ ...fontUtility, fontSize: "8.5px", letterSpacing: "0.14em",
                             color: theme.good, background: "transparent", border: 0, cursor: "pointer" }}>
              {busy === r.id ? "…" : "APPROVE"}
            </button>
            <button disabled={busy === r.id} onClick={() => decide(r.id, "DECLINED")}
                    style={{ ...fontUtility, fontSize: "8.5px", letterSpacing: "0.14em",
                             color: theme.bad, background: "transparent", border: 0, cursor: "pointer" }}>
              DECLINE
            </button>
          </span>
        )}
        {r.status !== "PENDING" && (
          <span style={{ ...fontUtility, fontSize: "8.5px", letterSpacing: "0.14em",
                         color: r.status === "APPROVED" ? theme.good : theme.ink2 }}>
            {r.status}
          </span>
        )}
      </div>
      {r.note && (
        <p className="m-0 mt-1.5" style={{ ...fontText, fontSize: "15px", color: theme.ink2, fontStyle: "italic" }}>
          “{r.note}”
        </p>
      )}
    </div>
  );

  return (
    <>
      <Notice message={msg} tone={msg.startsWith("Approved") ? "good" : "bad"} />
      <Section title={`WAITING — ${pending.length}`}>
        {pending.length === 0 && (
          <p className="m-0" style={{ ...fontText, fontSize: "16px", color: theme.ink2 }}>
            Nothing waiting.
          </p>
        )}
        {pending.map(card)}
      </Section>
      {decided.length > 0 && <Section title={`DECIDED — ${decided.length}`}>{decided.map(card)}</Section>}
    </>
  );
}

// ── THE NIGHT ───────────────────────────────────────────────────────────────

/*
  ── N01 · THE LINK FOR THE SCREEN ON THE WALL ─────────────────────────────

  Lives with THE NIGHT because that is what it shows: the count, live, on a
  spare phone propped in a corner. Not with settings, and not with the door
  list — it is a thing you make on the afternoon of a night and forget.

  IT EXPIRES BY ITSELF, thirty-six hours out. A headcount link pasted into a
  group chat and still readable next March is a small leak nobody will ever
  remember to close, and nobody is going to come back here to revoke it.
*/
function WallLink({ party }) {
  const [link, setLink] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const make = async () => {
    setBusy(true);
    setMsg("");
    const res = await api.makeShareLink("DOOR", party, "Wall display");
    setBusy(false);
    if (res.ok) setLink(`${window.location.origin}/wall/${res.token}`);
    else setMsg(res.error || "Could not make a link.");
  };

  const copy = async () => {
    try { await navigator.clipboard.writeText(link); setMsg("Copied."); }
    catch { setMsg("Select it and copy it by hand."); }
  };

  if (!party) return null;

  return (
    <Section title="THE NUMBER ON THE WALL">
      <p className="m-0 mb-4" style={{ ...fontText, fontSize: "16px", lineHeight: 1.55, color: theme.ink2 }}>
        Open this on a spare phone or a laptop and prop it up somewhere. It
        shows how many are in and nothing else — no names, no codes, because a
        screen in a public room is a screen anyone can photograph. It needs no
        sign-in and it stops working a day and a half from now.
      </p>

      {link ? (
        <>
          <p className="m-0 mb-3 px-3 py-3" style={{
            ...fontUtility, fontSize: "12px", wordBreak: "break-all", color: theme.ink,
            background: theme.sunk, border: `1px solid ${theme.ink}`,
          }}>{link}</p>
          <div className="flex gap-2">
            <button onClick={copy}
                    style={{ ...fontUtility, fontSize: "9px", letterSpacing: "0.16em", cursor: "pointer",
                             padding: "10px 16px", background: theme.ink, color: theme.bg, border: 0 }}>
              COPY IT
            </button>
            <a href={link} target="_blank" rel="noreferrer"
               style={{ ...fontUtility, fontSize: "9px", letterSpacing: "0.16em",
                        padding: "10px 16px", color: theme.ink, textDecoration: "none",
                        border: `1px solid ${theme.rule}` }}>
              OPEN IT ↗
            </a>
          </div>
        </>
      ) : (
        <button onClick={make} disabled={busy}
                style={{ ...fontUtility, fontSize: "9.5px", letterSpacing: "0.16em", cursor: "pointer",
                         padding: "11px 20px", background: theme.ink, color: theme.bg, border: 0 }}>
          {busy ? "MAKING…" : "MAKE THE LINK"}
        </button>
      )}
      {msg && (
        <p className="m-0 mt-3" style={{ ...fontUtility, fontSize: "9px", letterSpacing: "0.14em", color: theme.ink2 }}>
          {msg.toUpperCase()}
        </p>
      )}
    </Section>
  );
}

function Stats({ party }) {
  const [data, setData] = useState(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!party) return;
    api.fetchStats(party).then((res) => {
      if (res.ok) setData(res);
      else setMsg(res.error || "Couldn't load the numbers.");
    });
  }, [party]);

  if (!data) return <><Notice message={msg} /><Section title="THE NIGHT"><p className="m-0" style={{ ...fontText, fontSize: "16px", color: theme.ink2 }}>Loading…</p></Section><WallLink party={party} /></>;

  const t = data.totals || {};
  const peak = (data.byHour || []).reduce((best, h) => (h.n > (best?.n || 0) ? h : best), null);
  const maxHour = Math.max(1, ...(data.byHour || []).map((h) => h.n));

  return (
    <>
      <WallLink party={party} />
      <Section title="THE NIGHT">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { n: t.issued || 0, label: "ISSUED" },
            { n: t.admitted || 0, label: "CAME IN" },
            { n: t.noShows || 0, label: "NO-SHOWS" },
            { n: t.refusals || 0, label: "REFUSED" },
          ].map((b) => (
            <div key={b.label} className="text-center py-4" style={{ border: `1px solid ${theme.rule}` }}>
              <p className="m-0" style={{ ...fontDisplay, fontWeight: 300, fontSize: "32px", color: theme.ink,
                                          fontVariantNumeric: "tabular-nums lining-nums" }}>{b.n}</p>
              <p className="m-0 mt-1" style={{ ...fontUtility, fontSize: "8px", letterSpacing: "0.16em", color: theme.ink2 }}>
                {b.label}
              </p>
            </div>
          ))}
        </div>
      </Section>

      {/* Arrival times are the useful part — they tell you whether to open
          earlier or move the headline. */}
      {data.byHour?.length > 0 && (
        <Section title={`WHEN THEY ARRIVED${peak ? ` — BUSIEST AT ${peak.hour}:00` : ""}`}>
          {data.byHour.map((h) => (
            <div key={h.hour} className="flex items-center gap-3 py-1.5">
              <span style={{ ...fontUtility, fontSize: "9px", letterSpacing: "0.1em", color: theme.ink2, width: "42px" }}>
                {h.hour}:00
              </span>
              <span style={{ flex: 1, height: "14px", background: theme.rule }}>
                <span style={{ display: "block", height: "100%", width: `${(h.n / maxHour) * 100}%`, background: theme.ink }} />
              </span>
              <span style={{ ...fontUtility, fontSize: "9px", color: theme.ink2, width: "34px", textAlign: "right" }}>
                {h.n}
              </span>
            </div>
          ))}
        </Section>
      )}

      {data.byKind?.length > 0 && (
        <Section title="BY KIND">
          {data.byKind.map((k) => (
            <div key={k.kind} className="flex justify-between py-2.5" style={{ borderBottom: `1px solid ${theme.rule}` }}>
              <span style={{ ...fontText, fontSize: "16px", color: theme.ink }}>{k.kind}</span>
              <span style={{ ...fontUtility, fontSize: "10px", color: theme.ink2 }}>{k.n}</span>
            </div>
          ))}
        </Section>
      )}
    </>
  );
}

// ── POSTS ───────────────────────────────────────────────────────────────────

function Posts() {
  const [rows, setRows] = useState([]);
  const [msg, setMsg] = useState("");
  const [tone, setTone] = useState("bad");
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);

  const blank = {
    slug: "", headline: "", summary: "", bodyText: "", kicker: "", signoff: "",
    category: "NEWS", issue: "", dateLabel: "", sortDate: new Date().toISOString().slice(0, 10),
    poster: "", photo: "", caption: "", link: "", linkLabel: "", published: true,
  };
  const [form, setForm] = useState(blank);

  const load = useCallback(async () => {
    const res = await api.listPosts();
    if (res.ok) setRows(res.posts || []);
    else setMsg(res.error || "Couldn't load the posts.");
  }, []);
  useEffect(() => { load(); }, [load]);

  const set = (k) => (e) =>
    setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  // A headline becomes a web address: lowercase, dashes, nothing else.
  const slugify = (text) =>
    String(text).toLowerCase().trim()
      .replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").slice(0, 60);

  const startNew = () => { setForm(blank); setEditing("new"); };

  const startEdit = (p) => {
    setEditing(p.slug);
    setForm({
      slug: p.slug, headline: p.headline || "", summary: p.summary || "",
      bodyText: (p.body || []).join("\n\n"), kicker: p.kicker || "", signoff: p.signoff || "",
      category: p.category || "NEWS", issue: p.issue || "",
      dateLabel: p.date_label || p.date || "", sortDate: p.sort_date || p.sortDate || "",
      poster: p.poster || "", photo: p.photo || "", caption: p.caption || "",
      link: p.link || "", linkLabel: p.link_label || p.linkLabel || "",
      published: p.published !== false,
    });
  };

  const save = async () => {
    setMsg("");
    if (!form.headline.trim()) { setTone("bad"); setMsg("A headline is needed."); return; }

    const payload = {
      ...form,
      slug: form.slug || slugify(form.headline),
      // A blank line separates paragraphs, the way anyone writing expects.
      body: form.bodyText.split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean),
      categories: [form.category],
    };
    delete payload.bodyText;

    setBusy(true);
    const res = editing === "new"
      ? await api.createPost(payload)
      : await api.editPost(editing, payload);
    setBusy(false);

    if (!res.ok) { setTone("bad"); setMsg(res.error || "Couldn't save."); return; }
    setTone("good");
    setMsg(editing === "new" ? "Posted." : "Saved.");
    setEditing(null);
    load();
  };

  const remove = async (slug, headline) => {
    if (!window.confirm(`Delete "${headline}"? This cannot be undone.`)) return;
    const res = await api.deletePost(slug);
    if (!res.ok) { setTone("bad"); setMsg(res.error || "Couldn't delete."); return; }
    setTone("good"); setMsg("Deleted.");
    load();
  };


  return (
    <>
      <Notice message={msg} tone={tone} />

      {!editing && (
        <Section title={`POSTS — ${rows.length}`}>
          <button onClick={startNew} style={{ ...btn, marginBottom: "16px" }}>WRITE A POST</button>
          {rows.map((p) => (
            <div key={p.slug} className="flex items-center gap-3 py-3"
                 style={{ borderBottom: `1px solid ${theme.rule}`, opacity: p.published === false ? 0.55 : 1 }}>
              <span className="flex-1 min-w-0">
                <span className="block" style={{ ...fontText, fontSize: "16.5px", color: theme.ink }}>
                  {p.headline}
                </span>
                <span className="block" style={{ ...fontUtility, fontSize: "8px", letterSpacing: "0.12em", color: theme.ink2 }}>
                  {p.category}{p.date_label ? ` · ${p.date_label}` : ""}
                  {p.published === false ? " · DRAFT" : ""}
                </span>
              </span>
              <button onClick={() => startEdit(p)}
                      style={{ ...fontUtility, fontSize: "8.5px", letterSpacing: "0.14em", color: theme.ink,
                               background: "transparent", border: 0, cursor: "pointer" }}>
                EDIT
              </button>
              <button onClick={() => remove(p.slug, p.headline)}
                      style={{ ...fontUtility, fontSize: "8.5px", letterSpacing: "0.14em", color: theme.bad,
                               background: "transparent", border: 0, cursor: "pointer" }}>
                DELETE
              </button>
            </div>
          ))}
        </Section>
      )}

      {editing && (
        <Section title={editing === "new" ? "A NEW POST" : `EDITING ${editing}`}>
          <div className="space-y-3">
            <Field label="Headline">
              <input style={inputStyle} value={form.headline} onChange={set("headline")} />
            </Field>
            <Field label="Summary — one or two lines, shown on the news index">
              <input style={inputStyle} value={form.summary} onChange={set("summary")} />
            </Field>
            <Field label="The post — leave a blank line between paragraphs">
              <textarea rows={10} style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6 }}
                        value={form.bodyText} onChange={set("bodyText")} />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Category">
                <select style={inputStyle} value={form.category} onChange={set("category")}>
                  {["NEWS","ARTISTS","MUSIC","RECORDS","EVENTS","INTERVIEWS","INDUSTRY"].map((c) =>
                    <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Date shown">
                <input style={inputStyle} value={form.dateLabel} onChange={set("dateLabel")}
                       placeholder="21 AUGUST 2026" />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Sort date">
                <input type="date" style={inputStyle} value={form.sortDate} onChange={set("sortDate")} />
              </Field>
              <Field label="Issue">
                <input style={inputStyle} value={form.issue} onChange={set("issue")} placeholder="VOL. 01, NO. 7" />
              </Field>
            </div>

            {/* Upload straight from the phone, or pick something already
                on the site. */}
            <ImagePicker label="POSTER" value={form.poster} folder="posters"
                         onChange={(path) => setForm((f) => ({ ...f, poster: path }))} />

            <ImagePicker label="PHOTO" value={form.photo} folder="posts"
                         onChange={(path) => setForm((f) => ({ ...f, photo: path }))} />

            <Field label="Photo caption">
              <input style={inputStyle} value={form.caption} onChange={set("caption")} />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Kicker">
                <input style={inputStyle} value={form.kicker} onChange={set("kicker")} />
              </Field>
              <Field label="Sign-off">
                <input style={inputStyle} value={form.signoff} onChange={set("signoff")} />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Button link">
                <input style={inputStyle} value={form.link} onChange={set("link")} />
              </Field>
              <Field label="Button text">
                <input style={inputStyle} value={form.linkLabel} onChange={set("linkLabel")} />
              </Field>
            </div>

            {editing === "new" && (
              <Field label="Web address — left empty, it comes from the headline">
                <input style={inputStyle} value={form.slug} onChange={set("slug")}
                       placeholder={slugify(form.headline) || "a-new-post"} />
              </Field>
            )}

            <label className="flex items-center gap-2.5 pt-1" style={{ cursor: "pointer" }}>
              <input type="checkbox" checked={form.published} onChange={set("published")} />
              <span style={{ ...fontText, fontSize: "16px", color: theme.ink }}>
                Published — uncheck to keep it as a draft
              </span>
            </label>

            <div className="flex gap-3 pt-1">
              <button onClick={save} disabled={busy} style={{ ...btn, opacity: busy ? 0.6 : 1 }}>
                {busy ? "SAVING…" : editing === "new" ? "POST IT" : "SAVE"}
              </button>
              <button onClick={() => setEditing(null)} style={ghost}>CANCEL</button>
            </div>
          </div>
        </Section>
      )}
    </>
  );
}

// ── ARTISTS, RECORDS, MIXES ─────────────────────────────────────────────────

/*
  One editor for all three.

  They differ only in which fields they carry, so the shape of each is
  described here rather than written out three times. Adding a field means
  adding a line, not another screen.
*/
const CONTENT_SHAPES = {
  artists: {
    label: "artist", key: "id", title: (x) => x.name,
    blank: { id: "", name: "", alias: "", type: "DJ", genres: [], country: "", location: "",
             descr: "", bio: "", photo: "", poster: "", instagram: "", published: true },
    fields: [
      { k: "name", label: "Name" },
      { k: "alias", label: "Also known as" },
      { k: "type", label: "Type", options: ["DJ", "Producer", "Live Act"] },
      { k: "genres", label: "Genres — comma separated", list: true },
      { k: "country", label: "Country" },
      { k: "location", label: "Location" },
      { k: "descr", label: "One line for the roster" },
      { k: "bio", label: "Biography", long: true },
      { k: "instagram", label: "Instagram key (from social.js)" },
      { k: "photo", label: "PHOTO", image: true, folder: "artists" },
      { k: "poster", label: "POSTER", image: true, folder: "posters" },
    ],
  },
  records: {
    label: "release", key: "slug", title: (x) => x.title,
    blank: { slug: "", title: "", artist: "", kind: "ALBUM", tagline: "", catalog: "",
             release_date: "", cover: "", playlist: "", note: "", tracks: [], published: true },
    fields: [
      { k: "title", label: "Title" },
      { k: "artist", label: "Artist" },
      { k: "kind", label: "Kind", options: ["ALBUM", "EP", "SINGLE"] },
      { k: "tagline", label: "Tagline" },
      { k: "catalog", label: "Catalogue number" },
      { k: "release_date", label: "Release date" },
      { k: "playlist", label: "Playlist link" },
      { k: "note", label: "Note", long: true },
      { k: "cover", label: "COVER", image: true, folder: "records" },
    ],
  },
  mixes: {
    label: "sessions page", key: "slug", title: (x) => x.name,
    blank: { slug: "", artist_id: "", name: "", alias: "", photo: "", genres: [],
             intro: "", coming_soon: false, coming_soon_note: "", sections: [], published: true },
    fields: [
      { k: "name", label: "Name" },
      { k: "alias", label: "Also known as" },
      { k: "genres", label: "Genres — comma separated", list: true },
      { k: "intro", label: "Intro", long: true },
      { k: "coming_soon_note", label: "Coming-soon note" },
      { k: "photo", label: "PHOTO", image: true, folder: "artists" },
    ],
  },
};

/*
  THE SESSIONS EDITOR — the part of a mixes page that was never editable.

  A mixes page is a person (name, photo, intro) plus their SESSIONS, grouped
  into sections. Everything except the sessions could be changed from the
  console; the sessions themselves lived in a JSON file, which meant adding a
  set meant a deploy. This is the missing half.

  Adding one is a single paste. Drop in the link and the name and the platform
  fill themselves in — the server reads them out of the link, the same
  resolver the song pool uses. Both are still editable afterwards, because a
  service's own title is often "SET 01 FINAL FINAL v3" and yours is better.
*/

const PLATFORMS = ["AUTO", "YOUTUBE", "SOUNDCLOUD", "MIXCLOUD", "SPOTIFY", "APPLE MUSIC", "BANDCAMP", "LISTEN"];

function Sessions({ sections, onChange }) {
  const [busyAt, setBusyAt] = useState("");

  const edit = (si, fn) => {
    const next = sections.map((s) => ({ ...s, items: [...(s.items || [])] }));
    fn(next[si], next);
    onChange(next);
  };

  /*
    The link is the only thing anyone actually has to hand. Everything else is
    derived from it the moment it stops changing, and only into fields that are
    still empty — retyping over something a person just wrote is worse than
    leaving a blank.
  */
  const readLink = async (si, ii, url) => {
    if (!/^https?:\/\//i.test(url)) return;
    const at = `${si}-${ii}`;
    setBusyAt(at);
    const res = await api.resolveLink(url);
    setBusyAt("");
    if (!res.ok) return;
    edit(si, (sec) => {
      const item = { ...sec.items[ii] };
      if (!item.title) item.title = res.artist ? `${res.artist} — ${res.title}` : res.title;
      if (!item.icon && res.provider && res.provider !== "LINK") item.icon = res.provider;
      sec.items[ii] = item;
    });
  };

  return (
    <div className="mt-7">
      <p className="m-0 mb-3" style={{ ...fontUtility, fontSize: "9.5px", letterSpacing: "0.2em", color: theme.brass }}>
        SESSIONS
      </p>

      {sections.length === 0 && (
        <p className="m-0 mb-3" style={{ ...fontText, fontSize: "15px", lineHeight: 1.55, color: theme.ink2 }}>
          Nothing here yet. A section is a heading — “2026”, “Radio”, “Live” —
          and the sets go under it.
        </p>
      )}

      {sections.map((sec, si) => (
        <div key={si} className="mb-6" style={{ border: `1px solid ${theme.rule}`, padding: "14px" }}>
          <div className="flex items-center gap-3">
            <input value={sec.label || ""} placeholder="Section heading"
                   onChange={(e) => edit(si, (s) => { s.label = e.target.value; })}
                   style={{ ...inputStyle, flex: 1 }} />
            <button onClick={() => onChange(sections.filter((_, i) => i !== si))}
                    style={{ ...fontUtility, fontSize: "8.5px", letterSpacing: "0.14em", cursor: "pointer",
                             padding: "9px 11px", background: "transparent",
                             border: `1px solid ${theme.rule}`, color: theme.ink }}>
              REMOVE SECTION
            </button>
          </div>

          {(sec.items || []).map((item, ii) => (
            <div key={ii} className="mt-3.5 pt-3.5" style={{ borderTop: `1px solid ${theme.rule}` }}>
              <div className="flex items-center gap-3">
                <span style={{ ...fontUtility, fontSize: "10px", color: theme.brass, width: "26px" }}>
                  {String(ii + 1).padStart(2, "0")}
                </span>
                <input value={item.url || ""} placeholder="Link to the set"
                       inputMode="url" autoCapitalize="none" autoCorrect="off"
                       onChange={(e) => edit(si, (s) => { s.items[ii] = { ...s.items[ii], url: e.target.value }; })}
                       onBlur={(e) => readLink(si, ii, e.target.value.trim())}
                       style={{ ...inputStyle, flex: 1 }} />
                <button onClick={() => edit(si, (s) => { s.items.splice(ii, 1); })}
                        style={{ ...fontUtility, fontSize: "8.5px", letterSpacing: "0.14em", cursor: "pointer",
                                 padding: "9px 11px", background: theme.ink, border: 0, color: theme.bg }}>
                  ✕
                </button>
              </div>

              <input value={item.title || ""} placeholder="What to call it"
                     onChange={(e) => edit(si, (s) => { s.items[ii] = { ...s.items[ii], title: e.target.value }; })}
                     style={{ ...inputStyle, width: "100%", marginTop: "8px" }} />

              <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                <span style={{ ...fontUtility, fontSize: "8.5px", letterSpacing: "0.18em", color: theme.ink2, marginRight: "4px" }}>
                  {busyAt === `${si}-${ii}` ? "READING THE LINK…" : "ICON"}
                </span>
                {PLATFORMS.map((pf) => {
                  const on = (item.icon || "AUTO") === pf;
                  return (
                    <button key={pf} onClick={() => edit(si, (s) => {
                              s.items[ii] = { ...s.items[ii], icon: pf === "AUTO" ? "" : pf };
                            })}
                            style={{ ...fontUtility, fontSize: "8.5px", letterSpacing: "0.12em", cursor: "pointer",
                                     padding: "7px 9px",
                                     color: on ? theme.bg : theme.ink,
                                     background: on ? theme.ink : "transparent",
                                     border: `1px solid ${on ? theme.ink : theme.rule}` }}>
                      {pf}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          <button onClick={() => edit(si, (s) => { s.items.push({ url: "", title: "", icon: "" }); })}
                  style={{ ...fontUtility, fontSize: "9px", letterSpacing: "0.16em", cursor: "pointer",
                           marginTop: "14px", padding: "10px 14px", background: "transparent",
                           border: `1px solid ${theme.ink}`, color: theme.ink }}>
            + ADD A SET
          </button>
        </div>
      ))}

      <button onClick={() => onChange([...sections, { label: "", items: [] }])}
              style={{ ...fontUtility, fontSize: "9.5px", letterSpacing: "0.16em", cursor: "pointer",
                       padding: "11px 16px", background: theme.ink, border: 0, color: theme.bg }}>
        + ADD A SECTION
      </button>
    </div>
  );
}

function ContentEditor({ kind }) {
  const shape = CONTENT_SHAPES[kind];
  const [rows, setRows] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(shape.blank);
  const [msg, setMsg] = useState("");
  const [tone, setTone] = useState("bad");

  const load = useCallback(async () => {
    const res = await api.listContent(kind);
    if (res.ok) setRows(res.items || []);
    else setMsg(res.error || "Couldn't load these.");
  }, [kind]);
  useEffect(() => { load(); setEditing(null); }, [load]);

  const startNew = () => { setForm({ ...shape.blank }); setEditing("new"); };
  const startEdit = (item) => {
    setEditing(item[shape.key]);
    setForm({ ...shape.blank, ...item });
  };

  const save = async () => {
    setMsg("");
    const payload = { ...form };
    // An empty key on a new record is unusable, so make one from the title.
    if (editing === "new" && !payload[shape.key]) {
      if (shape.key === "slug") {
        payload.slug = String(shape.title(payload) || "").toLowerCase().trim()
          .replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").slice(0, 50);
      } else {
        payload.id = Math.max(0, ...rows.map((r) => Number(r.id) || 0)) + 1;
      }
    }
    const res = editing === "new"
      ? await api.createContent(kind, payload)
      : await api.editContent(kind, editing, payload);
    if (!res.ok) { setTone("bad"); setMsg(res.error || "Couldn't save."); return; }
    setTone("good"); setMsg("Saved.");
    setEditing(null);
    load();
  };

  const remove = async (id, title) => {
    if (!window.confirm(`Delete ${title}? This cannot be undone.`)) return;
    const res = await api.deleteContent(kind, id);
    if (!res.ok) { setTone("bad"); setMsg(res.error || "Couldn't delete."); return; }
    setTone("good"); setMsg("Deleted.");
    load();
  };

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <>
      <Notice message={msg} tone={tone} />

      {!editing && (
        <Section title={`${kind.toUpperCase()} — ${rows.length}`}>
          <button onClick={startNew} style={{ ...btn, marginBottom: "16px" }}>
            ADD {shape.label.toUpperCase()}
          </button>
          {rows.map((item) => (
            <div key={item[shape.key]} className="flex items-center gap-3 py-3"
                 style={{ borderBottom: `1px solid ${theme.rule}`, opacity: item.published ? 1 : 0.55 }}>
              {(item.photo || item.cover) && (
                <img src={item.photo || item.cover} alt="" loading="lazy"
                     style={{ width: "38px", height: "38px", objectFit: "cover", flexShrink: 0 }} />
              )}
              <span className="flex-1 min-w-0">
                <span className="block" style={{ ...fontText, fontSize: "16.5px", color: theme.ink }}>
                  {shape.title(item)}
                </span>
                <span className="block" style={{ ...fontUtility, fontSize: "8px", letterSpacing: "0.12em", color: theme.ink2 }}>
                  {item[shape.key]}{item.published ? "" : " · HIDDEN"}
                </span>
              </span>
              <button onClick={() => startEdit(item)}
                      style={{ ...fontUtility, fontSize: "8.5px", letterSpacing: "0.14em", color: theme.ink,
                               background: "transparent", border: 0, cursor: "pointer" }}>EDIT</button>
              <button onClick={() => remove(item[shape.key], shape.title(item))}
                      style={{ ...fontUtility, fontSize: "8.5px", letterSpacing: "0.14em", color: theme.bad,
                               background: "transparent", border: 0, cursor: "pointer" }}>DELETE</button>
            </div>
          ))}
        </Section>
      )}

      {editing && (
        <Section title={editing === "new" ? `A NEW ${shape.label.toUpperCase()}` : `EDITING ${editing}`}>
          <div className="space-y-3">
            {shape.fields.map((f) => {
              if (f.image) {
                return (
                  <ImagePicker key={f.k} label={f.label} value={form[f.k] || ""} folder={f.folder}
                               onChange={(path) => set(f.k, path)} />
                );
              }
              if (f.options) {
                return (
                  <Field key={f.k} label={f.label}>
                    <select style={inputStyle} value={form[f.k] || ""} onChange={(e) => set(f.k, e.target.value)}>
                      {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </Field>
                );
              }
              if (f.list) {
                return (
                  <Field key={f.k} label={f.label}>
                    <input style={inputStyle}
                           value={Array.isArray(form[f.k]) ? form[f.k].join(", ") : (form[f.k] || "")}
                           onChange={(e) => set(f.k, e.target.value.split(",").map((x) => x.trim()).filter(Boolean))} />
                  </Field>
                );
              }
              if (f.long) {
                return (
                  <Field key={f.k} label={f.label}>
                    <textarea rows={5} style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6 }}
                              value={form[f.k] || ""} onChange={(e) => set(f.k, e.target.value)} />
                  </Field>
                );
              }
              return (
                <Field key={f.k} label={f.label}>
                  <input style={inputStyle} value={form[f.k] || ""} onChange={(e) => set(f.k, e.target.value)} />
                </Field>
              );
            })}

            {/*
              Only the sessions page has sessions. The other content kinds get
              their fields and nothing else.
            */}
            {kind === "mixes" && (
              <Sessions sections={form.sections || []}
                        onChange={(next) => set("sections", next)} />
            )}

            <label className="flex items-center gap-2.5 pt-1" style={{ cursor: "pointer" }}>
              <input type="checkbox" checked={form.published !== false}
                     onChange={(e) => set("published", e.target.checked)} />
              <span style={{ ...fontText, fontSize: "16px", color: theme.ink }}>
                Shown on the site
              </span>
            </label>

            <div className="flex gap-3 pt-1">
              <button onClick={save} style={btn}>SAVE</button>
              <button onClick={() => setEditing(null)} style={ghost}>CANCEL</button>
            </div>
          </div>
        </Section>
      )}
    </>
  );
}

// ── SETTINGS ────────────────────────────────────────────────────────────────

/*
  The sections of the settings panel, in the order they appear. Written out
  rather than discovered, because the index has to be drawn BEFORE the
  sections themselves exist in the tree — and a list that can silently fall
  out of step is worth one line of maintenance to keep honest.

  If you add a Section below, add it here. The check in scripts/smoke.mjs
  does not catch this; your eyes are the check.
*/
const SETTING_SECTIONS = [
  "THE LOOK",
  "THE HOME PAGE",
  "THE DOOR",
  "THE STAFF DOOR",
  "MOVEMENT",
  "THE SONG POOL",
  "THE FLOATING BAR",
  "THE SITE",
  "THE GUEST LIST",
  "THE WAITING LIST",
  "DEMOS",
  "BOOKINGS",
  "EMAIL",
];

function Settings({ parties }) {
  const [values, setValues] = useState(null);
  const [defaults, setDefaults] = useState({});
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.fetchSettings().then((res) => {
      if (res.ok) { setValues(res.settings); setSaved0(res.settings); setDefaults(res.defaults || {}); }
      else setMsg(res.error || "Couldn't load the settings.");
    });
  }, []);

  const [savedAt, setSavedAt] = useState(null);   // which section last confirmed

  /*
    WHAT HAS BEEN CHANGED BUT NOT SAVED.

    Every save button writes the whole settings object, so pressing any of
    them saves everything — which is convenient and also the reason this is
    needed. With seventy-odd controls across ten sections it was possible to
    change three things in three places, save one of them, and have no way to
    tell whether the other two had gone with it. Now the count is on screen
    and the answer is always yes.
  */
  const [saved0, setSaved0] = useState(null);      // what the server last gave us
  const dirty = values && saved0
    ? Object.keys(values).filter((k) => String(values[k]) !== String(saved0[k]))
    : [];

  const save = async (which) => {
    setBusy(true);
    const res = await api.saveSettings(values);
    setBusy(false);
    setMsg(res.ok ? "Saved. Changes apply straight away." : (res.error || "Couldn't save."));
    if (res.ok) {
      setSaved0(values);
      setSavedAt(which);
      setTimeout(() => setSavedAt((w) => (w === which ? null : w)), 2600);
    }
  };
  // Handed to each Section so the button beside the controls you just changed
  // is the one that confirms.
  const saver = (which) => ({
    onSave: () => save(which),
    saving: busy,
    saved: savedAt === which,
  });

  if (!values) return <><Notice message={msg} /><Section title="SETTINGS"><p className="m-0" style={{ ...fontText, fontSize: "16px", color: theme.ink2 }}>Loading…</p></Section></>;

  const set = (k, v) => setValues((s) => ({ ...s, [k]: v }));

  /*
    A named choice, not a free field.

    Every one of these could have been a colour picker or a slider, and every
    one of them would then have been able to produce an unreadable site in two
    seconds. A system with no edges is not a system. Three papers that all work
    with the ink; three accents that all work on the paper.
  */
  const Choice = ({ k, label, help, options }) => (
    <div className="py-4" style={{ borderBottom: `1px solid ${theme.rule}` }}>
      <p className="m-0 mb-2.5" style={{ ...fontText, fontSize: "16px", color: theme.ink }}>{label}</p>
      <div className="flex flex-wrap" style={{ gap: "6px" }}>
        {options.map((o) => {
          const on = values[k] === o.value;
          return (
            <button key={o.value} onClick={() => set(k, o.value)}
                    style={{ ...fontUtility, fontSize: "9.5px", letterSpacing: "0.16em",
                             padding: "10px 14px", cursor: "pointer",
                             display: "flex", alignItems: "center", gap: "8px",
                             color: on ? theme.bg : theme.ink,
                             background: on ? theme.ink : "transparent",
                             border: `1px solid ${on ? theme.ink : theme.rule}` }}>
              {o.swatch && (
                <span style={{ width: "13px", height: "13px", background: o.swatch,
                               border: `1px solid ${on ? "rgba(237,228,208,0.5)" : theme.rule}`,
                               display: "block" }} />
              )}
              {o.label}
            </button>
          );
        })}
      </div>
      {help && (
        <p className="m-0 mt-2" style={{ ...fontText, fontSize: "14px", lineHeight: 1.5, color: theme.ink2 }}>
          {help}
        </p>
      )}
    </div>
  );

  const Switch = ({ k, label, help }) => (
    <label className="flex items-start gap-3 py-3.5" style={{ cursor: "pointer", borderBottom: `1px solid ${theme.rule}` }}>
      <input type="checkbox" checked={!!values[k]} style={{ marginTop: "4px" }}
             onChange={(e) => set(k, e.target.checked)} />
      <span>
        <span className="block" style={{ ...fontText, fontSize: "16px", color: theme.ink }}>{label}</span>
        {help && (
          <span className="block" style={{ ...fontText, fontSize: "14px", lineHeight: 1.5, color: theme.ink2 }}>{help}</span>
        )}
      </span>
    </label>
  );

  const Line = ({ k, label, help, placeholder }) => (
    <div className="py-4" style={{ borderBottom: `1px solid ${theme.rule}` }}>
      <p className="m-0 mb-2" style={{ ...fontText, fontSize: "16px", color: theme.ink }}>{label}</p>
      <input value={values[k] || ""} placeholder={placeholder}
             onChange={(e) => set(k, e.target.value)}
             style={{ ...inputStyle, width: "100%" }} />
      {help && (
        <p className="m-0 mt-1.5" style={{ ...fontText, fontSize: "14px", lineHeight: 1.5, color: theme.ink2 }}>{help}</p>
      )}
    </div>
  );

  const rows = [
    { key: "scanCooldown", label: "Scan cooldown", unit: "seconds",
      help: "How long the same pass is ignored after being read, so a camera left pointing at it doesn't report a refusal." },
    { key: "codeDrift", label: "Clock tolerance", unit: "windows",
      help: "How far a guest's clock may be out and still be accepted. Each window is 30 seconds." },
    { key: "sessionHours", label: "Session length", unit: "hours",
      help: "How long a team member stays signed in. A shift, not a fortnight." },
    { key: "loginMaxFails", label: "Failed logins allowed", unit: "attempts",
      help: "Wrong passwords from one address before a pause." },
    { key: "loginWindowMinutes", label: "Login pause window", unit: "minutes",
      help: "How long those failures are counted for." },
    { key: "poolLowWater", label: "Top up codes below", unit: "codes",
      help: "More codes are generated automatically when fewer than this remain." },
    { key: "capacityWarnAt", label: "Capacity warning at", unit: "%",
      help: "The door turns amber at this share of the room, so a full night is seen coming rather than hit blind." },
    { key: "reminderHoursBefore", label: "Reminder sent", unit: "hours before",
      help: "How far ahead guests get their pass again. Set to 0 to stop sending reminders." },
    { key: "maxPeoplePerRequest", label: "Most people per request", unit: "people",
      help: "The largest group someone may ask for on the public form." },
    { key: "idleSignOutMinutes", label: "Sign out after idle", unit: "minutes",
      help: "Ends a team session after this long doing nothing. 0 leaves sessions running for their full length." },
    { key: "autoCloseAfterMinutes", label: "Refuse entry after", unit: "min from open",
      help: "An earlier cut-off than the event's closing time, so late arrivals are refused by the system rather than by a judgement call. 0 means no cut-off." },
  ];

  return (
    <>
      <Notice message={msg} tone={msg.startsWith("Saved") ? "good" : "bad"} />

      {/*
        THE INDEX.

        Ten sections and seventy-odd controls is past the point where scrolling
        to find one is reasonable. These are the section names, in order, and
        they jump. It is the same INDEX register the public site uses for its
        metadata bands — a list of what exists and where it is.
      */}
      <nav aria-label="Settings sections" className="mt-6">
        <div className="flex items-baseline gap-3 mb-2">
          <span style={{ ...fontUtility, fontSize: "8.5px", letterSpacing: "0.22em", color: theme.brass }}>
            SETTINGS
          </span>
          <span className="flex-1" style={{ borderTop: `1px solid ${theme.rule}`, transform: "translateY(-3px)" }} />
          <span style={{ ...fontUtility, fontSize: "8.5px", letterSpacing: "0.14em",
                         color: theme.ink2, fontVariantNumeric: "tabular-nums" }}>
            {String(SETTING_SECTIONS.length).padStart(2, "0")}
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {SETTING_SECTIONS.map((title, i) => (
            <a key={title} href={`#${sectionId(title)}`}
               style={{ ...fontUtility, fontSize: "8.5px", letterSpacing: "0.14em",
                        color: theme.ink, textDecoration: "none",
                        border: `1px solid ${theme.rule}`, borderLeft: `3px solid ${theme.rule}`,
                        padding: "7px 9px", display: "inline-flex", gap: "7px" }}>
               <span style={{ color: theme.brass, fontVariantNumeric: "tabular-nums" }}>
                 {String(i + 1).padStart(2, "0")}
               </span>
               {title}
            </a>
          ))}
        </div>
      </nav>

      {/*
        A change that has not been saved is invisible otherwise, and every save
        button writes ALL of them — so this both warns and reassures: whatever
        you touched, in whatever section, one press takes the lot.
      */}
      {dirty.length > 0 && (
        <div className="flex flex-wrap items-center gap-4 mt-5 px-4 py-3"
             style={{ border: `1px solid ${theme.ink}`, borderLeft: `3px solid ${theme.brass}` }}>
          <span className="flex-1" style={{ ...fontText, fontSize: "16px", color: theme.ink }}>
            {dirty.length} change{dirty.length === 1 ? "" : "s"} not saved yet.
            <span style={{ color: theme.ink2 }}> Any save button below saves all of them.</span>
          </span>
          <button onClick={() => save("EVERYTHING")} disabled={busy}
                  style={{ ...btn, opacity: busy ? 0.6 : 1 }}>
            {busy ? "SAVING…" : "SAVE EVERYTHING"}
          </button>
          <button onClick={() => setValues(saved0)} disabled={busy}
                  style={{ ...ghost, opacity: busy ? 0.6 : 1 }}>
            UNDO
          </button>
        </div>
      )}

      <Section title="THE LOOK" {...saver("THE LOOK")}>
        <p className="m-0 mb-4" style={{ ...fontText, fontSize: "15px", lineHeight: 1.55, color: theme.ink2 }}>
          These change the site itself. Everything here saves and applies at
          once — open the site in another tab and reload to see it.
        </p>

        <Choice k="paperTone" label="Paper"
                help="The stock everything is printed on. Board is the darkest and the most physical; bone is the coolest."
                options={[
                  /* Literals, deliberately. A swatch has to show the colour
                     it names — reading these from the theme made all three
                     preview whatever the site is currently set to. */
                  { value: "BOARD", label: "BOARD", swatch: "#EDE4D0" },
                  { value: "IVORY", label: "IVORY", swatch: "#F3EBD9" },
                  { value: "BONE",  label: "BONE",  swatch: "#E6DFD2" },
                ]} />

        <Choice k="accentTone" label="Accent"
                help="The one colour that is not ink or paper — drop caps, numbers, kickers, the italic in a headline."
                options={[
                  { value: "OXBLOOD", label: "OXBLOOD", swatch: "#6E2118" },
                  { value: "BRASS",   label: "BRASS",   swatch: "#8A6A28" },
                  { value: "INK",     label: "NONE",    swatch: "#14120E" },
                ]} />

        <Choice k="grainStrength" label="Paper grain"
                help="The fibre in the stock. Heavy reads as board and card; none reads as a screen."
                options={[
                  { value: "NONE",   label: "NONE" },
                  { value: "LIGHT",  label: "LIGHT" },
                  { value: "NORMAL", label: "NORMAL" },
                  { value: "HEAVY",  label: "HEAVY" },
                ]} />

        <Switch k="photoHalftone" label="Print photographs through a dot screen"
                help="What makes a picture read as ink rather than as a photograph on a screen. Off gives clean, modern photography." />
        <Switch k="photoDuotone" label="Warm duotone on the full-bleed photographs"
                help="Ties every picture to the same shoot. Off leaves them close to their original colour." />
      </Section>

      <Section title="THE HOME PAGE" {...saver("THE HOME PAGE")}>
        <Choice k="heroImage" label="The opening photograph"
                options={[
                  { value: "club",     label: "THE ROOM" },
                  { value: "booth",    label: "THE BOOTH" },
                  { value: "portrait", label: "PORTRAIT" },
                ]} />

        <div className="flex items-center gap-3 py-4" style={{ borderBottom: `1px solid ${theme.rule}` }}>
          <span className="flex-1" style={{ ...fontText, fontSize: "16px", color: theme.ink }}>
            How tall it opens
          </span>
          <input type="number" value={values.heroHeightVw}
                 onChange={(e) => set("heroHeightVw", Number(e.target.value))}
                 style={{ ...inputStyle, width: "90px", textAlign: "right" }} />
          <span style={{ ...fontUtility, fontSize: "8.5px", letterSpacing: "0.14em", color: theme.ink2, width: "62px" }}>
            % of width
          </span>
        </div>

        <Switch k="showContactSheet" label="Show the contact sheet"
                help="The numbered strip of photographs under the story." />

        <Line k="storyHeadline" label="The big headline" placeholder="Leave empty for the built-in line"
              help="The line set large under THE STORY. Empty keeps the one that is written in." />
        <Line k="closingLine" label="The closing line" placeholder="Leave empty for the built-in line"
              help="Set in italic over the last photograph on the page." />
        <Line k="footerNote" label="A note in the footer" placeholder="Optional"
              help="One or two sentences at the bottom of every page. Empty shows nothing." />
      </Section>

      <Section title="THE DOOR" {...saver("THE DOOR")}>
        <Choice k="capacityFullAction" label="When the room is full"
                help="Capacity was watched and warned about, and nothing decided what to do at a hundred percent — which meant it was decided at the door, by whoever was holding the phone, differently each time."
                options={[
                  { value: "WARN",   label: "ADMIT AND SAY SO" },
                  { value: "REFUSE", label: "REFUSE" },
                  { value: "IGNORE", label: "JUST COUNT" },
                ]} />
        {rows.map((r) => (
          <div key={r.key} className="py-3.5" style={{ borderBottom: `1px solid ${theme.rule}` }}>
            <div className="flex items-center gap-3">
              <span className="flex-1" style={{ ...fontText, fontSize: "16px", color: theme.ink }}>
                {r.label}
              </span>
              <input
                type="number"
                value={values[r.key]}
                onChange={(e) => set(r.key, Number(e.target.value))}
                style={{ ...inputStyle, width: "90px", textAlign: "right" }}
              />
              <span style={{ ...fontUtility, fontSize: "8.5px", letterSpacing: "0.14em", color: theme.ink2, width: "62px" }}>
                {r.unit}
              </span>
            </div>
            <p className="m-0 mt-1" style={{ ...fontText, fontSize: "14px", lineHeight: 1.5, color: theme.ink2 }}>
              {r.help}
              {defaults[r.key] !== undefined && ` Default: ${defaults[r.key]}.`}
            </p>
          </div>
        ))}
      </Section>

      <Section title="THE STAFF DOOR" {...saver("THE STAFF DOOR")}>
        <p className="m-0 mb-4" style={{ ...fontText, fontSize: "15px", lineHeight: 1.55, color: theme.ink2 }}>
          Press and hold the logo in the masthead and this login opens. Nothing
          on the public site says so — it replaced a visible link that guests
          could find and that vanished whenever you happened to be holding a
          ticket yourself.
        </p>
        <p className="m-0 mb-4 px-3 py-2.5" style={{ ...fontText, fontSize: "15px",
           lineHeight: 1.5, color: theme.ink, border: `1px solid ${theme.rule}`, background: theme.sunk }}>
          None of this can lock you out. <strong>/admins-staff-boss</strong> is
          a real address and always works, typed straight into a browser,
          whatever is set here. Worth a bookmark.
        </p>

        <Switch k="staffDoorHold" label="Press and hold the logo to sign in"
                help="Off, the shortcut goes away and only the address above works." />

        <div className="py-3.5" style={{ borderBottom: `1px solid ${theme.rule}` }}>
          <div className="flex items-center gap-3">
            <span className="flex-1" style={{ ...fontText, fontSize: "16px", color: theme.ink }}>
              How long to hold
            </span>
            <input type="number" min="300" max="3000" step="50"
                   value={values.staffDoorHoldMs}
                   onChange={(e) => set("staffDoorHoldMs", Number(e.target.value))}
                   style={{ ...inputStyle, width: "90px", textAlign: "right" }} />
            <span style={{ ...fontUtility, fontSize: "8.5px", letterSpacing: "0.14em",
                           color: theme.ink2, width: "40px" }}>ms</span>
          </div>
          <p className="m-0 mt-1.5" style={{ ...fontText, fontSize: "14px", lineHeight: 1.5, color: theme.ink2 }}>
            Below about 500 an ordinary slow tap starts opening it by accident;
            above about 1500 it feels broken while you wait. Default: 900.
          </p>
        </div>

        <Switch k="staffDoorBuzz" label="Buzz when it opens"
                help="A short vibration. On a control with nothing to look at it is the only confirmation there is — though not every phone obliges." />
      </Section>

      <Section title="MOVEMENT" {...saver("MOVEMENT")}>
        <p className="m-0 mb-4" style={{ ...fontText, fontSize: "15px", lineHeight: 1.55, color: theme.ink2 }}>
          How much the site moves. Separate switches rather than one blunt
          control, because these are different kinds of movement and you may
          want one without the others.
        </p>
        <p className="m-0 mb-4" style={{ ...fontText, fontSize: "14.5px", lineHeight: 1.5, color: theme.ink2 }}>
          Anyone whose phone or laptop asks for reduced motion gets none of it
          regardless of what is set here. That setting is theirs, not yours,
          and it wins.
        </p>

        <Switch k="motionReveals" label="Sections arrive as you reach them"
                help="Each part of a page rises into place as it comes into view, instead of the whole page being there at once." />
        <Switch k="motionDevelop" label="Photographs develop"
                help="A picture comes up flat and overexposed and resolves into full tone, the way a print does in a tray. Off, photographs simply appear." />
        <Switch k="motionRoll" label="The countdown's digits roll"
                help="The numbers turn over like a clock rather than snapping from one to the next." />
        <Switch k="motionLogoInk" label="The mark inks itself on"
                help="On the home page, the first time somebody arrives in a session, the logo is pressed onto the photograph. Once per visit, never again." />
        <Switch k="showFolio" label="Running head in the margin"
                help="Section name and how far down the page you are, set vertically in the left margin on wide screens. Hidden on phones, where there is no margin to put it in." />
      </Section>

      <Section title="THE SONG POOL" {...saver("THE SONG POOL")}>
        <p className="m-0 mb-4" style={{ ...fontText, fontSize: "15px", lineHeight: 1.55, color: theme.ink2 }}>
          Every rule the pool runs on. All of it is enforced on the server, so
          switching something off here actually stops it — it does not merely
          hide the form from people who would use it anyway.
        </p>

        <Switch k="poolOpen" label="The pool is open"
                help="The master switch. Off, the page stays up and explains itself rather than 404-ing — a link that has already gone out should never land on nothing. Everything already in the pool is kept." />

        <Choice k="poolEventMode" label="The night's pool is"
                help="ADD is a suggestion box — anybody puts songs in, and the list is whatever the room brought. VOTE is a ballot — only the team puts options on it and everybody else picks between them. Use VOTE for “which of these five closes the night”."
                options={[
                  { value: "ADD",  label: "OPEN — ANYONE ADDS" },
                  { value: "VOTE", label: "A VOTE" },
                ]} />

        <Choice k="poolHouseMode" label="The house list is"
                help="Usually left open: the house list is a standing record of what the room likes, which only works if the room can write to it."
                options={[
                  { value: "ADD",  label: "OPEN — ANYONE ADDS" },
                  { value: "VOTE", label: "A VOTE" },
                ]} />

        <div className="py-3.5" style={{ borderBottom: `1px solid ${theme.rule}` }}>
          <div className="flex items-center gap-3">
            <span className="flex-1" style={{ ...fontText, fontSize: "16px", color: theme.ink }}>
              Picks each person gets
            </span>
            <input type="number" min="0" value={values.poolVotesPerPerson}
                   onChange={(e) => set("poolVotesPerPerson", Number(e.target.value))}
                   style={{ ...inputStyle, width: "90px", textAlign: "right" }} />
            <span style={{ ...fontUtility, fontSize: "8.5px", letterSpacing: "0.14em",
                           color: theme.ink2, width: "40px" }}>picks</span>
          </div>
          <p className="m-0 mt-1.5" style={{ ...fontText, fontSize: "14px", lineHeight: 1.5, color: theme.ink2 }}>
            1 makes it a straight choice. More makes it an approval vote, which
            is friendlier and gives a more useful ranking — people are rarely
            certain about exactly one. 0 means unlimited. Only applies to a pool
            set to VOTE. Default: 3.
          </p>
        </div>

        <Switch k="poolShowVotes" label="Show the tallies while voting is open"
                help="Off, people see that they have picked but not how anyone else is doing — which is how you stop an early lead snowballing. You always see the counts." />

        <Switch k="poolEventOpen" label="Songs for a specific night"
                help="The pool tied to an event. This is the one to close when a set starts." />

        <Switch k="poolHouseOpen" label="The house list"
                help="The standing list, not tied to any date. Usually left open — it is the real record of what the room likes." />

        <div className="mt-7 mb-1 flex items-baseline gap-3">
          <span style={{ ...fontUtility, fontSize: "8.5px", letterSpacing: "0.2em", color: theme.brass }}>
            WHO MAY ADD
          </span>
          <span className="flex-1" style={{ borderTop: `1px solid ${theme.rule}`, transform: "translateY(-3px)" }} />
        </div>

        <Switch k="poolNeedPass" label="Ticket holders only"
                help="Somebody must have opened their pass on that phone before they can add anything. The team is exempt — nobody in the booth is going to look up their own code first." />

        <Switch k="poolRequireName" label="A name is required"
                help="Off, the name is optional. Bear in mind that every field you insist on is a person who does not bother — the link alone is what makes this work at two in the morning." />

        {[
          { key: "poolPerHour", label: "Songs per person, per hour", unit: "songs",
            help: "The burst limit. One person with a playlist can fill a pool in a minute, and then it is their pool. 0 turns it off entirely." },
          { key: "poolMaxPerPerson", label: "Songs per person, in total", unit: "songs",
            help: "Counted per pool, so somebody gets this many for the night AND this many on the house list. 0 means no total cap." },
        ].map((r) => (
          <div key={r.key} className="py-3.5" style={{ borderBottom: `1px solid ${theme.rule}` }}>
            <div className="flex items-center gap-3">
              <span className="flex-1" style={{ ...fontText, fontSize: "16px", color: theme.ink }}>
                {r.label}
              </span>
              <input type="number" min="0" value={values[r.key]}
                     onChange={(e) => set(r.key, Number(e.target.value))}
                     style={{ ...inputStyle, width: "90px", textAlign: "right" }} />
              <span style={{ ...fontUtility, fontSize: "8.5px", letterSpacing: "0.14em",
                             color: theme.ink2, width: "40px" }}>
                {r.unit}
              </span>
            </div>
            <p className="m-0 mt-1.5" style={{ ...fontText, fontSize: "14px", lineHeight: 1.5, color: theme.ink2 }}>
              {r.help}
              {defaults[r.key] !== undefined && ` Default: ${defaults[r.key]}.`}
            </p>
          </div>
        ))}

        <Switch k="poolAllowDuplicates" label="The same song may go in twice"
                help="Off, a repeat is answered with “that one's already in — good taste” and nothing is added. On, it goes in again, which turns the list into a rough vote." />

        <div className="mt-7 mb-1 flex items-baseline gap-3">
          <span style={{ ...fontUtility, fontSize: "8.5px", letterSpacing: "0.2em", color: theme.brass }}>
            WHAT THE PUBLIC SEES
          </span>
          <span className="flex-1" style={{ borderTop: `1px solid ${theme.rule}`, transform: "translateY(-3px)" }} />
        </div>

        <Switch k="poolShowList" label="Show the list"
                help="Off, people can still add a song but cannot read what anyone else put in — a suggestion box rather than a noticeboard. You always see all of it." />

        <Switch k="poolShowNames" label="Show who asked"
                help="Off, the songs are there and the names are not. The names are removed before they leave the server, not merely hidden by the page." />

        <Switch k="poolShowPlayed" label="Show what has been played"
                help="Off, nobody outside the team can tell which requests made it into a set. Worth switching off if you would rather not answer for the ones that did not." />

        <div className="mt-7 mb-1 flex items-baseline gap-3">
          <span style={{ ...fontUtility, fontSize: "8.5px", letterSpacing: "0.2em", color: theme.brass }}>
            THE WORDS
          </span>
          <span className="flex-1" style={{ borderTop: `1px solid ${theme.rule}`, transform: "translateY(-3px)" }} />
        </div>

        <Line k="poolHeadline" label="Headline" placeholder="The Pool"
              help="Leave empty for “The Pool”." />
        <Line k="poolSub" label="Under the headline" placeholder="PASTE A LINK — WE'LL FIND THE NAME"
              help="Set in small tracked capitals, so keep it short." />
        <Line k="poolNote" label="A line under the form" placeholder="e.g. No hard techno before midnight."
              help="Where to say what you will and will not play. Empty means nothing is shown." />
        <Line k="poolClosedMessage" label="When the pool is closed"
              placeholder="The pool is closed right now."
              help="Shown in place of the form when the master switch above is off." />
      </Section>

      <Section title="THE FLOATING BAR" {...saver("THE FLOATING BAR")}>
        <Choice k="barFinish" label="Glass finish"
                help="LENS carries almost no colour of its own — it works by squeezing whatever is behind it toward a middle tone, so it holds up over paper and over a photograph alike. CLEAR is the most transparent and the least forgiving over busy content. INK leans dark and belongs over photography."
                options={[
                  { value: "LENS",  label: "LENS",  swatch: "#DCD3C0" },
                  { value: "CLEAR", label: "CLEAR", swatch: "#F4F1E9" },
                  { value: "INK",   label: "INK",   swatch: "#2A2620" },
                ]} />

        <p className="m-0 mb-3" style={{ ...fontText, fontSize: "14.5px", lineHeight: 1.55, color: theme.ink2 }}>
          The bar measures itself rather than counting tabs: it shares the
          width while they fit and scrolls once they genuinely do not, on any
          screen. These two set how big each tab is when it does scroll.
        </p>

        {[
          { key: "barTabWidth", label: "Tab width when scrolling", unit: "px" },
          { key: "barLabelSize", label: "Label size", unit: "px" },
        ].map((r) => (
          <div key={r.key} className="flex items-center gap-3 py-3"
               style={{ borderBottom: `1px solid ${theme.rule}` }}>
            <span className="flex-1" style={{ ...fontText, fontSize: "16px", color: theme.ink }}>
              {r.label}
            </span>
            <input type="number" step={r.key === "barLabelSize" ? "0.5" : "1"}
                   value={values[r.key]}
                   onChange={(e) => set(r.key, Number(e.target.value))}
                   style={{ ...inputStyle, width: "90px", textAlign: "right" }} />
            <span style={{ ...fontUtility, fontSize: "8.5px", letterSpacing: "0.14em", color: theme.ink2, width: "34px" }}>
              {r.unit}
            </span>
          </div>
        ))}

        <label className="flex items-start gap-3 py-3" style={{ cursor: "pointer" }}>
          <input type="checkbox" checked={!!values.barShowLabels} style={{ marginTop: "4px" }}
                 onChange={(e) => set("barShowLabels", e.target.checked)} />
          <span>
            <span className="block" style={{ ...fontText, fontSize: "16px", color: theme.ink }}>
              Show labels under the icons
            </span>
            <span className="block" style={{ ...fontText, fontSize: "14px", lineHeight: 1.5, color: theme.ink2 }}>
              Turn off for icons only. Far more fit across, at the cost of
              having to know what each one means.
            </span>
          </span>
        </label>
      </Section>

      <Section title="THE SITE" {...saver("THE SITE")}>
        <div className="py-3">
          <p className="m-0 mb-2" style={{ ...fontText, fontSize: "16px", color: theme.ink }}>
            Banner across every page
          </p>
          <input value={values.announcement} placeholder="Leave empty for no banner"
                 onChange={(e) => set("announcement", e.target.value)}
                 style={{ ...inputStyle, width: "100%" }} />
          <input value={values.announcementLink} placeholder="Link (optional)"
                 onChange={(e) => set("announcementLink", e.target.value)}
                 style={{ ...inputStyle, width: "100%", marginTop: "8px" }} />
          <p className="m-0 mt-1" style={{ ...fontText, fontSize: "14px", lineHeight: 1.5, color: theme.ink2 }}>
            One line at the top of the site. Useful for a last-minute change of
            venue or a sold-out notice.
          </p>
        </div>

        <label className="flex items-start gap-3 py-3" style={{ cursor: "pointer" }}>
          <input type="checkbox" checked={!!values.showCountdown} style={{ marginTop: "4px" }}
                 onChange={(e) => set("showCountdown", e.target.checked)} />
          <span>
            <span className="block" style={{ ...fontText, fontSize: "16px", color: theme.ink }}>
              Show the countdown on the home page
            </span>
          </span>
        </label>

        {values.showCountdown && (
          <div className="py-3">
            <p className="m-0 mb-2" style={{ ...fontText, fontSize: "16px", color: theme.ink }}>
              Counting down to
            </p>
            <input value={values.countdownTarget}
                   onChange={(e) => set("countdownTarget", e.target.value)}
                   style={{ ...inputStyle, width: "100%" }} />
            <input value={values.countdownLabel} placeholder="Label above it"
                   onChange={(e) => set("countdownLabel", e.target.value)}
                   style={{ ...inputStyle, width: "100%", marginTop: "8px" }} />
            <p className="m-0 mt-1" style={{ ...fontText, fontSize: "14px", lineHeight: 1.5, color: theme.ink2 }}>
              The moment must carry a timezone, like 2026-12-13T00:00:00+02:00,
              or visitors in other countries reach zero at the wrong time.
            </p>
          </div>
        )}

        <div className="py-3">
          <p className="m-0 mb-2" style={{ ...fontText, fontSize: "16px", color: theme.ink }}>
            Note under the roster
          </p>
          <input value={values.rosterNote} onChange={(e) => set("rosterNote", e.target.value)}
                 style={{ ...inputStyle, width: "100%" }} />
        </div>

        <div className="py-3">
          <p className="m-0 mb-2" style={{ ...fontText, fontSize: "16px", color: theme.ink }}>
            Note under the events list
          </p>
          <input value={values.eventsNote} onChange={(e) => set("eventsNote", e.target.value)}
                 style={{ ...inputStyle, width: "100%" }} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 py-3">
          <div>
            <p className="m-0 mb-2" style={{ ...fontText, fontSize: "16px", color: theme.ink }}>Contact email</p>
            <input value={values.contactEmail} onChange={(e) => set("contactEmail", e.target.value)}
                   style={{ ...inputStyle, width: "100%" }} />
          </div>
          <div>
            <p className="m-0 mb-2" style={{ ...fontText, fontSize: "16px", color: theme.ink }}>Booking email</p>
            <input value={values.bookingEmail} onChange={(e) => set("bookingEmail", e.target.value)}
                   style={{ ...inputStyle, width: "100%" }} />
          </div>
        </div>

        <label className="flex items-start gap-3 py-3" style={{ cursor: "pointer" }}>
          <input type="checkbox" checked={!!values.guestListLinkVisible} style={{ marginTop: "4px" }}
                 onChange={(e) => set("guestListLinkVisible", e.target.checked)} />
          <span style={{ ...fontText, fontSize: "16px", color: theme.ink }}>
            Show the guest list link publicly
          </span>
        </label>
      </Section>

      <Section title="ISSUING PASSES">
        <div className="grid grid-cols-2 gap-3 py-3">
          <div>
            <p className="m-0 mb-2" style={{ ...fontText, fontSize: "16px", color: theme.ink }}>Default kind</p>
            <select value={values.defaultKind} onChange={(e) => set("defaultKind", e.target.value)}
                    style={{ ...inputStyle, width: "100%" }}>
              {["TICKET","COUPLE","FAMILY","INVITATION","GUEST","PRESS","ARTIST","STAFF"].map((k) =>
                <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
          <div>
            <p className="m-0 mb-2" style={{ ...fontText, fontSize: "16px", color: theme.ink }}>Default tier</p>
            <select value={values.defaultTier} onChange={(e) => set("defaultTier", e.target.value)}
                    style={{ ...inputStyle, width: "100%" }}>
              {["", "EARLY", "STANDARD", "VIP"].map((k) =>
                <option key={k} value={k}>{k || "— none —"}</option>)}
            </select>
          </div>
        </div>

        <label className="flex items-start gap-3 py-3" style={{ cursor: "pointer" }}>
          <input type="checkbox" checked={!!values.emailPassOnIssue} style={{ marginTop: "4px" }}
                 onChange={(e) => set("emailPassOnIssue", e.target.checked)} />
          <span>
            <span className="block" style={{ ...fontText, fontSize: "16px", color: theme.ink }}>
              Email the pass as soon as it is issued
            </span>
            <span className="block" style={{ ...fontText, fontSize: "14px", lineHeight: 1.5, color: theme.ink2 }}>
              Turn off if you would rather send links yourself.
            </span>
          </span>
        </label>

        <label className="flex items-start gap-3 py-3" style={{ cursor: "pointer" }}>
          <input type="checkbox" checked={!!values.warnOnDuplicate} style={{ marginTop: "4px" }}
                 onChange={(e) => set("warnOnDuplicate", e.target.checked)} />
          <span style={{ ...fontText, fontSize: "16px", color: theme.ink }}>
            Warn before issuing a second pass to the same person
          </span>
        </label>
      </Section>

      <Section title="THE GUEST LIST" {...saver("THE GUEST LIST")}>
        <div className="py-3">
          <p className="m-0 mb-2" style={{ ...fontText, fontSize: "16px", color: theme.ink }}>
            What someone sees after asking
          </p>
          <textarea rows={2} value={values.requestThanksMessage}
                    onChange={(e) => set("requestThanksMessage", e.target.value)}
                    style={{ ...inputStyle, width: "100%", resize: "vertical", lineHeight: 1.5 }} />
        </div>
      </Section>

      <Section title="THE WAITING LIST" {...saver("THE WAITING LIST")}>
        <Switch k="waitlistOpen" label="Queue people when a night is full"
                help="A request that arrives at a full night joins a queue in the order it came, instead of being turned away for good. Offering a place is always a decision you make — nothing issues itself." />
        <div className="py-3">
          <p className="m-0 mb-2" style={{ ...fontText, fontSize: "16px", color: theme.ink }}>
            What someone sees when they land on the queue
          </p>
          <textarea rows={2} value={values.waitlistMessage}
                    onChange={(e) => set("waitlistMessage", e.target.value)}
                    style={{ ...inputStyle, width: "100%", resize: "vertical", lineHeight: 1.5 }} />
          <p className="m-0 mt-2" style={{ ...fontText, fontSize: "14px", lineHeight: 1.5, color: theme.ink2 }}>
            Their position is shown underneath this, in figures. A number is
            something to wait for; "full" is a door closing.
          </p>
        </div>
      </Section>

      <Section title="DEMOS" {...saver("DEMOS")}>
        <Switch k="demosOpen" label="Accept demos"
                help="Turned off, the form is hidden and anything sent to it is refused by the server — not just by the page." />
        <div className="py-3">
          <p className="m-0 mb-2" style={{ ...fontText, fontSize: "16px", color: theme.ink }}>
            What the form says above itself
          </p>
          <textarea rows={2} value={values.demosNote}
                    onChange={(e) => set("demosNote", e.target.value)}
                    style={{ ...inputStyle, width: "100%", resize: "vertical", lineHeight: 1.5 }} />
        </div>
        <div className="py-3">
          <p className="m-0 mb-2" style={{ ...fontText, fontSize: "16px", color: theme.ink }}>
            What it says when demos are closed
          </p>
          <textarea rows={2} value={values.demosClosedMessage}
                    onChange={(e) => set("demosClosedMessage", e.target.value)}
                    style={{ ...inputStyle, width: "100%", resize: "vertical", lineHeight: 1.5 }} />
        </div>
      </Section>

      <Section title="BOOKINGS" {...saver("BOOKINGS")}>
        <Switch k="bookingsOpen" label="Accept booking enquiries"
                help="Every enquiry is emailed to the address in EMAIL as it arrives, so a date does not sit unseen for a week." />
        <div className="py-3">
          <p className="m-0 mb-2" style={{ ...fontText, fontSize: "16px", color: theme.ink }}>
            What the booking form says above itself
          </p>
          <textarea rows={2} value={values.bookingsNote}
                    onChange={(e) => set("bookingsNote", e.target.value)}
                    style={{ ...inputStyle, width: "100%", resize: "vertical", lineHeight: 1.5 }} />
        </div>
      </Section>

      <Section title="EMAIL" {...saver("EMAIL")}>
        <div className="py-3">
          <p className="m-0 mb-2" style={{ ...fontText, fontSize: "16px", color: theme.ink }}>
            Sign-off at the foot of every email
          </p>
          <input value={values.emailSignoff} onChange={(e) => set("emailSignoff", e.target.value)}
                 style={{ ...inputStyle, width: "100%" }} />
        </div>
      </Section>

      <Section title="TAKING THE SITE DOWN">
        <label className="flex items-start gap-3 py-3" style={{ cursor: "pointer" }}>
          <input type="checkbox" checked={!!values.siteClosed} style={{ marginTop: "4px" }}
                 onChange={(e) => set("siteClosed", e.target.checked)} />
          <span>
            <span className="block" style={{ ...fontText, fontSize: "16px", color: theme.bad }}>
              Close the site to visitors
            </span>
            <span className="block" style={{ ...fontText, fontSize: "14px", lineHeight: 1.5, color: theme.ink2 }}>
              Shows a holding message instead of the site. The door tools and
              guests' passes keep working, so this can be used mid-night
              without stranding anyone.
            </span>
          </span>
        </label>
        {values.siteClosed && (
          <input value={values.siteClosedMessage}
                 onChange={(e) => set("siteClosedMessage", e.target.value)}
                 style={{ ...inputStyle, width: "100%" }} />
        )}
      </Section>

      <Section title="ACCESS">
        <label className="flex items-start gap-3 py-3" style={{ cursor: "pointer" }}>
          <input type="checkbox" checked={!!values.staffSeeDoorList} style={{ marginTop: "4px" }}
                 onChange={(e) => set("staffSeeDoorList", e.target.checked)} />
          <span>
            <span className="block" style={{ ...fontText, fontSize: "16px", color: theme.ink }}>
              Door staff can see the full door list
            </span>
            <span className="block" style={{ ...fontText, fontSize: "14px", lineHeight: 1.5, color: theme.ink2 }}>
              Useful when one person works the door alone. Turn it off and they
              can scan but not browse who is coming.
            </span>
          </span>
        </label>

        <label className="flex items-start gap-3 py-3" style={{ cursor: "pointer" }}>
          <input type="checkbox" checked={!!values.managementCanIssue} style={{ marginTop: "4px" }}
                 onChange={(e) => set("managementCanIssue", e.target.checked)} />
          <span>
            <span className="block" style={{ ...fontText, fontSize: "16px", color: theme.ink }}>
              Management can issue and cancel passes
            </span>
            <span className="block" style={{ ...fontText, fontSize: "14px", lineHeight: 1.5, color: theme.ink2 }}>
              Off by default, so only you can create or cancel a pass. Turn it
              on when you need someone else able to.
            </span>
          </span>
        </label>

        <label className="flex items-start gap-3 py-3" style={{ cursor: "pointer" }}>
          <input type="checkbox" checked={!!values.staffSeeContacts} style={{ marginTop: "4px" }}
                 onChange={(e) => set("staffSeeContacts", e.target.checked)} />
          <span>
            <span className="block" style={{ ...fontText, fontSize: "16px", color: theme.ink }}>
              Door staff can see guests' email and phone
            </span>
            <span className="block" style={{ ...fontText, fontSize: "14px", lineHeight: 1.5, color: theme.ink2 }}>
              Off by default. A door phone gets borrowed, and contact details
              are the part worth protecting.
            </span>
          </span>
        </label>

        <label className="flex items-start gap-3 py-3" style={{ cursor: "pointer" }}>
          <input type="checkbox" checked={!!values.guestListOpen} style={{ marginTop: "4px" }}
                 onChange={(e) => set("guestListOpen", e.target.checked)} />
          <span>
            <span className="block" style={{ ...fontText, fontSize: "16px", color: theme.ink }}>
              The guest list form is open
            </span>
            <span className="block" style={{ ...fontText, fontSize: "14px", lineHeight: 1.5, color: theme.ink2 }}>
              Turn it off between events and the public form stops accepting
              requests, rather than collecting ones nobody will read.
            </span>
          </span>
        </label>

        <label className="flex items-start gap-3 py-3" style={{ cursor: "pointer" }}>
          <input type="checkbox" checked={!!values.idOnEveryPass} style={{ marginTop: "4px" }}
                 onChange={(e) => set("idOnEveryPass", e.target.checked)} />
          <span>
            <span className="block" style={{ ...fontText, fontSize: "16px", color: theme.ink }}>
              Ask for ID on every pass
            </span>
            <span className="block" style={{ ...fontText, fontSize: "14px", lineHeight: 1.5, color: theme.ink2 }}>
              Normally only sold tickets prompt for ID. This makes the door ask
              for every pass, including guest list and press.
            </span>
          </span>
        </label>

        <div className="py-3">
          <p className="m-0 mb-2" style={{ ...fontText, fontSize: "16px", color: theme.ink }}>
            Copy new accounts to
          </p>
          <input value={values.accountCopyTo}
                 onChange={(e) => set("accountCopyTo", e.target.value)}
                 style={{ ...inputStyle, width: "100%" }} />
          <p className="m-0 mt-1" style={{ ...fontText, fontSize: "14px", lineHeight: 1.5, color: theme.ink2 }}>
            Every new account's details are blind-copied here, so there is
            always a second record of who was given access.
          </p>
        </div>
      </Section>

      <button onClick={() => save("FOOT")} disabled={busy} style={{ ...btn, marginTop: "8px", opacity: busy ? 0.6 : 1 }}>
        {busy ? "SAVING…" : "SAVE SETTINGS"}
      </button>

      <Maintenance parties={parties} />
    </>
  );
}

/*
  Maintenance. Everything here is destructive, so each action makes you type
  the phrase back before it will run. A misplaced tap should not be able to
  delete a night's guest list.
*/
function Maintenance({ parties }) {
  const [msg, setMsg] = useState("");
  const [tone, setTone] = useState("good");
  const [party, setParty] = useState(parties?.[0]?.id || "");
  const [count, setCount] = useState(1000);

  const run = async (action, phrase, extra = {}) => {
    if (phrase) {
      const typed = window.prompt(`This cannot be undone.\n\nType ${phrase} to continue.`);
      if (typed !== phrase) { setTone("bad"); setMsg("Not confirmed — nothing was changed."); return; }
    }
    const res = await api.maintenance(action, { confirm: phrase, ...extra });
    setTone(res.ok ? "good" : "bad");
    if (!res.ok) { setMsg(res.error || "That didn't work."); return; }
    if (res.added !== undefined) setMsg(`Added ${res.added} codes. ${res.unused} unused now.`);
    else if (res.removed !== undefined) setMsg(`Replaced ${res.removed} codes. ${res.unused} unused now.`);
    else setMsg(`Done — ${res.deleted} removed.`);
  };

  const row = (label, help, onClick, danger) => (
    <div className="py-3.5" style={{ borderBottom: `1px solid ${theme.rule}` }}>
      <div className="flex items-center gap-3">
        <span className="flex-1" style={{ ...fontText, fontSize: "16px", color: theme.ink }}>{label}</span>
        <button onClick={onClick}
                style={{ ...fontUtility, fontSize: "9px", letterSpacing: "0.16em",
                         color: danger ? theme.bad : theme.ink,
                         background: "transparent", border: `1px solid ${danger ? theme.badLine : theme.ink}`,
                         padding: "9px 14px", cursor: "pointer" }}>
          RUN
        </button>
      </div>
      <p className="m-0 mt-1" style={{ ...fontText, fontSize: "14px", lineHeight: 1.5, color: theme.ink2 }}>
        {help}
      </p>
    </div>
  );

  return (
    <>
      <Section title="CODES">
        <div className="flex items-center gap-3 pb-3">
          <input type="number" value={count} onChange={(e) => setCount(Number(e.target.value))}
                 style={{ ...inputStyle, width: "110px" }} />
          <button onClick={() => run("codes.add", null, { count })} style={btn}>ADD CODES</button>
        </div>
        {row("Delete unused codes",
             "Clears the pool of codes nobody holds yet. Used codes are never touched — a pass points at each one.",
             () => run("codes.purgeUnused", "DELETE UNUSED CODES"), true)}
        {row("Replace all unused codes",
             "Deletes the unused pool and generates a fresh one. Anyone already holding a pass is unaffected.",
             () => run("codes.regenerate", "REGENERATE ALL CODES"), true)}
      </Section>

      <Section title="A NIGHT'S DATA">
        <select value={party} onChange={(e) => setParty(e.target.value)}
                style={{ ...inputStyle, width: "100%", marginBottom: "10px" }}>
          {(parties || []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        {row("Clear the door record",
             "Wipes who was admitted and refused, leaving the passes themselves. Useful after a rehearsal.",
             () => run("scans.clearForParty", "CLEAR THE DOOR RECORD", { party }), true)}
        {row("Delete every pass for this event",
             "Removes the passes and the door record together. The codes stay used, so old links never point at someone new.",
             () => run("passes.deleteForParty", "DELETE ALL PASSES", { party }), true)}
        {row("Clear decided requests",
             "Removes approved and declined guest list requests. Anything still waiting is kept.",
             () => run("requests.clearDecided", "CLEAR DECIDED REQUESTS"), true)}
      </Section>

      <Notice message={msg} tone={tone} />
    </>
  );
}

// ── the console itself ──────────────────────────────────────────────────────

function ConsoleScreen({ role }) {
  usePageMeta({ title: "Console", description: "Hidden State door console." });
  /*
    Open the tab named in the address, so the bar can link straight to
    settings or posts rather than dropping you on the passes list every time.
  */
  const location = useLocation();
  const [tab, setTab] = useState("passes");

  /*
    Follow the tab named in the address, and keep following it.

    Reading it only once meant the bar's SETTINGS link did nothing when you
    were already on the console: the address changed, the page did not.
  */
  useEffect(() => {
    const wanted = new URLSearchParams(location.search).get("tab");
    if (wanted) setTab(wanted);
  }, [location.search]);
  const [parties, setParties] = useState([]);
  // The same roster the public pages draw from, so a press kit can only be
  // written for somebody who is actually on it.
  const roster = useArtists() || [];
  const [party, setParty] = useState("");
  const [msg, setMsg] = useState("");
  const [codesLeft, setCodesLeft] = useState(null);

  const loadParties = useCallback(async () => {
    const res = await api.listParties();
    if (!res.ok) { setMsg(res.error || "Couldn't load the events."); return; }
    setParties(res.parties || []);
    setCodesLeft(res.codesLeft ?? null);
    setParty((p) => p || (res.parties?.[0]?.id ?? ""));
  }, []);

  useEffect(() => { loadParties(); }, [loadParties]);

  const allowed = TABS.filter((t) => role.can[t.need]);

  return (
    <div data-page style={{ background: theme.bg, minHeight: "100vh" }}>
      <Nav />
      {/* where the skip link lands */}
      <span id="main" tabIndex={-1} />
      {/*
        The console is the index register end to end — it is nothing but facts
        and controls — so it opens the way every index does: an ink band that
        states who you are and what the night has left, then the name set
        large. The old centred title over a hairline row said the same things
        in a whisper.
      */}
      <IndexBand top items={[
        { label: "SIGNED IN", value: (role.displayName || role.label || "").toUpperCase() },
        { label: "ROLE", value: role.id },
        { label: "CODES LEFT", value: codesLeft !== null ? String(codesLeft) : "\u2014" },
        { label: "EVENTS", value: String(parties.length).padStart(2, "0") },
      ]} />

      <section className="max-w-[1180px] mx-auto px-[18px] pb-16">
        <h1 className="m-0 pt-8" style={{ ...fontDisplay, fontWeight: 900, textTransform: "uppercase",
            fontSize: "clamp(34px,9vw,76px)", lineHeight: 0.88, letterSpacing: "-0.04em", color: theme.ink }}>
          Console
        </h1>

        {/*
          TWO PANES ON A LAPTOP, ONE COLUMN ON A PHONE.

          The console was a 720px column on every screen, which meant a
          laptop showed a narrow strip of content down the middle with the
          navigation pushed off the top the moment you scrolled — so changing
          tab meant scrolling back up every time. On a wide screen the tabs
          belong in a rail that stays put beside the work.

          `sticky` is used on the rail and NOTHING on that element clips its
          overflow: the two together are what made Safari refuse to unstick a
          panel here once, and it looked like the whole page had gone dark.
        */}
        <div className="lg:grid lg:gap-10 mt-6" style={{ gridTemplateColumns: "260px minmax(0, 1fr)" }}>
          <div className="lg:sticky lg:self-start" style={{ top: "124px" }}>

        {/*
          Everything visible at once. The grid wraps rather than scrolls, so
          the number of columns follows the screen — three on a phone, five or
          six on a laptop — and no tab is ever hidden past an edge.

          A group with nothing in it for this account is not drawn at all:
          door staff see THE DOOR and nothing else, rather than two empty
          headings telling them what they cannot have.
        */}
        <div className="mt-6">
          {GROUPS.map((g) => {
            const items = allowed.filter((t) => t.group === g.id);
            if (!items.length) return null;

            return (
              <div key={g.id} className="mb-5">
                {/*
                  The heading now carries the count as well as the name, set
                  as a figure on the far side of the rule. It is the INDEX
                  register the rest of the site uses, and it tells door staff
                  at a glance that THE DOOR is all five of the things they
                  have rather than the beginning of a longer list.
                */}
                <div className="flex items-baseline gap-3 mb-2.5">
                  <span style={{ ...fontUtility, fontSize: "8.5px", letterSpacing: "0.22em", color: theme.brass }}>
                    {g.label}
                  </span>
                  <span className="flex-1" style={{ borderTop: `1px solid ${theme.rule}`, transform: "translateY(-3px)" }} />
                  <span style={{ ...fontUtility, fontSize: "8.5px", letterSpacing: "0.14em",
                                 color: theme.ink2, fontVariantNumeric: "tabular-nums" }}>
                    {String(items.length).padStart(2, "0")}
                  </span>
                </div>

                {/*
                  THE TILES. Same grid, same grouping, restyled.

                  What changed and why:

                  • Each tile is numbered down its left edge. Twelve
                    unnumbered boxes of tracked-out capitals are hard to tell
                    apart at a glance; a figure gives every one a fixed
                    position you learn without reading it, which is how you
                    reach SETTINGS without looking by the second week.

                  • The lit tile keeps its ink fill but gains a rule down the
                    left in the accent, so the current tab is still obvious in
                    a photograph, in bright sun at a door, and to anyone who
                    cannot separate the fill from the paper by colour alone.

                  • The label sits left rather than centred. Centred text in a
                    wrapping grid means every label starts in a different
                    place, and the eye has to find each one; a common left
                    edge is a column you can run down.

                  • A tile that LEAVES the console (the scanner, the door
                    list) is marked with an arrow in the accent instead of
                    being appended to the label, so its width no longer
                    depends on its own name.
                */}
                <div className="grid" style={{ gap: "5px", gridTemplateColumns: "repeat(auto-fill, minmax(132px, 1fr))" }}>
                  {items.map((t, i) => {
                    // A link leaves the console entirely, so it is never the
                    // lit one — nothing here is "open" while you are at it.
                    const active = !t.to && tab === t.id;
                    const style = {
                      ...fontUtility,
                      fontSize: "9px",
                      letterSpacing: "0.16em",
                      color: active ? theme.bg : theme.ink,
                      background: active ? theme.ink : "transparent",
                      border: `1px solid ${active ? theme.ink : theme.rule}`,
                      borderLeft: active
                        ? `3px solid ${theme.brass}`
                        : `3px solid ${theme.rule}`,
                      // 44px is the smallest a target can be and still be hit
                      // reliably with a thumb, which is how this is used.
                      minHeight: "46px",
                      padding: "10px 10px 10px 8px",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      textAlign: "left",
                      lineHeight: 1.15,
                      cursor: "pointer",
                      transition: "background 180ms ease, color 180ms ease, border-color 180ms ease",
                    };

                    const inside = (
                      <>
                        <span style={{ fontSize: "8px", letterSpacing: "0.08em",
                                       color: active ? theme.bg : theme.brass,
                                       opacity: active ? 0.65 : 1,
                                       fontVariantNumeric: "tabular-nums" }}>
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <span className="flex-1">{t.label}</span>
                        {t.to && (
                          <span aria-hidden="true"
                                style={{ color: active ? theme.bg : theme.brass, fontSize: "10px" }}>
                            ↗
                          </span>
                        )}
                      </>
                    );

                    return t.to ? (
                      <Link key={t.id} to={t.to} style={style}
                            title={`${t.label} — opens its own page`}>
                        {inside}
                      </Link>
                    ) : (
                      <button key={t.id} onClick={() => setTab(t.id)} style={style}
                              aria-pressed={active}>
                        {inside}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

          </div>

          <div className="min-w-0">
        <Notice message={msg} />

        {tab === "passes" && (
          <Passes role={role} parties={parties} party={party} setParty={setParty} />
        )}
        {tab === "events" && role.can.issuePasses && <Events parties={parties} reload={loadParties} />}
        {tab === "activity" && role.can.manageTeam && <Activity />}
        {tab === "faults" && role.can.manageTeam && <Faults />}
        {tab === "reading" && role.can.manageTeam && <Readership />}
        {tab === "backups" && role.can.manageTeam && <Backups />}
        {tab === "team" && role.can.manageTeam && <Team />}
        {tab === "requests" && <Requests role={role} party={party} />}
        {tab === "waiting" && <Waitlist party={party} />}
        {tab === "sets" && role.can.issuePasses && <SetTimes party={party} />}
        {tab === "kits" && role.can.issuePasses && <Kits artists={roster} />}
        {tab === "demos" && role.can.issuePasses && <Demos />}
        {tab === "bookings" && role.can.issuePasses && <Bookings />}
        {tab === "after" && role.can.manageTeam && <After parties={parties} />}
        {tab === "stats" && <Stats party={party} />}
        {tab === "posts" && role.can.issuePasses && <Posts />}
        {["artists","records","mixes"].includes(tab) && role.can.issuePasses && (
          <ContentEditor key={tab} kind={tab} />
        )}
        {tab === "settings" && role.can.manageTeam && <Settings parties={parties} />}
          </div>
        </div>
      </section>
      <Footer />
    </div>
  );
}

export default function Console() {
  return <DoorGate>{(role) => <ConsoleScreen role={role} />}</DoorGate>;
}
