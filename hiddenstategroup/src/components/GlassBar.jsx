import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Home, Newspaper, Disc, Briefcase, Users, Calendar, Radio, Info } from "lucide-react";
import { fontUtility, theme } from "./Shared";
import { useLang } from "../lib/lang";

/*
  GlassBar — the floating navigation on phones.

    One tap   → open / close
    Two taps  → home
    Swipe     → the open bar scrolls sideways

  Built to sit closer to an iOS tab bar: icon above a small label, a soft
  rounded highlight behind the current section, and glass that gets its
  separation from refraction rather than from a drop shadow.

  A note on the material. Apple's own is rendered by the OS and can't be used
  by a website, so this is built from what a browser does give us:

    backdrop-filter   blurs and saturates the page behind the panel
    layered gradient  depth across the surface instead of flat translucency
    rim highlight     the lit top edge where glass catches light
    underside shade   the darker lower edge, which reads as thickness
    sheen             a soft highlight that tracks your finger
    spring            a slight squash on press that overshoots coming back

  Deliberately NOT mix-blend-mode, which broke this site on iOS once.
*/

const DOUBLE_TAP_MS = 260;
const SPRING = "cubic-bezier(.34,1.56,.64,1)";

// Only long-standing lucide icons, so this can't break on a version bump.
const TABS = [
  { href: "/", key: "home", Icon: Home },
  { href: "/news", key: "news", Icon: Newspaper },
  { href: "/records", key: "records", Icon: Disc },
  { href: "/agency", key: "agency", Icon: Briefcase },
  { href: "/artists", key: "artists", Icon: Users },
  { href: "/events", key: "events", Icon: Calendar },
  { href: "/mixes", key: "mixes", Icon: Radio },
  { href: "/about", key: "about", Icon: Info },
];

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
    let queued = false;
    const onScroll = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => { queued = false; setOpen(false); });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
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

  const pane = {
    background:
      "linear-gradient(155deg, rgba(255,255,255,0.60) 0%, rgba(243,235,217,0.44) 50%, rgba(243,235,217,0.32) 100%)",
    backdropFilter: "blur(30px) saturate(190%) brightness(1.05)",
    WebkitBackdropFilter: "blur(30px) saturate(190%) brightness(1.05)",
    border: "1px solid rgba(255,255,255,0.6)",
    boxShadow: [
      "inset 0 1px 0 rgba(255,255,255,0.95)",
      "inset 0 -1px 0 rgba(22,19,14,0.07)",
      "inset 0 0 28px rgba(255,255,255,0.24)",
      "0 1px 3px rgba(22,19,14,0.06)",
    ].join(", "),
  };

  const sheenLayer = (
    <span
      aria-hidden="true"
      className="absolute inset-0"
      style={{
        borderRadius: "inherit",
        background: `radial-gradient(140px circle at ${sheen.x}% ${sheen.y}%, rgba(255,255,255,0.5), rgba(255,255,255,0) 65%)`,
        opacity: sheen.on ? 1 : 0,
        transition: "opacity 280ms ease",
        pointerEvents: "none",
      }}
    />
  );

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-[78] lg:hidden" onClick={() => setOpen(false)} aria-hidden="true" />
      )}

      <div
        className="fixed left-0 right-0 z-[79] lg:hidden flex justify-center px-3"
        style={{
          bottom: "calc(env(safe-area-inset-bottom, 0px) + 30px)",
          transform: "translateZ(0)",
          WebkitTransform: "translateZ(0)",
          willChange: "transform",
          backfaceVisibility: "hidden",
          WebkitBackfaceVisibility: "hidden",
        }}
      >
        <div className="relative w-full max-w-[560px] flex justify-center">
          {/* collapsed — a larger, quieter pill */}
          <div
            style={{
              opacity: open ? 0 : 1,
              transform: open ? "translateY(18px) scale(0.9)" : "translateY(0) scale(1)",
              pointerEvents: open ? "none" : "auto",
              transition: `opacity 200ms ease, transform 440ms ${SPRING}`,
            }}
          >
            <Link
              to="/"
              onClick={(e) => { e.preventDefault(); handleTap(); }}
              onPointerDown={(e) => { setPressing(true); trackSheen(e); }}
              onPointerMove={(e) => pressing && trackSheen(e)}
              onPointerUp={() => { setPressing(false); setSheen((s) => ({ ...s, on: false })); }}
              onPointerLeave={() => { setPressing(false); setSheen((s) => ({ ...s, on: false })); }}
              onContextMenu={(e) => e.preventDefault()}
              aria-label="Menu — tap once to open, twice for home"
              className="relative flex items-center gap-3 overflow-hidden"
              style={{
                ...pane,
                borderRadius: "26px",
                padding: "15px 26px",
                transform: pressing ? "scale(0.95)" : "scale(1)",
                transition: `transform 440ms ${SPRING}`,
              }}
            >
              {sheenLayer}
              <span className="flex flex-col gap-[3.5px] relative" aria-hidden="true">
                <span style={{ width: "18px", height: "1.5px", background: theme.ink, display: "block" }} />
                <span style={{ width: "18px", height: "1.5px", background: theme.ink, display: "block" }} />
                <span style={{ width: "11px", height: "1.5px", background: theme.ink, display: "block" }} />
              </span>
              <span className="relative" style={{ ...fontUtility, fontSize: "10.5px", letterSpacing: "0.2em", color: theme.ink }}>
                HIDDEN STATE
              </span>
            </Link>
          </div>

          {/* open — icon over label, the way a tab bar reads */}
          <nav
            aria-label="Site navigation"
            className="absolute left-0 right-0 overflow-hidden"
            style={{
              ...pane,
              borderRadius: "28px",
              opacity: open ? 1 : 0,
              transform: open ? "translateY(0) scale(1)" : "translateY(22px) scale(0.92)",
              pointerEvents: open ? "auto" : "none",
              transition: `opacity 200ms ease, transform 480ms ${SPRING}`,
            }}
          >
            <div
              className="flex overflow-x-auto no-scrollbar"
              style={{ scrollSnapType: "x proximity", padding: "8px 8px" }}
            >
              {TABS.map(({ href, key, Icon }) => {
                const active = isActive(href);
                return (
                  <Link
                    key={key}
                    to={href}
                    onClick={() => setOpen(false)}
                    className="flex flex-col items-center justify-center shrink-0"
                    style={{
                      scrollSnapAlign: "center",
                      minWidth: "68px",
                      padding: "9px 6px",
                      borderRadius: "18px",
                      gap: "5px",
                      background: active ? "rgba(22,19,14,0.90)" : "transparent",
                      transition: "background 240ms ease",
                    }}
                  >
                    <Icon
                      size={19}
                      strokeWidth={1.6}
                      color={active ? theme.bg : theme.ink}
                      aria-hidden="true"
                    />
                    <span
                      style={{
                        ...fontUtility,
                        fontSize: "8.5px",
                        letterSpacing: "0.12em",
                        color: active ? theme.bg : theme.ink,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {t(key)}
                    </span>
                  </Link>
                );
              })}
            </div>
          </nav>
        </div>
      </div>
    </>
  );
}
