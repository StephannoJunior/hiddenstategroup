import { usePageMeta } from "../lib/seo";
import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Nothing,
  Nav, Footer, useGoogleFonts,
  IndexBand, PageHead, fontDisplay, fontUtility, fontText, theme,
} from "../components/Shared";
import DoorGate from "../components/DoorGate";
import * as api from "../lib/api";

/*
  The organiser's view of the door.

  Every pass for the night, with what has actually happened to it: admitted,
  refused, or still to arrive. Refusals carry a reason and an attempt count,
  because a code being tried five times usually means a screenshot is doing
  the rounds rather than five separate people making the same mistake.

  It re-reads every two seconds. On this trial that means it must be open on
  the SAME device as the scanner, since the record lives in that device's own
  storage. Once the passes move to a server, this page shows the door live
  from anywhere.
*/

const STATE = {
  ADMITTED: { fg: theme.good, label: "VALID" },
  // Some of a group through and some still outside. Its own state, because
  // calling it either "in" or "awaiting" is untrue in a way the door notices.
  PARTLY:   { fg: theme.brass, label: "SOME IN" },
  REFUSED:  { fg: theme.bad, label: "REJECTED" },
  AWAITING: { fg: theme.ink2, label: "AWAITING" },
  REVOKED:  { fg: theme.bad, label: "CANCELLED" },
};

const REASON = {
  USED: "already used",
  EXPIRED: "code went stale",
  NOT_VALID: "code not recognised",
  PARTY_OVER: "wrong night",
  UNKNOWN: "not on the list",
  NOT_A_PASS: "not a pass",
  WRONG_CODE: "wrong code",
  NO_PARTY: "no night linked",
};

function PassListScreen({ role }) {
  useGoogleFonts();
  usePageMeta({ title: "Door list", description: "Hidden State pass status." });

  const [rows, setRows] = useState([]);
  const [party, setParty] = useState(null);
  const [msg, setMsg] = useState("");

  /*
    Read from the server every few seconds, so this is the same list every
    phone on the door sees. It used to read the scanning device's own storage,
    which meant a second phone knew nothing about the first.
  */
  /*
    Hoisted out of the effect so anything that CHANGES the list — reissuing a
    pass, for one — can ask for a fresh copy immediately rather than waiting
    up to four seconds for the next poll and looking broken in the meantime.
  */
  const load = useCallback(async () => {
    const p = await api.listParties();
    if (!p.ok || !p.parties?.length) return;
    const current = p.parties[0];
    setParty(current);
    const res = await api.listPasses(current.id);
    if (res.ok) setRows(res.passes || []);
    else setMsg(res.error || "Couldn't load the list.");
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 4000);
    return () => clearInterval(id);
  }, [load]);

  /*
    The server returns raw facts; the states are worked out here.

    "Admitted" now means EVERY place on the pass is taken. A pass for four
    with two people through is neither admitted nor awaiting — it is PARTLY,
    and calling it either of the others would tell the door something untrue
    at the one moment it matters.
  */
  const placesIn = (r) => Math.max(0, Number(r.ins || 0) - Number(r.outs || 0));
  const stateOf = (r) => {
    if (r.status === "REVOKED") return "REVOKED";
    const allowed = Math.max(1, Number(r.admits) || 1);
    const inside = placesIn(r);
    if (inside >= allowed) return "ADMITTED";
    if (inside > 0) return "PARTLY";
    if (r.refusals > 0) return "REFUSED";
    return "AWAITING";
  };


  /*
    ── D03 · A REPLACEMENT CODE ──────────────────────────────────────────

    A ticket gets soaked, or smudged, or left at home. The old code is
    cancelled in the same breath as the new one is made — a lost ticket that
    still works is two people holding one pass, and the door cannot tell
    which of them is the guest.

    Deliberately behind a confirmation that names the person: this cancels
    something, and cancelling the wrong pass at a door is a bad minute.
  */
  const reissue = async (r) => {
    if (r.status === "REVOKED") return;
    const yes = window.confirm(
      `Replace ${r.name}'s pass?\n\n` +
      `${r.code} stops working immediately and a new code is issued.\n` +
      "Use this when a ticket is lost or unreadable."
    );
    if (!yes) return;
    const res = await api.reissuePass(r.code);
    if (!res.ok) { setMsg(res.error || "That did not work."); return; }
    setMsg(`${res.name} now has ${res.code}. The old code is cancelled.`);
    load();
  };

  /*
    IN PLACES, NOT PASSES. This counted rows, so a pass for four read as one
    person — and on a night sold mostly as pairs the door list disagreed with
    both the scanner and the room by a factor of two.
  */
  const admitted = rows.reduce((n, r) => n + (r.status === "REVOKED" ? 0 : placesIn(r)), 0);
  const refused = rows.filter((r) => stateOf(r) === "REFUSED").length;
  const waiting = rows.reduce((n, r) => {
    if (r.status === "REVOKED") return n;
    return n + Math.max(0, (Math.max(1, Number(r.admits) || 1)) - placesIn(r));
  }, 0);

  /*
    ── N06 · THE PAPER FALLBACK ────────────────────────────────────────────

    Every phone at a door can die. The offline queue survives no signal; it
    does not survive no battery, and it does not survive a phone dropped down
    a stairwell at eleven.

    So: one button, one sheet, laid out to be read in bad light and ticked
    with a pen — names first because names are what people say, the code
    second, and a box to tick. It opens the browser's own print dialogue,
    which is also how it becomes a PDF on a phone.

    Printed from a hidden block on this page rather than a new window: a popup
    is blocked on iOS about half the time, and a door is the worst place to
    discover that.
  */
  const [printing, setPrinting] = useState(false);
  const printSheet = () => {
    setPrinting(true);
    // Two frames, so the sheet is in the document before the dialogue opens —
    // printing in the same tick prints the page without it.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      window.print();
      setTimeout(() => setPrinting(false), 500);
    }));
  };

  const sheet = [...rows]
    .filter((r) => r.status !== "REVOKED")
    .sort((a, b) => String(a.name).localeCompare(String(b.name)));

  return (
    <div data-page style={{ background: theme.bg, minHeight: "100vh" }}>
      <Nav />
      {/* where the skip link lands */}
      <span id="main" tabIndex={-1} />

      <IndexBand top items={[
        { label: "THE NIGHT", value: party ? party.name.toUpperCase() : "NO NIGHT SET" },
        { label: "ISSUED", value: String(rows.length).padStart(2, "0") },
      ]} />
      <PageHead flush kicker="AT THE DOOR" title="Door list" />

      <section className="max-w-[720px] mx-auto px-[18px] pb-16">

        {/* the three numbers that matter, big enough to read at a glance */}
        <div className="grid grid-cols-3 gap-3 mt-5">
          {[
            // PEOPLE, not passes — see placesIn.
            { n: admitted, label: "INSIDE", fg: STATE.ADMITTED.fg },
            { n: refused, label: "REJECTED", fg: STATE.REFUSED.fg },
            { n: waiting, label: "STILL TO COME", fg: theme.ink2 },
          ].map((b) => (
            <div key={b.label} className="text-center py-4" style={{ border: "1px solid " + theme.rule }}>
              <p className="m-0" style={{ ...fontDisplay, fontWeight: 300, fontSize: "34px", color: b.fg,
                                          fontVariantNumeric: "tabular-nums lining-nums" }}>
                {b.n}
              </p>
              <p className="m-0 mt-1" style={{ ...fontUtility, fontSize: "8.5px", letterSpacing: "0.2em", color: theme.ink2 }}>
                {b.label}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-7" style={{ borderTop: "1px solid " + theme.ink }}>
          {rows.length === 0 && (
            <Nothing note="Passes appear the moment they are issued. If you are expecting names here, check the night selected above is the right one.">
              Nobody on the list yet.
            </Nothing>
          )}
          {rows.map((r) => {
            const st = stateOf(r);
            const s = STATE[st] || STATE.AWAITING;
            return (
              <div key={r.code} className="flex items-center gap-3 py-3.5"
                   style={{ borderBottom: "1px solid " + theme.rule }}>
                <span style={{ ...fontUtility, fontSize: "9.5px", letterSpacing: "0.12em",
                               color: theme.ink2, width: "72px", cursor: "pointer" }}
                      role="button" tabIndex={0}
                      title="Replace this code — the old one stops working"
                      onKeyDown={(e) => { if (e.key === "Enter") reissue(r); }}
                      onClick={() => reissue(r)}>
                  {r.code}
                </span>

                <span className="flex-1 min-w-0">
                  <span className="block" style={{ ...fontText, fontSize: "17px", color: theme.ink }}>
                    {r.name}
                  </span>
                  <span className="block" style={{ ...fontUtility, fontSize: "8.5px", letterSpacing: "0.14em", color: theme.ink2 }}>
                    {r.ticket ? r.ticket.ref : r.type}
                    {Number(r.admits) > 1 ? ` · ${placesIn(r)} OF ${r.admits} IN` : ""}
                    {role.can.seeReasons && st === "REFUSED" && r.last_reason ? ` · ${REASON[r.last_reason] || r.last_reason}` : ""}
                    {r.refusals > 1 ? ` · ${r.refusals} attempts` : ""}
                  </span>
                  {r.door_note && (
                    /* N04 — the note, wherever the name is shown. */
                    <span className="block mt-1" style={{
                      ...fontUtility, fontSize: "8.5px", letterSpacing: "0.12em", lineHeight: 1.5,
                      color: r.door_tone === "STOP" ? theme.bad
                           : r.door_tone === "WARN" ? theme.warn
                           : r.door_tone === "GOOD" ? theme.good : theme.brass,
                    }}>
                      {r.door_note}
                    </span>
                  )}
                </span>

                <span className="text-right shrink-0">
                  <span className="block" style={{ ...fontUtility, fontSize: "9.5px", letterSpacing: "0.16em", color: s.fg }}>
                    {s.label}
                  </span>
                  {r.admitted_at && (
                    <span className="block" style={{ ...fontUtility, fontSize: "8.5px", letterSpacing: "0.1em", color: theme.ink2 }}>
                      {new Date(r.admitted_at).toLocaleTimeString()}
                    </span>
                  )}
                </span>
              </div>
            );
          })}
        </div>

        <p className="m-0 mt-6" style={{ ...fontText, fontSize: "15px", lineHeight: 1.55, color: theme.ink2 }}>
          Updates every couple of seconds. On this trial it reads the scanning
          device's own record, so keep it open on the same phone as the door.
        </p>

        <div className="flex flex-wrap gap-5 mt-6">
          <button onClick={printSheet}
                  style={{ ...fontUtility, fontSize: "10px", letterSpacing: "0.2em",
                           color: theme.ink, background: "transparent",
                           border: 0, borderBottom: `1px solid ${theme.brass}`,
                           cursor: "pointer", padding: 0 }}>
            PRINT THE SHEET
          </button>
          <Link to="/scan" className="pb-0.5"
                style={{ ...fontUtility, fontSize: "10px", letterSpacing: "0.2em",
                         color: theme.ink, borderBottom: "1px solid " + theme.brass }}>
            OPEN THE SCANNER
          </Link>
          {role.can.reset && (
          <button
            onClick={() => window.alert("The record now lives on the server and is kept as history. Cancel individual passes from the console instead.")}
            style={{ ...fontUtility, fontSize: "10px", letterSpacing: "0.2em",
                     color: theme.ink2, borderBottom: "1px solid " + theme.rule }}
          >
            RESET THE NIGHT
          </button>
          )}
        </div>
      </section>

      {/*
        ── N06 · THE SHEET ────────────────────────────────────────────────────

        Hidden on screen, and the only thing on the page when printed. Kept in
        the document rather than opened in a new window because iOS blocks
        popups often enough that a door is the worst place to find out.

        LAID OUT FOR A CLIPBOARD IN BAD LIGHT. Names alphabetically, because a
        name is what a person says at a door and a code is what they have lost.
        Large type, generous rows, a box to tick and a line to write the time
        on. Nothing here is decorative — every millimetre of the row is space
        to write in with a cold hand.
      */}
      <div className={printing ? "print-sheet" : "print-sheet hide"} aria-hidden={!printing}>
        <style>{`
          .print-sheet { display: none; }
          @media print {
            body * { visibility: hidden !important; }
            .print-sheet, .print-sheet * { visibility: visible !important; }
            .print-sheet {
              display: block !important;
              position: absolute; left: 0; top: 0; width: 100%;
              background: #fff; color: #000;
              padding: 10mm 8mm;
              font-family: Georgia, 'Times New Roman', serif;
            }
            .ps-head { border-bottom: 2px solid #000; padding-bottom: 4mm; margin-bottom: 4mm; }
            .ps-title { font-size: 20pt; margin: 0; font-weight: 400; }
            .ps-sub { font-size: 8pt; letter-spacing: 0.18em; margin: 2mm 0 0;
                      font-family: ui-monospace, 'SF Mono', monospace; text-transform: uppercase; }
            .ps-row { display: flex; align-items: center; gap: 4mm;
                      border-bottom: 1px solid #999; padding: 3.2mm 0;
                      break-inside: avoid; page-break-inside: avoid; }
            .ps-box { width: 7mm; height: 7mm; border: 1.2pt solid #000; flex: none; }
            .ps-name { font-size: 12pt; flex: 1; }
            .ps-note { font-size: 8pt; font-style: italic; display: block; }
            .ps-code { font-size: 9pt; font-family: ui-monospace, monospace;
                       letter-spacing: 0.08em; width: 26mm; text-align: right; flex: none; }
            .ps-plus { font-size: 9pt; width: 12mm; text-align: right; flex: none; font-weight: bold; }
            .ps-time { width: 22mm; border-bottom: 1px solid #999; flex: none; height: 5mm; }
            .ps-foot { margin-top: 6mm; font-size: 8pt;
                       font-family: ui-monospace, monospace; letter-spacing: 0.12em; }
          }
        `}</style>

        <div className="ps-head">
          <p className="ps-title">{party ? party.name : "Door list"}</p>
          <p className="ps-sub">
            {party ? party.date_label : ""} · {sheet.length} PASSES ·
            {" "}{sheet.reduce((n, r) => n + Math.max(1, Number(r.admits) || 1), 0)} PEOPLE ·
            {" "}PRINTED {new Date().toLocaleString()}
          </p>
        </div>

        {sheet.map((r) => (
          <div key={r.code} className="ps-row">
            <span className="ps-box" />
            <span className="ps-name">
              {r.name}
              {r.door_note && (
                <span className="ps-note">
                  {r.door_tone === "STOP" ? "DO NOT ADMIT — " : ""}{r.door_note}
                </span>
              )}
            </span>
            <span className="ps-plus">{Number(r.admits) > 1 ? `×${r.admits}` : ""}</span>
            <span className="ps-code">{r.code}</span>
            <span className="ps-time" />
          </div>
        ))}

        <p className="ps-foot">
          TICK THE BOX AND WRITE THE TIME · ×N MEANS THE PASS ADMITS THAT MANY ·
          TYPE ANY ADMISSIONS BACK IN WHEN THE PHONES ARE WORKING
        </p>
      </div>

      <Footer />
    </div>
  );
}

export default function PassList() {
  return (
    <DoorGate>
      {(role) =>
        role.can.seeList ? (
          <PassListScreen role={role} />
        ) : (
          // Staff can scan, but the full guest list is not theirs to browse.
          <div data-page style={{ background: theme.bg, minHeight: "100vh" }}>
            <Nav />
            <section className="max-w-[420px] mx-auto px-[18px] pt-[104px] pb-24 text-center">
              <h1 style={{ ...fontDisplay, fontWeight: 400, color: theme.ink, fontSize: "clamp(24px,6vw,36px)" }}>
                Not available on this login.
              </h1>
              <p className="m-0 mt-3" style={{ ...fontText, fontSize: "17px", color: theme.ink2 }}>
                The door list is for management. Use the scanner instead.
              </p>
              <Link to="/scan" className="inline-block mt-7 pb-0.5"
                    style={{ ...fontUtility, fontSize: "10px", letterSpacing: "0.2em",
                             color: theme.ink, borderBottom: "1px solid " + theme.brass }}>
                OPEN THE SCANNER
              </Link>
            </section>
            <Footer />
          </div>
        )
      }
    </DoorGate>
  );
}
