import { usePageMeta } from "../lib/seo";
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Nav, Footer, useGoogleFonts,
  fontDisplay, fontUtility, fontText, fontMasthead, theme,
} from "../components/Shared";
import DoorGate from "../components/DoorGate";
import { passStatuses, PARTIES, PASSES } from "../lib/passes";

/*
  The admin area — one place that gathers the door tools behind a login.

  What each role sees differs. Staff get the scanner and nothing else, because
  a door phone gets borrowed and left on tables. Management gets the numbers,
  the full list and the reset.
*/

function Tile({ to, label, note, disabled = false }) {
  const body = (
    <>
      <p className="m-0" style={{ ...fontDisplay, fontWeight: 400, fontSize: "24px", color: disabled ? theme.ink2 : theme.ink }}>
        {label}
      </p>
      <p className="m-0 mt-1.5" style={{ ...fontText, fontSize: "15px", lineHeight: 1.5, color: theme.ink2 }}>
        {note}
      </p>
    </>
  );
  const style = {
    border: "1px solid " + (disabled ? theme.rule : theme.ink),
    padding: "20px",
    display: "block",
    opacity: disabled ? 0.55 : 1,
  };
  return disabled ? <div style={style}>{body}</div> : <Link to={to} style={style}>{body}</Link>;
}

function AdminScreen({ role }) {
  usePageMeta({ title: "Admin", description: "Hidden State door tools." });
  const [rows, setRows] = useState([]);
  const party = PARTIES[0];

  useEffect(() => {
    const refresh = () => setRows(passStatuses());
    refresh();
    const id = setInterval(refresh, 3000);
    return () => clearInterval(id);
  }, []);

  const admitted = rows.filter((r) => r.state === "ADMITTED").length;
  const refused = rows.filter((r) => r.state === "REFUSED").length;
  const sold = PASSES.filter((p) => p.ticket).length;

  return (
    <div data-page style={{ background: theme.bg, minHeight: "100vh" }}>
      <Nav />

      <section className="max-w-[720px] mx-auto px-[18px] pt-[104px] pb-16">
        <h1 className="text-center m-0" style={{ ...fontMasthead, color: theme.ink, fontSize: "clamp(24px,6vw,38px)" }}>
          Admin
        </h1>
        <div className="flex justify-between py-1.5 mt-2"
             style={{ ...fontUtility, fontSize: "9.5px", letterSpacing: "0.18em", color: theme.ink2,
                      borderTop: "1px solid " + theme.ink, borderBottom: "1px solid " + theme.ink }}>
          <span>{(role.displayName || role.label).toUpperCase()}</span>
          <span>{role.id}</span>
        </div>

        <p className="text-center mt-6 mb-0"
           style={{ ...fontDisplay, fontWeight: 400, fontSize: "clamp(24px,6vw,36px)", color: theme.ink }}>
          {party ? party.name : "No night set"}
        </p>
        <p className="text-center m-0 mt-1"
           style={{ ...fontUtility, fontSize: "9.5px", letterSpacing: "0.2em", color: theme.ink2 }}>
          {party ? party.date.toUpperCase() : ""}
        </p>

        {role.can.seeList && (
          <div className="grid grid-cols-4 gap-2.5 mt-6">
            {[
              { n: PASSES.length, label: "ISSUED" },
              { n: sold, label: "SOLD" },
              { n: admitted, label: "IN" },
              { n: refused, label: "REFUSED" },
            ].map((b) => (
              <div key={b.label} className="text-center py-4" style={{ border: "1px solid " + theme.rule }}>
                <p className="m-0" style={{ ...fontDisplay, fontWeight: 300, fontSize: "30px", color: theme.ink,
                                            fontVariantNumeric: "tabular-nums lining-nums" }}>
                  {b.n}
                </p>
                <p className="m-0 mt-1" style={{ ...fontUtility, fontSize: "8px", letterSpacing: "0.16em", color: theme.ink2 }}>
                  {b.label}
                </p>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-7">
          <Tile to="/scan" label="Scanner" note="Open the camera and admit guests at the door." />
          <Tile
            to="/doorlist"
            label="Door list"
            note={role.can.seeList
              ? "Every pass, who came in, and who was turned away."
              : "Management only."}
            disabled={!role.can.seeList}
          />
        </div>

        <p className="m-0 mt-7" style={{ ...fontText, fontSize: "15px", lineHeight: 1.55, color: theme.ink2 }}>
          Signed in as <strong>{role.user}</strong>. This session ends when you
          close the tab — a phone left on a table won't stay signed in.
        </p>

        <div className="mt-6 pt-5" style={{ borderTop: "1px solid " + theme.rule }}>
          <Link to="/" className="pb-0.5"
                style={{ ...fontUtility, fontSize: "10px", letterSpacing: "0.2em",
                         color: theme.ink2, borderBottom: "1px solid " + theme.rule }}>
            BACK TO THE SITE
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}

export default function Admin() {
  return <DoorGate>{(role) => <AdminScreen role={role} />}</DoorGate>;
}
