import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { NAV_ITEMS, fontUtility, theme } from "./Shared";
import { useLang } from "../lib/lang";

/*
  GlassBar — floating navigation, phones only.

    One tap   → open / close the menu
    Two taps  → home
    Swipe     → the open menu scrolls sideways with snap

  ON THE GLASS: this is a web approximation of a frosted-glass control, not
  Apple's own material — that is rendered by the OS and isn't available to a
  website. What produces the effect here:

    backdrop-filter        blurs and saturates whatever is behind it
    layered gradient       gives the pane depth rather than flat translucency
    inset top highlight    the bright edge where light catches the rim
    inset bottom shade     the darker underside, which reads as thickness
    moving sheen           a soft highlight that follows your finger
    spring press           slight squash on touch, with a little overshoot back

  Deliberately NOT mix-blend-mode — that property broke this site on iOS once.
*/

const DOUBLE_TAP_MS = 260;
const SPRING = "cubic-bezier(.34,1.56,.64,1)";

export default function GlassBar() {
  const [open, setOpen] = useState(false);
  const [pressing, setPressing] = useState(false);
  const [sheen, setSheen] = useState({ x: 50, y: 50, on: false });
  const tapTimer = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useLang();

  useEffect(() => { setOpen(false); }, [location.pathname]);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener("scroll", close, { passive: true });
    return () => window.removeEventListener("scroll", close);
  }, [open]);

  useEffect(() => () => { if (tapTimer.current) clearTimeout(tapTimer.current); }, []);

  const handleTap = () => {
    if (tapTimer.current) {
      clearTimeout(tapTimer.current);
      tapTimer.current = null;
      setOpen(false);
      navigate("/");
      return;
    }
    tapTimer.current = setTimeout(() => {
      tapTimer.current = null;
      setOpen((o) => !o);
      if (navigator.vibrate) navigator.vibrate(6);
    }, DOUBLE_TAP_MS);
  };

  const trackSheen = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    setSheen({
      x: ((e.clientX - r.left) / r.width) * 100,
      y: ((e.clientY - r.top) / r.height) * 100,
      on: true,
    });
  };

  const isActive = (href) =>
    href === "/" ? location.pathname === "/" : location.pathname.startsWith(href);

  // The pane itself: translucent, blurred, with a lit rim and a shaded underside.
  const pane = {
    background:
      "linear-gradient(160deg, rgba(255,255,255,0.58) 0%, rgba(243,235,217,0.42) 48%, rgba(243,235,217,0.30) 100%)",
    backdropFilter: "blur(26px) saturate(200%) brightness(1.04)",
    WebkitBackdropFilter: "blur(26px) saturate(200%) brightness(1.04)",
    border: "1px solid rgba(255,255,255,0.55)",
    boxShadow: [
      "inset 0 1px 0 rgba(255,255,255,0.92)",      // rim light along the top
      "inset 0 -1px 0 rgba(22,19,14,0.10)",        // underside, reads as thickness
      "inset 0 0 22px rgba(255,255,255,0.22)",     // soft interior glow
      "0 14px 44px rgba(22,19,14,0.24)",           // cast shadow
      "0 2px 8px rgba(22,19,14,0.10)",             // contact shadow
    ].join(", "),
  };

  const sheenLayer = (
    <span
      aria-hidden="true"
      className="absolute inset-0 rounded-full"
      style={{
        background: `radial-gradient(120px circle at ${sheen.x}% ${sheen.y}%, rgba(255,255,255,0.55), rgba(255,255,255,0) 62%)`,
        opacity: sheen.on ? 1 : 0,
        transition: "opacity 260ms ease",
        pointerEvents: "none",
      }}
    />
  );

  const pill = (
    <Link
      to="/"
      onClick={(e) => { e.preventDefault(); handleTap(); }}
      onPointerDown={(e) => { setPressing(true); trackSheen(e); }}
      onPointerMove={(e) => pressing && trackSheen(e)}
      onPointerUp={() => { setPressing(false); setSheen((s) => ({ ...s, on: false })); }}
      onPointerLeave={() => { setPressing(false); setSheen((s) => ({ ...s, on: false })); }}
      onContextMenu={(e) => e.preventDefault()}
      aria-label="Menu — tap once to open, twice for home"
      className="relative rounded-full flex items-center gap-2.5 px-6 py-3 overflow-hidden"
      style={{
        ...pane,
        transform: pressing ? "scale(0.94)" : "scale(1)",
        transition: `transform 420ms ${SPRING}`,
      }}
    >
      {sheenLayer}
      <span className="flex flex-col gap-[3px] relative" aria-hidden="true">
        <span style={{ width: "16px", height: "1.5px", background: theme.ink, display: "block" }} />
        <span style={{ width: "16px", height: "1.5px", background: theme.ink, display: "block" }} />
        <span style={{ width: "10px", height: "1.5px", background: theme.ink, display: "block" }} />
      </span>
      <span className="relative" style={{ ...fontUtility, fontSize: "10px", letterSpacing: "0.18em", color: theme.ink }}>
        HIDDEN STATE
      </span>
    </Link>
  );

  const item = (to, label, key) => (
    <Link
      key={key}
      to={to}
      onClick={() => setOpen(false)}
      className="px-4 py-2 rounded-full whitespace-nowrap relative"
      style={{
        ...fontUtility, fontSize: "10px", letterSpacing: "0.16em",
        scrollSnapAlign: "center",
        color: isActive(to) ? theme.bg : theme.ink,
        background: isActive(to) ? theme.ink : "transparent",
        boxShadow: isActive(to) ? "0 2px 10px rgba(22,19,14,0.28)" : "none",
        transition: `background 220ms ease, color 220ms ease`,
      }}
    >
      {label}
    </Link>
  );

  const labelFor = (item_) => {
    const map = {
      NEWS: "news", RECORDS: "records", AGENCY: "agency", ARTISTS: "artists",
      EVENTS: "events", MIXES: "mixes", ABOUT: "about",
    };
    return map[item_.label] ? t(map[item_.label]) : item_.label;
  };

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-[78] lg:hidden" onClick={() => setOpen(false)} aria-hidden="true" />
      )}

      <div
        className="fixed left-0 right-0 z-[79] lg:hidden flex justify-center px-4"
        style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 34px)" }}
      >
        <div className="relative w-full max-w-[520px] flex justify-center">
          <div
            style={{
              opacity: open ? 0 : 1,
              transform: open ? "translateY(16px) scale(0.92)" : "translateY(0) scale(1)",
              pointerEvents: open ? "none" : "auto",
              transition: `opacity 220ms ease, transform 420ms ${SPRING}`,
            }}
          >
            {pill}
          </div>

          <nav
            aria-label="Site navigation"
            className="absolute left-0 right-0 rounded-full overflow-hidden"
            style={{
              ...pane,
              opacity: open ? 1 : 0,
              transform: open ? "translateY(0) scale(1)" : "translateY(20px) scale(0.94)",
              pointerEvents: open ? "auto" : "none",
              transition: `opacity 220ms ease, transform 460ms ${SPRING}`,
            }}
          >
            <div className="flex gap-1 overflow-x-auto no-scrollbar px-2 py-2 relative"
                 style={{ scrollSnapType: "x proximity" }}>
              {item("/", t("home"), "home")}
              {NAV_ITEMS.map((n) => item(n.href, labelFor(n), n.label))}
            </div>
          </nav>
        </div>
      </div>
    </>
  );
}
