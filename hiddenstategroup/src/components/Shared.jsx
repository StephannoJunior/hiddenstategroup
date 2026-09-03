import Img from "./Img";
import React, { useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { X, Search } from "lucide-react";
import { MARK_SJ, MARK_SEAL, MARK_NOPROBLEM } from "../lib/marks";
import { ARTISTS } from "../lib/data";
import { SOCIAL } from "../lib/social";
import { LiveDateline, LanguageSwitch } from "./Dateline";
import { useLang } from "../lib/lang";
import { useSite } from "../lib/site";
import { FORM_ENDPOINT, CONTACT_EMAIL, BOOKING_EMAIL } from "../lib/config";

/*
  Shared furniture: the masthead, the footer, the wordmark, the booking form,
  and the primitives of the Sleeve & Index system defined just below.
  Every page imports from here rather than redefining its own copy.
*/

import { theme, fontDisplay, fontText, fontUtility, fontBody, fontMasthead } from "../lib/theme";
// Re-exported so every page keeps importing its tokens from one place.
export { theme, fontDisplay, fontText, fontUtility, fontBody, fontMasthead };

export function useGoogleFonts() {
  useEffect(() => {
    const id = "hs-fonts";
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Bodoni+Moda:ital,opsz,wght@0,6..96,400;0,6..96,700;0,6..96,900;1,6..96,400;1,6..96,700&family=EB+Garamond:ital,wght@0,400;0,500;1,400&family=Space+Mono:ital,wght@0,400;0,700;1,400&display=swap";
    document.head.appendChild(link);
  }, []);
}

/*
  ── THE INDEX REGISTER ────────────────────────────────────────────────────
  An ink band of metadata. Facts the page would otherwise have to say in a
  sentence, worn on the outside instead: dates, counts, catalogue numbers.
  Give it two to five pairs — more and it stops scanning.
*/
/*
  ── PRINT FURNITURE ───────────────────────────────────────────────────────
  Three details that separate ink on paper from a black rectangle on a beige
  website. None of them uses a blend mode, a full-screen overlay or a sticky
  panel — the three things that have broken this site on iOS.
*/

// Ink soaks. A black band laid on paper darkens the fibres just below it, and
// that faint halo is most of why real print reads as pressed rather than
// placed. Six pixels of it, under every band on the site.
export function Bleed() {
  return (
    <span aria-hidden="true" className="block" style={{
      height: "7px", marginTop: "-1px",
      background: "linear-gradient(rgba(20,18,14,0.20), rgba(20,18,14,0))",
    }} />
  );
}

// Registration marks — the crosshairs a printer uses to line up each colour
// pass. Here they mark where one register hands over to the other.
export function RegMark({ color }) {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" aria-hidden="true" style={{ display: "block", opacity: 0.55 }}>
      <circle cx="5.5" cy="5.5" r="3.4" fill="none" stroke={color || theme.brass} strokeWidth="0.7" />
      <path d="M5.5 0v11M0 5.5h11" stroke={color || theme.brass} strokeWidth="0.7" />
    </svg>
  );
}

/*
  A halftone screen. Photographs in print are not continuous tone — they are
  a field of dots, and at this size the eye reads the dots as ink rather than
  as pixels. Laid over the picture at low opacity, no blend mode involved.
*/
export function Halftone({ opacity = 0.26, size = 4 }) {
  // Turned off in the console gives clean, modern photography instead.
  const site = useSite();
  if (site.photoHalftone === false) return null;
  return (
    <span aria-hidden="true" className="absolute inset-0" style={{
      backgroundImage: "radial-gradient(circle at center, rgba(20,18,14,0.62) 0.8px, rgba(20,18,14,0) 1.1px)",
      backgroundSize: `${size}px ${size}px`,
      opacity,
      pointerEvents: "none",
    }} />
  );
}

export function IndexBand({ items, top = false }) {
  /*
    `top` is for a band that opens a page. The masthead is fixed, so anything
    at the very top of a page has to be pushed clear of it by hand — the same
    104px every page already carries, topped up on desktop where the masthead
    is taller.
  */
  return (
    <div className={top ? "pt-[104px] lg:pt-[124px]" : undefined}
         style={{ background: top ? theme.bg : undefined }}>
    <div style={{ background: theme.ink, color: theme.bg }}>
      <div className="max-w-[1180px] mx-auto grid"
           style={{ gridTemplateColumns: "repeat(auto-fit, minmax(112px, 1fr))" }}>
        {items.map((it, i) => (
          <div key={it.label}
               style={{ ...fontUtility, fontSize: "9.5px", letterSpacing: "0.14em",
                        padding: "10px 14px", color: "rgba(237,228,208,0.58)",
                        borderRight: i < items.length - 1 ? "1px solid rgba(237,228,208,0.16)" : undefined }}>
            {it.label}
            <b style={{ display: "block", color: theme.bg, fontWeight: 700, fontSize: "11px", marginTop: "4px" }}>
              {it.value}
            </b>
          </div>
        ))}
      </div>
    </div>
    <Bleed />
    </div>
  );
}

/*
  A contact sheet. Photographs as evidence rather than as moments: uniform,
  greyscale, numbered. Individually ordinary pictures read as a strong set,
  which is what a growing archive actually has.
*/
export function ContactSheet({ frames, note }) {
  /*
    A CONTACT SHEET IS PRINTED FROM NEGATIVES, AND A NEGATIVE HAS A SHAPE.

    These cells used to be a fixed 150px tall, which is landscape — so a 3:4
    portrait got squeezed into it and the subject's head ended up cropped off
    near the top edge. A photograph of a person that cuts the person is not a
    smaller photograph, it is a different one.

    So the cells are portrait, the way 35mm frames are when the camera is
    held upright, and each frame can say where its subject sits. `pos`
    defaults to a third of the way down, which is where a face lands in
    almost every portrait ever taken.
  */
  return (
    <section style={{ background: theme.bg }}>
      <div className="max-w-[1180px] mx-auto">
        <div className="flex justify-between items-center" style={{ ...fontUtility, fontSize: "9.5px",
             letterSpacing: "0.18em", color: theme.ink2, padding: "11px 18px",
             borderTop: `1px solid ${theme.rule}`, borderBottom: `1px solid ${theme.rule}` }}>
          <span className="flex items-center gap-3"><RegMark /> CONTACT SHEET</span>
          <span>{note || `${String(frames.length).padStart(2, "0")} FRAMES`}</span>
        </div>
        <div className="grid" style={{ gap: "1px", background: theme.rule,
             gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
          {frames.map((f, i) => (
            <figure key={f.src} className="m-0 relative" style={{ background: theme.bg }}>
              <Img src={f.src} alt={f.alt || ""}
                   style={{ width: "100%", aspectRatio: "3 / 4", objectFit: "cover",
                            objectPosition: f.pos || "center 32%",
                            filter: "grayscale(1) contrast(1.12) brightness(1.02)" }} />
              <Halftone opacity={0.22} size={3} />
              <figcaption style={{ ...fontUtility, position: "absolute", top: 0, left: 0,
                          background: theme.ink, color: theme.bg, fontSize: "9px",
                          padding: "2px 6px", letterSpacing: "0.08em" }}>
                {String(i + 1).padStart(2, "0")}
              </figcaption>
              {f.caption && (
                <figcaption style={{ ...fontUtility, position: "absolute", left: 0, right: 0, bottom: 0,
                            background: "rgba(20,18,14,0.82)", color: theme.bg, fontSize: "8.5px",
                            padding: "5px 7px", letterSpacing: "0.16em" }}>
                  {f.caption}
                </figcaption>
              )}
            </figure>
          ))}
        </div>
        <div style={{ borderBottom: `1px solid ${theme.rule}` }} />
      </div>
    </section>
  );
}

/*
  A full-height portrait, printed as a plate rather than dropped into a grid.
  Kept separate from the contact sheet on purpose: a sheet is evidence, a
  plate is a portrait, and the same picture should not do both jobs at once.
*/
export function Plate({ src, alt, caption, credit }) {
  return (
    <figure className="m-0 relative" style={{ background: theme.ink }}>
      <Img src={src} alt={alt || ""}
           style={{ width: "100%", aspectRatio: "3 / 4", objectFit: "cover",
                    objectPosition: "center 28%",
                    filter: "grayscale(1) contrast(1.10) sepia(0.20) brightness(1.04)" }} />
      <Halftone opacity={0.20} size={3} />
      {(caption || credit) && (
        <figcaption className="flex justify-between gap-4" style={{ ...fontUtility, fontSize: "9px",
                    letterSpacing: "0.16em", color: theme.ink2, background: theme.bg,
                    padding: "9px 2px 0", borderTop: `1px solid ${theme.rule}`, marginTop: "7px" }}>
          <span>{caption}</span><span>{credit}</span>
        </figcaption>
      )}
    </figure>
  );
}

/*
  A numbered entry. The number is real information — these are catalogue
  positions, not decoration — so it is set in the accent and in mono.
*/
export function Entry({ n, title, children, invert = false }) {
  // On ink, oxblood goes nearly black. The number keeps its job by going to
  // the stock colour instead — the accent is not load-bearing here.
  const rule = invert ? "rgba(237,228,208,0.20)" : theme.rule;
  const num = invert ? "rgba(237,228,208,0.62)" : theme.brass;
  const head = invert ? theme.bg : theme.ink;
  const body = invert ? "rgba(237,228,208,0.72)" : theme.ink2;
  return (
    <div className="grid items-start" style={{ gridTemplateColumns: "46px 1fr", gap: "16px",
         padding: "22px 0", borderBottom: `1px solid ${rule}` }}>
      <span style={{ ...fontUtility, fontSize: "11px", color: num, paddingTop: "9px" }}>{n}</span>
      <div>
        <h3 className="m-0 mb-1.5" style={{ ...fontDisplay, fontWeight: 700, fontSize: "clamp(24px,4.4vw,34px)",
            letterSpacing: "-0.018em", color: head }}>{title}</h3>
        <p className="m-0" style={{ ...fontText, fontSize: "17px", lineHeight: 1.55,
           color: body, maxWidth: "54ch" }}>{children}</p>
      </div>
    </div>
  );
}

/*
  ── AN INK-GROUND SECTION ─────────────────────────────────────────────────
  Not a band — a whole stretch of page that goes black and comes back. It is
  the loudest move in the system, so it is used once or twice per page at
  most; a site that is half black has no black in it.
*/
export function InkSection({ children, className = "" }) {
  return (
    <>
      <section className={className} style={{ background: theme.ink, color: theme.bg }}>
        <div className="max-w-[1180px] mx-auto px-[18px] py-12">{children}</div>
      </section>
      <Bleed />
    </>
  );
}

/*
  Every page opened the same way: a centred title between a thick rule and a
  thin one. Thirteen pages, one gesture, and it made the whole site read as
  one long document rather than as a place with rooms in it.

  This is the replacement. The name is set enormous, tight and flush left —
  a catalogue's cover, not a chapter heading — with the section it belongs to
  named above it in mono. No rules: the ink band that sits above it is already
  the hardest edge on the page, and a double rule underneath would be a second
  full stop.
*/
export function PageHead({ kicker, title, sub, flush = false }) {
  return (
    <section style={{ background: theme.bg }} className={flush ? "" : "pt-[104px] lg:pt-[124px]"}>
      <div className="max-w-[1180px] mx-auto px-[18px] pt-9 pb-7">
        {kicker && (
          <p className="m-0 mb-4 flex items-center gap-3" style={{ ...fontUtility, fontSize: "9.5px",
             letterSpacing: "0.22em", color: theme.brass }}><RegMark />{kicker}</p>
        )}
        <h1 className="m-0" style={{ ...fontDisplay, fontWeight: 900, textTransform: "uppercase",
            fontSize: "clamp(46px,13vw,138px)", lineHeight: 0.82, letterSpacing: "-0.05em",
            color: theme.ink, textWrap: "balance" }}>
          {title}
        </h1>
        {sub && (
          <p className="m-0 mt-5" style={{ ...fontUtility, fontSize: "9.5px",
             letterSpacing: "0.18em", color: theme.ink2 }}>{sub}</p>
        )}
      </div>
    </section>
  );
}

/*
  ── A DETAIL PAGE ─────────────────────────────────────────────────────────

  Every page about ONE THING — an article, a night, an artist, a set of mixes
  — opened the same way: a back link, "Hidden State" centred in the masthead
  face, a hairline row of meta, the subject's name centred under it, and a
  genre line hung between two rules. Four pages, one gesture, repeated so
  exactly that you could not tell an artist from an event at a glance.

  Which was the real problem. A detail page has a subject, and that subject
  almost always has a PHOTOGRAPH — a portrait, a poster, a sleeve. Putting the
  name on the picture instead of above it is the whole sleeve idea, and it
  costs nothing: the picture was already on the page, three hundred pixels
  further down, boxed and captioned.

  So: the facts go in the band, the name goes on the photograph, and the back
  link sits underneath in mono where it belongs. A subject with no picture
  falls back to the same flush-left name every other page uses, which is a
  quieter page rather than a broken one.
*/
export function DetailHead({ items, image, title, sub, meta, backTo, backLabel }) {
  return (
    <>
      {items && items.length > 0 && <IndexBand top items={items} />}

      {image ? (
        <Sleeve src={image} alt={title} height="clamp(340px, 58vw, 720px)" pos="center 32%">
          {meta && (
            <p className="m-0 mb-3" style={{ ...fontUtility, fontSize: "9.5px",
               letterSpacing: "0.24em", color: theme.onInk }}>{meta}</p>
          )}
          <h1 className="m-0" style={{ ...fontDisplay, fontWeight: 700, color: theme.bg,
              fontSize: "clamp(38px,9vw,96px)", lineHeight: 0.94, letterSpacing: "-0.035em",
              textWrap: "balance", textShadow: "0 4px 40px rgba(0,0,0,0.55)" }}>
            {title}
          </h1>
          {sub && (
            <p className="m-0 mt-2.5" style={{ ...fontDisplay, fontStyle: "italic",
               fontSize: "clamp(20px,3.4vw,30px)", color: theme.onInk,
               textShadow: "0 3px 30px rgba(0,0,0,0.6)" }}>{sub}</p>
          )}
        </Sleeve>
      ) : (
        <PageHead flush={!!(items && items.length)} kicker={meta} title={title} sub={sub} />
      )}

      {backTo && (
        <div className="max-w-[900px] mx-auto px-[18px] pt-6">
          <Link to={backTo} className="inline-flex items-center gap-2"
                style={{ ...fontUtility, fontSize: "9.5px", letterSpacing: "0.2em", color: theme.ink2 }}>
            ← {backLabel}
          </Link>
        </div>
      )}
    </>
  );
}

/*
  ── THE SLEEVE REGISTER ───────────────────────────────────────────────────
  A photograph printed into the ink, with something laid over it. Never a
  picture in a box with a caption underneath — that was the old site's habit
  and it is what made the images feel like illustrations of the text.

  The duotone is one filter chain, defined once: desaturate, push contrast,
  then tint warm. Every photograph on the site gets the same treatment, which
  is what makes a set of ordinary phone pictures look like one shoot.
*/
export const DUOTONE = "grayscale(1) contrast(1.16) sepia(0.44) hue-rotate(-16deg) saturate(1.55)";

/*
  THE SAME BAND IS A DIFFERENT CROP ON EVERY SCREEN.

  A height of 46vw is generous on a phone, where the viewport is narrow and
  tall — but on a 1440px laptop the same rule produced a wide letterbox that
  cut the top and bottom out of the picture. The photograph was fine; the
  frame around it was the wrong shape.

  So the height is driven by the WIDTH it has to fill: it grows with the
  viewport rather than stopping at a phone-sized number, and the cap is high
  enough that a desktop still gets a proper plate. The focal point sits a
  little above centre, which is where the subject is in every one of these
  photographs.
*/
/*
  A photograph printed to the trim.

  `caption` is the new part. On a wide screen it hangs in the margin beside
  the picture rather than sitting under it — which is what a printed page does
  with a plate, and what stops a full-bleed image from being a decoration with
  nothing to say about itself. Below 1100px there is no margin to hang into,
  so the stylesheet puts it back underneath.
*/
export function Sleeve({ src, alt = "", height = "clamp(340px, 62vw, 780px)", opacity = 0.62,
                        pos = "center 42%", children, align = "end", caption = null }) {
  const site = useSite();
  const duotone = site.photoDuotone !== false;
  return (
    <>
      <figure className={caption ? "hs-bleed-figure" : undefined} style={{ margin: 0 }}>
      <section className="relative" style={{ background: theme.ink }}>
        <Img src={src} alt={alt} eager
             style={{ width: "100%", height, objectFit: "cover", objectPosition: pos,
                      filter: duotone ? DUOTONE : "grayscale(0.15) contrast(1.06)",
                      opacity }} />
        {/* the screen the picture is printed through */}
        <Halftone opacity={0.30} size={4} />
        <div className="absolute inset-0 flex flex-col"
             style={{ justifyContent: align === "center" ? "center" : "flex-end" }}>
          <div className="max-w-[1180px] mx-auto w-full px-[18px] pb-7">{children}</div>
        </div>
      </section>
      {caption && <figcaption>{caption}</figcaption>}
      </figure>
      <Bleed />
    </>
  );
}
export function Reveal({ children, delay = 0, className = "" }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          obs.unobserve(el);
        }
      },
      { threshold: 0.15 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(24px)",
        transition: `opacity 0.7s ease ${delay}ms, transform 0.7s cubic-bezier(0.16,1,0.3,1) ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

/*
  NOTHING HERE — an empty state with a voice.

  A blank screen and an empty screen look identical, and a visitor cannot tell
  which one they are looking at. So an empty list says what it is empty OF,
  and, where there is one, what would fill it.

  Set as a small centred plate rather than a line of grey text: it should read
  as a deliberate part of the page, not as the moment before something loads.
*/
export function Nothing({ children, note = null }) {
  return (
    <div className="text-center py-14 px-5">
      <p className="m-0" style={{ ...fontUtility, fontSize: "9.5px", letterSpacing: "0.22em", color: theme.brass }}>
        NOTHING HERE
      </p>
      <p className="m-0 mt-3 mx-auto" style={{ ...fontDisplay, fontStyle: "italic",
         fontSize: "clamp(20px, 4.6vw, 27px)", lineHeight: 1.28, color: theme.ink, maxWidth: "26ch" }}>
        {children}
      </p>
      {note && (
        <p className="m-0 mt-3 mx-auto" style={{ ...fontText, fontSize: "16.5px",
           lineHeight: 1.55, color: theme.ink2, maxWidth: "44ch" }}>
          {note}
        </p>
      )}
    </div>
  );
}
export function Wordmark({ size = "h-9", dark = false }) {
  // The official line logo. `dark` picks the ink version for paper backgrounds.
  return (
    <img
      fetchpriority="high"
      decoding="async"
      src={dark ? "/wordmark-black.png" : "/wordmark.png"}
      alt="Hidden State"
      className={`${size} w-auto block`}
    />
  );
}
export function MarkClipping({ src, alt, w = 92 }) {
  return (
    <div
      className="shrink-0 p-2"
      style={{ background: theme.bg, border: `1px solid ${theme.ink}` }}
    >
      <Img src={src} alt={alt} style={{ width: w, display: "block" }} />
    </div>
  );
}

export function PressStrip() {
  // Marks only — the blackletter wordmark that used to sit in the middle is gone.
  return (
    <div className="hidden md:flex items-center justify-center gap-5 py-1.5" style={{ borderBottom: `1px solid ${theme.rule}` }}>
      <MarkClipping src={MARK_SJ} alt="SJ" w={34} />
      <MarkClipping src={MARK_SEAL} alt="Hidden State" w={60} />
      <MarkClipping src={MARK_NOPROBLEM} alt="No Problem" w={52} />
    </div>
  );
}

export const NAV_ITEMS = [
  { label: "NEWS", href: "/news", desc: "Music & Culture" },
  { label: "RECORDS", href: "/records", desc: "Releases & Label" },
  { label: "AGENCY", href: "/agency", desc: "Booking & Representation" },
  { label: "ARTISTS", href: "/artists", desc: "Artist Roster" },
  { label: "EVENTS", href: "/events", desc: "Events & Experiences" },
  { label: "MIXES", href: "/mixes", desc: "Sessions & Radio" },
  { label: "ABOUT", href: "/about", desc: "The Ecosystem" },
];

/*
  ── THE WAY IN ───────────────────────────────────────────────────────────

  Press and hold the wordmark for a second and the staff login opens.

  WHY IT IS HIDDEN. The bar builds its last tab one of two ways: signed in as
  team you get a CONSOLE tab, otherwise you get a PASS tab. There is no third
  case — so the moment the boss holds a guest pass, the pass tab replaces the
  only route into the console, and the one link to the login lives on /mypass,
  which the pass tab no longer goes to. Holding a pass made the door vanish.

  The alternative was a CONSOLE tab visible to every visitor. This was chosen
  instead: nothing on the public site announces that a staff door exists.

  THE THREE THINGS THAT MAKE A LONG PRESS WORK ON A PHONE:

    1. iOS offers its own menu (Save Image, Copy) when you hold a picture, and
       that menu would open on top of this. -webkit-touch-callout: none and a
       cancelled context menu are what suppress it.
    2. A held finger drifts. Cancelling on any movement at all would make this
       fire perhaps one time in three, so movement is allowed up to 10px.
    3. The press is followed by a click, and that click would navigate home
       immediately after the login opened. A flag set when the hold fires lets
       the click be swallowed exactly once.

  No setPointerCapture. Capturing retargets the following click to the
  capturing element, which is what silently broke every tab in the floating
  bar once already.
*/
const HOLD_SLOP = 10;

function useHoldForTheDoor(to = "/admins-staff-boss") {
  const navigate = useNavigate();
  const site = useSite();

  // Both settable from the console. The address itself always works, so
  // turning the hold off removes the shortcut and not the door.
  const enabled = site.staffDoorHold !== false;
  const holdMs = Number(site.staffDoorHoldMs) > 0 ? Number(site.staffDoorHoldMs) : 900;
  const hold = useRef({ timer: null, fired: false, x: 0, y: 0 });

  const cancel = () => {
    clearTimeout(hold.current.timer);
    hold.current.timer = null;
  };

  const onPointerDown = (e) => {
    if (!enabled) return;
    if (e.button !== undefined && e.button !== 0) return;
    hold.current.fired = false;
    hold.current.x = e.clientX;
    hold.current.y = e.clientY;
    cancel();
    hold.current.timer = setTimeout(() => {
      hold.current.fired = true;
      // The only confirmation there is, on a control with no appearance.
      if (site.staffDoorBuzz !== false) {
        try { navigator.vibrate?.(18); } catch { /* not supported */ }
      }
      navigate(to);
    }, holdMs);
  };

  const onPointerMove = (e) => {
    if (!hold.current.timer) return;
    if (Math.abs(e.clientX - hold.current.x) > HOLD_SLOP ||
        Math.abs(e.clientY - hold.current.y) > HOLD_SLOP) cancel();
  };

  const onClick = (e) => {
    if (!hold.current.fired) return;
    e.preventDefault();
    hold.current.fired = false;
  };

  useEffect(() => cancel, []);

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onPointerLeave: cancel,
    onClick,
    onContextMenu: (e) => e.preventDefault(),
    style: { WebkitTouchCallout: "none", WebkitUserSelect: "none", userSelect: "none" },
  };
}

export function Nav() {
  const { t } = useLang();
  const door = useHoldForTheDoor();
  const site = useSite();
  const navLabel = (item) => {
    const map = { NEWS: "news", RECORDS: "records", AGENCY: "agency", ARTISTS: "artists",
                  EVENTS: "events", MIXES: "mixes", ABOUT: "about", CONTACT: "contact" };
    return map[item.label] ? t(map[item.label]) : item.label;
  };
  const location = useLocation();

  const isActive = (href) =>
    href === "/" ? location.pathname === "/" : location.pathname.startsWith(href);

  return (
    <>
      {/*
        THE SKIP LINK.

        The first thing a keyboard reaches on every page, and invisible until
        it is reached. Without it, getting to the actual content means tabbing
        through the masthead and the whole floating bar on every single page —
        which is the difference between a site somebody can use and one they
        give up on.

        It is a real link to a real id, not a script: it has to work before
        JavaScript, because that is when somebody with a slow connection is
        most likely to be tabbing.
      */}
      <a href="#main" className="hs-skip">Skip to the page</a>

      {/* One line across the top, set in the console. Nothing renders when
          it is empty, so the masthead sits where it always did. */}
      {site.announcement ? (
        <div className="fixed top-0 left-0 right-0 z-[41] text-center py-1.5"
             style={{ background: theme.ink, color: theme.bg }}>
          {site.announcementLink ? (
            <a href={site.announcementLink}
               style={{ ...fontUtility, fontSize: "9.5px", letterSpacing: "0.18em", color: theme.bg }}>
              {site.announcement}
            </a>
          ) : (
            <span style={{ ...fontUtility, fontSize: "9.5px", letterSpacing: "0.18em", color: theme.bg }}>
              {site.announcement}
            </span>
          )}
        </div>
      ) : null}

      <header
        className="fixed top-0 left-0 right-0 z-40"
        style={{
          background: theme.bg,
          borderBottom: `1px solid ${theme.ink}`,
          // Sits below the banner when there is one.
          top: site.announcement ? "28px" : 0,
          transform: "translateZ(0)",
          WebkitTransform: "translateZ(0)",
        }}
      >
        {/* Row one — the masthead.
            The logo is absolutely centred rather than being a grid column.
            As a grid column it could be squeezed to nothing when the dateline
            and the language button both demanded their full width, which is
            exactly what happened on narrow screens. Absolute centring means
            the logo is always dead centre and can never be crushed. */}
        <div className="max-w-[1180px] mx-auto px-[18px] h-[76px] lg:h-[92px] relative flex items-center justify-between">
          {/* left — the dateline, capped so it can never reach the logo */}
          <span className="min-w-0 overflow-hidden" style={{ maxWidth: "34%" }}>

          <LiveDateline />
          </span>

          {/* centre — always exactly halfway across */}
          <Link
            to="/"
            className="absolute left-1/2 top-1/2"
            style={{ transform: "translate(-50%, -50%)", ...door.style }}
            aria-label="Hidden State — home"
            onPointerDown={door.onPointerDown}
            onPointerMove={door.onPointerMove}
            onPointerUp={door.onPointerUp}
            onPointerCancel={door.onPointerCancel}
            onPointerLeave={door.onPointerLeave}
            onContextMenu={door.onContextMenu}
            onClick={door.onClick}
          >
            <Wordmark size="h-[38px] lg:h-[46px]" dark />
          </Link>

          {/* right — language, plus the burger on phones */}
          <div className="flex items-center gap-4 shrink-0">
            <LanguageSwitch />
          </div>
        </div>

      </header>

    </>
  );
}

export function Footer() {
  const site = useSite();
  return (
    <footer style={{ background: theme.ink, color: theme.bg }}>
      <div className="max-w-[1180px] mx-auto px-[18px] pt-10 pb-16">
        <div className="flex flex-col items-center text-center gap-4">
          <Wordmark size="h-8" />
          <p style={{ ...fontUtility, color: "rgba(237,228,208,0.62)", fontSize: "9.5px", letterSpacing: "0.2em" }}>
            RECORDS · AGENCY · BOOKING · EVENTS · ARTISTS
          </p>
          <div className="flex flex-wrap justify-center gap-x-5 gap-y-2">
            <Instagram account={SOCIAL.official} color={theme.bg} />
            <Instagram account={SOCIAL.group} color={theme.bg} />
          </div>
          {/* Shown only while the guest list is open and the setting allows
              it — no point sending people to a form that will refuse them. */}
          {/*
            The pool is always open — it is not gated on the guest list being
            open, because wanting to hear a song and wanting to get in are
            different things.
          */}
          <Link to="/pool" className="pb-0.5 inline-block"
                style={{ ...fontUtility, fontSize: "9.5px", letterSpacing: "0.2em",
                         color: theme.bg, borderBottom: `1px solid ${theme.bg}` }}>
            PUT A SONG IN THE POOL
          </Link>

          {site.guestListLinkVisible && site.guestListOpen && (
            <Link to="/guestlist" className="pb-0.5 mb-3 inline-block"
                  style={{ ...fontUtility, fontSize: "9.5px", letterSpacing: "0.2em",
                           color: theme.bg, borderBottom: `1px solid ${theme.bg}` }}>
              ASK FOR A PASS
            </Link>
          )}

          <LiveDateline tone="light" />

          {site.footerNote ? (
            <p style={{ ...fontText, color: "rgba(237,228,208,0.72)", fontSize: "16px",
                        lineHeight: 1.5, maxWidth: "46ch", textAlign: "center" }}>
              {site.footerNote}
            </p>
          ) : null}
          <p style={{ ...fontUtility, color: "rgba(237,228,208,0.48)", fontSize: "9.5px", letterSpacing: "0.2em" }}>
            © 2026 HIDDEN STATE — ALL RIGHTS RESERVED
          </p>
        </div>
      </div>
    </footer>
  );
}

// ---- Shared booking-request form (used by the Agency and Artists pages) ----

export const EVENT_TYPES = ["Club Night", "Festival", "Private Event", "Corporate", "Other"];
export const ATTENDANCE = ["Under 200", "200\u2013500", "500\u20132,000", "2,000\u201310,000", "10,000+"];
export const BUDGETS = ["Under \u20ac2,000", "\u20ac2,000\u20135,000", "\u20ac5,000\u201315,000", "\u20ac15,000\u201350,000", "\u20ac50,000+"];

const initialForm = {
  fullName: "", company: "", email: "", phone: "",
  eventName: "", eventDate: "", eventLocation: "", country: "",
  artist: "", eventType: "", attendance: "", budget: "", message: "",
};

export function Field({ label, children }) {
  return (
    <label className="block">
      <span style={{ ...fontUtility, fontSize: "10.5px", letterSpacing: "0.1em", color: theme.ink2 }}>{label.toUpperCase()}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

export const inputStyle = {
  ...fontText, width: "100%", background: "transparent", border: "1px solid " + theme.rule,
  color: theme.ink, padding: "10px 12px", fontSize: "14px", outline: "none",
};

export function BookingDrawer({ open, onClose, artist }) {
  // The address comes from settings, so changing it in the console changes
  // where enquiries actually go — it used to be fixed in the code.
  const site = useSite();
  const [form, setForm] = useState(initialForm);
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setForm((f) => ({ ...initialForm, artist: artist ? artist.name : "" }));
      setSubmitted(false);
      setError("");
    }
  }, [open, artist]);

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    // No endpoint configured yet — tell the truth rather than fake a success.
    if (!FORM_ENDPOINT) {
      setError(`This form isn't connected yet. Please email ${site.bookingEmail || BOOKING_EMAIL} directly.`);
      return;
    }

    setSending(true);
    try {
      const res = await fetch(FORM_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          ...form,
          _subject: `Booking request — ${form.artist || "Hidden State"}`,
          _deliverTo: site.bookingEmail || BOOKING_EMAIL,
        }),
      });
      if (!res.ok) throw new Error("Request failed");
      setSubmitted(true);
    } catch {
      setError(`Something went wrong sending that. Please email ${site.bookingEmail || BOOKING_EMAIL} instead.`);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70]" style={{ pointerEvents: open ? "auto" : "none" }}>
      <div
        onClick={onClose}
        className="absolute inset-0 transition-opacity duration-300"
        style={{ background: "rgba(10,10,9,0.7)", opacity: open ? 1 : 0 }}
      />
      <div
        className="absolute top-0 right-0 h-full w-full md:w-[520px] overflow-y-auto transition-transform duration-[400ms]"
        style={{ background: theme.bg, borderLeft: "1px solid " + theme.ink, transform: open ? "translateX(0)" : "translateX(100%)" }}
      >
        <div className="flex items-center justify-between p-6 border-b" style={{ borderColor: theme.ink }}>
          <div>
            <span style={{ ...fontUtility, fontSize: "10px", letterSpacing: "0.16em", color: theme.brass }}>BOOK AN ARTIST</span>
            <h2 className="mt-1 text-[22px]" style={{ ...fontDisplay, fontStyle: "italic", fontWeight: 500, color: theme.ink }}>
              {artist ? artist.name : "Hidden State Agency"}
            </h2>
            <a href={`mailto:${site.bookingEmail || BOOKING_EMAIL}`} className="mt-1 inline-block"
               style={{ ...fontUtility, fontSize: "9px", letterSpacing: "0.1em", color: theme.ink2 }}>
              {BOOKING_EMAIL}
            </a>
          </div>
          <button onClick={onClose} style={{ color: theme.ink }}><X size={22} strokeWidth={1.5} /></button>
        </div>

        {submitted ? (
          <div className="p-8 md:p-10">
            <span className="inline-block px-2.5 py-[4px]"
                  style={{ ...fontUtility, fontSize: "9px", letterSpacing: "0.18em",
                           color: theme.brass, border: `1px solid ${theme.brass}` }}>
              REQUEST SENT
            </span>
            <h3 className="mt-5 text-[26px]" style={{ ...fontDisplay, fontWeight: 500, color: theme.ink }}>
              Thank you.
            </h3>
            <p className="mt-3 text-[14px] leading-relaxed max-w-sm" style={{ ...fontText, color: theme.ink2 }}>
              Your booking request has been received. The Hidden State Agency team will be in touch within 48 hours to discuss availability and next steps.
            </p>
            <button
              onClick={onClose}
              className="mt-8 text-[12px] tracking-[0.16em] px-6 py-3 border"
              style={{ ...fontUtility, color: theme.ink, borderColor: theme.ink }}
            >
              CLOSE
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Full Name"><input required style={inputStyle} value={form.fullName} onChange={update("fullName")} /></Field>
              <Field label="Company / Organization"><input style={inputStyle} value={form.company} onChange={update("company")} /></Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Email"><input required type="email" style={inputStyle} value={form.email} onChange={update("email")} /></Field>
              <Field label="Phone"><input type="tel" style={inputStyle} value={form.phone} onChange={update("phone")} /></Field>
            </div>
            <Field label="Event Name"><input style={inputStyle} value={form.eventName} onChange={update("eventName")} /></Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Event Date"><input type="date" style={inputStyle} value={form.eventDate} onChange={update("eventDate")} /></Field>
              <Field label="Country"><input style={inputStyle} value={form.country} onChange={update("country")} /></Field>
            </div>
            <Field label="Event Location"><input style={inputStyle} value={form.eventLocation} onChange={update("eventLocation")} /></Field>
            <Field label="Artist">
              <select required style={inputStyle} value={form.artist} onChange={update("artist")}>
                <option value="" disabled>Select artist</option>
                {ARTISTS.map((a) => <option key={a.id} value={a.name}>{a.name}</option>)}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Event Type">
                <select style={inputStyle} value={form.eventType} onChange={update("eventType")}>
                  <option value="">Select</option>
                  {EVENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="Expected Attendance">
                <select style={inputStyle} value={form.attendance} onChange={update("attendance")}>
                  <option value="">Select</option>
                  {ATTENDANCE.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Budget Range">
              <select style={inputStyle} value={form.budget} onChange={update("budget")}>
                <option value="">Select</option>
                {BUDGETS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Message">
              <textarea rows={4} style={{ ...inputStyle, resize: "none" }} value={form.message} onChange={update("message")} />
            </Field>
            {error && (
              <p className="text-[12.5px] leading-relaxed px-3 py-2.5 border" style={{ ...fontBody, color: theme.bad, borderColor: theme.badLine, background: theme.sunk }}>
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={sending}
              className="w-full mt-2 text-[12px] tracking-[0.16em] py-4"
              style={{ ...fontUtility, color: theme.bg, background: theme.ink, opacity: sending ? 0.6 : 1, cursor: sending ? "wait" : "pointer" }}
            >
              {sending ? "SENDING…" : "SEND BOOKING REQUEST"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

// ---- Shared news-grid pieces (used by the Home and News pages) ----


export const spanClasses = {
  lg: "md:col-span-4 md:row-span-2",
  md: "md:col-span-3 md:row-span-1",
  wide: "md:col-span-6 md:row-span-1",
};
export function Instagram({ account, size = "10px", color = null }) {
  if (!account) return null;
  return (
    <a
      href={account.url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-block pb-0.5"
      style={{
        ...fontUtility,
        fontSize: size,
        letterSpacing: "0.14em",
        color: color || theme.ink,
        // The rule under the handle follows the text. Oxblood on ink is
        // almost black, so a fixed accent underline vanished in the footer.
        borderBottom: "1px solid " + (color || theme.brass),
      }}
    >
      {account.handle}
    </a>
  );
}

// A printer's ornament, used where a plain rule would be the third in a row.
export function Fleuron({ mark = "\u2766" }) {
  return (
    <div className="hs-fleuron my-9" aria-hidden="true">
      <span style={{ fontSize: "15px", lineHeight: 1 }}>{mark}</span>
    </div>
  );
}

// Thick over thin — the classic newspaper divider.
export function DoubleRuleClassic() {
  return <div className="hs-double-rule" aria-hidden="true" />;
}
