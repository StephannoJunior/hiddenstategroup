import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { NAV_ITEMS, fontUtility, theme } from "./Shared";

/*
  GlassBar — floating navigation, phones only.

    One tap   → open / close the menu
    Two taps  → home
    Swipe     → the open menu scrolls sideways with snap

  A single tap waits ~260ms before acting, because that is how long we must
  allow for a possible second tap. Any shorter and double-tap gets missed; any
  longer and the menu feels sluggish.

  Frosted look comes from backdrop-filter — the property Apple's own surfaces
  use. Deliberately not mix-blend-mode, which broke iOS here once before.
*/

const DOUBLE_TAP_MS = 260;

export default function GlassBar() {
  const [open, setOpen] = useState(false);
  const [pressing, setPressing] = useState(false);
  const tapTimer = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();

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
      // second tap landed inside the window → home
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

  const isActive = (href) =>
    href === "/" ? location.pathname === "/" : location.pathname.startsWith(href);

  const glass = {
    background: "rgba(243, 235, 217, 0.62)",
    backdropFilter: "blur(22px) saturate(180%)",
    WebkitBackdropFilter: "blur(22px) saturate(180%)",
    border: "1px solid rgba(22, 19, 14, 0.14)",
    boxShadow: "0 12px 38px rgba(22,19,14,0.20), inset 0 1px 0 rgba(255,255,255,0.55)",
  };

  const pill = (
    <Link
      to="/"
      onClick={(e) => { e.preventDefault(); handleTap(); }}
      onPointerDown={() => setPressing(true)}
      onPointerUp={() => setPressing(false)}
      onPointerLeave={() => setPressing(false)}
      onContextMenu={(e) => e.preventDefault()}
      aria-label="Menu — tap once to open, twice for home"
      className="rounded-full flex items-center gap-2.5 px-6 py-3"
      style={{
        ...glass,
        transform: pressing ? "scale(0.95)" : "scale(1)",
        transition: "transform 150ms ease",
      }}
    >
      <span className="flex flex-col gap-[3px]" aria-hidden="true">
        <span style={{ width: "16px", height: "1.5px", background: theme.ink, display: "block" }} />
        <span style={{ width: "16px", height: "1.5px", background: theme.ink, display: "block" }} />
        <span style={{ width: "10px", height: "1.5px", background: theme.ink, display: "block" }} />
      </span>
      <span style={{ ...fontUtility, fontSize: "10px", letterSpacing: "0.18em", color: theme.ink }}>
        HIDDEN STATE
      </span>
    </Link>
  );

  const item = (to, label, key) => (
    <Link
      key={key}
      to={to}
      onClick={() => setOpen(false)}
      className="px-4 py-2 rounded-full whitespace-nowrap"
      style={{
        ...fontUtility, fontSize: "10px", letterSpacing: "0.16em",
        scrollSnapAlign: "center",
        color: isActive(to) ? theme.bg : theme.ink,
        background: isActive(to) ? theme.ink : "transparent",
      }}
    >
      {label}
    </Link>
  );

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
          {/* collapsed pill — slides down and fades as the menu takes over */}
          <div
            style={{
              opacity: open ? 0 : 1,
              transform: open ? "translateY(14px) scale(0.94)" : "translateY(0) scale(1)",
              pointerEvents: open ? "none" : "auto",
              transition: "opacity 240ms ease, transform 320ms cubic-bezier(.22,1,.36,1)",
            }}
          >
            {pill}
          </div>

          {/* menu — slides up into its place */}
          <nav
            aria-label="Site navigation"
            className="absolute left-0 right-0 rounded-full overflow-hidden"
            style={{
              ...glass,
              opacity: open ? 1 : 0,
              transform: open ? "translateY(0) scale(1)" : "translateY(18px) scale(0.96)",
              pointerEvents: open ? "auto" : "none",
              transition: "opacity 240ms ease, transform 340ms cubic-bezier(.22,1,.36,1)",
            }}
          >
            <div
              className="flex gap-1 overflow-x-auto no-scrollbar px-2 py-2"
              style={{ scrollSnapType: "x proximity" }}
            >
              {item("/", "HOME", "home")}
              {NAV_ITEMS.map((n) => item(n.href, n.label, n.label))}
            </div>
          </nav>
        </div>
      </div>
    </>
  );
}
