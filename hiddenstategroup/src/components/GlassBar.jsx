import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Home, Newspaper, Disc, Briefcase, Users, Calendar, Radio, Info,
         Ticket, Shield, ScanLine, ClipboardList, Settings2, PenLine, Globe } from "lucide-react";
import { fontUtility, theme } from "./Shared";
import { useLang } from "../lib/lang";
import * as api from "../lib/api";
import { useSite } from "../lib/site";
import { Spring, springSet, driveSprings, glassStyle, lipStyle, specStyle,
         lozengeStyle, resolveFinish } from "../lib/liquid";

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
const PILL_W = 190;
const PILL_H = 58;
const BAR_H = 76;

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

  /*
    The specular leans with a drag. Written straight to the node rather than
    held in state: this fires on every pointermove, and a re-render per move
    would recompute the tab list, the permissions and the layout each time.
  */
  const drift = useRef(0);
  const leanTo = (px) => {
    drift.current = Math.max(-18, Math.min(18, px));
    if (specRef.current) {
      specRef.current.style.transform = `translate3d(${drift.current}px,0,0)`;
    }
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

  /*
    ── THE SELECTION LEAVES ON THE TOUCH, NOT ON THE ROUTE ──────────────────

    THIS IS THE WHOLE REASON THE BAR FELT LATE, AND IT IS NOT A CURVE.

    Until now nothing moved until React had been all the way round the loop.
    Touch a tab and the sequence was: the Link navigates; the router updates
    the location; the component re-renders; a layout effect measures the tab
    and calls setLozenge, which renders AGAIN; a second layout effect finally
    hands the number to the spring. Only then does the first frame of motion
    exist — and hanging off that same render is the destination page mounting,
    which on a phone is a lazy chunk, a Suspense boundary and a whole subtree.

    So the pill was never slow. It was ON TIME, and it was starting a couple
    of hundred milliseconds after the finger, from behind a page mount. That
    is a different fault from a soft spring and no amount of stiffening would
    have touched it. It is also exactly what "it doesn't respect the movement"
    describes: the motion had come loose from the gesture that caused it.

    So it moves on POINTERDOWN — before the click, before the navigation,
    before any render — by measuring the tab straight off the DOM and handing
    the numbers to the spring. Nothing goes through state, so nothing
    re-renders; the route-driven effect below arrives at the same target a
    moment later and finds the spring already on its way there.

    A touch that turns into a SCROLL rather than a tap has to give the pill
    back, which is what leadBack is for: the browser fires pointercancel the
    instant a scroller claims the gesture, and the selection returns to
    wherever the route actually is.
  */
  const leadTo = useCallback((key) => {
    if (!hasPlaced.current) return;      // nothing has been measured yet
    const el = tabRefs.current[key];
    if (!el || !el.offsetWidth) return;
    rig.current?.to({ lx: el.offsetLeft, lw: el.offsetWidth });
  }, []);

  const activeKey = previewKey || (activeIndex >= 0 ? allTabs[activeIndex].key : null);

  // A gesture that became a scroll gives the selection back to the route.
  const leadBack = useCallback(() => {
    if (activeKey) leadTo(activeKey);
  }, [activeKey, leadTo]);

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
  /*
    THE MATERIAL now comes from lib/liquid.js, so the bar and anything else
    dressed in glass cannot drift apart. `finish` is a console setting.

    What changed from the old hand-written block: the backdrop is CONTRAST
    RE-MAPPED rather than merely blurred and tinted, which is what keeps the
    labels readable over a photograph as well as over paper; the single-pixel
    border became a masked lip with a faint warm/cool split, because glass is
    thick and thickness reads as bent light rather than an outline; and the
    specular drifts instead of sitting still.
  */
  const finish = site.barFinish || "INK";
  /*
    THE THREE NUMBERS THE CONSOLE CAN MOVE. Undefined means "whatever the
    finish itself says", so a site that has never touched the settings gets
    the designed values and nothing has to be seeded into the database.
  */
  const tune = {
    darkness: site.barDarkness,
    blur: site.barBlur,
    saturation: site.barSaturation,
  };
  const mat = resolveFinish(finish, tune);
  const glass = glassStyle(finish, theme.ink, tune);

  /*
    HOW FAST, as a multiplier rather than a duration. Above one is quicker.
    Bounded on both sides: below about a half the bar reads as syrup, and
    above two the springs are moving further per frame than the integrator
    can follow honestly.
  */
  const speed = Math.max(0.5, Math.min(2, Number(site.barSpeed) || 1));

  /*
    Two layers over the pane, under the contents: the lip that gives the edge
    thickness, and the specular streak that drifts with a drag. The old
    radial "sheen" that followed the finger is gone — it read as a torch being
    shone on a surface rather than as light behaving.
  */
  const specRef = useRef(null);
  const lipLayer = <span aria-hidden="true" style={lipStyle(finish, tune)} />;
  const specLayer = <span ref={specRef} aria-hidden="true" style={specStyle(finish, 0, tune)} />;

  /*
    ── THE GEOMETRY, ON SPRINGS ───────────────────────────────────────────

    The pill and the open bar are the same pane at two sizes, and the pane
    travels between them on springs rather than a CSS transition.

    WHY THIS IS WORTH THE EXTRA CODE. A transition has a duration, and a
    duration cannot be interrupted: tap the bar twice quickly and the second
    transition restarts from a standstill — the motion stops dead and begins
    again. That dead stop is the "slow, sticky" feeling that survived every
    round of easing-curve tuning, because the curve was never the problem.
    A spring has velocity, and when the target changes it carries that
    velocity into the new one.

    The press squash lives on the same loop, so a tap that lands mid-open
    blends into the movement already happening instead of fighting it.

    Nothing here goes through state: this writes to the node about sixty
    times a second, and a re-render at that rate would recompute the tab
    list, the permissions and the layout every frame.
  */
  const paneRef = useRef(null);
  const stageW = useRef(0);
  /*
    The last geometry actually written to each node, so a frame that would
    write the same pixel writes nothing at all. See the writer below.
  */
  const paneGeom = useRef({ w: -1, h: -1, m: -1, r: -1, s: -1 });
  const lozGeom = useRef({ x: -1, w: -1 });

  const springs = useRef(null);
  if (!springs.current) {
    const K = springSet(speed);
    springs.current = {
      /*
        LOWER DAMPING THAN BEFORE, ON PURPOSE.

        At damping 26 against stiffness 250 this was very nearly critically
        damped — it arrived exactly on its mark and stopped, which is correct
        and lifeless. Liquid does not stop; it arrives, goes very slightly
        past, and settles. Twenty is enough overshoot to read as weight and
        not enough to read as a bounce.

        The width is the wobbliest and the height the tightest, which is the
        right way round: a widening capsule reads as something being poured
        sideways, and a height that overshoots just looks like a mistake.
      */
      w: new Spring(PILL_W, K.w),
      h: new Spring(PILL_H, K.h),
      m: new Spring(-PILL_W / 2, K.m),
      /*
        THE RADIUS IS SPRUNG TOO. A capsule whose corners snap while its
        width flows is the one detail that gives away that a shape is being
        resized rather than poured. Damped a little less than the rest so the
        corners arrive just after the edges do — which is what a heavy liquid
        actually does.
      */
      r: new Spring(PILL_H / 2, K.r),
      s: new Spring(1, K.s),
      /*
        THE SELECTION, ON THE SAME LOOP AS EVERYTHING ELSE.

        This used to be a CSS transition plus a `stretch` value held in state
        and cleared by a 250ms timer, and it was wrong three ways at once:

          · the timer (250ms) was shorter than the transition (520ms), so the
            width was still travelling outward when it was told to come back.
            It never reached its target and never rested — it just wobbled.
          · the stretch was added to the width while the transform was already
            at the destination, so the capsule grew OUT FROM the tab it had
            arrived at instead of reaching ACROSS to it. On a short hop the
            movement is only a few pixels, so what you actually saw was a pill
            sitting still and inflating.
          · the direction test read `lastX.current`, which the effect had
            already overwritten with the new position one tick earlier. It was
            comparing a number to itself, so it was false every time and the
            leftward case never ran at all.

        None of that is tunable. The whole idea was wrong: a stretch is not a
        thing you schedule, it is a thing that FALLS OUT of moving fast. So
        the position and width are springs now, and the stretch is read from
        the position spring's velocity every frame — which means it is exactly
        zero at rest, largest in the middle of the flight, and self-correcting
        if you tap somewhere else halfway through. No timer to get wrong.
      */
      lx: new Spring(0, K.lx),
      lw: new Spring(0, K.lw),
    };
  }

  const rig = useRef(null);
  /*
    A LAYOUT effect, not an ordinary one. The pane has no inline width until
    this rig writes one, and an ordinary effect runs after the browser has
    already painted — which is one frame of a full-width, unstyled bar before
    it snaps to a pill. Layout effects run before that paint.
  */
  useLayoutEffect(() => {
    rig.current = driveSprings(
      springs.current,
      ({ w, h, m, r, s, lx, lw }) => {
        /*
          THE SELECTION, WRITTEN FROM ITS OWN VELOCITY.

          `extra` is how far the capsule is stretched, and it is read from how
          fast it is travelling — not from a timer, not from how far it has to
          go. At rest the velocity is zero, so the stretch is zero and the
          capsule is exactly the width of the tab it is on. There is no state
          to leave behind and nothing to clean up.

          WHICH END LEADS. Moving right, the right edge runs ahead and the
          left edge stays put: the left is `lx` and the width grows. Moving
          left, the left edge leads, so the left is pulled back by the same
          amount. That is the difference between a capsule reaching across to
          the next tab and one inflating where it stands.

          Stretched by WIDTH, never scaleX — scaling a capsule turns its round
          ends into ellipses and it stops reading as liquid.
        */
        const loz = lozRef.current;
        if (loz) {
          /*
            THE STRETCH, AS A LENGTH — NOT AS A VELOCITY.

            This was |velocity| x 0.045, capped at 72px, and both halves were
            wrong. Velocity is pixels per second, so the coefficient silently
            depended on how stiff the spring happened to be: making the bar
            quicker — which is exactly what "less slow" means — would have
            made the capsule stretch FURTHER on the same journey. And 72px of
            stretch on a 64px tab is the selection more than doubling in width
            in mid-air, which is what read as a glitch.

            Dividing by the spring's own natural frequency turns a velocity
            back into a DISTANCE: how far the capsule would coast if it were
            let go. That is the same size at every speed setting, which is the
            point, and it is bounded by the capsule's own width so a narrow
            tab cannot throw a long smear across its neighbours.
          */
          const sp = springs.current.lx;
          const reach = Math.abs(sp.vel) / Math.sqrt(sp.k / sp.m);
          const extra = Math.min(reach * 0.34, lw * 0.5, 28);
          const width = Math.round(lw + extra);
          const left = Math.round(lx - (sp.vel < 0 ? extra : 0));
          const g = lozGeom.current;
          if (width !== g.w) {
            loz.style.width = width + "px";
            loz.style.borderRadius = Math.min(20, width / 2) + "px";
            g.w = width;
          }
          if (left !== g.x) {
            loz.style.transform = `translate3d(${left}px,0,0)`;
            g.x = left;
          }
        }

        const node = paneRef.current;
        if (!node) return;
        /*
          ── WHY THESE ARE ROUNDED, AND ONLY WRITTEN WHEN THEY CHANGE ────────

          This node carries a backdrop-filter. Changing its WIDTH or HEIGHT
          does not merely move it — it invalidates the blur, and the
          compositor re-samples and re-blurs everything behind the bar. That
          is by a wide margin the most expensive thing happening on screen.

          Unrounded, it happened on every frame of every movement INCLUDING
          the long tail, where the spring is creeping the last half-pixel into
          place: about ten frames of full-price re-blur for a change nobody
          can see. Rounding to whole pixels and skipping writes that would not
          change anything removes those frames outright — and they are exactly
          the frames, at the end of a gesture, that a phone was dropping.
        */
        const W = Math.round(w), H = Math.round(h), M = Math.round(m), R = Math.round(r);
        const pg = paneGeom.current;
        if (W !== pg.w) { node.style.width = W + "px"; pg.w = W; }
        if (H !== pg.h) { node.style.height = H + "px"; pg.h = H; }
        if (M !== pg.m) { node.style.marginLeft = M + "px"; pg.m = M; }
        if (R !== pg.r) { node.style.borderRadius = R + "px"; pg.r = R; }
        /*
          THE SQUASH GOES ON THE STAGE, NOT ON THE PANE.

          The pane clips and has a border-radius; adding a transform to that
          pair is the exact Safari combination that stopped it clipping its
          children and threw the tabs off the side of the screen. The stage
          does neither, so scaling it is free — and scaling the parent moves
          the glass and its contents together, which is what a squashed
          physical object does anyway.
        */
        const stage = stageRef.current;
        if (stage) {
          /*
            `s === 1` was an exact float comparison against a spring, and a
            spring settles to WITHIN a tolerance rather than onto a number. It
            came to rest at about .998 and stayed there — so the stage kept a
            transform forever, and a permanent transform on the ancestor of a
            clipping, rounded box is precisely the Safari combination this
            file spends three comments warning about. It is snapped and
            cleared instead.
          */
          const S = Math.abs(s - 1) < 0.003 ? 1 : Math.round(s * 1000) / 1000;
          if (S !== paneGeom.current.s) {
            stage.style.transformOrigin = "50% 100%";
            stage.style.transform = S === 1 ? "none" : `scale(${S})`;
            paneGeom.current.s = S;
          }
        }
      },
      () => still
    );
    // Size it immediately, so the first painted frame is already correct.
    rig.current.set({ w: PILL_W, h: PILL_H, m: -PILL_W / 2, r: PILL_H / 2, s: 1, lx: 0, lw: 0 });
    rig.current.kick();
    return () => rig.current?.stop();
  }, [still]);

  /*
    RETUNED IN PLACE when the console changes the speed, never rebuilt. A
    spring carries a position AND a velocity; throwing it away for a new one
    would drop both, and the bar would jump if the slider were moved while it
    happened to be moving.
  */
  useEffect(() => {
    rig.current?.tune(springSet(speed));
  }, [speed]);

  /*
    Targets. The open bar fills the stage, so its width is measured rather
    than assumed — a percentage cannot be sprung.
  */
  useLayoutEffect(() => {
    const node = stageRef.current;
    if (node) stageW.current = node.getBoundingClientRect().width;
    const w = open ? (stageW.current || PILL_W) : PILL_W;
    const h = open ? BAR_H : PILL_H;
    rig.current?.to({
      w,
      h,
      m: open ? -(w / 2) : -PILL_W / 2,
      // A full capsule, always — the radius follows the height rather than
      // being a number someone chose once.
      r: h / 2,
      s: pressing && !open ? 0.938 : 1,
    });
  }, [open, pressing, available, allTabs.length]);


  /*
    Hand the measured position to the springs.

    `animate` is false the first time a selection appears and on a correction
    (fonts landing, the phone rotating) — those SNAP, because a lozenge that
    slides in from nowhere on load reads as a bug. Only a change of selection
    travels, and it travels because the target moved, not because anything
    told it to animate.

    A LAYOUT effect, so the node carries the right position before the browser
    paints the frame it first appears in.
  */
  const lozRef = useRef(null);
  useLayoutEffect(() => {
    const node = lozRef.current;
    if (!lozenge) {
      if (node) node.style.opacity = "0";
      return;
    }
    if (lozenge.animate) rig.current?.to({ lx: lozenge.x, lw: lozenge.w });
    else rig.current?.set({ lx: lozenge.x, lw: lozenge.w });
    if (node) node.style.opacity = "1";
  }, [lozenge]);

  /*
    WHAT COLOUR THE TABS ARE, now that the selection is a LIGHT lens instead
    of a black block.

    This is not cosmetic. The old rule was `active ? theme.bg : theme.ink` —
    cream on near-black. Put that same cream on the new pale lens and the
    selected tab becomes invisible, which is the worst possible thing for the
    one tab that must always be readable. So the lit colour follows the
    finish: ink on the pale finishes, stock on the dark one, and the accent
    for the label so the selection is signalled by more than a shape.
  */
  /*
    Which way round the labels go is now decided by how dark the glass ACTUALLY
    is, not by which finish was chosen. INK dialled down to a tenth is a pale
    pane, and cream lettering on it is invisible — the same failure the old
    `active ? theme.bg : theme.ink` rule had, one level up.
  */
  const onDark = mat.dark && mat.darkness >= 34;
  const onGlass = onDark ? theme.bg : theme.ink;
  const litInk = onDark ? theme.bg : theme.brass;

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
            onPointerDown={() => { if (!open) setPressing(true); }}
            
            onPointerUp={() => { setPressing(false); leanTo(0); }}
            onPointerLeave={() => { setPressing(false); leanTo(0); }}
            ref={paneRef}
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
              /*
                WIDTH, HEIGHT, MARGIN AND SCALE ARE NOT SET HERE.

                They are driven by springs writing straight to this node, in
                the effect below. React must not also write them or the two
                fight every frame — whichever ran last would win, and the
                animation would stutter in a way that looks like a dropped
                frame and is actually a disagreement.

                `left` stays at 0 and the centring is done with margin-left,
                for the same reason as before: this element clips and has a
                radius, and adding a transform to that pair is what makes
                Safari stop clipping its children.
              */
              left: "50%",
            }}
          >
            {lipLayer}
            {specLayer}

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
                <span
                  aria-hidden="true"
                  className="absolute"
                  ref={lozRef}
                  style={{
                    /*
                      A ROUNDED RECTANGLE, NOT A CIRCLE.

                      This stretched from 6px below the top to 6px above the
                      bottom, which at a 76px bar is 64px tall — TALLER than a
                      tab is wide once there are nine of them. With a full
                      capsule radius on top of that, the selection stopped
                      being a lozenge and became a circle sitting behind the
                      icon, which is what it looked like on the live site.

                      So it is sized to its CONTENTS — an icon and a label,
                      about 46px — and centred.
                    */
                    top: "50%",
                    height: "46px",
                    marginTop: "-23px",
                    left: 0,

                    /*
                      WIDTH, TRANSFORM AND RADIUS ARE NOT SET HERE.

                      They belong to the spring loop, which writes them
                      straight to this node about sixty times a second. Naming
                      any of them in this style object would mean React
                      reasserting a stale value on its next render and
                      snatching the capsule back mid-flight — which is a real
                      bug, not a theoretical one.

                      The element is always mounted and hidden with opacity
                      instead of being conditionally rendered, so the loop
                      always has something to write to and there is never a
                      frame where a freshly-mounted node has no geometry.
                    */
                    opacity: 0,

                    /*
                      A thicker piece of the same glass, not a black block cut
                      out of it. The old solid fill was the single thing that
                      most made this bar read as a website: the selected tab
                      became a different material instead of a deeper part of
                      the same one.
                    */
                    ...lozengeStyle(finish, tune),
                    pointerEvents: "none",
                  }}
                />

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
                      onPointerDown={() => leadTo(key)}
                      onPointerCancel={leadBack}
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
                        // A capsule, to match the lens that lands behind it.
                        borderRadius: "999px",
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
                      <Icon size={19} strokeWidth={active ? 1.9 : 1.6} color={active ? litInk : onGlass} aria-hidden="true"
                            style={{ transition: `color ${ms(300)}ms ${EASE}` }} />
                      {showLabels && (
                        <span
                          style={{
                            ...fontUtility,
                            fontSize: `${labelSize}px`,
                            letterSpacing: "0.02em",
                            color: active ? litInk : onGlass,
                            fontWeight: active ? 700 : 400,
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
