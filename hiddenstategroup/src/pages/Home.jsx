import { usePageMeta } from "../lib/seo";
import { useLang } from "../lib/lang";
import Img from "../components/Img";
import { Fleuron } from "../components/Shared";
import Countdown from "../components/Countdown";
import { useSite } from "../lib/site";
import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  Nav, Footer, useGoogleFonts,
  fontDisplay, fontUtility, fontText, theme,
} from "../components/Shared";
import { ARTICLES } from "../lib/news";
import { ARTISTS, EVENTS } from "../lib/data";
import { ALBUMS } from "../lib/records";
import { MIX_ARTISTS, countMixes } from "../lib/mixes";

/*
  HOME — the broadsheet.
  Deliberately plain in construction: no sticky panels, no full-screen
  overlays, no blend modes, no scroll-driven opacity. Those caused the iOS
  "everything looks dark" bug and must not come back.
*/

const DIVISIONS = ["Records", "Agency", "Booking", "Events", "Artists"];

const OFFER = [
  { n: "01", title: "Records", body: "A label releasing Afro House, Afro Tech and Deep House." },
  { n: "02", title: "Agency", body: "Booking and representation for the Hidden State roster." },
  { n: "03", title: "Events", body: "Nights, festivals and experiences built around the sound." },
];

function Nameplate() {
  return (
    <section style={{ background: theme.bg }} className="pt-[104px] pb-8">
      <div className="max-w-[1180px] mx-auto px-[18px] text-center pt-8">
        <p style={{ ...fontUtility, fontSize: "9.5px", letterSpacing: "0.2em", color: theme.brass }}>
          FROM ANOTHER STATE OF MIND
        </p>
        <h1 className="my-6">
          <Img src="/wordmark-black.png" alt="Hidden State" eager transparent
               className="block mx-auto w-full" style={{ maxWidth: "440px" }} />
        </h1>
        <div style={{ borderTop: "2px solid " + theme.ink }} />
        <div style={{ borderTop: "1px solid " + theme.ink, marginTop: "3px" }} />
        <div className="mt-3.5 flex justify-center flex-wrap gap-y-1.5 gap-x-5">
          {DIVISIONS.map((d) => (
            <span key={d} style={{ ...fontUtility, fontSize: "9px", letterSpacing: "0.18em", color: theme.ink2 }}>
              {d.toUpperCase()}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

function Story() {
  const { t } = useLang();
  return (
    <section style={{ background: theme.bg }} className="pt-10 pb-14">
      <div className="max-w-[1180px] mx-auto px-[18px]">
        <p style={{ ...fontUtility, fontSize: "9.5px", letterSpacing: "0.2em", color: theme.brass }} className="mb-2.5">
          {t("theStory")}
        </p>
        <h2 className="mb-5" style={{ ...fontDisplay, fontWeight: 300, color: theme.ink, fontSize: "clamp(27px,6vw,48px)", lineHeight: 1.14 }}>
          One artist. One vision. Records, rooms, and the people who{" "}
          <em style={{ fontStyle: "italic", color: theme.brass }}>fill them.</em>
        </h2>

        <figure className="m-0 mb-5">
          <Img src="/portrait.webp" alt="Stephanno Jr." className="w-full block" style={{ background: theme.raised }} />
          <figcaption
            className="pt-1.5 mt-1.5"
            style={{ ...fontUtility, fontSize: "9.5px", letterSpacing: "0.12em", color: theme.ink2, borderTop: "1px solid " + theme.rule }}
          >
            STEPHANNO JR. — FOUNDER, HIDDEN STATE
          </figcaption>
        </figure>

        <div className="md:columns-2 md:gap-x-9 hs-wide-cols" style={{ ...fontText, fontSize: "17.5px", lineHeight: 1.62, color: theme.ink }}>
          <p className="mt-0 mb-3.5 hs-drop">
            Hidden State began as one artist's way of joining the parts of a scene that usually stay
            apart — the records, the rooms, and the people who make them.
          </p>
          <p className="mb-3.5">
            What started as a name on a release grew into a label, an agency and a roster, all built
            on a single idea: that the music, the artists and the nights they play should come from
            the same vision.
          </p>
          <p className="mb-3.5">
            As a DJ and producer working across Afro House, Afro Tech and Deep House, Stephanno Jr.
            continues to build that universe — connecting music, events, artists and creative
            experiences under one name.
          </p>
          <p className="mb-3.5">
            The label releases original music and signs artists who share the same direction. The
            agency handles booking and representation for that roster, from club nights to festival
            stages. The events arm builds the nights themselves — the rooms, the line-ups and the
            atmosphere the music was written for.
          </p>
          <p className="mb-3.5">
            Everything sits under one roof on purpose. An artist signed to the label can be booked
            through the agency and play a Hidden State night, with the same people behind each step.
          </p>
        </div>
      </div>
    </section>
  );
}

function Offer() {
  const { t } = useLang();
  return (
    <section style={{ background: theme.bg }} className="pt-10 pb-16">
      <div className="max-w-[1180px] mx-auto px-[18px]">
        <div style={{ borderTop: "1px solid " + theme.rule }} className="mb-9" />
        <p style={{ ...fontUtility, fontSize: "9.5px", letterSpacing: "0.2em", color: theme.brass }}>
          {t("whatWeOffer")}
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 mt-5" style={{ borderTop: "1px solid " + theme.rule }}>
          {OFFER.map((o, i) => (
            <div
              key={o.n}
              className="py-6 md:px-5"
              style={{
                borderBottom: "1px solid " + theme.rule,
                borderRight: i < OFFER.length - 1 ? "1px solid " + theme.rule : undefined,
              }}
            >
              <span style={{ ...fontUtility, fontSize: "10px", letterSpacing: "0.2em", color: theme.brass }}>{o.n}</span>
              <h3 className="mt-1.5 mb-1.5" style={{ ...fontDisplay, fontWeight: 400, fontSize: "25px", color: theme.ink }}>
                {o.title}
              </h3>
              <p className="m-0" style={{ ...fontText, fontSize: "16px", lineHeight: 1.55, color: theme.ink2 }}>
                {o.body}
              </p>
            </div>
          ))}
        </div>
        <Link
          to="/news"
          className="inline-block mt-9 px-9 py-3.5"
          style={{ ...fontUtility, fontSize: "10.5px", letterSpacing: "0.2em", background: theme.ink, color: theme.bg }}
        >
          READ THE LATEST
        </Link>
      </div>
    </section>
  );
}

const TABS = ["ALL", "NEWS", "ARTISTS", "RECORDS", "EVENTS", "MIXES", "INDUSTRY"];

// One row shape for everything, so the tabs read as a single index.
function Row({ to, img, kicker, title, sub, meta }) {
  return (
    <Link to={to} className="flex items-center gap-4 py-4"
          style={{ borderBottom: "1px solid " + theme.rule }}>
      {img && (
        <Img src={img} alt="" className="block shrink-0"
             style={{ width: "64px", height: "64px", objectFit: "cover", background: theme.raised }} />
      )}
      <span className="flex-1">
        {kicker && (
          <span className="block" style={{ ...fontUtility, fontSize: "9px", letterSpacing: "0.18em", color: theme.brass }}>
            {kicker}
          </span>
        )}
        <span className="block mt-1" style={{ ...fontDisplay, fontSize: "19px", lineHeight: 1.2, color: theme.ink }}>
          {title}
        </span>
        {sub && (
          <span className="block mt-1" style={{ ...fontText, fontSize: "15px", lineHeight: 1.45, color: theme.ink2 }}>
            {sub}
          </span>
        )}
      </span>
      {meta && (
        <span style={{ ...fontUtility, fontSize: "9px", letterSpacing: "0.14em", color: theme.ink2, whiteSpace: "nowrap" }}>
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
      <div style={{ background: theme.bg, borderTop: "1px solid " + theme.ink, borderBottom: "1px solid " + theme.ink }}>
        <div className="max-w-[1180px] mx-auto px-[18px] flex gap-6 overflow-x-auto no-scrollbar">
          {TABS.map((t) => (
            <button key={t} onClick={() => setActive(t)} className="py-3"
              style={{ ...fontUtility, fontSize: "10.5px", letterSpacing: "0.16em", whiteSpace: "nowrap",
                       color: active === t ? theme.ink : theme.ink2,
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
  const { t } = useLang();
  usePageMeta({ title: null, description: "Records, agency, booking, events and artists — from another state of mind." });
  return (
    <div data-page style={{ background: theme.bg, minHeight: "100vh" }}>
      <Nav />
      <Nameplate />

      {site.showCountdown && (
      <section style={{ background: theme.bg }} className="pb-10">
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
      <Fleuron />
      <Offer />
      <TabBar />
      <Footer />
    </div>
  );
}
