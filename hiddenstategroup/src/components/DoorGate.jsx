import React, { useEffect, useState } from "react";
import { Nav, Footer, useGoogleFonts, PageHead,
         fontDisplay, fontUtility, fontText, theme } from "./Shared";
import * as api from "../lib/api";

/*
  DoorGate — wraps the scanner and the door list.

  Children are given the signed-in role, so each page can show only what that
  role should see. Staff get the scanner; the owner gets everything.

  This keeps guests out. It is not a real lock — see the note in access.js.
*/

export default function DoorGate({ children }) {
  useGoogleFonts();
  const [role, setRole] = useState(null);
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);
  const [ready, setReady] = useState(false);

  /*
    A token in this tab means a session may still be open. Ask the server who
    it belongs to rather than trusting anything the browser is holding — and
    restore it, so a refresh mid-shift does not dump someone back to the
    login screen.
  */
  useEffect(() => {
    const token = api.getToken();
    if (!token) { setReady(true); return; }
    api.me().then((res) => {
      if (res.ok) setRole(res.user);
      else api.setToken(null);
      setReady(true);
    });
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setChecking(true);
    const res = await api.login(user, pass);
    setChecking(false);
    if (!res.ok) {
      // Deliberately vague: saying which half was wrong would tell someone
      // guessing that a username exists.
      setError(res.error || "Those details weren't recognised.");
      setPass("");
      return;
    }
    api.setToken(res.token);
    setRole(res.user);
    setUser("");
    setPass("");
  };

  // Blank while the session check runs: showing the login form for a moment
  // and then replacing it looks like a fault.
  if (!ready) return <div style={{ background: theme.bg, minHeight: "100vh" }} />;

  if (role) {
    return (
      <>
        {/* A constant reminder of who is signed in — on a shared door phone,
            not knowing which role you are in is a real source of mistakes. */}
        <div className="fixed top-[76px] left-0 right-0 z-[42] flex justify-center"
             style={{ pointerEvents: "none" }}>
          <span className="px-3 py-1"
                style={{ ...fontUtility, fontSize: "8.5px", letterSpacing: "0.18em",
                         background: theme.ink, color: theme.bg, pointerEvents: "auto" }}>
            {(role.displayName || role.username || "").toUpperCase()}
            <button onClick={() => { api.logout(); api.setToken(null); setRole(null); }}
                    style={{ ...fontUtility, fontSize: "8.5px", letterSpacing: "0.18em",
                             color: theme.bg, marginLeft: "12px", opacity: 0.7 }}>
              SIGN OUT
            </button>
          </span>
        </div>
        {children(role)}
      </>
    );
  }

  return (
    <div data-page style={{ background: theme.bg, minHeight: "100vh" }}>
      <Nav />
      <PageHead kicker="THE SYSTEM" title="Staff only"
                sub="DOOR STAFF AND MANAGEMENT" />

      <section className="max-w-[420px] mx-auto px-[18px] pb-24">

        <form onSubmit={submit} className="mt-8">
          <p className="m-0 mb-2" style={{ ...fontUtility, fontSize: "9.5px", letterSpacing: "0.2em", color: theme.brass }}>
            USERNAME
          </p>
          <input
            value={user}
            onChange={(e) => setUser(e.target.value)}
            autoCapitalize="none"
            autoComplete="username"
            style={{ width: "100%", background: "transparent", border: "1px solid " + theme.rule,
                     color: theme.ink, padding: "13px", fontSize: "17px", letterSpacing: "0.06em" }}
          />
          <p className="m-0 mt-4 mb-2" style={{ ...fontUtility, fontSize: "9.5px", letterSpacing: "0.2em", color: theme.brass }}>
            PASSWORD
          </p>
          <input
            type="password"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            autoComplete="current-password"
            style={{ width: "100%", background: "transparent", border: "1px solid " + theme.rule,
                     color: theme.ink, padding: "13px", fontSize: "17px", letterSpacing: "0.1em" }}
          />
          {error && (
            <p className="m-0 mt-3 px-3 py-2.5"
               style={{ ...fontText, fontSize: "15px", color: theme.bad, border: `1px solid ${theme.badLine}` }}>
              {error}
            </p>
          )}
          <button type="submit" disabled={checking} className="w-full mt-4 py-3.5"
                  style={{ ...fontUtility, fontSize: "10.5px", letterSpacing: "0.2em",
                           background: theme.ink, color: theme.bg, opacity: checking ? 0.6 : 1 }}>
            {checking ? "CHECKING…" : "ENTER"}
          </button>
        </form>

        <p className="m-0 mt-6" style={{ ...fontText, fontSize: "15px", lineHeight: 1.55, color: theme.ink2 }}>
          Door staff and management only. If you're a guest, your pass link was
          sent to you directly.
        </p>
      </section>
      <Footer />
    </div>
  );
}
