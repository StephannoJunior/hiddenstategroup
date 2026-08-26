import { usePageMeta } from "../lib/seo";
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Nav, Footer, useGoogleFonts,
  fontDisplay, fontUtility, fontText, fontMasthead, theme,
} from "../components/Shared";
import DoorGate from "../components/DoorGate";
import { passStatuses, clearUsed, PARTIES } from "../lib/passes";

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
  ADMITTED: { fg: "#1E4620", label: "VALID" },
  REFUSED:  { fg: "#7A2E2E", label: "REJECTED" },
  AWAITING: { fg: "#8C887E", label: "AWAITING" },
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
  const party = PARTIES[0];

  useEffect(() => {
    const refresh = () => setRows(passStatuses());
    refresh();
    const id = setInterval(refresh, 2000);
    return () => clearInterval(id);
  }, []);

  const admitted = rows.filter((r) => r.state === "ADMITTED").length;
  const refused = rows.filter((r) => r.state === "REFUSED").length;
  const waiting = rows.filter((r) => r.state === "AWAITING").length;

  return (
    <div data-page style={{ background: theme.bg, minHeight: "100vh" }}>
      <Nav />

      <section className="max-w-[720px] mx-auto px-[18px] pt-[104px] pb-16">
        <h1 className="text-center m-0" style={{ ...fontMasthead, color: theme.ink, fontSize: "clamp(24px,6vw,38px)" }}>
          Door List
        </h1>
        <div className="flex justify-between py-1.5 mt-2"
             style={{ ...fontUtility, fontSize: "9.5px", letterSpacing: "0.18em", color: theme.ink2,
                      borderTop: "1px solid " + theme.ink, borderBottom: "1px solid " + theme.ink }}>
          <span>{party ? party.name : "NO NIGHT SET"}</span>
          <span>{rows.length} ISSUED</span>
        </div>

        {/* the three numbers that matter, big enough to read at a glance */}
        <div className="grid grid-cols-3 gap-3 mt-5">
          {[
            { n: admitted, label: "VALID", fg: STATE.ADMITTED.fg },
            { n: refused, label: "REJECTED", fg: STATE.REFUSED.fg },
            { n: waiting, label: "AWAITING", fg: theme.ink2 },
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
          {rows.map((r) => {
            const s = STATE[r.state];
            return (
              <div key={r.code} className="flex items-center gap-3 py-3.5"
                   style={{ borderBottom: "1px solid " + theme.rule }}>
                <span style={{ ...fontUtility, fontSize: "9.5px", letterSpacing: "0.12em",
                               color: theme.ink2, width: "72px" }}>
                  {r.code}
                </span>

                <span className="flex-1 min-w-0">
                  <span className="block" style={{ ...fontText, fontSize: "17px", color: theme.ink }}>
                    {r.name}
                  </span>
                  <span className="block" style={{ ...fontUtility, fontSize: "8.5px", letterSpacing: "0.14em", color: theme.ink2 }}>
                    {r.ticket ? r.ticket.ref : r.type}
                    {role.can.seeReasons && r.state === "REFUSED" && r.reason ? ` · ${REASON[r.reason] || r.reason}` : ""}
                    {r.tries > 1 ? ` · ${r.tries} attempts` : ""}
                  </span>
                </span>

                <span className="text-right shrink-0">
                  <span className="block" style={{ ...fontUtility, fontSize: "9.5px", letterSpacing: "0.16em", color: s.fg }}>
                    {s.label}
                  </span>
                  {r.at && (
                    <span className="block" style={{ ...fontUtility, fontSize: "8.5px", letterSpacing: "0.1em", color: theme.ink2 }}>
                      {new Date(r.at).toLocaleTimeString()}
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
          <Link to="/scan" className="pb-0.5"
                style={{ ...fontUtility, fontSize: "10px", letterSpacing: "0.2em",
                         color: theme.ink, borderBottom: "1px solid " + theme.brass }}>
            OPEN THE SCANNER
          </Link>
          {role.can.reset && (
          <button
            onClick={() => { if (window.confirm("Clear tonight's record and start fresh?")) { clearUsed(); setRows(passStatuses()); } }}
            style={{ ...fontUtility, fontSize: "10px", letterSpacing: "0.2em",
                     color: theme.ink2, borderBottom: "1px solid " + theme.rule }}
          >
            RESET THE NIGHT
          </button>
          )}
        </div>
      </section>

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
