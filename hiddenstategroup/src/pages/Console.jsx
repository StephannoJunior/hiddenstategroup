import { usePageMeta } from "../lib/seo";
import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Nav, Footer, useGoogleFonts, Field, inputStyle,
  fontDisplay, fontUtility, fontText, fontMasthead, theme,
} from "../components/Shared";
import DoorGate from "../components/DoorGate";
import * as api from "../lib/api";
import IMAGES from "../content/images.json";

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
  { id: "scan",     label: "SCANNER",  need: "scan",    to: "/scan" },
  { id: "door",     label: "DOOR",     need: "seeList", to: "/doorlist" },
  { id: "passes",   label: "PASSES",   need: "seeList" },
  { id: "events",   label: "EVENTS",   need: "issuePasses" },
  { id: "team",     label: "TEAM",     need: "manageTeam" },
  { id: "requests", label: "REQUESTS", need: "seeList" },
  { id: "stats",    label: "THE NIGHT", need: "seeList" },
  { id: "posts",    label: "POSTS",     need: "issuePasses" },
  { id: "settings", label: "SETTINGS",  need: "manageTeam" },
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

function Notice({ message, tone = "bad" }) {
  if (!message) return null;
  const colour = tone === "good" ? "#1E4620" : "#7A2E2E";
  return (
    <p className="m-0 mt-3 px-3 py-2.5"
       style={{ ...fontText, fontSize: "15px", color: colour, border: `1px solid ${colour}55` }}>
      {message}
    </p>
  );
}

function Section({ title, children }) {
  return (
    <div className="mt-7">
      <p className="m-0 mb-3" style={{ ...fontUtility, fontSize: "9.5px", letterSpacing: "0.2em", color: theme.brass }}>
        {title}
      </p>
      {children}
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
            <div className="mt-4 p-5 text-center" style={{ border: `1px solid ${theme.ink}`, background: "#EFE6D0" }}>
              <p className="m-0" style={{ ...fontUtility, fontSize: "9px", letterSpacing: "0.2em", color: theme.brass }}>
                WRITE THIS ON THE TICKET
              </p>
              <p className="m-0 mt-2" style={{ ...fontDisplay, fontSize: "34px", letterSpacing: "0.14em", color: theme.ink }}>
                {issued.code}
              </p>

              {/* Say plainly whether it was emailed. Silence here would leave
                  you assuming a guest has their pass when they do not. */}
              <p className="m-0 mt-3" style={{ ...fontUtility, fontSize: "9px", letterSpacing: "0.16em",
                                               color: issued.email?.sent ? "#1E4620" : "#7A5A2E" }}>
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
            <div className="mt-4 p-4" style={{ border: `1px solid ${theme.ink}`, background: "#EFE6D0" }}>
              <p className="m-0 mb-2" style={{ ...fontUtility, fontSize: "9px", letterSpacing: "0.18em", color: theme.brass }}>
                {bulkResult.issued.length} ISSUED{bulkResult.failed.length ? ` · ${bulkResult.failed.length} FAILED` : ""}
              </p>
              {bulkResult.issued.map((i) => (
                <p key={i.code} className="m-0" style={{ ...fontText, fontSize: "15px", color: theme.ink }}>
                  {i.code} — {i.name}
                </p>
              ))}
              {bulkResult.failed.map((f, n) => (
                <p key={n} className="m-0" style={{ ...fontText, fontSize: "15px", color: "#7A2E2E" }}>
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
                                 color: dead ? theme.brass : "#7A2E2E", background: "transparent", border: 0, cursor: "pointer" }}>
                  {dead ? "RESTORE" : "CANCEL"}
                </button>
              )}
            </div>

            {editing === r.code && (
              <div className="px-3 py-4 mb-3" style={{ border: `1px solid ${theme.ink}`, background: "#EFE6D0" }}>
                <p className="m-0 mb-3" style={{ ...fontUtility, fontSize: "8.5px", letterSpacing: "0.18em", color: theme.brass }}>
                  EDITING {r.code} — THE CODE ITSELF CANNOT CHANGE
                </p>

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
                             color: "#7A2E2E", background: "transparent", border: 0, cursor: "pointer" }}>
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
                                 color: "#7A2E2E", background: "transparent", border: 0, cursor: "pointer" }}>
                  DELETE
                </button>
              </>
            )}
          </div>

          {editing === m.username && (
            <div className="px-3 py-4 mb-3" style={{ border: `1px solid ${theme.ink}`, background: "#EFE6D0" }}>
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
            {r.email}{r.phone ? ` · ${r.phone}` : ""} · {new Date(r.created_at).toLocaleDateString()}
            {r.pass_code ? ` · ${r.pass_code}` : ""}
          </span>
        </span>
        {r.status === "PENDING" && role.can.issuePasses && (
          <span className="flex gap-3 shrink-0">
            <button disabled={busy === r.id} onClick={() => decide(r.id, "APPROVED")}
                    style={{ ...fontUtility, fontSize: "8.5px", letterSpacing: "0.14em",
                             color: "#1E4620", background: "transparent", border: 0, cursor: "pointer" }}>
              {busy === r.id ? "…" : "APPROVE"}
            </button>
            <button disabled={busy === r.id} onClick={() => decide(r.id, "DECLINED")}
                    style={{ ...fontUtility, fontSize: "8.5px", letterSpacing: "0.14em",
                             color: "#7A2E2E", background: "transparent", border: 0, cursor: "pointer" }}>
              DECLINE
            </button>
          </span>
        )}
        {r.status !== "PENDING" && (
          <span style={{ ...fontUtility, fontSize: "8.5px", letterSpacing: "0.14em",
                         color: r.status === "APPROVED" ? "#1E4620" : theme.ink2 }}>
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

  if (!data) return <><Notice message={msg} /><Section title="THE NIGHT"><p className="m-0" style={{ ...fontText, fontSize: "16px", color: theme.ink2 }}>Loading…</p></Section></>;

  const t = data.totals || {};
  const peak = (data.byHour || []).reduce((best, h) => (h.n > (best?.n || 0) ? h : best), null);
  const maxHour = Math.max(1, ...(data.byHour || []).map((h) => h.n));

  return (
    <>
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

  const imageOptions = ["", ...IMAGES];

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
                      style={{ ...fontUtility, fontSize: "8.5px", letterSpacing: "0.14em", color: "#7A2E2E",
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

            {/* Photographs are the files already on the site. Send me new ones
                and they appear in these lists. */}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Poster">
                <select style={inputStyle} value={form.poster} onChange={set("poster")}>
                  {imageOptions.map((i) => <option key={i} value={i}>{i || "— none —"}</option>)}
                </select>
              </Field>
              <Field label="Photo">
                <select style={inputStyle} value={form.photo} onChange={set("photo")}>
                  {imageOptions.map((i) => <option key={i} value={i}>{i || "— none —"}</option>)}
                </select>
              </Field>
            </div>

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

// ── SETTINGS ────────────────────────────────────────────────────────────────

function Settings({ parties }) {
  const [values, setValues] = useState(null);
  const [defaults, setDefaults] = useState({});
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.fetchSettings().then((res) => {
      if (res.ok) { setValues(res.settings); setDefaults(res.defaults || {}); }
      else setMsg(res.error || "Couldn't load the settings.");
    });
  }, []);

  const save = async () => {
    setBusy(true);
    const res = await api.saveSettings(values);
    setBusy(false);
    setMsg(res.ok ? "Saved. Changes apply straight away." : (res.error || "Couldn't save."));
  };

  if (!values) return <><Notice message={msg} /><Section title="SETTINGS"><p className="m-0" style={{ ...fontText, fontSize: "16px", color: theme.ink2 }}>Loading…</p></Section></>;

  const set = (k, v) => setValues((s) => ({ ...s, [k]: v }));

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
    { key: "autoCloseAfterMinutes", label: "Refuse entry after", unit: "min from open",
      help: "An earlier cut-off than the event's closing time, so late arrivals are refused by the system rather than by a judgement call. 0 means no cut-off." },
  ];

  return (
    <>
      <Notice message={msg} tone={msg.startsWith("Saved") ? "good" : "bad"} />

      <Section title="THE DOOR">
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

      <Section title="THE SITE">
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

      <Section title="EMAIL">
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
            <span className="block" style={{ ...fontText, fontSize: "16px", color: "#7A2E2E" }}>
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

      <button onClick={save} disabled={busy} style={{ ...btn, marginTop: "8px", opacity: busy ? 0.6 : 1 }}>
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
                         color: danger ? "#7A2E2E" : theme.ink,
                         background: "transparent", border: `1px solid ${danger ? "#C08A8A" : theme.ink}`,
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
  const [tab, setTab] = useState("passes");
  const [parties, setParties] = useState([]);
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
      <section className="max-w-[720px] mx-auto px-[18px] pt-[104px] pb-16">
        <h1 className="text-center m-0" style={{ ...fontMasthead, color: theme.ink, fontSize: "clamp(24px,6vw,38px)" }}>
          Console
        </h1>
        <div className="flex justify-between py-1.5 mt-2"
             style={{ ...fontUtility, fontSize: "9.5px", letterSpacing: "0.18em", color: theme.ink2,
                      borderTop: `1px solid ${theme.ink}`, borderBottom: `1px solid ${theme.ink}` }}>
          <span>{(role.displayName || role.label || "").toUpperCase()}</span>
          <span>{role.id}{codesLeft !== null ? " · " + codesLeft + " CODES" : ""}</span>
        </div>

        <div className="flex gap-5 mt-5 overflow-x-auto no-scrollbar">
          {allowed.map((t) => (
            t.to ? (
              <Link key={t.id} to={t.to} className="pb-1 whitespace-nowrap"
                    style={{ ...fontUtility, fontSize: "10px", letterSpacing: "0.16em",
                             color: theme.ink2, borderBottom: "2px solid transparent" }}>
                {t.label} →
              </Link>
            ) : (
            <button key={t.id} onClick={() => setTab(t.id)} className="pb-1 whitespace-nowrap"
                    style={{ ...fontUtility, fontSize: "10px", letterSpacing: "0.16em",
                             color: tab === t.id ? theme.brass : theme.ink2,
                             borderBottom: `2px solid ${tab === t.id ? theme.brass : "transparent"}`,
                             background: "transparent", border: 0, cursor: "pointer" }}>
              {t.label}
            </button>
            )
          ))}
        </div>

        <Notice message={msg} />

        {tab === "passes" && (
          <Passes role={role} parties={parties} party={party} setParty={setParty} />
        )}
        {tab === "events" && role.can.issuePasses && <Events parties={parties} reload={loadParties} />}
        {tab === "team" && role.can.manageTeam && <Team />}
        {tab === "requests" && <Requests role={role} party={party} />}
        {tab === "stats" && <Stats party={party} />}
        {tab === "posts" && role.can.issuePasses && <Posts />}
        {tab === "settings" && role.can.manageTeam && <Settings parties={parties} />}
      </section>
      <Footer />
    </div>
  );
}

export default function Console() {
  return <DoorGate>{(role) => <ConsoleScreen role={role} />}</DoorGate>;
}
