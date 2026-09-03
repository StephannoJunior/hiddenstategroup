import { usePageMeta } from "../lib/seo";
import React, { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  Nav, Footer, useGoogleFonts,
  PageHead, fontDisplay, fontUtility, fontText, theme,
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
  const [qr, setQr] = useState(null);
  const [recoverEmail, setRecoverEmail] = useState("");
  const [recoverMsg, setRecoverMsg] = useState("");

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
      /*
        Remember a working pass so the bar can offer a way back — and forget
        one that no longer works. Leaving a cancelled code stored meant the
        MY PASS tab took someone straight to "this pass has been cancelled"
        every time, with no way out of it.
      */
      api.setGuestPass(res.ok ? res.pass.code : null);

      /*
        Redraw the QR each time the number changes, so the square and the
        digits below it always agree. The library is fetched only here, and
        only when a pass is actually on screen.
      */
      if (res.ok && res.code) {
        try {
          const QR = await import("qrcode");
          const url = await QR.toDataURL(`HS|${res.pass.code}|${res.code}`, {
            margin: 1, width: 560,
            color: { dark: theme.ink, light: theme.bg },
          });
          if (alive) setQr(url);
        } catch {
          if (alive) setQr(null);   // the number below still works
        }
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

  const navigate = useNavigate();

  const shell = (children) => (
    <div data-page style={{ background: theme.bg, minHeight: "100vh" }}>
      <Nav />
      {/* where the skip link lands */}
      <span id="main" tabIndex={-1} />
      <PageHead kicker="YOUR ENTRY" title="The Pass"
                sub="SHOW THIS AT THE DOOR" />

      {/*
        A WAY OUT.

        This page had none. Once a pass is stored the floating bar's last tab
        points straight back here, so opening it was a room with the door
        painted over — you could reach the pass from anywhere and nothing but
        the browser's own back button led anywhere else.

        Back goes where you actually came from when there is a history to go
        back to, and home when there is not — someone opening a pass link
        cold has no previous page, and a back button that does nothing is
        worse than no back button.
      */}
      <div className="max-w-[520px] mx-auto px-[18px] -mt-2 mb-1">
        <button
          onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/"))}
          style={{ ...fontUtility, fontSize: "9px", letterSpacing: "0.18em",
                   color: theme.ink2, background: "transparent", border: 0,
                   padding: "8px 0", cursor: "pointer" }}>
          ← BACK TO THE SITE
        </button>
      </div>

      <section className="max-w-[520px] mx-auto px-[18px] pb-24">
        {children}

        {/*
          FORGET IT ON THIS DEVICE.

          The stored pass is what puts a PASS tab in the floating bar, and
          that tab takes the place of the console one. On a phone that is
          used to run the door as well as to hold a ticket, being able to put
          it down again matters.

          It navigates away as well as clearing, because this page stores the
          pass again every time it loads — clearing without leaving would
          undo itself on the next visit.
        */}
        <button
          onClick={() => { api.setGuestPass(null); navigate("/"); }}
          className="block mx-auto mt-10"
          style={{ ...fontUtility, fontSize: "8.5px", letterSpacing: "0.16em",
                   color: theme.ink2, background: "transparent",
                   border: `1px solid ${theme.rule}`, padding: "9px 13px",
                   cursor: "pointer" }}>
          FORGET THIS PASS ON THIS DEVICE
        </button>
      </section>
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
          {state.revoked ? "This pass has been cancelled." : "You don't have a pass yet."}
        </h1>
        <p className="m-0 mt-3" style={{ ...fontText, fontSize: "17px", lineHeight: 1.55, color: theme.ink2 }}>
          {state.revoked
            ? "Speak to whoever issued it, or ask for a new one."
            : "If you were sent one, open the link from your email. Otherwise you can ask for a pass."}
        </p>

        <div className="flex flex-wrap justify-center gap-4 mt-7">
          <Link to="/guestlist" className="px-7 py-3.5"
                style={{ ...fontUtility, fontSize: "10px", letterSpacing: "0.2em",
                         background: theme.ink, color: theme.bg }}>
            ASK FOR A PASS
          </Link>
          <Link to="/mypass" className="px-7 py-3.5"
                style={{ ...fontUtility, fontSize: "10px", letterSpacing: "0.2em",
                         color: theme.ink, border: `1px solid ${theme.ink}` }}>
            I HAVE A CODE
          </Link>
        </div>
        {/* Someone who followed a broken link is exactly the person who needs
            this, so it belongs here rather than buried elsewhere. */}
        <div className="mt-8 pt-6 mx-auto" style={{ borderTop: `1px solid ${theme.rule}`, maxWidth: "360px" }}>
          <p className="m-0 mb-2" style={{ ...fontUtility, fontSize: "9px", letterSpacing: "0.18em", color: theme.brass }}>
            LOST YOUR PASS?
          </p>
          <p className="m-0 mb-3" style={{ ...fontText, fontSize: "15px", lineHeight: 1.5, color: theme.ink2 }}>
            Enter the email you gave us and we'll send it again.
          </p>
          <div className="flex gap-2">
            <input
              type="email"
              value={recoverEmail}
              onChange={(e) => setRecoverEmail(e.target.value)}
              placeholder="you@example.com"
              style={{ flex: 1, background: "transparent", border: `1px solid ${theme.rule}`,
                       color: theme.ink, padding: "11px", fontSize: "16px" }}
            />
            <button
              onClick={async () => {
                const res = await api.resendPass(recoverEmail);
                setRecoverMsg(res.message || "Check your inbox.");
              }}
              style={{ ...fontUtility, fontSize: "9.5px", letterSpacing: "0.16em",
                       background: theme.ink, color: theme.bg, border: 0, padding: "0 18px", cursor: "pointer" }}>
              SEND
            </button>
          </div>
          {recoverMsg && (
            <p className="m-0 mt-3" style={{ ...fontText, fontSize: "15px", color: theme.ink }}>
              {recoverMsg}
            </p>
          )}
        </div>

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
      <div className="flex justify-between py-1.5"
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

      <div className="mt-7 p-5" style={{ border: `1px solid ${theme.ink}`, background: theme.sunk }}>
        {qr ? (
          <img src={qr} alt="Entry code" className="block"
               style={{ width: "100%", maxWidth: "300px", margin: "0 auto", imageRendering: "pixelated" }} />
        ) : (
          <p className="text-center m-0 py-10"
             style={{ ...fontUtility, fontSize: "10px", letterSpacing: "0.16em", color: theme.ink2 }}>
            SHOW THE NUMBER BELOW
          </p>
        )}

        <p className="text-center m-0 mt-4"
           style={{ ...fontDisplay, fontWeight: 300, fontSize: "44px", letterSpacing: "0.14em",
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

      {/* One tap and the night is in their own calendar, with a reminder
          three hours before set by the phone itself. */}
      <p className="text-center mt-5 m-0">
        <a
          href={`/api/calendar/${pass.code}.ics`}
          className="inline-block pb-0.5"
          style={{ ...fontUtility, fontSize: "10px", letterSpacing: "0.2em",
                   color: theme.ink, borderBottom: `1px solid ${theme.brass}` }}
        >
          ADD TO YOUR CALENDAR
        </a>
      </p>

      {party.lineup?.length > 0 && (
        <div className="mt-7">
          <p className="m-0 mb-2 text-center"
             style={{ ...fontUtility, fontSize: "9px", letterSpacing: "0.2em", color: theme.brass }}>
            SET TIMES
          </p>
          <div style={{ borderTop: `1px solid ${theme.ink}` }}>
            {party.lineup.map((slot, i) => (
              <div key={i} className="flex justify-between py-2.5"
                   style={{ borderBottom: `1px solid ${theme.rule}` }}>
                <span style={{ ...fontUtility, fontSize: "10px", letterSpacing: "0.14em", color: theme.ink2,
                               fontVariantNumeric: "tabular-nums lining-nums" }}>
                  {slot.time}
                </span>
                <span style={{ ...fontText, fontSize: "16.5px", color: theme.ink }}>{slot.artist}</span>
              </div>
            ))}
          </div>
        </div>
      )}

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
