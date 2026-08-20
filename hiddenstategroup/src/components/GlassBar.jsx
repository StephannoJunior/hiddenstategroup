import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { NAV_ITEMS, fontUtility, theme } from "./Shared";

/*
  GlassBar — floating navigation, phones only.

  Tap        → home
  Long press → expands into the nav items, which scroll sideways
  Tap away   → closes

  Uses backdrop-filter for the frosted look. Note this is NOT mix-blend-mode,
  which is what broke iOS previously — backdrop-filter is safe and is the
  property Apple's own frosted surfaces use. The -webkit- prefix is required
  for Safari.
*/

const LONG_PRESS_MS = 420;

export default function GlassBar() {
  const [open, setOpen] = useState(false);
  const [pressing, setPressing] = useState(false);
  const timer = useRef(null);
  const moved = useRef(false);
  const location = useLocation();
  const navigate = useNavigate();

  // close whenever the route changes
  useEffect(() => { setOpen(false); }, [location.pathname]);

  // close on scroll or on a tap elsewhere
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener("scroll", close, { passive: true });
    return () => window.removeEventListener("scroll", close);
  }, [open]);

  const clear = () => { if (timer.current) { clearTimeout(timer.current); timer.current = null; } };

  const start = () => {
    moved.current = false;
    setPressing(true);
    clear();
    timer.current = setTimeout(() => {
      if (!moved.current) {
        setOpen(true);
        if (navigator.vibrate) navigator.vibrate(8); // matches the iOS long-press feel
      }
    }, LONG_PRESS_MS);
  };

  const end = () => {
    setPressing(false);
    const wasLong = timer.current === null;
    clear();
    if (!wasLong && !moved.current && !open) navigate("/");
  };

  const cancel = () => { moved.current = true; setPressing(false); clear(); };

  const isActive = (href) =>
    href === "/" ? location.pathname === "/" : location.pathname.startsWith(href);

  const glass = {
    background: "rgba(243, 235, 217, 0.62)",
    backdropFilter: "blur(22px) saturate(180%)",
    WebkitBackdropFilter: "blur(22px) saturate(180%)",
    border: "1px solid rgba(22, 19, 14, 0.14)",
    boxShadow: "0 10px 34px rgba(22,19,14,0.18), inset 0 1px 0 rgba(255,255,255,0.55)",
  };

  return (
    <>
      {/* tap-away layer */}
      {open && (
        <div className="fixed inset-0 z-[78] lg:hidden" onClick={() => setOpen(false)} aria-hidden="true" />
      )}

      <div
        className="fixed left-0 right-0 z-[79] lg:hidden flex justify-center px-4"
        style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 14px)" }}
      >
        {open ? (
          <nav
            className="w-full max-w-[520px] rounded-full overflow-hidden"
            style={glass}
            aria-label="Site navigation"
          >
            <div className="flex gap-1 overflow-x-auto no-scrollbar px-2 py-2"
                 style={{ scrollSnapType: "x proximity" }}>
              <Link to="/" onClick={() => setOpen(false)}
                    className="px-4 py-2 rounded-full whitespace-nowrap"
                    style={{ ...fontUtility, fontSize: "10px", letterSpacing: "0.16em",
                             scrollSnapAlign: "center",
                             color: isActive("/") ? theme.bg : theme.ink,
                             background: isActive("/") ? theme.ink : "transparent" }}>
                HOME
              </Link>
              {NAV_ITEMS.map((item) => (
                <Link key={item.label} to={item.href} onClick={() => setOpen(false)}
                      className="px-4 py-2 rounded-full whitespace-nowrap"
                      style={{ ...fontUtility, fontSize: "10px", letterSpacing: "0.16em",
                               scrollSnapAlign: "center",
                               color: isActive(item.href) ? theme.bg : theme.ink,
                               background: isActive(item.href) ? theme.ink : "transparent" }}>
                  {item.label}
                </Link>
              ))}
            </div>
          </nav>
        ) : (
          <button
            onTouchStart={start}
            onTouchEnd={end}
            onTouchMove={cancel}
            onMouseDown={start}
            onMouseUp={end}
            onMouseLeave={cancel}
            onContextMenu={(e) => e.preventDefault()}
            aria-label="Home — press and hold for the menu"
            className="rounded-full flex items-center gap-2.5 px-6 py-3 transition-transform duration-150"
            style={{ ...glass, transform: pressing ? "scale(0.95)" : "scale(1)" }}
          >
            <span className="flex flex-col gap-[3px]" aria-hidden="true">
              <span style={{ width: "16px", height: "1.5px", background: theme.ink, display: "block" }} />
              <span style={{ width: "16px", height: "1.5px", background: theme.ink, display: "block" }} />
              <span style={{ width: "10px", height: "1.5px", background: theme.ink, display: "block" }} />
            </span>
            <span style={{ ...fontUtility, fontSize: "10px", letterSpacing: "0.18em", color: theme.ink }}>
              HIDDEN STATE
            </span>
          </button>
        )}
      </div>
    </>
  );
}
