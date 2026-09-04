import { SOCIAL } from "../lib/social";
import { useOrganisationSchema, usePageMeta } from "../lib/seo";
import { useLang } from "../lib/lang";
import Img from "../components/Img";
import Mark from "../components/Mark";
import Countdown from "../components/Countdown";
import { useSite } from "../lib/site";
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Nav, Footer, useGoogleFonts,
  IndexBand, ContactSheet, Entry, Sleeve, InkSection, Plate, RegMark,
  fontDisplay, fontUtility, fontText, theme,
} from "../components/Shared";
import { ARTICLES } from "../lib/news";
import { ARTISTS, EVENTS } from "../lib/data";
import { ALBUMS } from "../lib/records";
import { MIX_ARTISTS, countMixes } from "../lib/mixes";

/*
  The accounts that are demonstrably this same organisation elsewhere. Only
  the group's own — an artist's personal account is that artist, not the
  label, and claiming otherwise in structured data is the kind of thing that
  gets markup ignored altogether.
*/
const HS_ACCOUNTS = [SOCIAL.group, SOCIAL.official, SOCIAL.agency, SOCIAL.records, SOCIAL.news]
  .filter(Boolean)
  .map((a) => a.url);


/*
  HOME — Sleeve & Index.

  Six beats, alternating between the two registers, and never half of each:

    INDEX   the band of facts
    SLEEVE  the photograph with the mark on it
    SLEEVE  the story, set large
    INDEX   the contact sheet
    INDEX   the divisions, numbered
    INDEX   the tab bar — the index of everything
    SLEEVE  the closing line

  The old page opened with a centred wordmark on empty stock and then ran one
  continuous grey column to the bottom. That is where "too plain" and "no
  rhythm" both came from: no black, no bleed, and no change of temperature
  anywhere on the way down.

  Still deliberately plain in CONSTRUCTION: no sticky panels, no full-screen
  overlays, no blend modes, no scroll-driven opacity. Those caused the iOS
  "everything looks dark" bug and must not come back.
*/

const OFFER = [
  { n: "01", title: "Records", body: "A label releasing Afro House, Afro Tech and Deep House. Original music, and artists signed for the same direction." },
  { n: "02", title: "Agency", body: "Booking and representation for the Hidden State roster, from club nights to festival stages." },
  { n: "03", title: "Events", body: "The nights themselves — the rooms, the line-ups and the atmosphere the music was written for." },
];

/* ── beat 1 · INDEX ─────────────────────────────────────────────────────── */
function Facts() {
  const upcoming = EVENTS.filter((e) => e.status !== "past");
  const tracks = ALBUMS.reduce((n, a) => n + a.tracks.length, 0);
  return (
    <IndexBand
      top
      items={[
        { label: "EST", value: "2005" },
        { label: "DIVISIONS", value: "05" },
        { label: "ROSTER", value: `${String(ARTISTS.length).padStart(2, "0")} ARTISTS` },
        { label: "CATALOGUE", value: `${String(ALBUMS.length).padStart(2, "0")} LP / ${String(tracks).padStart(2, "0")} TRK` },
        { label: "NEXT", value: upcoming[0] ? upcoming[0].date.toUpperCase() : "TBA" },
      ]}
    />
  );
}

/* ── beat 2 · SLEEVE ────────────────────────────────────────────────────── */
const HEROES = { club: "/club.webp", booth: "/booth.webp", portrait: "/portrait.webp" };

/*
  THE MARK GOES ON ONCE.

  The logo is inked onto the sleeve the first time you arrive and never again
  in that session — a flourish you notice once is a signature; the same
  flourish on every navigation is a stutter.

  WHAT THIS IS NOT. A true line-draw, where the logo writes itself stroke by
  stroke, needs the mark as a vector: an SVG path has a length, and a length
  is what can be drawn. What exists in this project is a PNG, which has
  pixels and no strokes, so what happens here is a wipe — the mark arrives
  from the left as if it were being pressed on. It is the honest version of
  the effect for the artwork available. Hand over an SVG of the wordmark and
  the real one is an hour's work.

  sessionStorage, not localStorage: once per visit, not once per lifetime.
*/
function useFirstArrival(enabled = true) {
  const [first, setFirst] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    try {
      if (sessionStorage.getItem("hs-marked")) return;
      sessionStorage.setItem("hs-marked", "1");
    } catch { /* private window — treat every arrival as the first */ }
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    setFirst(true);
  }, [enabled]);
  return first;
}

function Mark() {
  const site = useSite();
  const src = HEROES[site.heroImage] || HEROES.club;
  const inked = useFirstArrival(site.motionLogoInk !== false);
  // The height is set in the console because how tall an opening photograph
  // should be depends on the photograph, and that changes.
  const vw = Number(site.heroHeightVw) > 0 ? Number(site.heroHeightVw) : 46;
  /*
    46vw, not 64. At 64 the photograph filled a laptop screen on its own, so
    the page opened on a picture with no page behind it and you had to scroll
    before anything told you where you were. An opening image should be the
    first thing, not the only thing.
  */
  return (
    <Sleeve src={src} alt="" height={`clamp(300px, ${vw}vw, 620px)`} pos="center 46%">
      {/*
        The hero mark, as outlines. It was a PNG whose width was capped at
        340px — beyond that it went soft, which is exactly where a hero wants
        to be sharpest. This has no such ceiling, and it inherits the stock
        colour rather than carrying it baked in.
      */}
      <Mark
        height={null}
        title="Hidden State"
        className={`block${inked ? " hs-ink-on" : ""}`}
        style={{ width: "min(420px, 72%)", height: "auto",
                 color: theme.onInk, marginBottom: "14px" }}
      />
      <p className="m-0" style={{ ...fontUtility, fontSize: "9.5px", letterSpacing: "0.24em", color: theme.onInk }}>
        FROM ANOTHER STATE OF MIND
      </p>
    </Sleeve>
  );
}

/* ── beat 3 · SLEEVE ────────────────────────────────────────────────────── */
function Story() {
  const { t } = useLang();
  const site = useSite();
  return (
    <section style={{ background: theme.bg }} className="pt-11 pb-12">
      <div className="max-w-[1180px] mx-auto px-[18px]">
        <p className="m-0 mb-3" style={{ ...fontUtility, fontSize: "9.5px", letterSpacing: "0.2em", color: theme.brass }}>
          {t("theStory")}
        </p>
        <h2 className="m-0 mb-8"
            style={{ ...fontDisplay, fontWeight: 400, color: theme.ink,
                     fontSize: "clamp(36px,8.4vw,86px)", lineHeight: 0.98,
                     letterSpacing: "-0.028em", textWrap: "balance" }}>
          {site.storyHeadline ? site.storyHeadline : (
            <>
              One artist. One vision. Records, rooms, and the people who{" "}
              <em style={{ fontStyle: "italic", color: theme.brass }}>fill them.</em>
            </>
          )}
        </h2>

        {/*
          The portrait is a tall 3:4 frame, so it is printed as a plate at its
          own shape and set beside the text rather than squeezed into a strip
          across it. Cropping a portrait to a letterbox is how you end up with
          a photograph of a t-shirt.
        */}
        <div className="grid md:grid-cols-[300px_1fr] gap-7 md:gap-10 items-start">
          <Plate src="/portrait.webp" alt="Stephanno Jr."
                 caption="STEPHANNO JR." credit="FOUNDER" />

        <div className="md:columns-1 cols"
             style={{ ...fontText, fontSize: "18.5px", lineHeight: 1.62, color: theme.ink }}>
          <p className="mt-0 mb-4 hs-drop">
            Hidden State began as one artist's way of joining the parts of a scene that usually stay
            apart — the records, the rooms, and the people who make them.
          </p>
          <p className="mb-4">
            What started as a name on a release grew into a label, an agency and a roster, all built
            on a single idea: that the music, the artists and the nights they play should come from
            the same vision.
          </p>
          <p className="mb-4">
            As a DJ and producer working across Afro House, Afro Tech and Deep House, Stephanno Jr.
            continues to build that universe — connecting music, events, artists and creative
            experiences under one name.
          </p>
          <p className="mb-4">
            Everything sits under one roof on purpose. An artist signed to the label can be booked
            through the agency and play a Hidden State night, with the same people behind each step.
          </p>
        </div>
        </div>
      </div>
    </section>
  );
}

/* ── beat 5 · INDEX ─────────────────────────────────────────────────────── */
function Divisions() {
  const { t } = useLang();
  /*
    The loudest beat on the page, and the only full ink ground on it. Three
    divisions is the thing the site most needs someone to walk away knowing,
    so it gets the black. Two of these on one page and neither would land.
  */
  return (
    <InkSection>
      <p className="m-0 mb-5 flex items-center gap-3"
         style={{ ...fontUtility, fontSize: "9.5px", letterSpacing: "0.22em", color: "rgba(237,228,208,0.62)" }}>
        <RegMark color="rgba(237,228,208,0.62)" />{t("whatWeOffer")}
      </p>
      <div style={{ borderTop: "1px solid rgba(237,228,208,0.20)" }}>
        {OFFER.map((o) => (
          <Entry key={o.n} n={o.n} title={o.title} invert>{o.body}</Entry>
        ))}
      </div>
      <Link to="/news" className="inline-block mt-9 px-9 py-3.5"
            style={{ ...fontUtility, fontSize: "10.5px", letterSpacing: "0.18em",
                     background: theme.bg, color: theme.ink }}>
        READ THE LATEST
      </Link>
    </InkSection>
  );
}

/* ── beat 7 · SLEEVE ────────────────────────────────────────────────────── */
function Closer() {
  const site = useSite();
  return (
    <Sleeve src="/booth.webp" alt="" height="clamp(260px, 40vw, 520px)" opacity={0.46} pos="center 44%" align="center"
            caption="PLATE II · THE BOOTH — BUCHAREST">
      <h3 className="m-0"
          style={{ ...fontDisplay, fontWeight: 400, fontStyle: "italic", color: theme.bg,
                   fontSize: "clamp(25px,5.2vw,46px)", lineHeight: 1.12, maxWidth: "17ch" }}>
        {site.closingLine || "The music, the artists and the nights they play — from the same vision."}
      </h3>
    </Sleeve>
  );
}

/* ── beat 6 · INDEX — the index of everything ───────────────────────────── */
const TABS = ["ALL", "NEWS", "ARTISTS", "RECORDS", "EVENTS", "MIXES", "INDUSTRY"];

// One row shape for everything, so the tabs read as a single index.
function Row({ to, img, kicker, title, sub, meta }) {
  return (
    <Link to={to} className="flex items-center gap-4 py-4"
          style={{ borderBottom: "1px solid " + theme.rule }}>
      {img && (
        <Img src={img} alt="" className="block shrink-0"
             style={{ width: "64px", height: "64px", objectFit: "cover",
                      background: theme.raised, filter: "grayscale(1) contrast(1.06)" }} />
      )}
      <span className="flex-1">
        {kicker && (
          <span className="block" style={{ ...fontUtility, fontSize: "9px", letterSpacing: "0.16em", color: theme.brass }}>
            {kicker}
          </span>
        )}
        <span className="block mt-1" style={{ ...fontDisplay, fontWeight: 700, fontSize: "20px", lineHeight: 1.18, color: theme.ink }}>
          {title}
        </span>
        {sub && (
          <span className="block mt-1" style={{ ...fontText, fontSize: "15px", lineHeight: 1.45, color: theme.ink2 }}>
            {sub}
          </span>
        )}
      </span>
      {meta && (
        <span style={{ ...fontUtility, fontSize: "9px", letterSpacing: "0.12em", color: theme.ink2, whiteSpace: "nowrap" }}>
          {meta}
        </span>
      )}
    </Link>
  );
}

function Heading({ children }) {
  return (
    <p className="m-0 mt-7 mb-1" style={{ ...fontUtility, fontSize: "9.5px", letterSpacing: "0.2em", color: theme.brass }}>
      {children}
    </p>
  );
}

const newsRows = (list) =>
  list.map((a) => (
    <Row key={a.slug} to={`/news/${a.slug}`} img={a.photo || a.poster}
         kicker={a.category} title={a.headline} meta={a.date} />
  ));

const artistRows = () =>
  ARTISTS.map((a) => (
    <Row key={a.id} to={`/artists/${a.id}`} img={a.photo}
         kicker={a.type} title={a.alias ? `${a.name} — ${a.alias}` : a.name}
         sub={a.desc} meta={a.genres[0].toUpperCase()} />
  ));

const eventRows = () =>
  EVENTS.map((e) => (
    <Row key={e.id} to={`/events/${e.id}`} img={e.artwork}
         kicker={e.status === "past" ? "PAST EVENT" : "UPCOMING"}
         title={e.name} sub={e.subtitle} meta={e.date} />
  ));

const recordRows = () =>
  ALBUMS.map((al) => (
    <Row key={al.slug} to="/records" img={al.cover}
         kicker={`${al.kind} · ${al.catalog}`} title={al.title}
         sub={`${al.artist} — ${al.tracks.length} tracks`} meta="LISTEN" />
  ));

const mixRows = () =>
  MIX_ARTISTS.map((m) => {
    const n = countMixes(m);
    return (
      <Row key={m.slug} to={`/mixes/${m.slug}`} img={m.photo}
           kicker={m.comingSoon ? "COMING SOON" : `${n} ${n === 1 ? "MIX" : "MIXES"}`}
           title={m.alias ? `${m.name} — ${m.alias}` : m.name} sub={m.intro} />
    );
  });

function Empty({ label }) {
  return (
    <div className="my-8 py-14 text-center"
         style={{ border: "1px dashed " + theme.rule, ...fontUtility,
                  fontSize: "10.5px", letterSpacing: "0.16em", color: theme.ink2 }}>
      {label} — NOTHING FILED YET
    </div>
  );
}

function TabBar() {
  const [active, setActive] = useState("ALL");
  const industry = ARTICLES.filter((a) => (a.categories || []).includes("INDUSTRY"));

  let content;
  if (active === "ALL") {
    content = (
      <>
        <Heading>LATEST NEWS</Heading>
        {newsRows(ARTICLES.slice(0, 3))}
        <Heading>ON THE LABEL</Heading>
        {recordRows()}
        <Heading>NEXT EVENTS</Heading>
        {eventRows().slice(0, 3)}
        <Heading>THE ROSTER</Heading>
        {artistRows().slice(0, 3)}
      </>
    );
  } else if (active === "NEWS") content = newsRows(ARTICLES);
  else if (active === "ARTISTS") content = artistRows();
  else if (active === "RECORDS") content = recordRows();
  else if (active === "EVENTS") content = eventRows();
  else if (active === "MIXES") content = mixRows();
  else if (active === "INDUSTRY")
    content = industry.length ? newsRows(industry) : <Empty label="INDUSTRY" />;

  return (
    <>
      {/* The tab bar is ink, not stock. It is the spine of the index half and
          it should read as a hard edge across the page, not as one more
          hairline among the rest. */}
      <div style={{ background: theme.ink }}>
        <div className="max-w-[1180px] mx-auto px-[18px] flex gap-6 overflow-x-auto no-scrollbar">
          {TABS.map((t) => (
            <button key={t} onClick={() => setActive(t)} className="py-3.5"
              style={{ ...fontUtility, fontSize: "10px", letterSpacing: "0.16em", whiteSpace: "nowrap",
                       background: "transparent", border: 0, cursor: "pointer",
                       color: active === t ? theme.bg : "rgba(237,228,208,0.52)",
                       borderBottom: `2px solid ${active === t ? theme.brass : "transparent"}` }}>
              {t}
            </button>
          ))}
        </div>
      </div>
      <div className="max-w-[1180px] mx-auto px-[18px] pb-14">{content}</div>
    </>
  );
}

export default function Home() {
  useGoogleFonts();
  const site = useSite();
  // Every other rich result on the site points at this organisation.
  useOrganisationSchema(HS_ACCOUNTS);

  usePageMeta({ title: null, description: "Records, agency, booking, events and artists — from another state of mind." });

  /*
    The sheet is the rooms and the nights. The portrait is deliberately NOT
    in here — it is printed as a plate in the story, at its own shape. A face
    reduced to a numbered thumbnail alongside a poster reads as filing, not as
    a photograph of a person.
  */
  const frames = [
    { src: "/booth.webp", alt: "The booth", caption: "THE BOOTH", pos: "center 40%" },
    { src: "/club.webp", alt: "The room", caption: "THE ROOM", pos: "center 45%" },
    ...EVENTS.filter((e) => e.artwork).slice(0, 2).map((e) => ({
      src: e.artwork, alt: e.name, caption: e.name.toUpperCase(), pos: "center 35%",
    })),
  ];

  return (
    <div data-page style={{ background: theme.bg, minHeight: "100vh" }}>
      <Nav />
      {/* where the skip link lands */}
      <span id="main" tabIndex={-1} />

      <Facts />
      <Mark />

      {site.showCountdown && (
        <section style={{ background: theme.bg }} className="pt-10 pb-2">
          <div className="max-w-[760px] mx-auto px-[18px]">
            <Countdown target={site.countdownTarget} label={site.countdownLabel} />
            <p className="text-center mt-3 m-0"
               style={{ ...fontUtility, fontSize: "9px", letterSpacing: "0.18em", color: theme.ink2 }}>
              LOCATION UNDISCLOSED · LINE-UP SEALED
            </p>
          </div>
        </section>
      )}

      <Story />
      {site.showContactSheet !== false && <ContactSheet frames={frames} note={`${String(frames.length).padStart(2, "0")} FRAMES · 2026`} />}
      <Divisions />
      <TabBar />
      <Closer />
      <Footer />
    </div>
  );
}
