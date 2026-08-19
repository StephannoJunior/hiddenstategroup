import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  Nav, Footer, useGoogleFonts,
  fontDisplay, fontUtility, fontText, theme,
} from "../components/Shared";

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
          <img src="/wordmark-black.png" alt="Hidden State"
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

function LeadPicture() {
  return (
    <section style={{ background: theme.bg }} className="pb-10">
      <div className="max-w-[1180px] mx-auto px-[18px]">
        <figure className="m-0">
          <img src="/club.jpg" alt="" className="w-full block" style={{ background: theme.raised }} />
          <figcaption
            className="pt-1.5 mt-1.5"
            style={{ ...fontUtility, fontSize: "9.5px", letterSpacing: "0.12em", color: theme.ink2, borderTop: "1px solid " + theme.rule }}
          >
            HIDDEN STATE — A NIGHT IN THE ROOM
          </figcaption>
        </figure>
      </div>
    </section>
  );
}

function Story() {
  return (
    <section style={{ background: theme.bg }} className="pt-10 pb-14">
      <div className="max-w-[1180px] mx-auto px-[18px]">
        <p style={{ ...fontUtility, fontSize: "9.5px", letterSpacing: "0.2em", color: theme.brass }} className="mb-2.5">
          THE STORY
        </p>
        <h2 className="mb-5" style={{ ...fontDisplay, fontWeight: 300, color: theme.ink, fontSize: "clamp(27px,6vw,48px)", lineHeight: 1.14 }}>
          One artist. One vision. Records, rooms, and the people who{" "}
          <em style={{ fontStyle: "italic", color: theme.brass }}>fill them.</em>
        </h2>

        <figure className="m-0 mb-5">
          <img src="/portrait.jpg" alt="Stephanno Jr." className="w-full block" style={{ background: theme.raised }} />
          <figcaption
            className="pt-1.5 mt-1.5"
            style={{ ...fontUtility, fontSize: "9.5px", letterSpacing: "0.12em", color: theme.ink2, borderTop: "1px solid " + theme.rule }}
          >
            STEPHANNO JR. — FOUNDER, HIDDEN STATE
          </figcaption>
        </figure>

        <div className="md:columns-2 md:gap-x-9" style={{ ...fontText, fontSize: "17.5px", lineHeight: 1.62, color: theme.ink }}>
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
  return (
    <section style={{ background: theme.bg }} className="pt-10 pb-16">
      <div className="max-w-[1180px] mx-auto px-[18px]">
        <div style={{ borderTop: "1px solid " + theme.rule }} className="mb-9" />
        <p style={{ ...fontUtility, fontSize: "9.5px", letterSpacing: "0.2em", color: theme.brass }}>
          WHAT WE OFFER
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

const TABS = ["ALL", "MUSIC", "ARTISTS", "RECORDS", "EVENTS", "INTERVIEWS", "INDUSTRY"];

function TabBar() {
  const [active, setActive] = useState("ALL");
  return (
    <>
      <div style={{ background: theme.bg, borderTop: "1px solid " + theme.ink, borderBottom: "1px solid " + theme.ink }}>
        <div className="max-w-[1180px] mx-auto px-[18px] flex gap-6 overflow-x-auto no-scrollbar">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setActive(t)}
              className="py-3"
              style={{
                ...fontUtility, fontSize: "10.5px", letterSpacing: "0.16em", whiteSpace: "nowrap",
                color: active === t ? theme.ink : theme.ink2,
                borderBottom: `2px solid ${active === t ? theme.brass : "transparent"}`,
              }}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
      <div className="max-w-[1180px] mx-auto px-[18px] py-10">
        <div className="py-14 text-center" style={{ border: "1px dashed " + theme.rule, color: theme.ink2, ...fontUtility, fontSize: "10.5px", letterSpacing: "0.16em" }}>
          {active} — NOTHING FILED YET
        </div>
      </div>
    </>
  );
}

export default function Home() {
  useGoogleFonts();
  return (
    <div style={{ background: theme.bg, minHeight: "100vh" }}>
      <Nav />
      <Nameplate />
      <LeadPicture />
      <Story />
      <Offer />
      <TabBar />
      <Footer />
    </div>
  );
}
