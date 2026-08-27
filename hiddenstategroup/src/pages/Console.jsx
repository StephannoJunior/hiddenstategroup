import { usePageMeta } from "../lib/seo";
import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Nav, Footer, useGoogleFonts, Field, inputStyle,
  fontDisplay, fontUtility, fontText, fontMasthead, theme,
} from "../components/Shared";
import DoorGate from "../components/DoorGate";
import * as api from "../lib/api";

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
  { id: "events",   label: "EVENTS",   need: "issue" },
  { id: "team",     label: "TEAM",     need: "team" },
  { id: "requests", label: "REQUESTS", need: "seeList" },
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
  const [form, setForm] = useState({ name: "", email: "", phone: "", kind: "TICKET", tier: "STANDARD", ticketRef: "", note: "" });
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
    setBusy(true);
    const res = await api.issuePass({ ...form, party });
    setBusy(false);
    if (!res.ok) { setMsg(res.error || "Couldn't issue that pass."); return; }
    setIssued({ code: res.code, email: res.email });
    setForm({ name: "", email: "", phone: "", kind: "TICKET", tier: "STANDARD", ticketRef: "", note: "" });
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

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <>
      <Section title="EVENT">
        <select value={party} onChange={(e) => setParty(e.target.value)} style={{ ...inputStyle, width: "100%" }}>
          {parties.map((p) => <option key={p.id} value={p.id}>{p.name} — {p.date_label}</option>)}
        </select>
      </Section>

      {role.can.issue && (
        <Section title="ISSUE A PASS">
          <form onSubmit={issue} className="space-y-3">
            <Field label="Full name"><input required style={inputStyle} value={form.name} onChange={set("name")} /></Field>
            <Field label="Email"><input type="email" style={inputStyle} value={form.email} onChange={set("email")} /></Field>
            <Field label="Phone"><input type="tel" style={inputStyle} value={form.phone} onChange={set("phone")} /></Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Kind">
                <select style={inputStyle} value={form.kind} onChange={set("kind")}>
                  <option value="TICKET">Sold ticket</option>
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
                </select>
              </Field>
            </div>

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

      <Section title={`ISSUED — ${rows.length}`}>
        {rows.length === 0 && (
          <p className="m-0" style={{ ...fontText, fontSize: "16px", color: theme.ink2 }}>
            Nothing issued for this event yet.
          </p>
        )}
        {rows.map((r) => {
          const dead = r.status === "REVOKED";
          return (
            <div key={r.code} className="flex items-center gap-3 py-3"
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
              {role.can.revoke && (
                <button onClick={() => (dead ? restore(r.code) : revoke(r.code, r.name))}
                        style={{ ...fontUtility, fontSize: "8.5px", letterSpacing: "0.14em",
                                 color: dead ? theme.brass : "#7A2E2E", background: "transparent", border: 0, cursor: "pointer" }}>
                  {dead ? "RESTORE" : "CANCEL"}
                </button>
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
  const [form, setForm] = useState({ id: "", name: "", dateLabel: "", venue: "", doorsCloseAt: "", minimumAge: 16 });
  const [msg, setMsg] = useState("");
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const add = async (e) => {
    e.preventDefault();
    setMsg("");
    if (!form.id || !form.name || !form.doorsCloseAt) {
      setMsg("An id, a name and a closing time are needed.");
      return;
    }
    const res = await api.createParty(form);
    if (!res.ok) { setMsg(res.error || "Couldn't add that event."); return; }
    setForm({ id: "", name: "", dateLabel: "", venue: "", doorsCloseAt: "", minimumAge: 16 });
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
          <Field label="Doors close">
            <input type="datetime-local" style={inputStyle} value={form.doorsCloseAt}
                   onChange={(e) => setForm((f) => ({ ...f, doorsCloseAt: e.target.value + ":00+02:00" }))} />
          </Field>
          <p className="m-0" style={{ ...fontText, fontSize: "14px", lineHeight: 1.5, color: theme.ink2 }}>
            Set this to the morning after, not the start of the night — passes stop
            working at this moment, and anyone arriving late would be refused by
            their own ticket.
          </p>
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
  const [form, setForm] = useState({ username: "", password: "", role: "STAFF", displayName: "", email: "", phone: "" });
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const res = await api.listTeam();
    if (res.ok) setRows(res.team || []);
    else setMsg(res.error || "Couldn't load the team.");
  }, []);
  useEffect(() => { load(); }, [load]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const add = async (e) => {
    e.preventDefault();
    setMsg("");
    if (form.password.length < 12) {
      setMsg("Use at least 12 characters — this login can open the door.");
      return;
    }
    const res = await api.createMember(form);
    if (!res.ok) { setMsg(res.error || "Couldn't create that account."); return; }
    setMsg(`Created ${form.username}. Send them their password yourself — it isn't stored anywhere readable.`);
    setForm({ username: "", password: "", role: "STAFF", displayName: "", email: "", phone: "" });
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
              <select style={inputStyle} value={form.role} onChange={set("role")}>
                <option value="STAFF">Door staff</option>
                <option value="OWNER">Management</option>
              </select>
            </Field>
          </div>
          <Field label="Their name"><input style={inputStyle} value={form.displayName} onChange={set("displayName")} /></Field>
          <Field label="Email"><input type="email" style={inputStyle} value={form.email} onChange={set("email")} /></Field>
          <Field label="Phone"><input type="tel" style={inputStyle} value={form.phone} onChange={set("phone")} /></Field>
          <Field label="Password"><input style={inputStyle} value={form.password} onChange={set("password")} /></Field>
          <button type="submit" style={btn}>CREATE ACCOUNT</button>
        </form>
        <Notice message={msg} tone={msg.startsWith("Created") ? "good" : "bad"} />
      </Section>

      <Section title={`TEAM — ${rows.length}`}>
        {rows.map((m) => (
          <div key={m.username} className="flex items-center gap-3 py-3"
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
        {r.status === "PENDING" && role.can.issue && (
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
        {tab === "events" && role.can.issue && <Events parties={parties} reload={loadParties} />}
        {tab === "team" && role.can.team && <Team />}
        {tab === "requests" && <Requests role={role} party={party} />}
      </section>
      <Footer />
    </div>
  );
}

export default function Console() {
  return <DoorGate>{(role) => <ConsoleScreen role={role} />}</DoorGate>;
}
