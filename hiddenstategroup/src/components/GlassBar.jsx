import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Home, Newspaper, Disc, Briefcase, Users, Calendar, Radio, Info,
         Ticket, Shield, ScanLine, ClipboardList, Settings2, PenLine, Globe } from "lucide-react";
import { fontUtility, theme } from "./Shared";
import { useLang } from "../lib/lang";
import * as api from "../lib/api";
import { useSite } from "../lib/site";

/*
  GlassBar — floating navigation on phones.

    One tap   → open / close
    Two taps  → home
    Swipe     → the open bar scrolls sideways with snap, but only when the
                tabs genuinely do not fit

  ── WHAT MAKES GLASS READ AS GLASS ─────────────────────────────────────────
  Apple renders its glass in the OS, with a real refraction pass. A web page
  cannot do that. What it CAN do is reproduce the four things the eye actually
  reads, and skip the one it does not.

    1  IT MORPHS, IT DOES NOT SWAP.  The single biggest tell. Earlier this was
       two separate panels cross-fading — the pill faded out while the bar
       faded in, and for 200ms you saw both, ghosted. Real glass is one
       object that changes shape. So now it is one element whose width, height
       and corner radius spring from pill to bar, with the contents fading
       inside it. Nothing ever overlaps itself.

    2  THE EDGE IS WHERE THE LIGHT BENDS.  On a light paper background, glass
       does not read as a white outline — that reads as a drawn line, which is
       why an earlier version's bright rim was removed. It reads as a lit band
       just inside the top edge, a faint darkening at the outer edge, and a dim
       bounce along the underside. All of that is inset shadow: no blend
       modes, no masks, no nested backdrop filters, all of which have broken
       this site on iOS before.

    3  IT FLOATS ON THREE SHADOWS, NOT ONE.  A tight contact shadow, a mid
       ambient one, and a wide soft one. A single shadow reads as a sticker.

    4  THE SELECTION SLIDES.  iOS moves one lozenge between items rather than
       lighting up a new box. It is the difference between a control and a
       row of buttons.

  What is deliberately NOT attempted: sampling the colour behind the bar to
  tint itself, and true edge refraction. Both need the compositor. Faking them
  costs frames and looks worse than not trying.
*/

const DOUBLE_TAP_MS = 240;
// A spring with a little overshoot. Everything that changes shape uses this
// one curve, so the whole bar feels like a single piece of hardware.
const SPRING = "cubic-bezier(.32,1.5,.52,1)";
const EASE = "cubic-bezier(.4,0,.2,1)";

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

// The closed pill's size. Fixed rather than measured, because the morph has
// to know where it is going before it starts.
const PILL_W = 188;
const PILL_H = 52;
const BAR_H = 68;

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

  /*
    Someone who has asked their phone to stop animating things means it. The
    bar still opens and closes and the lozenge still moves — they just arrive
    rather than travel.
  */
  const [still, setStill] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = (e) => setStill(e.matches);
    onChange(mq);
    mq.addEventListener ? mq.addEventListener("change", onChange) : mq.addListener(onChange);
    return () => (mq.removeEventListener ? mq.removeEventListener("change", onChange) : mq.removeListener(onChange));
  }, []);

  const ms = (n) => (still ? 0 : n);

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
    The bar gains extra tabs depending on who is signed in:
      guest  → their own pass
      team   → the door tools
    Signed out, neither appears — a visitor sees no trace of them.
  */
  const [role, setRole] = useState(null);
  /*
    Read on the first render rather than in an effect. Reading it afterwards
    meant the bar briefly showed the finder link before switching to the
    direct one — a visible flicker on every page load for anyone who holds a
    pass.
  */
  const [guestPass, setGuestPass] = useState(() => api.getGuestPass());

  /*
    Ask the server who is signed in, rather than trusting anything the browser
    holds.

    WHEN THIS RUNS matters more than it looks. Route changes alone were not
    enough: the team login sits on the page it protects, so signing in as boss
    never changed the address, and the bar carried on showing a guest's tabs
    until you tapped something else or reloaded. So it also listens for the
    session announcement api.js makes whenever the token changes — which is
    the moment the login succeeds — and for the same change arriving from
    another tab.
  */
  const inFlight = useRef(0);

  const refresh = useCallback(() => {
    // Answers can come back out of order — a slow check started before
    // signing out must not overwrite the fast one started after it. Only the
    // most recent request is allowed to set the role.
    const ticket = ++inFlight.current;

    if (api.getToken()) {
      api.me().then((res) => {
        if (ticket !== inFlight.current) return;
        setRole(res.ok ? res.user : null);
      });
    } else {
      setRole(null);
    }

    setGuestPass(api.getGuestPass());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh, location.pathname, location.search]);

  useEffect(() => {
    window.addEventListener(api.AUTH_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(api.AUTH_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [refresh]);

  /*
    What the bar shows depends entirely on who is looking.

      signed out  → a way to their pass, nothing else
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
    if (role.can.issuePasses) teamTabs.push({ href: "/console?tab=posts", key: "write", Icon: PenLine });
    if (role.can.manageTeam) teamTabs.push({ href: "/console?tab=settings", key: "settings", Icon: Settings2 });
  }

  const passTab = {
    href: guestPass ? `/pass/${guestPass}` : "/mypass",
    key: "myPass",
    Icon: Ticket,
  };

  /*
    THE BAR HAS TWO JOBS, AND THEY DO NOT BELONG IN ONE ROW.

    Signed in as boss, eight public tabs and five team ones made thirteen —
    which on a phone meant scrolling sideways to reach the console, the very
    thing you signed in for.

    So the bar follows where you are. On the system's own pages it becomes the
    system's bar. Anywhere on the public site it stays the public bar, with a
    single CONSOLE tab to get back in. Neither ever needs to scroll, and
    browsing the site while signed in does not cost you the navigation.
  */
  const SYSTEM_PATHS = ["/console", "/scan", "/doorlist", "/admin", "/guestlist"];
  const onSystemPage = SYSTEM_PATHS.some((p) => location.pathname.startsWith(p));

  const extraTabs = role ? (onSystemPage ? teamTabs : [{ href: "/console", key: "team", Icon: Shield }]) : [passTab];

  const allTabs = role && onSystemPage
    ? [{ href: "/", key: "site", Icon: Globe }, ...extraTabs]
    : [...TABS, ...extraTabs];

  /*
    WHY THE BAR FELT SLOW.

    It was not the animation. Every tap sat in a 260ms timer first, waiting to
    find out whether a second tap was coming — so the bar could not begin to
    open until a quarter of a second after the finger landed, and no amount of
    tuning the transition was ever going to fix that.

    Now the first tap acts immediately and the double-tap is handled by UNDOING
    it: if a second tap lands inside the window, the bar closes again and goes
    home. Waiting to be sure costs every single tap; undoing costs only the
    rare double one.
  */
  const handleTap = () => {
    if (tapTimer.current) {
      clearTimeout(tapTimer.current);
      tapTimer.current = null;
      setOpen(false);
      navigate("/");
      return;
    }
    setOpen((o) => !o);
    if (navigator.vibrate) navigator.vibrate(6);
    tapTimer.current = setTimeout(() => { tapTimer.current = null; }, DOUBLE_TAP_MS);
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
  */
  const stageRef = useRef(null);
  const [available, setAvailable] = useState(0);

  useEffect(() => {
    const el = stageRef.current;
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
  */
  const isActive = (href) => {
    const [hrefPath, hrefQuery] = href.split("?");
    if (hrefPath === "/") return location.pathname === "/";
    if (!location.pathname.startsWith(hrefPath)) return false;

    const wanted = hrefQuery ? new URLSearchParams(hrefQuery).get("tab") : null;
    const current = new URLSearchParams(location.search).get("tab");
    return wanted ? current === wanted : !current;
  };

  const activeIndex = allTabs.findIndex((tb) => isActive(tb.href));

  /*
    THE SLIDING SELECTION.

    One lozenge, measured from the real tab elements and moved to wherever the
    selection now is. Lighting up a different box each time is what a row of
    buttons does; moving one piece is what a control does, and it is most of
    the reason the iOS bar feels like an object rather than a menu.

    It lives inside the scrolling row, so on a crowded bar it scrolls along
    with the tabs instead of hanging in mid-air.
  */
  const rowRef = useRef(null);
  const tabRefs = useRef({});
  const [lozenge, setLozenge] = useState(null);

  const [previewKey, setPreviewKey] = useState(null);

  /*
    ── THE GESTURE, THIRD TIME, AND THIS TIME BY SUBTRACTION ───────────────

    I built this twice and got it wrong twice, both times for the same reason:
    I took the gesture away from the browser and then tried to give it back by
    hand. `touch-action: none` is what let the bar recognise a drag — and it is
    also what turned scrolling from a native, inertial, rubber-banding thing
    into my own loop setting scrollLeft one pixel at a time. That is why it
    felt dead and why it never quite went where a thumb expected.

    So the touch gesture is the browser's again, completely:

      a phone       → the row is an ordinary horizontal scroller. Native
                      momentum, native bounce, native everything. Tap to choose.
      a mouse       → dragging slides the selection, because a mouse has no
                      scroll gesture to collide with and the bar fits anyway.

    No pointer capture, no manual panning, no touch-action override. The bar
    does less and works more.
  */
  const dragging = useRef(null);
  const draggedAt = useRef(0);

  const keyUnder = (clientX) => {
    for (const tb of allTabs) {
      const el = tabRefs.current[tb.key];
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (clientX >= r.left && clientX <= r.right) return tb.key;
    }
    return null;
  };

  /*
    Escape closes the bar.

    Anything that opens over the page has to be dismissible without a pointer,
    or a keyboard user who opens it is stuck in it. This is the smallest
    correct version of that rule: no focus trap, because the bar does not
    cover the page and tabbing out of it is a fine way to leave.
  */
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const onRowDown = (e) => {
    // Touch belongs to the scroller. Only a mouse drags the selection.
    if (e.pointerType !== "mouse" || e.button !== 0 || crowded) return;
    dragging.current = { x0: e.clientX, moved: false, key: null };
  };

  const onRowMove = (e) => {
    const d = dragging.current;
    if (!d) return;
    if (!d.moved) {
      if (Math.abs(e.clientX - d.x0) < 8) return;
      d.moved = true;
    }
    const key = keyUnder(e.clientX);
    if (key && key !== d.key) { d.key = key; setPreviewKey(key); }
  };

  const endRowDrag = () => {
    const d = dragging.current;
    dragging.current = null;
    if (!d || !d.moved) { setPreviewKey(null); return; }
    draggedAt.current = Date.now();      // the click that follows is not a tap
    const key = d.key;
    setPreviewKey(null);
    if (key) {
      const tb = allTabs.find((x) => x.key === key);
      if (tb) { setOpen(false); navigate(tb.href); }
    }
  };

  // A mouse drag ends in a click on whichever tab it left from. That click is
  // a side effect of the gesture, not a choice, so it is thrown away.
  const wasDrag = () => Date.now() - draggedAt.current < 300;

  // Nothing should slide into place the first time it is drawn — it should
  // already be there. Only a change of SELECTION travels.
  const hasPlaced = useRef(false);

  const activeKey = previewKey || (activeIndex >= 0 ? allTabs[activeIndex].key : null);

  useLayoutEffect(() => {
    if (!open || !activeKey) {
      hasPlaced.current = false;
      setLozenge(null);
      return;
    }

    const place = (correcting) => {
      const el = tabRefs.current[activeKey];
      // A tab with no width yet has not been laid out. Measuring it would
      // park the lozenge somewhere arbitrary, which is worse than waiting.
      if (!el || !el.offsetWidth) return;
      setLozenge({ x: el.offsetLeft, w: el.offsetWidth, animate: hasPlaced.current && !correcting });
      hasPlaced.current = true;
    };

    place(false);

    /*
      A scrolling row that opens showing tabs one to six, when the tab you are
      on is number nine, looks broken. Bring the lit one into view — but only
      once the panel has finished opening, because until then the row is as
      narrow as the pill and any scroll position worked out against that width
      is meaningless.
    */
    const bring = setTimeout(() => {
      const el = tabRefs.current[activeKey];
      const row = rowRef.current;
      if (!el || !row || row.scrollWidth <= row.clientWidth + 2) return;
      const want = el.offsetLeft - (row.clientWidth - el.offsetWidth) / 2;
      row.scrollLeft = Math.max(0, Math.min(want, row.scrollWidth - row.clientWidth));
    }, 300);

    /*
      Fonts arriving, the phone rotating, the bar being widened in settings:
      each moves the tabs without changing which one is lit. Those are
      corrections, so they snap. Only the selection itself slides.
    */
    if (typeof ResizeObserver === "undefined") return () => clearTimeout(bring);
    const observer = new ResizeObserver(() => place(true));
    if (rowRef.current) observer.observe(rowRef.current);
    return () => { clearTimeout(bring); observer.disconnect(); };
  }, [open, activeKey, available, crowded, tabWidth, showLabels]);

  /*
    THE MATERIAL.

    Clear rather than milky: an earlier version used a heavy opaque tint and
    read as frosted plastic. Real glass shows what is behind it, slightly
    brighter and slightly more saturated than it really is.
  */
  const glass = {
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.30) 0%, rgba(255,255,255,0.12) 42%, rgba(255,255,255,0.20) 100%)",
    backdropFilter: "blur(20px) saturate(190%) brightness(1.07)",
    WebkitBackdropFilter: "blur(20px) saturate(190%) brightness(1.07)",
    border: "1px solid rgba(22,19,14,0.09)",
    boxShadow: [
      // the lit band just inside the top edge — this is the light bending,
      // and it is why the panel reads as thick rather than as a rectangle
      "inset 0 1px 0 rgba(255,255,255,0.62)",
      "inset 0 6px 14px -8px rgba(255,255,255,0.55)",
      // the underside: dimmer, and slightly warm from the paper below it
      "inset 0 -1px 0 rgba(255,255,255,0.26)",
      "inset 0 -8px 16px -10px rgba(22,19,14,0.10)",
      // three shadows, not one. A single shadow reads as a sticker.
      "0 1px 1px rgba(22,19,14,0.05)",
      "0 8px 20px -6px rgba(22,19,14,0.10)",
      "0 26px 50px -18px rgba(22,19,14,0.16)",
    ].join(", "),
  };

  const sheenLayer = (
    <span
      aria-hidden="true"
      className="absolute inset-0"
      style={{
        borderRadius: "inherit",
        background: `radial-gradient(160px circle at ${sheen.x}% ${sheen.y}%, rgba(255,255,255,0.50), rgba(255,255,255,0) 66%)`,
        opacity: sheen.on ? 1 : 0,
        transition: `opacity ${ms(320)}ms ${EASE}`,
        pointerEvents: "none",
      }}
    />
  );

  const stageWidth = Math.min(1080, Math.max(560, allTabs.length * (tabWidth + 6)));

  return (
    <>
      {/*
        A scrim, so the open bar sits in front of the page rather than on it.
        Colour only — a full-screen backdrop-filter is what broke this site on
        iOS once, and it is not worth a second try.
      */}
      <div data-glassbar data-print="hide" className="fixed inset-0 z-[78] lg:hidden"
        onClick={() => setOpen(false)}
        aria-hidden="true"
        style={{
          background: "rgba(22,19,14,0.14)",
          opacity: open && !isDesktop ? 1 : 0,
          pointerEvents: open && !isDesktop ? "auto" : "none",
          transition: `opacity ${ms(200)}ms ${EASE}`,
        }}
      />

      <div data-glassbar data-print="hide" className="fixed left-0 right-0 z-[79] flex justify-center px-3"
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
          The stage is a fixed box the glass morphs inside. Measuring happens
          here, on something that never changes size mid-animation, so the
          "does it fit" answer cannot flicker while the bar is opening.
        */}
        <div
          ref={stageRef}
          className="relative w-full"
          style={{ height: `${BAR_H}px`, maxWidth: `${stageWidth}px` }}
        >
          {/*
            ONE piece of glass. Not two cross-fading.
          */}
          <div
            className="absolute overflow-hidden"
            onPointerDown={(e) => { if (!open) { setPressing(true); trackSheen(e); } }}
            onPointerMove={(e) => pressing && trackSheen(e)}
            onPointerUp={() => { setPressing(false); setSheen((s) => ({ ...s, on: false })); }}
            onPointerLeave={() => { setPressing(false); setSheen((s) => ({ ...s, on: false })); }}
            style={{
              ...glass,
              bottom: 0,
              /*
                CENTRED WITHOUT A TRANSFORM — ON PURPOSE.

                This was `left: 50%` plus `translateX(-50%)`, which is the
                normal way to centre something of unknown width. But this
                element also has `overflow: hidden` and a border-radius, and
                that trio is what makes Safari stop clipping transformed
                children. The bug does not need the child to be at fault; the
                PARENT having a transform is half of it.

                So the centring is done with left and a negative margin, both
                animatable, and the transform is left free for the press
                squash — which only ever happens while the bar is closed and
                there is nothing inside it to clip.
              */
              left: open ? "0%" : "50%",
              marginLeft: open ? "0px" : `-${PILL_W / 2}px`,
              width: open ? "100%" : `${PILL_W}px`,
              height: open ? `${BAR_H}px` : `${PILL_H}px`,
              borderRadius: open ? "26px" : "26px",
              transform: pressing && !open ? "scale(0.955)" : "none",
              transition: [
                `width ${ms(260)}ms ${SPRING}`,
                `height ${ms(260)}ms ${SPRING}`,
                `left ${ms(260)}ms ${SPRING}`,
                `margin-left ${ms(260)}ms ${SPRING}`,
                `transform ${ms(340)}ms ${SPRING}`,
              ].join(", "),
            }}
          >
            {sheenLayer}

            {/* ── closed: the pill's own contents ── */}
            <Link
              to="/"
              onClick={(e) => { e.preventDefault(); handleTap(); }}
              onContextMenu={(e) => e.preventDefault()}
              aria-label="Menu — tap once to open, twice for home"
              aria-expanded={open}
              className="absolute inset-0 flex items-center justify-center gap-3"
              style={{
                opacity: open ? 0 : 1,
                // The contents shrink slightly as the panel grows past them,
                // which reads as them receding into it rather than vanishing.
                transform: open ? "scale(0.92)" : "scale(1)",
                pointerEvents: open ? "none" : "auto",
                transition: `opacity ${ms(open ? 100 : 200)}ms ${EASE} ${ms(open ? 0 : 90)}ms, transform ${ms(320)}ms ${SPRING}`,
              }}
            >
              <span className="flex flex-col gap-[3.5px]" aria-hidden="true">
                <span style={{ width: "18px", height: "1.5px", background: theme.ink, display: "block" }} />
                <span style={{ width: "18px", height: "1.5px", background: theme.ink, display: "block" }} />
                <span style={{ width: "11px", height: "1.5px", background: theme.ink, display: "block" }} />
              </span>
              <span style={{ ...fontUtility, fontSize: "10.5px", letterSpacing: "0.2em", color: theme.ink }}>
                HIDDEN STATE
              </span>
            </Link>

            {/* ── open: the tabs ── */}
            <nav
              aria-label="Site navigation"
              className="absolute"
              style={{
                /*
                  NOTHING IN HERE MAY HAVE A TRANSFORM.

                  This row used to be pinned at its final width and centred
                  with translateX(-50%), so the panel could wipe open and
                  reveal it. On iOS that made the tabs spill out of the bar
                  entirely and run off the side of the screen while it opened.

                  The cause is a Safari bug worth remembering: an element with
                  `overflow: hidden` AND a border-radius AND a transform — the
                  glass panel has all three — stops clipping any child that has
                  a transform of its own. The clip silently switches off, and
                  the child renders wherever it likes.

                  So the row no longer relies on being clipped by the panel. It
                  fills the panel exactly, and its own `overflow-x: auto` does
                  the clipping — a plain scroller with no radius and no
                  transform, which every browser gets right.
                */
                inset: 0,
                opacity: open ? 1 : 0,
                pointerEvents: open ? "auto" : "none",
                transition: `opacity ${ms(open ? 130 : 80)}ms ${EASE} ${ms(open ? 40 : 0)}ms`,
              }}
            >
              <div
                ref={rowRef}
                className={`flex relative h-full ${crowded ? "overflow-x-auto no-scrollbar" : ""}`}
                onPointerDown={onRowDown}
                onPointerMove={onRowMove}
                onPointerUp={endRowDrag}
                onPointerLeave={endRowDrag}
                style={{
                  padding: "6px",
                  gap: "2px",
                  // Horizontal belongs to the scroller, vertical to the page.
                  // Nothing is taken away from the browser here.
                  touchAction: crowded ? "pan-x" : "manipulation",
                  WebkitOverflowScrolling: "touch",
                  overscrollBehaviorX: "contain",
                  /*
                    The row clips its own contents in BOTH states, not only
                    when it scrolls. The tabs and the lozenge animate with
                    transforms, and a transformed child is exactly what the
                    panel's overflow stops clipping on iOS — so the clip has to
                    live here, on an element with no radius and no transform of
                    its own.
                  */
                  overflowX: crowded ? "auto" : "hidden",
                  overflowY: "hidden",
                }}
              >
                {/*
                  The lozenge. One of them, moved — never a background switched
                  on and off.
                */}
                {lozenge && (
                  <span
                    aria-hidden="true"
                    className="absolute"
                    style={{
                      top: "6px",
                      bottom: "6px",
                      left: 0,
                      width: `${lozenge.w}px`,
                      transform: `translateX(${lozenge.x}px)`,
                      borderRadius: "16px",
                      background: theme.ink,
                      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.20), 0 2px 8px -2px rgba(22,19,14,0.35)",
                      transition: lozenge.animate
                        ? `transform ${ms(380)}ms ${SPRING}, width ${ms(380)}ms ${SPRING}`
                        : "none",
                      pointerEvents: "none",
                    }}
                  />
                )}

                {allTabs.map(({ href, key, Icon }, i) => {
                  /*
                    LIT BY THE SAME KEY THAT MOVES THE LOZENGE.

                    This used to read `i === activeIndex` — the route's tab —
                    while the lozenge followed `activeKey`, which is the route's
                    tab OR the one a finger is currently over. The two disagreed
                    the moment you dragged, and both halves of that disagreement
                    were visible:

                      the tab under the lozenge kept its dark ink, so it went
                      black-on-black and the icon vanished into a hole;

                      the tab the lozenge had left kept its light ink, so it
                      went white-on-glass and looked empty.

                    One key now decides both.
                  */
                  const active = key === activeKey;
                  return (
                    <Link
                      key={key}
                      ref={(el) => { tabRefs.current[key] = el; }}
                      to={href}
                      /* Says "you are here" to a screen reader. The lozenge
                         says it to everybody else. */
                      aria-current={active ? "page" : undefined}
                      onClick={(e) => {
                        if (wasDrag()) { e.preventDefault(); return; }
                        setOpen(false);
                      }}
                      draggable={false}
                      className="flex flex-col items-center justify-center shrink-0 relative"
                      style={{
                        flex: crowded ? "0 0 auto" : "1 1 0",
                        width: crowded ? `${tabWidth}px` : undefined,
                        minWidth: crowded ? `${tabWidth}px` : 0,
                          padding: "8px 2px",
                        borderRadius: "16px",
                        gap: "5px",
                        // Each tab arrives a beat after the one before it.
                        // Together they read as the bar unrolling rather than
                        // as eight things appearing at once.
                        opacity: open ? 1 : 0,
                        transform: open ? "translateY(0)" : "translateY(7px)",
                        /*
                          The stagger is gone. Ten milliseconds per tab looks
                          considered in a design tool and reads as LAG on a
                          phone: the last tab of nine arrived 150ms after the
                          first, which is exactly the window in which a thumb
                          is already reaching for it. They arrive together now.
                        */
                        transition: [
                          `opacity ${ms(130)}ms ${EASE} ${ms(open ? 40 : 0)}ms`,
                          `transform ${ms(220)}ms ${SPRING} ${ms(open ? 40 : 0)}ms`,
                        ].join(", "),
                      }}
                    >
                      <Icon size={19} strokeWidth={1.6} color={active ? theme.bg : theme.ink} aria-hidden="true"
                            style={{ transition: `color ${ms(300)}ms ${EASE}` }} />
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
                            transition: `color ${ms(300)}ms ${EASE}`,
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
      </div>
    </>
  );
}
