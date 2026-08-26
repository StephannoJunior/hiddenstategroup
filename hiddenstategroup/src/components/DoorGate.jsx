import React, { useEffect, useState } from "react";
import { Nav, Footer, useGoogleFonts, fontDisplay, fontUtility, fontText, fontMasthead, theme } from "./Shared";
import { roleForCode, currentRole, signIn, signOut } from "../lib/access";

/*
  DoorGate — wraps the scanner and the door list.

  Children are given the signed-in role, so each page can show only what that
  role should see. Staff get the scanner; the owner gets everything.

  This keeps guests out. It is not a real lock — see the note in access.js.
*/

export default function DoorGate({ children }) {
  useGoogleFonts();
  const [role, setRole] = useState(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);

  useEffect(() => { setRole(currentRole()); }, []);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setChecking(true);
    const found = await roleForCode(code);
    setChecking(false);
    if (!found) {
      setError("That code isn't recognised.");
      setCode("");
      return;
    }
    signIn(found);
    setRole(found);
    setCode("");
  };

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
            {role.label.toUpperCase()}
            <button onClick={() => { signOut(); setRole(null); }}
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
      <section className="max-w-[420px] mx-auto px-[18px] pt-[104px] pb-24">
        <h1 className="text-center m-0" style={{ ...fontMasthead, color: theme.ink, fontSize: "clamp(24px,6vw,36px)" }}>
          Staff Only
        </h1>
        <div className="mt-2" style={{ borderTop: "2px solid " + theme.ink }} />
        <div style={{ borderTop: "1px solid " + theme.ink, marginTop: "3px" }} />

        <form onSubmit={submit} className="mt-8">
          <p className="m-0 mb-2" style={{ ...fontUtility, fontSize: "9.5px", letterSpacing: "0.2em", color: theme.brass }}>
            ENTER YOUR CODE
          </p>
          <input
            type="password"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoComplete="off"
            style={{ width: "100%", background: "transparent", border: "1px solid " + theme.rule,
                     color: theme.ink, padding: "13px", fontSize: "17px", letterSpacing: "0.1em" }}
          />
          {error && (
            <p className="m-0 mt-3 px-3 py-2.5"
               style={{ ...fontText, fontSize: "15px", color: "#7A2E2E", border: "1px solid #C08A8A" }}>
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
