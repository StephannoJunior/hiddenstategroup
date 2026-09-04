import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Field, inputStyle, IndexBand, fontDisplay, fontUtility, fontText, theme }
  from "../components/Shared";
import * as api from "../lib/api";

/*
  ── THE SECOND EIGHTEEN, IN THE CONSOLE ─────────────────────────────────────

  Six panels, in their own file rather than in Console.jsx, which was already
  three thousand lines before any of this. They are imported and rendered by
  Console.jsx exactly like the panels that live there.

  Everything here follows the rules the rest of the console already follows:

    · NO native confirm() or alert(). On iOS a system dialog blocks the whole
      page behind it, and this site has been bitten by that before. A
      destructive button changes to say what a second press will do.
    · The server decides. Every panel below can be lied to by its own screen —
      a queue that had room when it loaded and none now — so nothing here is
      the last word on anything.
    · Read-only where read-only is right. A record you can edit is not a
      record.
*/

/* ── small shared pieces ─────────────────────────────────────────────────── */

const Panel = ({ title, right, children }) => (
  <section className="mb-10">
    <div className="flex items-baseline gap-3" style={{ borderBottom: `1px solid ${theme.ink}`, paddingBottom: "7px" }}>
      <h2 className="m-0" style={{ ...fontUtility, fontSize: "11px", letterSpacing: "0.2em", fontWeight: 700 }}>
        {title}
      </h2>
      {right != null && (
        <span className="flex-1 text-right" style={{ ...fontUtility, fontSize: "9px", letterSpacing: "0.16em", color: theme.ink2 }}>
          {right}
        </span>
      )}
    </div>
    <div className="mt-4">{children}</div>
  </section>
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

const Btn = ({ on, wide, danger, children, ...rest }) => (
  <button {...rest} style={{
    ...fontUtility, fontSize: "9px", letterSpacing: "0.16em", cursor: "pointer",
    padding: wide ? "11px 20px" : "8px 12px",
    color: on ? theme.onInk : danger ? theme.bad : theme.ink,
    background: on ? (danger ? theme.bad : theme.ink) : "transparent",
    border: `1px solid ${danger ? theme.bad : on ? theme.ink : theme.rule}`,
    ...(rest.style || {}),
  }}>{children}</button>
);

const Empty = ({ children }) => (
  <p className="m-0 py-2" style={{ ...fontText, fontSize: "17px", lineHeight: 1.55, color: theme.ink2 }}>
    {children}
  </p>
);

const when = (iso) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString([], { day: "2-digit", month: "short" }) + " " +
         d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

/* ═══════════════════════════════════════════════════════════════════════════
   L01 · DEMOS
   ═══════════════════════════════════════════════════════════════════════════

   A queue that gets played rather than skimmed. The verdict field is a note to
   ourselves and is never sent to anybody — that separation is the whole reason
   it is safe to write an honest one.

   ANSWERING IS A SEPARATE ACT from deciding, and the tick that sends a reply
   is off every time the panel draws. Marking something NO and having a letter
   leave in the same instant is how you send a rejection you meant to sleep on.
*/
export function Demos() {
  const [rows, setRows] = useState([]);
  const [only, setOnly] = useState("NEW");
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [open, setOpen] = useState(null);
  const [draft, setDraft] = useState({});
  const [reply, setReply] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api.listDemos(only).then((res) => {
      setLoading(false);
      if (res.ok) setRows(res.demos || []);
      else setMsg(res.error || "Could not read the demos.");
    });
  }, [only]);
  useEffect(() => { load(); }, [load]);

  const judge = async (row, status) => {
    setMsg("");
    const res = await api.judgeDemo(row.id, status, draft[row.id] ?? row.verdict ?? "", reply);
    if (!res.ok) { setMsg(res.error || "Could not save that."); return; }
    setReply(false);
    load();
  };

  const counts = useMemo(() => {
    const c = {};
    for (const r of rows) c[r.status] = (c[r.status] || 0) + 1;
    return c;
  }, [rows]);

  return (
    <div>
      <IndexBand items={[
        { label: "SHOWING", value: only },
        { label: "IN THIS VIEW", value: loading ? "—" : String(rows.length).padStart(3, "0") },
        { label: "SAID YES", value: String(counts.YES || 0).padStart(2, "0") },
      ]} />

      <Note>{msg}</Note>

      <div className="flex flex-wrap gap-1.5 mt-6 mb-6">
        {["NEW", "HEARD", "MAYBE", "YES", "NO", "ALL"].map((k) => (
          <Btn key={k} on={only === k} onClick={() => setOnly(k)}>{k}</Btn>
        ))}
      </div>

      {loading ? (
        <Empty>Reading…</Empty>
      ) : rows.length === 0 ? (
        <Empty>
          Nothing here. Demos arrive from /demos, which is open or closed from
          the DEMOS section of settings.
        </Empty>
      ) : (
        <div style={{ borderTop: `1px solid ${theme.ink}` }}>
          {rows.map((r) => {
            const shown = open === r.id;
            return (
              <div key={r.id} style={{ borderBottom: `1px solid ${theme.rule}` }}>
                <button onClick={() => setOpen(shown ? null : r.id)}
                        className="w-full text-left flex items-baseline gap-3"
                        style={{ background: "transparent", border: 0, cursor: "pointer", padding: "13px 0" }}>
                  <span style={{ ...fontUtility, fontSize: "8.5px", letterSpacing: "0.14em",
                                 width: "52px", flex: "none",
                                 color: r.status === "YES" ? theme.good
                                      : r.status === "NO" ? theme.ink2
                                      : r.status === "NEW" ? theme.brass : theme.ink }}>
                    {r.status}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block truncate" style={{ ...fontText, fontSize: "18px", color: theme.ink }}>
                      {r.artist}{r.title ? <span style={{ color: theme.ink2 }}> — {r.title}</span> : null}
                    </span>
                    <span className="block" style={{ ...fontUtility, fontSize: "8.5px", letterSpacing: "0.12em", color: theme.ink2 }}>
                      {when(r.created_at)}{r.replied_at ? " · ANSWERED" : ""}
                    </span>
                  </span>
                </button>

                {shown && (
                  <div className="pb-5" style={{ paddingLeft: "52px" }}>
                    {/*
                      The link is the point of the whole panel, so it is the
                      largest thing here and opens in its own tab — losing the
                      queue every time you play something would make this
                      unusable after about four demos.
                    */}
                    <a href={r.url} target="_blank" rel="noreferrer"
                       className="inline-block mb-3"
                       style={{ ...fontUtility, fontSize: "10px", letterSpacing: "0.18em",
                                padding: "12px 18px", background: theme.ink, color: theme.bg,
                                textDecoration: "none" }}>
                      PLAY IT ↗
                    </a>

                    <p className="m-0 mb-3" style={{ ...fontText, fontSize: "15px", lineHeight: 1.5, color: theme.ink2 }}>
                      {r.email}{r.socials ? " · " + r.socials : ""}
                    </p>

                    {r.note && (
                      <p className="m-0 mb-4 px-3 py-2.5" style={{
                        ...fontText, fontSize: "16px", lineHeight: 1.55, color: theme.ink,
                        background: theme.sunk, border: `1px solid ${theme.rule}`, whiteSpace: "pre-wrap",
                      }}>{r.note}</p>
                    )}

                    <Field label="What we think — never sent to them">
                      <textarea rows={2}
                                value={draft[r.id] ?? r.verdict ?? ""}
                                onChange={(e) => setDraft((d) => ({ ...d, [r.id]: e.target.value }))}
                                style={{ ...inputStyle, width: "100%", resize: "vertical", lineHeight: 1.5 }} />
                    </Field>

                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {["HEARD", "MAYBE", "YES", "NO"].map((k) => (
                        <Btn key={k} on={r.status === k} onClick={() => judge(r, k)}>{k}</Btn>
                      ))}
                    </div>

                    {!r.replied_at ? (
                      <label className="flex items-start gap-2.5 mt-4" style={{ cursor: "pointer" }}>
                        <input type="checkbox" checked={reply} onChange={(e) => setReply(e.target.checked)}
                               style={{ marginTop: "3px" }} />
                        <span style={{ ...fontText, fontSize: "15px", lineHeight: 1.5, color: theme.ink }}>
                          Write to them as well — a short, kind note that says
                          yes or no. It goes out with the next verdict you press
                          and can only be sent once.
                        </span>
                      </label>
                    ) : (
                      <p className="m-0 mt-4" style={{ ...fontUtility, fontSize: "9px", letterSpacing: "0.14em", color: theme.ink2 }}>
                        ANSWERED {when(r.replied_at)} — THEY WILL NOT BE WRITTEN TO AGAIN
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   L04 · BOOKINGS
   ═══════════════════════════════════════════════════════════════════════════ */
export function Bookings() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [open, setOpen] = useState(null);
  const [draft, setDraft] = useState({});

  const load = useCallback(() => {
    setLoading(true);
    api.listBookings().then((res) => {
      setLoading(false);
      if (res.ok) setRows(res.bookings || []);
      else setMsg(res.error || "Could not read the enquiries.");
    });
  }, []);
  useEffect(() => { load(); }, [load]);

  const decide = async (row, status) => {
    setMsg("");
    const res = await api.decideBooking(row.id, status, draft[row.id] ?? row.reply_note ?? "");
    if (!res.ok) { setMsg(res.error || "Could not save that."); return; }
    load();
  };

  const live = rows.filter((r) => r.status === "NEW" || r.status === "TALKING" || r.status === "HELD");

  return (
    <div>
      <IndexBand items={[
        { label: "ENQUIRIES", value: loading ? "—" : String(rows.length).padStart(3, "0") },
        { label: "OPEN", value: String(live.length).padStart(2, "0") },
        { label: "CONFIRMED", value: String(rows.filter((r) => r.status === "CONFIRMED").length).padStart(2, "0") },
      ]} />

      <Note>{msg}</Note>

      {loading ? (
        <Empty>Reading…</Empty>
      ) : rows.length === 0 ? (
        <Empty>
          Nothing yet. Enquiries arrive from /bookings and are emailed to the
          address in the EMAIL settings as they come in.
        </Empty>
      ) : (
        <div className="mt-6" style={{ borderTop: `1px solid ${theme.ink}` }}>
          {rows.map((r) => {
            const shown = open === r.id;
            return (
              <div key={r.id} style={{ borderBottom: `1px solid ${theme.rule}` }}>
                <button onClick={() => setOpen(shown ? null : r.id)}
                        className="w-full text-left flex items-baseline gap-3"
                        style={{ background: "transparent", border: 0, cursor: "pointer", padding: "13px 0" }}>
                  <span style={{ ...fontUtility, fontSize: "8.5px", letterSpacing: "0.14em",
                                 width: "72px", flex: "none",
                                 color: r.status === "CONFIRMED" ? theme.good
                                      : r.status === "NO" ? theme.ink2
                                      : r.status === "NEW" ? theme.brass : theme.ink }}>
                    {r.status}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block truncate" style={{ ...fontText, fontSize: "18px", color: theme.ink }}>
                      {r.artist || "Any artist"}
                      <span style={{ color: theme.ink2 }}>
                        {" — "}{[r.city, r.date_label].filter(Boolean).join(", ") || "no date given"}
                      </span>
                    </span>
                    <span className="block" style={{ ...fontUtility, fontSize: "8.5px", letterSpacing: "0.12em", color: theme.ink2 }}>
                      {(r.company || r.promoter).toUpperCase()} · {when(r.created_at)}
                    </span>
                  </span>
                </button>

                {shown && (
                  <div className="pb-5" style={{ paddingLeft: "72px" }}>
                    <div className="grid gap-x-6 gap-y-1 mb-4"
                         style={{ gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))" }}>
                      {[
                        ["WHO", r.promoter + (r.company ? ` · ${r.company}` : "")],
                        ["REACH THEM", r.email + (r.phone ? ` · ${r.phone}` : "")],
                        ["WHEN", r.date_label],
                        ["WHERE", [r.venue, r.city, r.country].filter(Boolean).join(", ")],
                        ["ROOM", r.capacity],
                        ["BUDGET", r.budget],
                      ].filter(([, v]) => v).map(([k, v]) => (
                        <div key={k}>
                          <p className="m-0" style={{ ...fontUtility, fontSize: "8px", letterSpacing: "0.16em", color: theme.brass }}>{k}</p>
                          <p className="m-0" style={{ ...fontText, fontSize: "16px", lineHeight: 1.45, color: theme.ink }}>{v}</p>
                        </div>
                      ))}
                    </div>

                    {r.note && (
                      <p className="m-0 mb-4 px-3 py-2.5" style={{
                        ...fontText, fontSize: "16px", lineHeight: 1.55, color: theme.ink,
                        background: theme.sunk, border: `1px solid ${theme.rule}`, whiteSpace: "pre-wrap",
                      }}>{r.note}</p>
                    )}

                    <Field label="Where this got to — for us, not for them">
                      <textarea rows={2}
                                value={draft[r.id] ?? r.reply_note ?? ""}
                                onChange={(e) => setDraft((d) => ({ ...d, [r.id]: e.target.value }))}
                                style={{ ...inputStyle, width: "100%", resize: "vertical", lineHeight: 1.5 }} />
                    </Field>

                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {["TALKING", "HELD", "CONFIRMED", "NO"].map((k) => (
                        <Btn key={k} on={r.status === k} onClick={() => decide(r, k)}>{k}</Btn>
                      ))}
                    </div>

                    {/*
                      No reply is sent from here, and that is on purpose: a
                      booking answer is a real letter with terms in it, written
                      by a person. A templated one would be worse than none.
                    */}
                    <a href={`mailto:${r.email}?subject=${encodeURIComponent("Re: " + (r.artist || "booking") + (r.date_label ? " — " + r.date_label : ""))}`}
                       className="inline-block mt-4"
                       style={{ ...fontUtility, fontSize: "9px", letterSpacing: "0.16em",
                                color: theme.ink, borderBottom: `1px solid ${theme.brass}`, textDecoration: "none" }}>
                      WRITE TO THEM →
                    </a>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   N05 · THE WAITING LIST
   ═══════════════════════════════════════════════════════════════════════════

   THE ONE NUMBER THAT MATTERS is `room` — how many places have actually come
   free. Offering a place while the room is at its limit is how a night ends up
   over capacity, so the button that offers the next person says what it is
   doing when there is no room, rather than being hidden or quietly refusing.
*/
export function Waitlist({ party }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(null);

  const load = useCallback(() => {
    if (!party) { setLoading(false); return; }
    setLoading(true);
    api.readWaitlist(party).then((res) => {
      setLoading(false);
      if (res.ok) setData(res);
      else setMsg(res.error || "Could not read the queue.");
    });
  }, [party]);
  useEffect(() => { load(); }, [load]);

  const offer = async (id, anyway) => {
    setBusy(id || "next");
    setMsg("");
    const res = await api.offerPlace(party, id, anyway);
    setBusy(null);
    if (res.ok) {
      setMsg(`${res.name} has their pass — ${res.email && res.email.sent ? "emailed" : "but the email did not send, so tell them"}.`);
      load();
    } else {
      setMsg(res.error || "Could not offer that place.");
    }
  };

  if (!party) return <Empty>Choose an event first.</Empty>;

  const room = data ? data.room : 0;
  const queue = data ? data.queue : [];

  return (
    <div>
      <IndexBand items={[
        { label: "WAITING", value: loading ? "—" : String(queue.length).padStart(3, "0") },
        { label: "PLACES FREE", value: loading ? "—" : String(room).padStart(3, "0") },
        { label: "ISSUED", value: data ? `${data.issued} / ${data.capacity || "∞"}` : "—" },
      ]} />

      <Note tone={msg.includes("has their pass") ? "ok" : "bad"}>{msg}</Note>

      <p className="m-0 mt-6" style={{ ...fontText, fontSize: "16px", lineHeight: 1.55, color: theme.ink2 }}>
        In the order they asked, which is the only order anyone accepts as
        fair. Offering a place issues the pass and emails it — there is no
        accept step, because nobody else is kept waiting while one person
        decides.
      </p>

      {room > 0 && queue.length > 0 && (
        <div className="mt-5">
          <Btn wide on onClick={() => offer(null, false)} disabled={busy === "next"}>
            {busy === "next" ? "OFFERING…" : `OFFER THE NEXT PLACE — ${queue[0].name.toUpperCase()}`}
          </Btn>
        </div>
      )}

      {loading ? (
        <Empty>Reading…</Empty>
      ) : queue.length === 0 ? (
        <Empty>
          Nobody is waiting. People land here when a request arrives for a
          night whose places are all issued — which only happens if the event
          has a capacity set.
        </Empty>
      ) : (
        <div className="mt-6" style={{ borderTop: `1px solid ${theme.ink}` }}>
          {queue.map((r, i) => (
            <div key={r.id} className="flex items-baseline gap-3 py-3.5"
                 style={{ borderBottom: `1px solid ${theme.rule}` }}>
              <span style={{ ...fontUtility, fontSize: "10px", letterSpacing: "0.1em",
                             width: "28px", flex: "none", color: theme.brass,
                             fontVariantNumeric: "tabular-nums" }}>
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="flex-1 min-w-0">
                <span className="block truncate" style={{ ...fontText, fontSize: "17.5px", color: theme.ink }}>
                  {r.name}
                  {r.people > 1 && <span style={{ color: theme.ink2 }}> · {r.people} people</span>}
                  {r.referrer && (
                    <span style={{ ...fontUtility, fontSize: "8px", letterSpacing: "0.14em",
                                   color: theme.brass, marginLeft: "8px" }}>
                      BROUGHT BY {r.referrer}
                    </span>
                  )}
                </span>
                <span className="block truncate" style={{ ...fontUtility, fontSize: "8.5px", letterSpacing: "0.12em", color: theme.ink2 }}>
                  {when(r.created_at)}{r.note ? " · " + r.note : ""}
                </span>
              </span>
              <Btn onClick={() => offer(r.id, room < (r.people || 1))}
                   danger={room < (r.people || 1)}
                   disabled={busy === r.id}>
                {busy === r.id ? "…" : room < (r.people || 1) ? "OFFER ANYWAY" : "OFFER"}
              </Btn>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   G06 · THE RUNNING ORDER
   ═══════════════════════════════════════════════════════════════════════════

   Edited as a LIST and saved whole. A running order gets reordered, one line
   deleted, two added — and sending the finished list is the only version of
   that which cannot end up half-applied when a phone loses signal between the
   third and fourth request.

   The time is a text field, not a time picker. "01:30" is a running order;
   "01:30 – 03:00" is a running order; "after Astryon" is a running order. A
   time picker would demand somebody decide what date 01:30 belongs to at the
   exact hour nobody should be deciding anything.
*/
export function SetTimes({ party }) {
  const [sets, setSets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    if (!party) { setLoading(false); return; }
    setLoading(true);
    api.listSetTimes(party).then((res) => {
      setLoading(false);
      if (res.ok) setSets((res.sets || []).map((s) => ({ name: s.name, at: s.at_label || "", room: s.room || "", note: s.note || "" })));
    });
  }, [party]);
  useEffect(() => { load(); }, [load]);

  const set = (i, k, v) => setSets((list) => list.map((s, j) => (j === i ? { ...s, [k]: v } : s)));
  const add = () => setSets((list) => [...list, { name: "", at: "", room: "", note: "" }]);
  const drop = (i) => setSets((list) => list.filter((_, j) => j !== i));
  const move = (i, by) => setSets((list) => {
    const next = [...list];
    const j = i + by;
    if (j < 0 || j >= next.length) return next;
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  });

  const save = async () => {
    setBusy(true);
    setMsg("");
    const res = await api.saveSetTimes(party, sets.filter((s) => s.name.trim()));
    setBusy(false);
    setMsg(res.ok ? "Saved. Every phone with the pass open sees it within a minute." : (res.error || "Could not save."));
  };

  if (!party) return <Empty>Choose an event first.</Empty>;

  return (
    <div>
      <IndexBand items={[
        { label: "SETS", value: loading ? "—" : String(sets.length).padStart(2, "0") },
        { label: "SHOWN ON", value: "PASS + EVENT" },
        { label: "UPDATES", value: "LIVE" },
      ]} />

      <Note tone={msg.startsWith("Saved") ? "ok" : "bad"}>{msg}</Note>

      <p className="m-0 mt-6 mb-5" style={{ ...fontText, fontSize: "16px", lineHeight: 1.55, color: theme.ink2 }}>
        This appears on every guest's pass and on the event page. Change it
        during the night and it changes on their phones — which is the whole
        point, because a running order printed at 9pm is fiction by midnight.
      </p>

      {sets.map((s, i) => (
        <div key={i} className="py-3" style={{ borderBottom: `1px solid ${theme.rule}` }}>
          <div className="flex gap-2 items-start">
            <span style={{ ...fontUtility, fontSize: "10px", color: theme.brass, paddingTop: "12px",
                           width: "24px", flex: "none", fontVariantNumeric: "tabular-nums" }}>
              {String(i + 1).padStart(2, "0")}
            </span>
            <div className="flex-1 grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))" }}>
              <input placeholder="Who is playing" value={s.name}
                     onChange={(e) => set(i, "name", e.target.value)} style={inputStyle} />
              <input placeholder="01:30 – 03:00" value={s.at}
                     onChange={(e) => set(i, "at", e.target.value)} style={inputStyle} />
              <input placeholder="Room (optional)" value={s.room}
                     onChange={(e) => set(i, "room", e.target.value)} style={inputStyle} />
            </div>
            <div className="flex flex-col gap-1" style={{ paddingTop: "4px" }}>
              <Btn onClick={() => move(i, -1)} aria-label="Move up">↑</Btn>
              <Btn onClick={() => move(i, 1)} aria-label="Move down">↓</Btn>
              <Btn danger onClick={() => drop(i)} aria-label="Remove">×</Btn>
            </div>
          </div>
        </div>
      ))}

      <div className="flex gap-2 mt-5">
        <Btn onClick={add}>ADD A SET</Btn>
        <Btn wide on onClick={save} disabled={busy}>{busy ? "SAVING…" : "SAVE THE RUNNING ORDER"}</Btn>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   L02 · PRESS KITS
   ═══════════════════════════════════════════════════════════════════════════

   The kit and the LINKS to it are two different things, and keeping them
   separate is what makes this usable: an artist's kit is edited for years
   while the links to it are made, sent, and killed. Revoking a link that has
   gone somewhere it should not must never mean losing the rider.
*/
/*
  The press kit panel moved to KitEditor.jsx when it grew a photo grid, file
  uploads, a link manager and a preview. It is re-exported here so Console.jsx
  keeps importing its panels from one place.
*/
export { Kits } from "./KitEditor";

/* ═══════════════════════════════════════════════════════════════════════════
   G08 · THE MORNING AFTER
   ═══════════════════════════════════════════════════════════════════════════

   The count is checked before anything is sent, because "this will reach 84
   people" is the only number that makes the send button honest. A letter that
   turns out to have gone to four people, or four hundred, is a letter you
   would have written differently.
*/
export function After({ parties = [] }) {
  const [party, setParty] = useState(parties[0]?.id || "");
  const [subject, setSubject] = useState("");
  const [text, setText] = useState("");
  const [would, setWould] = useState(null);
  const [msg, setMsg] = useState("");
  const [tone, setTone] = useState("bad");
  const [busy, setBusy] = useState(false);
  const [sure, setSure] = useState(false);
  const [past, setPast] = useState([]);

  useEffect(() => {
    api.listAfters().then((res) => { if (res.ok) setPast(res.letters || []); });
  }, [busy]);

  useEffect(() => { setWould(null); setSure(false); }, [party]);

  const count = async () => {
    setMsg("");
    const res = await api.sendAfter(party, subject || "x", text || "x", { dryRun: true });
    if (res.ok) { setWould(res.would); setTone("ok"); setMsg(`This would reach ${res.would} ${res.would === 1 ? "person" : "people"}.`); }
    else { setTone("bad"); setMsg(res.error || "Could not count."); }
  };

  const send = async () => {
    if (!sure) { setSure(true); setTimeout(() => setSure(false), 6000); return; }
    setSure(false);
    setBusy(true);
    const res = await api.sendAfter(party, subject, text, { anyway: true });
    setBusy(false);
    setTone(res.ok ? "ok" : "bad");
    setMsg(res.ok ? `Sent to ${res.sent}.` : (res.error || "Could not send."));
    if (res.ok) { setSubject(""); setText(""); setWould(null); }
  };

  const already = past.find((p) => p.party_id === party);

  return (
    <div>
      <IndexBand items={[
        { label: "GOES TO", value: "PEOPLE WHO CAME" },
        { label: "WOULD REACH", value: would == null ? "—" : String(would).padStart(3, "0") },
        { label: "LETTERS SENT", value: String(past.length).padStart(2, "0") },
      ]} />

      <Note tone={tone}>{msg}</Note>

      <p className="m-0 mt-6 mb-5" style={{ ...fontText, fontSize: "16px", lineHeight: 1.55, color: theme.ink2 }}>
        One letter, to the people who actually scanned in — not to everyone
        who was issued a pass, and not to a mailing list. That distinction is
        the only thing that makes this worth doing: a list of people who turned
        up means something, and a list of people who once filled in a form does
        not.
      </p>

      <Field label="Which night">
        <select value={party} onChange={(e) => setParty(e.target.value)} style={{ ...inputStyle, width: "100%" }}>
          {parties.map((p) => <option key={p.id} value={p.id}>{p.name} — {p.date_label}</option>)}
        </select>
      </Field>

      {already && (
        <p className="m-0 mt-3" style={{ ...fontUtility, fontSize: "9px", letterSpacing: "0.14em", color: theme.warn }}>
          ALREADY WRITTEN TO — {already.sent_to} PEOPLE ON {when(already.sent_at)}
        </p>
      )}

      <div className="mt-5">
        <Field label="Subject">
          <input value={subject} onChange={(e) => setSubject(e.target.value)}
                 placeholder="Saturday, and what's next"
                 style={{ ...inputStyle, width: "100%" }} />
        </Field>
      </div>

      <div className="mt-4">
        <Field label="The letter">
          <textarea rows={9} value={text} onChange={(e) => setText(e.target.value)}
                    placeholder={"Thank you for Saturday.\n\nThe mix is here: …\nPhotographs: …\n\nThe next one is 14 March."}
                    style={{ ...inputStyle, width: "100%", resize: "vertical", lineHeight: 1.6 }} />
          <span className="block mt-1.5" style={{ ...fontText, fontSize: "14px", lineHeight: 1.5, color: theme.ink2 }}>
            Their first name and the sign-off are added for you. Keep it short —
            this is a thank you with two links in it, not a newsletter.
          </span>
        </Field>
      </div>

      <div className="flex flex-wrap gap-2 mt-6">
        <Btn onClick={count} disabled={!party}>HOW MANY WOULD THIS REACH</Btn>
        <Btn wide on danger={sure} disabled={busy || !party || !subject.trim() || !text.trim()}
             onClick={send}>
          {busy ? "SENDING…" : sure ? `TAP AGAIN TO SEND TO ${would ?? "THEM"}` : "SEND IT"}
        </Btn>
      </div>

      {past.length > 0 && (
        <Panel title="ALREADY SENT">
          <div style={{ borderTop: `1px solid ${theme.rule}` }}>
            {past.map((l) => (
              <div key={l.id} className="flex items-baseline gap-3 py-2.5" style={{ borderBottom: `1px solid ${theme.rule}` }}>
                <span style={{ ...fontUtility, fontSize: "8.5px", letterSpacing: "0.12em", color: theme.ink2, width: "96px", flex: "none" }}>
                  {when(l.sent_at)}
                </span>
                <span className="flex-1 min-w-0 truncate" style={{ ...fontText, fontSize: "16px", color: theme.ink }}>
                  {l.subject}
                  <span style={{ color: theme.ink2 }}> — {l.party_name || l.party_id}</span>
                </span>
                <span style={{ ...fontUtility, fontSize: "9px", letterSpacing: "0.14em", color: theme.brass }}>
                  {l.sent_to}
                </span>
              </div>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   L03 · WHERE A RECORD LIVES
   ═══════════════════════════════════════════════════════════════════════════

   One record at a time, edited as a list and saved whole — the same shape as
   the running order, and for the same reason: these get reordered and deleted
   from the middle, and sending the finished list is the only version of that
   which cannot half-apply.

   PRE-SAVE IS A TICK, NOT A SEPARATE LIST. A row marked pre-save is shown
   before the release date and hidden after it, and every other row does the
   opposite. That means the same page turns itself over at midnight on release
   day with nobody touching it — which is the entire point, because the person
   who would have to remember is asleep.
*/

const PLATFORMS = [
  "SPOTIFY", "APPLE MUSIC", "BEATPORT", "BANDCAMP",
  "SOUNDCLOUD", "YOUTUBE", "TIDAL", "DEEZER", "TRAXSOURCE",
];

export function ReleaseLinks({ records = [] }) {
  const [slug, setSlug] = useState(records[0]?.slug || "");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    if (!slug) { setLoading(false); return; }
    setLoading(true);
    api.listReleaseLinks(slug).then((res) => {
      setLoading(false);
      if (res.ok) setRows((res.links || []).map((l) => ({
        label: l.label, url: l.url, presave: !!l.presave,
      })));
      else setMsg(res.error || "Could not read the links.");
    });
  }, [slug]);
  useEffect(() => { load(); }, [load]);

  const set = (i, k, v) => setRows((list) => list.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  const add = (label = "") => setRows((list) => [...list, { label, url: "", presave: false }]);
  const drop = (i) => setRows((list) => list.filter((_, j) => j !== i));
  const move = (i, by) => setRows((list) => {
    const next = [...list];
    const j = i + by;
    if (j < 0 || j >= next.length) return next;
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  });

  const save = async () => {
    setBusy(true);
    setMsg("");
    const res = await api.saveReleaseLinks(slug, rows.filter((r) => r.label.trim() && r.url.trim()));
    setBusy(false);
    setMsg(res.ok ? "Saved." : (res.error || "Could not save."));
  };

  const record = records.find((r) => r.slug === slug);
  const dated = record && record.releaseDate && !Number.isNaN(new Date(record.releaseDate).getTime());
  const out = !dated ? true : Date.now() >= new Date(record.releaseDate).getTime();

  if (!records.length) return <Empty>No records yet.</Empty>;

  return (
    <Panel title="WHERE THIS RECORD LIVES"
           right={`${rows.length} LINK${rows.length === 1 ? "" : "S"}`}>

      <Note tone={msg === "Saved." ? "ok" : "bad"}>{msg}</Note>

      <Field label="Which record">
        <select value={slug} onChange={(e) => setSlug(e.target.value)} style={{ ...inputStyle, width: "100%" }}>
          {records.map((r) => (
            <option key={r.slug} value={r.slug}>{r.title} — {r.artist}</option>
          ))}
        </select>
      </Field>

      <p className="m-0 mt-3 mb-5" style={{ ...fontText, fontSize: "16px", lineHeight: 1.55, color: theme.ink2 }}>
        {!dated
          ? "This record has no proper release date on it, so everything here is shown as already out. Pre-save rows will never appear until it gets one."
          : out
            ? `Out since ${new Date(record.releaseDate).toLocaleDateString()} — the ordinary links are showing and pre-save rows are hidden.`
            : `Out on ${new Date(record.releaseDate).toLocaleDateString()} — only pre-save rows are showing until then. The page turns itself over at midnight; nobody needs to be awake for it.`}
      </p>

      {loading ? (
        <Empty>Reading…</Empty>
      ) : (
        <>
          {rows.map((r, i) => (
            <div key={i} className="py-3" style={{ borderBottom: `1px solid ${theme.rule}` }}>
              <div className="flex gap-2 items-start">
                <span style={{ ...fontUtility, fontSize: "10px", color: theme.brass, paddingTop: "12px",
                               width: "24px", flex: "none", fontVariantNumeric: "tabular-nums" }}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="flex-1 grid gap-2" style={{ gridTemplateColumns: "minmax(120px,1fr) minmax(180px,2fr)" }}>
                  <input placeholder="SPOTIFY" value={r.label}
                         onChange={(e) => set(i, "label", e.target.value.toUpperCase())} style={inputStyle} />
                  <input placeholder="https://…" value={r.url} inputMode="url"
                         onChange={(e) => set(i, "url", e.target.value)} style={inputStyle} />
                </div>
                <div className="flex flex-col gap-1" style={{ paddingTop: "4px" }}>
                  <Btn onClick={() => move(i, -1)} aria-label="Move up">↑</Btn>
                  <Btn onClick={() => move(i, 1)} aria-label="Move down">↓</Btn>
                  <Btn danger onClick={() => drop(i)} aria-label="Remove">×</Btn>
                </div>
              </div>
              <label className="flex items-center gap-2.5 mt-2" style={{ cursor: "pointer", paddingLeft: "32px" }}>
                <input type="checkbox" checked={r.presave}
                       onChange={(e) => set(i, "presave", e.target.checked)} />
                <span style={{ ...fontText, fontSize: "15px", color: r.presave ? theme.brass : theme.ink2 }}>
                  Pre-save — shown only until release day, then this row disappears
                </span>
              </label>
            </div>
          ))}

          <div className="flex flex-wrap gap-1.5 mt-5 mb-4">
            {PLATFORMS.filter((n) => !rows.some((r) => r.label === n)).map((n) => (
              <Btn key={n} onClick={() => add(n)}>+ {n}</Btn>
            ))}
            <Btn onClick={() => add("")}>+ SOMETHING ELSE</Btn>
          </div>

          <Btn wide on onClick={save} disabled={busy || !slug}>
            {busy ? "SAVING…" : "SAVE THE LINKS"}
          </Btn>

          <p className="m-0 mt-4" style={{ ...fontText, fontSize: "15px", lineHeight: 1.55, color: theme.ink2 }}>
            A link with no address is dropped when you save — that is how you
            remove one you added by mistake.
          </p>
        </>
      )}
    </Panel>
  );
}
