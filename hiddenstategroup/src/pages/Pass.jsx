import { usePageMeta } from "../lib/seo";
import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  Nav, Footer, useGoogleFonts,
  fontDisplay, fontUtility, fontText, fontMasthead, theme,
} from "../components/Shared";
import * as api from "../lib/api";

/*
  The guest's pass.

  Everything comes from the server: the pass, the event, and the six-digit
  code. Nothing is computed here, because the secret that generates the code
  must never reach a browser — that was the whole reason for building the API.

  The page re-asks the server as each 30-second window closes. That is a small
  request, and it keeps a screenshot useless: the number on screen is only
  ever the live one.
*/

export default function Pass() {
  useGoogleFonts();
  const { code } = useParams();
  const [state, setState] = useState({ loading: true });
  const [left, setLeft] = useState(30);

  usePageMeta({
    title: state.pass ? `Pass — ${state.pass.name}` : "Pass",
    description: "Hidden State entry pass.",
  });

  useEffect(() => {
    let alive = true;

    const load = async () => {
      const res = await api.fetchPass(code);
      if (!alive) return;
      setState({ loading: false, ...res });
      if (res.ok && res.refreshIn) setLeft(res.refreshIn);
      // Remember this pass on the device, so the bar can offer a way back.
      if (res.ok) {
        try { localStorage.setItem("hs-guest-pass", res.pass.code); } catch { /* not fatal */ }
      }
    };

    load();
    const tick = setInterval(() => {
      setLeft((s) => {
        if (s <= 1) { load(); return 30; }
        return s - 1;
      });
    }, 1000);

    return () => { alive = false; clearInterval(tick); };
  }, [code]);

  const shell = (children) => (
    <div data-page style={{ background: theme.bg, minHeight: "100vh" }}>
      <Nav />
      <section className="max-w-[520px] mx-auto px-[18px] pt-[104px] pb-24">{children}</section>
      <Footer />
    </div>
  );

  if (state.loading) {
    return shell(
      <p className="text-center m-0" style={{ ...fontUtility, fontSize: "10px", letterSpacing: "0.2em", color: theme.ink2 }}>
        LOADING…
      </p>
    );
  }

  if (!state.ok) {
    return shell(
      <div className="text-center">
        <h1 className="m-0" style={{ ...fontDisplay, fontWeight: 400, color: theme.ink, fontSize: "clamp(26px,6vw,40px)" }}>
          {state.revoked ? "This pass has been cancelled." : "We couldn't find that pass."}
        </h1>
        <p className="m-0 mt-3" style={{ ...fontText, fontSize: "17px", color: theme.ink2 }}>
          {state.revoked
            ? "Speak to whoever issued it."
            : state.error || "Check the link, or ask whoever sent it to resend."}
        </p>
        <Link to="/" className="inline-block mt-7 pb-0.5"
              style={{ ...fontUtility, fontSize: "10px", letterSpacing: "0.2em",
                       color: theme.ink, borderBottom: `1px solid ${theme.brass}` }}>
          HOME
        </Link>
      </div>
    );
  }

  const { pass, party } = state;

  if (party.over) {
    return shell(
      <div className="text-center">
        <h1 className="m-0" style={{ ...fontDisplay, fontWeight: 400, color: theme.ink, fontSize: "clamp(26px,6vw,40px)" }}>
          That night has passed.
        </h1>
        <p className="m-0 mt-3" style={{ ...fontText, fontSize: "17px", color: theme.ink2 }}>
          This pass was for {party.name} and is no longer valid.
        </p>
        <Link to="/events" className="inline-block mt-7 pb-0.5"
              style={{ ...fontUtility, fontSize: "10px", letterSpacing: "0.2em",
                       color: theme.ink, borderBottom: `1px solid ${theme.brass}` }}>
          WHAT'S COMING
        </Link>
      </div>
    );
  }

  return shell(
    <>
      <h1 className="text-center m-0" style={{ ...fontMasthead, color: theme.ink, fontSize: "clamp(24px,6vw,38px)" }}>
        Entry Pass
      </h1>
      <div className="flex justify-between py-1.5 mt-2"
           style={{ ...fontUtility, fontSize: "9.5px", letterSpacing: "0.18em", color: theme.ink2,
                    borderTop: `1px solid ${theme.ink}`, borderBottom: `1px solid ${theme.ink}` }}>
        <span>{pass.kind}</span>
        <span>{party.date}</span>
      </div>

      <h2 className="text-center mt-6 mb-1"
          style={{ ...fontDisplay, fontWeight: 400, color: theme.ink, fontSize: "clamp(26px,7vw,42px)", lineHeight: 1.1 }}>
        {pass.name}
      </h2>
      <p className="text-center m-0"
         style={{ ...fontUtility, fontSize: "10px", letterSpacing: "0.24em", color: theme.brass }}>
        {pass.code}
      </p>

      {(pass.ticketRef || pass.tier) && (
        <div className="flex justify-between mt-4 py-2"
             style={{ ...fontUtility, fontSize: "9px", letterSpacing: "0.14em", color: theme.ink2,
                      borderTop: `1px solid ${theme.rule}`, borderBottom: `1px solid ${theme.rule}` }}>
          <span>{pass.ticketRef || ""}</span>
          <span>{pass.tier || ""}</span>
        </div>
      )}

      <div className="mt-7 p-5" style={{ border: `1px solid ${theme.ink}`, background: "#EFE6D0" }}>
        <p className="text-center m-0"
           style={{ ...fontDisplay, fontWeight: 300, fontSize: "48px", letterSpacing: "0.14em",
                    color: theme.ink, fontVariantNumeric: "tabular-nums lining-nums",
                    fontFeatureSettings: '"tnum" 1, "lnum" 1' }}>
          {state.code || "······"}
        </p>

        {party.rotating && (
          <>
            <div className="mt-3" style={{ height: "2px", background: theme.rule }}>
              <div style={{ width: `${(left / 30) * 100}%`, height: "100%", background: theme.brass,
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
        {party.rotating
          ? "Show this at the door. The number changes every thirty seconds, so a screenshot will not work — keep this page open when you arrive."
          : "Show this at the door. Keep it to yourself: anyone holding this code can use it."}
      </p>

      {pass.idRequired && (
        <p className="text-center mt-4 m-0" style={{ ...fontText, fontSize: "15px", lineHeight: 1.5, color: theme.ink }}>
          This pass is in <strong>{pass.name}</strong>'s name and is not
          transferable. Bring ID matching the name.
        </p>
      )}

      <p className="text-center mt-4 m-0"
         style={{ ...fontUtility, fontSize: "9px", letterSpacing: "0.16em", color: theme.ink2 }}>
        {party.minimumAge}+ · ID MAY BE REQUESTED
      </p>
    </>
  );
}
