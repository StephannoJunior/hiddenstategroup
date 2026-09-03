import React, { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { fontDisplay, fontUtility, theme } from "../components/Shared";
import * as api from "../lib/api";

/*
  ── N01 · THE NUMBER ON THE WALL ────────────────────────────────────────────

  A spare phone or a laptop propped in a corner, showing one thing: how many
  people are in. Whoever is running the room stops walking to the door to ask.

  WHAT IT IS NOT. It is not a guest list. A screen in a public room is a screen
  anyone can photograph, so no names, no codes and no addresses ever reach this
  page — the server sends four numbers and nothing else.

  NO NAVIGATION, NO FOOTER, NO SIGN-IN. Everything that makes this a website
  is a thing somebody can accidentally tap at 1am, and then the number is gone
  and nobody knows how to get it back. There is one screen and no way off it.

  DESIGNED FOR ACROSS THE ROOM, not for a hand: the count is as large as the
  viewport allows, in figures rather than words, and the state that matters
  most — the room being full — is carried by the colour of the whole screen,
  because at that distance colour arrives before any number is read.
*/

const POLL_MS = 15000;

export default function Wall() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [stale, setStale] = useState(false);
  const timer = useRef(null);

  const read = useCallback(async () => {
    const res = await api.readWall(token);
    if (res.ok) {
      setData(res);
      setError("");
      setStale(false);
    } else if (res.error && !/connection/i.test(res.error)) {
      // A dead link is worth saying out loud. A dropped connection is not —
      // the last good number is still the best answer anyone has.
      setError(res.error);
    } else {
      setStale(true);
    }
  }, [token]);

  useEffect(() => {
    read();
    timer.current = setInterval(read, POLL_MS);
    return () => clearInterval(timer.current);
  }, [read]);

  /*
    KEEP THE SCREEN ON.

    A wall display that sleeps after thirty seconds is not a wall display. The
    wake lock is dropped by the browser whenever the tab is hidden, so it is
    re-taken every time the page becomes visible again — asking once on load
    lasts exactly until somebody switches apps.
  */
  useEffect(() => {
    let lock = null;
    const take = async () => {
      try {
        if (document.visibilityState === "visible" && navigator.wakeLock) {
          lock = await navigator.wakeLock.request("screen");
        }
      } catch { /* refused, or unsupported. The screen dims; nothing breaks. */ }
    };
    take();
    document.addEventListener("visibilitychange", take);
    return () => {
      document.removeEventListener("visibilitychange", take);
      try { lock && lock.release(); } catch { /* already gone */ }
    };
  }, []);

  const inside = data ? data.inside : 0;
  const capacity = data ? data.capacity : 0;
  const share = capacity > 0 ? inside / capacity : 0;

  /*
    Three states, and the ground carries them. Ninety percent is the moment
    the door needs to start thinking, not the moment it is too late.
  */
  const full = capacity > 0 && inside >= capacity;
  const nearly = capacity > 0 && !full && share >= 0.9;
  const ground = full ? theme.bad : nearly ? theme.brass : theme.ink;

  return (
    <div
      style={{
        position: "fixed", inset: 0,
        background: ground,
        color: theme.bg,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        padding: "3vmin",
        transition: "background 600ms ease",
        userSelect: "none", WebkitUserSelect: "none",
        WebkitTouchCallout: "none",
      }}
    >
      {error ? (
        <p style={{ ...fontUtility, fontSize: "12px", letterSpacing: "0.2em", opacity: 0.8 }}>
          {error.toUpperCase()}
        </p>
      ) : !data ? (
        <p style={{ ...fontUtility, fontSize: "12px", letterSpacing: "0.2em", opacity: 0.5 }}>
          READING…
        </p>
      ) : (
        <>
          <p className="m-0" style={{
            ...fontUtility, fontSize: "clamp(9px,1.6vw,15px)", letterSpacing: "0.28em",
            opacity: 0.6, textAlign: "center",
          }}>
            {(data.party.name || "TONIGHT").toUpperCase()}
          </p>

          {/*
            One number, as big as the screen allows. `tabular-nums` so it does
            not jump sideways every time a 1 becomes a 2 — at this size that
            shift is the whole screen twitching.
          */}
          <p className="m-0" style={{
            ...fontDisplay, fontWeight: 400,
            fontSize: "min(46vw, 62vh)", lineHeight: 0.86,
            fontVariantNumeric: "tabular-nums",
            margin: "1vmin 0",
          }}>
            {inside}
          </p>

          <p className="m-0" style={{
            ...fontUtility, fontSize: "clamp(10px,2.2vw,22px)", letterSpacing: "0.22em",
            opacity: 0.85,
          }}>
            {full ? "ROOM FULL" : capacity > 0 ? `OF ${capacity}` : "INSIDE"}
          </p>

          {/*
            The bar exists so the number has a shape. At a glance across a
            room, "nearly there" is read from a length long before it is read
            from two figures.
          */}
          {capacity > 0 && (
            <div style={{
              width: "min(60vw, 520px)", height: "6px", marginTop: "4vmin",
              background: "rgba(237,228,208,0.22)",
            }}>
              <div style={{
                width: `${Math.min(100, share * 100)}%`, height: "100%",
                background: theme.bg, transition: "width 700ms ease",
              }} />
            </div>
          )}

          <div className="flex" style={{ gap: "clamp(14px,4vw,44px)", marginTop: "5vmin", opacity: 0.55 }}>
            <span style={{ ...fontUtility, fontSize: "clamp(8px,1.3vw,12px)", letterSpacing: "0.18em" }}>
              EXPECTED {data.expected}
            </span>
            <span style={{ ...fontUtility, fontSize: "clamp(8px,1.3vw,12px)", letterSpacing: "0.18em" }}>
              IN {data.admitted}
            </span>
            <span style={{ ...fontUtility, fontSize: "clamp(8px,1.3vw,12px)", letterSpacing: "0.18em" }}>
              OUT {data.outside}
            </span>
          </div>

          {/*
            A number that has stopped updating looks exactly like a number that
            has not changed. This is the difference, and on a screen nobody is
            watching closely it is the only thing that could ever mislead
            anyone.
          */}
          {stale && (
            <p className="m-0" style={{
              ...fontUtility, fontSize: "clamp(8px,1.2vw,11px)", letterSpacing: "0.18em",
              marginTop: "3vmin", opacity: 0.7,
            }}>
              NO SIGNAL — LAST KNOWN
            </p>
          )}
        </>
      )}
    </div>
  );
}
