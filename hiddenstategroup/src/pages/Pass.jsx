import { usePageMeta } from "../lib/seo";
import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  Nav, Footer, useGoogleFonts,
  fontDisplay, fontUtility, fontText, fontMasthead, theme,
} from "../components/Shared";
import {
  findPass, codeFor, buildPayload, secondsLeftInWindow,
  partyOf, partyIsUpcoming, claimDevice,
} from "../lib/passes";

/*
  The guest's pass. Opened from a link like /pass/HS-4KQ2.

  The code refreshes every thirty seconds. A ring drains alongside it so the
  guest can see it is live rather than wondering whether the page has frozen.
*/

export default function Pass() {
  useGoogleFonts();
  const { code } = useParams();
  const pass = findPass(code);
  const party = partyOf(pass);
  const rotates = party ? party.rotatingCodes !== false : true;
  const live = partyIsUpcoming(party);
  usePageMeta({
    title: pass ? `Pass — ${pass.name}` : "Pass",
    description: "Hidden State entry pass.",
  });

  const [rotating, setRotating] = useState(null);
  const [left, setLeft] = useState(secondsLeftInWindow());
  const [qr, setQr] = useState(null);
  const [claim, setClaim] = useState(null);

  useEffect(() => {
    if (!pass) return;
    setClaim(claimDevice(pass.code));
    let alive = true;

    const refresh = async () => {
      const r = await codeFor(pass);
      if (!alive) return;
      setRotating(r);
      setLeft(secondsLeftInWindow());

      // The QR library is fetched only on this page, and only when a pass is
      // actually being shown — it never weighs on the rest of the site.
      try {
        const QR = await import("qrcode");
        const url = await QR.toDataURL(buildPayload(pass, r), {
          margin: 1,
          width: 520,
          color: { dark: "#16130E", light: "#F3EBD9" },
        });
        if (alive) setQr(url);
      } catch {
        if (alive) setQr(null); // fall back to the numbers below
      }
    };

    refresh();
    const tick = setInterval(() => {
      const s = secondsLeftInWindow();
      setLeft(s);
      if (s >= 29) refresh();
    }, 1000);

    return () => { alive = false; clearInterval(tick); };
  }, [pass]);

  if (!pass) {
    return (
      <div data-page style={{ background: theme.bg, minHeight: "100vh" }}>
        <Nav />
        <section className="max-w-[900px] mx-auto px-[18px] pt-[104px] pb-24 text-center">
          <h1 style={{ ...fontDisplay, fontWeight: 400, color: theme.ink, fontSize: "clamp(26px,6vw,42px)" }}>
            We couldn't find that pass.
          </h1>
          <p className="m-0 mt-3" style={{ ...fontText, fontSize: "17px", color: theme.ink2 }}>
            Check the link, or ask whoever sent it to resend.
          </p>
          <Link to="/" className="inline-block mt-7 pb-0.5"
                style={{ ...fontUtility, fontSize: "10px", letterSpacing: "0.2em",
                         color: theme.ink, borderBottom: "1px solid " + theme.brass }}>
            HOME
          </Link>
        </section>
        <Footer />
      </div>
    );
  }

  const pct = (left / 30) * 100;

  if (!live) {
    return (
      <div data-page style={{ background: theme.bg, minHeight: "100vh" }}>
        <Nav />
        <section className="max-w-[520px] mx-auto px-[18px] pt-[104px] pb-24 text-center">
          <h1 style={{ ...fontDisplay, fontWeight: 400, color: theme.ink, fontSize: "clamp(26px,6vw,40px)" }}>
            That night has passed.
          </h1>
          <p className="m-0 mt-3" style={{ ...fontText, fontSize: "17px", color: theme.ink2 }}>
            This pass was for {party ? party.name : "an earlier event"} and is no longer valid.
          </p>
          <Link to="/events" className="inline-block mt-7 pb-0.5"
                style={{ ...fontUtility, fontSize: "10px", letterSpacing: "0.2em",
                         color: theme.ink, borderBottom: "1px solid " + theme.brass }}>
            WHAT'S COMING
          </Link>
        </section>
        <Footer />
      </div>
    );
  }

  return (
    <div data-page style={{ background: theme.bg, minHeight: "100vh" }}>
      <Nav />

      <article className="max-w-[520px] mx-auto px-[18px] pt-[104px] pb-16">
        <h1 className="text-center m-0" style={{ ...fontMasthead, color: theme.ink, fontSize: "clamp(24px,6vw,38px)" }}>
          Entry Pass
        </h1>
        <div className="flex justify-between py-1.5 mt-2"
             style={{ ...fontUtility, fontSize: "9.5px", letterSpacing: "0.18em", color: theme.ink2,
                      borderTop: "1px solid " + theme.ink, borderBottom: "1px solid " + theme.ink }}>
          <span>{pass.type}</span>
          <span>{party ? party.date : ""}</span>
        </div>

        <h2 className="text-center mt-6 mb-1"
            style={{ ...fontDisplay, fontWeight: 400, color: theme.ink, fontSize: "clamp(26px,7vw,42px)", lineHeight: 1.1 }}>
          {pass.name}
        </h2>
        <p className="text-center m-0"
           style={{ ...fontUtility, fontSize: "10px", letterSpacing: "0.24em", color: theme.brass }}>
          {pass.code}
        </p>

        {pass.ticket && (
          <div className="flex justify-between mt-4 py-2"
               style={{ ...fontUtility, fontSize: "9px", letterSpacing: "0.14em", color: theme.ink2,
                        borderTop: "1px solid " + theme.rule, borderBottom: "1px solid " + theme.rule }}>
            <span>{pass.ticket.ref}</span>
            <span>{pass.ticket.tier}</span>
          </div>
        )}

        {pass.ticket && pass.ticket.idRequired && (
          <p className="text-center mt-3 m-0"
             style={{ ...fontText, fontSize: "15px", lineHeight: 1.5, color: theme.ink }}>
            This ticket is in <strong>{pass.name}</strong>'s name and is not
            transferable. Bring ID matching the name — it will be checked.
          </p>
        )}

        {claim && !claim.firstTime && (
          <p className="mt-4 mb-0 px-3 py-2.5"
             style={{ ...fontText, fontSize: "14px", lineHeight: 1.5, color: "#7A5A2E",
                      border: "1px solid #C9A96A" }}>
            This pass was first opened on {new Date(claim.at).toLocaleDateString()}.
            If that wasn't you, the ticket may have been passed on and entry can be refused.
          </p>
        )}

        <div className="mt-7 p-5" style={{ border: "1px solid " + theme.ink, background: "#EFE6D0" }}>
          {qr ? (
            <img src={qr} alt="Entry code" className="w-full block"
                 style={{ imageRendering: "pixelated", maxWidth: "300px", margin: "0 auto" }} />
          ) : (
            <div className="py-12 text-center"
                 style={{ ...fontUtility, fontSize: "10px", letterSpacing: "0.16em", color: theme.ink2 }}>
              SHOW THE NUMBER BELOW
            </div>
          )}

          <p className="text-center mt-4 mb-0"
             style={{ ...fontDisplay, fontWeight: 300, fontSize: "40px", letterSpacing: "0.12em",
                      color: theme.ink, fontVariantNumeric: "tabular-nums lining-nums",
                      fontFeatureSettings: '"tnum" 1, "lnum" 1' }}>
            {rotating || "······"}
          </p>

          {rotates && (
            <>
              <div className="mt-3" style={{ height: "2px", background: theme.rule }}>
                <div style={{ width: `${pct}%`, height: "100%", background: theme.brass,
                              transition: "width 1s linear" }} />
              </div>
              <p className="text-center mt-2 mb-0"
                 style={{ ...fontUtility, fontSize: "8.5px", letterSpacing: "0.18em", color: theme.ink2 }}>
                REFRESHES IN {left}s
              </p>
            </>
          )}
        </div>

        <p className="text-center mt-6 m-0" style={{ ...fontText, fontSize: "16px", lineHeight: 1.55, color: theme.ink2 }}>
          {rotates
            ? "Show this at the door. The code changes every thirty seconds, so a screenshot will not work — keep this page open when you arrive."
            : "Show this at the door. Keep it to yourself: anyone holding this code can use it."}
        </p>

        <p className="text-center mt-4 m-0"
           style={{ ...fontUtility, fontSize: "9px", letterSpacing: "0.16em", color: theme.ink2 }}>
          {(party ? party.minimumAge : 16)}+ · ID MAY BE REQUESTED
        </p>
      </article>

      <Footer />
    </div>
  );
}
