import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Home, Newspaper, Disc, Briefcase, Users, Calendar, Radio, Info } from "lucide-react";
import { fontUtility, theme } from "./Shared";
import { useLang } from "../lib/lang";

/*
  GlassBar — floating navigation on phones.

    One tap   → open / close
    Two taps  → home
    Swipe     → the open bar scrolls sideways with snap

  THE MATERIAL. Apple renders its glass in the OS; a website cannot use that.
  What produces the effect here, layer by layer, bottom to top:

    1  backdrop-filter        blur + saturation of everything behind
    2  clear tint             only a whisper of colour, so the page shows through
    3  specular streak        a fixed bright band across the upper third — this
                              is the reflection, and it is what sells glass more
                              than anything else
    4  rim light              the lit top edge
    5  underside shade        darker lower edge, reads as thickness
    6  moving sheen           a highlight that tracks your finger
    7  spring press           slight squash with overshoot returning

  Kept deliberately CLEAR rather than milky: earlier versions used a heavy
  opaque tint that read as frosted plastic. Real glass shows what is behind it.

  NOT mix-blend-mode, which broke this site on iOS once.
*/

const DOUBLE_TAP_MS = 260;
const SPRING = "cubic-bezier(.34,1.56,.64,1)";

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

  // Clear, not milky. Low opacity so the page reads through the panel.
  const pane = {
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.34) 0%, rgba(255,255,255,0.16) 42%, rgba(243,235,217,0.20) 100%)",
    backdropFilter: "blur(34px) saturate(210%) brightness(1.08)",
    WebkitBackdropFilter: "blur(34px) saturate(210%) brightness(1.08)",
    border: "1px solid rgba(255,255,255,0.42)",
    boxShadow: [
      "inset 0 1px 0 rgba(255,255,255,0.9)",
      "inset 0 -1px 0 rgba(22,19,14,0.06)",
      "0 1px 3px rgba(22,19,14,0.05)",
    ].join(", "),
  };

  // The reflection: a fixed specular band across the top, slightly angled,
  // the way light catches a curved glass surface.
  const reflection = (
    <span
      aria-hidden="true"
      className="absolute inset-0"
      style={{
        borderRadius: "inherit",
        background:
          "linear-gradient(168deg, rgba(255,255,255,0.62) 0%, rgba(255,255,255,0.22) 26%, rgba(255,255,255,0) 46%)",
        pointerEvents: "none",
      }}
    />
  );

  const sheenLayer = (
    <span
      aria-hidden="true"
      className="absolute inset-0"
      style={{
        borderRadius: "inherit",
        background: `radial-gradient(150px circle at ${sheen.x}% ${sheen.y}%, rgba(255,255,255,0.55), rgba(255,255,255,0) 62%)`,
        opacity: sheen.on ? 1 : 0,
        transition: "opacity 300ms ease",
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
        {/* Fixed-height stage. Both states are absolutely placed inside it, so
            neither pushes the other and the slide stays perfectly smooth. */}
        <div className="relative w-full max-w-[560px]" style={{ height: "72px" }}>

          {/* collapsed pill */}
          <div
            className="absolute left-0 right-0 flex justify-center"
            style={{
              bottom: 0,
              opacity: open ? 0 : 1,
              transform: open ? "translateY(20px) scale(0.88)" : "translateY(0) scale(1)",
              pointerEvents: open ? "none" : "auto",
              transition: `opacity 200ms ease, transform 460ms ${SPRING}`,
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
                borderRadius: "24px",
                padding: "14px 26px",
                transform: pressing ? "scale(0.95)" : "scale(1)",
                transition: `transform 460ms ${SPRING}`,
              }}
            >
              {reflection}
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

          {/* open tab bar */}
          <nav
            aria-label="Site navigation"
            className="absolute left-0 right-0 overflow-hidden"
            style={{
              ...pane,
              bottom: 0,
              borderRadius: "26px",
              opacity: open ? 1 : 0,
              transform: open ? "translateY(0) scale(1)" : "translateY(24px) scale(0.9)",
              pointerEvents: open ? "auto" : "none",
              transition: `opacity 200ms ease, transform 500ms ${SPRING}`,
            }}
          >
            {reflection}
            <div
              className="flex overflow-x-auto no-scrollbar relative"
              style={{ scrollSnapType: "x proximity", padding: "7px" }}
            >
              {TABS.map(({ href, key, Icon }) => {
                const active = isActive(href);
                return (
                  <Link
                    key={key}
                    to={href}
                    onClick={() => setOpen(false)}
                    className="flex flex-col items-center justify-center shrink-0 relative"
                    style={{
                      scrollSnapAlign: "center",
                      minWidth: "66px",
                      padding: "8px 6px",
                      borderRadius: "17px",
                      gap: "5px",
                      background: active ? "rgba(22,19,14,0.88)" : "transparent",
                      boxShadow: active ? "inset 0 1px 0 rgba(255,255,255,0.18)" : "none",
                      transition: "background 260ms ease",
                    }}
                  >
                    <Icon size={19} strokeWidth={1.6} color={active ? theme.bg : theme.ink} aria-hidden="true" />
                    <span
                      style={{
                        ...fontUtility,
                        fontSize: "8.5px",
                        letterSpacing: "0.1em",
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
