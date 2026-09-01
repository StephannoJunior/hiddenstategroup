import { usePageMeta } from "../lib/seo";
import React, { useEffect, useState } from "react";
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
  REFUSED:  { fg: theme.bad, label: "REJECTED" },
  AWAITING: { fg: theme.ink2, label: "AWAITING" },
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
  useEffect(() => {
    let alive = true;

    const load = async () => {
      const p = await api.listParties();
      if (!alive || !p.ok || !p.parties?.length) return;
      const current = p.parties[0];
      setParty(current);
      const res = await api.listPasses(current.id);
      if (!alive) return;
      if (res.ok) setRows(res.passes || []);
      else setMsg(res.error || "Couldn't load the list.");
    };

    load();
    const id = setInterval(load, 4000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  // The server returns raw facts; the three states are worked out here.
  const stateOf = (r) =>
    r.status === "REVOKED" ? "REVOKED"
      : r.admitted_at ? "ADMITTED"
        : r.refusals > 0 ? "REFUSED"
          : "AWAITING";

  const admitted = rows.filter((r) => stateOf(r) === "ADMITTED").length;
  const refused = rows.filter((r) => stateOf(r) === "REFUSED").length;
  const waiting = rows.filter((r) => stateOf(r) === "AWAITING").length;

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
                               color: theme.ink2, width: "72px" }}>
                  {r.code}
                </span>

                <span className="flex-1 min-w-0">
                  <span className="block" style={{ ...fontText, fontSize: "17px", color: theme.ink }}>
                    {r.name}
                  </span>
                  <span className="block" style={{ ...fontUtility, fontSize: "8.5px", letterSpacing: "0.14em", color: theme.ink2 }}>
                    {r.ticket ? r.ticket.ref : r.type}
                    {role.can.seeReasons && st === "REFUSED" && r.last_reason ? ` · ${REASON[r.last_reason] || r.last_reason}` : ""}
                    {r.refusals > 1 ? ` · ${r.refusals} attempts` : ""}
                  </span>
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
