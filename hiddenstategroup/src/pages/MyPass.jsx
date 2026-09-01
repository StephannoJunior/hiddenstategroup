import { usePageMeta } from "../lib/seo";
import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Nav, Footer, useGoogleFonts,
  PageHead, fontDisplay, fontUtility, fontText, theme,
} from "../components/Shared";
import * as api from "../lib/api";

/*
  How a guest gets to their pass.

  NO PASSWORD, deliberately. A guest would forget it, reuse one from another
  site, and we would be holding something we do not want to hold. Their pass
  code is already unique to them and already in their hands — it proves they
  hold that pass, which is the only thing that matters here.

  Two ways in, because people lose things in different ways:
    • they still have the code  → type it
    • they have lost everything → type the email they gave us

  The second says the same thing whether the address is on the list or not, so
  it cannot be used to find out who is coming.
*/

export default function MyPass() {
  useGoogleFonts();
  usePageMeta({
    title: "Find your pass",
    description: "Open your Hidden State entry pass.",
  });

  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState("");
  const [busy, setBusy] = useState(false);

  const openPass = async (e) => {
    e.preventDefault();
    setError(""); setSent("");
    const typed = code.trim().toUpperCase();
    if (!typed) return;

    setBusy(true);
    // Check it exists before navigating, so a wrong code gives a plain answer
    // here rather than a "not found" page that looks like the site is broken.
    const res = await api.fetchPass(typed);
    setBusy(false);

    if (res.ok) { navigate(`/pass/${typed}`); return; }
    setError(res.revoked
      ? "That pass has been cancelled. Speak to whoever issued it."
      : "We couldn't find that code. Check it and try again.");
  };

  const sendIt = async (e) => {
    e.preventDefault();
    setError(""); setSent("");
    if (!email.trim()) return;
    setBusy(true);
    const res = await api.resendPass(email.trim());
    setBusy(false);
    setSent(res.message || "If that address is on the list, the pass is on its way.");
    setEmail("");
  };

  const field = {
    width: "100%", background: "transparent", border: `1px solid ${theme.rule}`,
    color: theme.ink, padding: "13px", fontSize: "17px", letterSpacing: "0.06em",
  };

  return (
    <div data-page style={{ background: theme.bg, minHeight: "100vh" }}>
      <Nav />
      {/* where the skip link lands */}
      <span id="main" tabIndex={-1} />

      <PageHead kicker="FIND IT" title="Your pass"
                sub="THE CODE IS ON YOUR EMAIL AND YOUR TICKET" />

      <section className="max-w-[440px] mx-auto px-[18px] pb-20">

        <form onSubmit={openPass} className="mt-8">
          <p className="m-0 mb-2" style={{ ...fontUtility, fontSize: "9.5px", letterSpacing: "0.2em", color: theme.brass }}>
            YOUR PASS CODE
          </p>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="HS-XXXXXX"
            autoCapitalize="characters"
            style={{ ...field, letterSpacing: "0.14em" }}
          />
          <button type="submit" disabled={busy} className="w-full mt-3 py-3.5"
                  style={{ ...fontUtility, fontSize: "10.5px", letterSpacing: "0.2em",
                           background: theme.ink, color: theme.bg, border: 0, opacity: busy ? 0.6 : 1 }}>
            {busy ? "CHECKING…" : "OPEN MY PASS"}
          </button>
          <p className="m-0 mt-2" style={{ ...fontText, fontSize: "14.5px", lineHeight: 1.5, color: theme.ink2 }}>
            It's on the email we sent, and printed on your ticket.
          </p>
        </form>

        {error && (
          <p className="m-0 mt-4 px-3 py-2.5"
             style={{ ...fontText, fontSize: "15px", color: theme.bad, border: `1px solid ${theme.badLine}` }}>
            {error}
          </p>
        )}

        <div className="mt-9 pt-7" style={{ borderTop: `1px solid ${theme.rule}` }}>
          <form onSubmit={sendIt}>
            <p className="m-0 mb-2" style={{ ...fontUtility, fontSize: "9.5px", letterSpacing: "0.2em", color: theme.brass }}>
              LOST IT ENTIRELY?
            </p>
            <p className="m-0 mb-3" style={{ ...fontText, fontSize: "15.5px", lineHeight: 1.55, color: theme.ink2 }}>
              Enter the email you gave us and we'll send your pass again.
            </p>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              style={field}
            />
            <button type="submit" disabled={busy} className="w-full mt-3 py-3.5"
                    style={{ ...fontUtility, fontSize: "10.5px", letterSpacing: "0.2em",
                             color: theme.ink, background: "transparent",
                             border: `1px solid ${theme.ink}`, opacity: busy ? 0.6 : 1 }}>
              SEND IT TO ME
            </button>
          </form>

          {sent && (
            <p className="m-0 mt-4" style={{ ...fontText, fontSize: "15.5px", lineHeight: 1.5, color: theme.ink }}>
              {sent}
            </p>
          )}
        </div>

        <p className="text-center m-0 mt-10">
          <Link to="/admins-staff-boss" className="pb-0.5"
                style={{ ...fontUtility, fontSize: "9px", letterSpacing: "0.2em",
                         color: theme.ink2, borderBottom: `1px solid ${theme.rule}` }}>
            TEAM SIGN IN
          </Link>
        </p>
      </section>

      <Footer />
    </div>
  );
}
