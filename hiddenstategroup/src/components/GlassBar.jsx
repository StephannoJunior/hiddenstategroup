import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Home, Newspaper, Disc, Briefcase, Users, Calendar, Radio, Info,
         Ticket, Shield, ScanLine, ClipboardList, Settings2, PenLine } from "lucide-react";
import { fontUtility, theme } from "./Shared";
import { useLang } from "../lib/lang";
import * as api from "../lib/api";
import { useSite } from "../lib/site";

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
  // On desktop the bar is simply always open — there is room for it, and a
  // tap-to-reveal control makes no sense with a mouse. On phones it stays
  // collapsed until tapped.
  const [isDesktop, setIsDesktop] = useState(
    typeof window !== "undefined" ? window.matchMedia("(min-width: 1024px)").matches : false
  );
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const onChange = (e) => setIsDesktop(e.matches);
    mq.addEventListener ? mq.addEventListener("change", onChange) : mq.addListener(onChange);
    return () => (mq.removeEventListener ? mq.removeEventListener("change", onChange) : mq.removeListener(onChange));
  }, []);

  const [openState, setOpen] = useState(false);
  const open = isDesktop || openState;
  const [pressing, setPressing] = useState(false);
  const [sheen, setSheen] = useState({ x: 50, y: 50, on: false });
  const tapTimer = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useLang();
  const site = useSite();

  /*
    The bar gains one extra tab depending on who is signed in:
      guest  → their own pass
      team   → the door tools
    Signed out, neither appears — a visitor sees no trace of them.

    Re-read on every route change, so signing in or out updates the bar
    without a reload.
  */
  const [role, setRole] = useState(null);
  /*
    Read on the first render rather than in an effect. Reading it afterwards
    meant the bar briefly showed the finder link before switching to the
    direct one — a visible flicker on every page load for anyone who holds a
    pass.
  */
  const [guestPass, setGuestPass] = useState(() => {
    try {
      return localStorage.getItem("hs-guest-pass");
    } catch {
      return null;
    }
  });

  /*
    Ask the server who is signed in, rather than trusting anything the browser
    holds. Re-checked on every route change so signing in or out updates the
    bar straight away.

    A guest is different: they hold a pass code, not an account, so their code
    is remembered locally and turned into a tab without any server call.
  */
  useEffect(() => {
    let alive = true;

    if (api.getToken()) {
      api.me().then((res) => {
        if (!alive) return;
        setRole(res.ok ? res.user : null);
      });
    } else {
      setRole(null);
    }

    try {
      setGuestPass(localStorage.getItem("hs-guest-pass"));
    } catch {
      setGuestPass(null);
    }

    return () => { alive = false; };
  }, [location.pathname, location.search]);

  /*
    What the bar shows depends entirely on who is looking.

      signed out  → a way in, nothing else
      guest       → their own pass
      door staff  → the scanner
      management  → scanner, door list, console

    A guest tab never appears for the team: someone working the door should
    not be sent to their own ticket by mistake, and the two are one tap apart.
  */
  const teamTabs = [];
  if (role) {
    if (role.can.scan) teamTabs.push({ href: "/scan", key: "scanner", Icon: ScanLine });
    if (role.can.seeList) teamTabs.push({ href: "/doorlist", key: "doorList", Icon: ClipboardList });
    teamTabs.push({ href: "/console", key: "team", Icon: Shield });
    // Writing posts and changing settings are yours alone, so these only
    // appear for an account that actually holds those permissions.
    if (role.can.issuePasses) teamTabs.push({ href: "/console?tab=posts", key: "write", Icon: PenLine });
    if (role.can.manageTeam) teamTabs.push({ href: "/console?tab=settings", key: "settings", Icon: Settings2 });
  }

  /*
    One tab for anyone who is not team, always in the same place.

    It used to show MY PASS on a device that had opened one and SIGN IN on a
    device that had not — so the same person saw different things on their
    phone and their laptop. Now it is always the pass tab; it just goes
    straight there if this device knows the code, and to the finder if not.
  */
  const extraTabs = role
    ? teamTabs
    : [{
        href: guestPass ? `/pass/${guestPass}` : "/mypass",
        key: "myPass",
        Icon: Ticket,
      }];

  const handleTap = () => {
    if (tapTimer.current) {
      // Second tap inside the window → home.
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

  /*
    How the bar lays itself out, adjustable in settings because what reads
    well depends on the phone and on how many tabs a person has.
  */
  const allTabs = [...TABS, ...extraTabs];
  const tabWidth = site.barTabWidth || 64;
  const labelSize = site.barLabelSize || 7.5;
  const showLabels = site.barShowLabels !== false;

  /*
    Whether the bar scrolls is a question about WIDTH, not about how many tabs
    there are.

    Counting tabs meant a laptop with room for twenty was told to scroll at
    ten, while a narrow phone squeezed nine into nothing. Measuring the bar
    itself — and measuring again whenever it changes — means it opens fully
    wherever there is room, and scrolls only when there genuinely is not.

    ResizeObserver catches a window resize, an iPad rotating, and a
    split-screen change alike, which a window resize listener alone does not.
  */
  const barRef = useRef(null);
  const [available, setAvailable] = useState(0);

  useEffect(() => {
    const el = barRef.current;
    if (!el) return;
    const measure = () => setAvailable(el.clientWidth);
    measure();

    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(measure);
      observer.observe(el);
      return () => observer.disconnect();
    }
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [allTabs.length]);

  // The narrowest a tab can be and still be read. Icons alone need less.
  const minTab = showLabels ? Math.max(46, tabWidth * 0.72) : 38;
  // Until it has been measured, assume there is room: guessing "crowded"
  // would make the bar scroll for a moment on every load.
  const crowded = available > 0 && available / allTabs.length < minTab;

  /*
    Which tab is lit.

    The console's own tabs live in the address as ?tab=..., so comparing only
    the path meant /console, /console?tab=posts and /console?tab=settings all
    looked identical — the pill sat on the first of them and never moved.

    A link carrying no tab matches only when no tab is showing, so the console
    icon does not stay lit while you are in settings.
  */
  const isActive = (href) => {
    const [hrefPath, hrefQuery] = href.split("?");
    if (hrefPath === "/") return location.pathname === "/";
    if (!location.pathname.startsWith(hrefPath)) return false;

    const wanted = hrefQuery ? new URLSearchParams(hrefQuery).get("tab") : null;
    const current = new URLSearchParams(location.search).get("tab");
    return wanted ? current === wanted : !current;
  };

  // Clear, not milky. Low opacity so the page reads through the panel.
  const pane = {
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.05) 55%, rgba(255,255,255,0.09) 100%)",
    backdropFilter: "blur(40px) saturate(260%) brightness(1.12) contrast(1.05)",
    WebkitBackdropFilter: "blur(40px) saturate(260%) brightness(1.12) contrast(1.05)",
    // No white outline and no bright streak. The edge is defined only by a
    // faint darkening, which separates the panel from the page without
    // drawing a visible line around it.
    border: "1px solid rgba(22,19,14,0.07)",
    boxShadow: "0 1px 3px rgba(22,19,14,0.07)",
  };

  // The specular streak was removed — it read as a hard white line across
  // the top rather than as light on glass.

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
        className="fixed left-0 right-0 z-[79] flex justify-center px-3"
        style={{
          bottom: "calc(env(safe-area-inset-bottom, 0px) + 30px)",
          transform: "translateZ(0)",
          WebkitTransform: "translateZ(0)",
          willChange: "transform",
          backfaceVisibility: "hidden",
          WebkitBackfaceVisibility: "hidden",
        }}
      >
        {/*
          Fixed-height stage. Both states sit absolutely inside it, so neither
          pushes the other and the slide stays smooth.

          The width follows the number of tabs rather than a fixed 560px: with
          five team tabs added there is simply more to show, and a laptop or
          iPad has the room for it. Capped so it never stretches across a large
          monitor and leaves the tabs marooned at the edges.
        */}
        <div
          ref={barRef}
          className="relative w-full"
          style={{
            height: "72px",
            maxWidth: `${Math.min(1080, Math.max(560, allTabs.length * (tabWidth + 6)))}px`,
          }}
        >

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
            {/*
              Eight tabs share a phone's width comfortably. Thirteen do not —
              signed in as boss there are five more, and each one ends up
              around 26px wide with unreadable text.

              So: share the width while they fit, and scroll once they do not.
              Squeezing past that point makes every tab useless rather than
              just the last few.
            */}
            <div
              className={`flex relative ${crowded ? "overflow-x-auto no-scrollbar" : ""}`}
              style={{ padding: "6px", gap: "2px", scrollSnapType: crowded ? "x proximity" : "none" }}
            >
              {allTabs.map(({ href, key, Icon }) => {
                const active = isActive(href);
                return (
                  <Link
                    key={key}
                    to={href}
                    onClick={() => setOpen(false)}
                    className="flex flex-col items-center justify-center shrink-0 relative"
                    style={{
                      // Fixed width once crowded, so text stays readable and
                      // the row scrolls instead.
                      flex: crowded ? "0 0 auto" : "1 1 0",
                      width: crowded ? `${tabWidth}px` : undefined,
                      minWidth: crowded ? `${tabWidth}px` : 0,
                      scrollSnapAlign: "center",
                      padding: "8px 2px",
                      borderRadius: "16px",
                      gap: "5px",
                      background: active ? "rgba(22,19,14,0.88)" : "transparent",
                      boxShadow: active ? "inset 0 1px 0 rgba(255,255,255,0.18)" : "none",
                      transition: "background 260ms ease",
                    }}
                  >
                    <Icon size={19} strokeWidth={1.6} color={active ? theme.bg : theme.ink} aria-hidden="true" />
                    {showLabels && (
                      <span
                        style={{
                          ...fontUtility,
                          fontSize: `${labelSize}px`,
                          letterSpacing: "0.02em",
                          color: active ? theme.bg : theme.ink,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          maxWidth: "100%",
                        }}
                      >
                        {t(key)}
                      </span>
                    )}
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
