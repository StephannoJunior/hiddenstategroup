import React from "react";
import { Link } from "react-router-dom";
import {
  Nav, Footer, useGoogleFonts, Instagram,
  fontDisplay, fontUtility, fontText, fontMasthead, theme,
} from "../components/Shared";
import { ARTISTS } from "../lib/data";
import { EMAILS } from "../lib/contacts";
import { SOCIAL } from "../lib/social";

const DIVISIONS = [
  { n: "01", title: "Records", body: "The label. Original releases across Afro House, Afro Tech and Deep House, and the artists signed to them.", to: "/records" },
  { n: "02", title: "Agency", body: "Booking and representation for the roster, from club nights to festival stages.", to: "/agency" },
  { n: "03", title: "Events", body: "The nights themselves — the rooms, the line-ups and the atmosphere the music was written for.", to: "/events" },
  { n: "04", title: "Artists", body: "The roster: DJs and producers working under one vision.", to: "/artists" },
  { n: "05", title: "News", body: "Announcements, signings and dispatches from inside Hidden State.", to: "/news" },
  { n: "06", title: "Sessions & Radio", body: "Recorded sets from the roster.", to: "/mixes" },
];

export default function About() {
  useGoogleFonts();
  return (
    <div style={{ background: theme.bg, minHeight: "100vh" }}>
      <Nav />

      <section className="max-w-[1180px] mx-auto px-[18px] pt-[104px] text-center">
        <h1 className="m-0" style={{ ...fontMasthead, color: theme.ink, fontSize: "clamp(30px,8vw,52px)" }}>
          About
        </h1>
        <div className="mt-2" style={{ borderTop: "2px solid " + theme.ink }} />
        <div style={{ borderTop: "1px solid " + theme.ink, marginTop: "3px" }} />
        <p className="mt-3 mb-0" style={{ ...fontUtility, fontSize: "9.5px", letterSpacing: "0.2em", color: theme.brass }}>
          FROM ANOTHER STATE OF MIND
        </p>
      </section>

      <section className="max-w-[900px] mx-auto px-[18px] pt-8">
        <h2 className="mb-5" style={{ ...fontDisplay, fontWeight: 300, color: theme.ink, fontSize: "clamp(25px,5.4vw,42px)", lineHeight: 1.16 }}>
          One artist, building a <em style={{ fontStyle: "italic", color: theme.brass }}>universe</em> around a sound.
        </h2>
        <div className="md:columns-2 md:gap-x-9" style={{ ...fontText, fontSize: "17.5px", lineHeight: 1.64, color: theme.ink }}>
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
            Everything sits under one roof on purpose. An artist signed to the label can be booked
            through the agency and play a Hidden State night, with the same people behind each step.
          </p>
          <p className="mb-3.5">
            Founded by Stephanno Jr., the roster now runs to {ARTISTS.length} artists working across
            Afro House, Afro Tech, Deep House, techno, old-school hip-hop and drum &amp; bass.
          </p>
        </div>
      </section>

      <section className="max-w-[1180px] mx-auto px-[18px] pt-12">
        <p className="m-0 mb-1" style={{ ...fontUtility, fontSize: "9.5px", letterSpacing: "0.2em", color: theme.brass }}>
          THE DIVISIONS
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3" style={{ borderTop: "1px solid " + theme.ink }}>
          {DIVISIONS.map((d, i) => (
            <Link key={d.n} to={d.to} className="py-6 md:px-5 block"
                  style={{ borderBottom: "1px solid " + theme.rule,
                           borderRight: (i % 3 !== 2) ? "1px solid " + theme.rule : undefined }}>
              <span style={{ ...fontUtility, fontSize: "10px", letterSpacing: "0.2em", color: theme.brass }}>{d.n}</span>
              <h3 className="mt-1.5 mb-1.5" style={{ ...fontDisplay, fontWeight: 400, fontSize: "24px", color: theme.ink }}>
                {d.title}
              </h3>
              <p className="m-0" style={{ ...fontText, fontSize: "16px", lineHeight: 1.55, color: theme.ink2 }}>{d.body}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="max-w-[1180px] mx-auto px-[18px] pt-12 pb-16">
        <p className="m-0 mb-1" style={{ ...fontUtility, fontSize: "9.5px", letterSpacing: "0.2em", color: theme.brass }}>
          CONTACT
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2" style={{ borderTop: "1px solid " + theme.ink }}>
          {Object.values(EMAILS).map((e, i) => (
            <a key={e.address} href={`mailto:${e.address}`} className="py-4 md:px-5 block"
               style={{ borderBottom: "1px solid " + theme.rule,
                        borderRight: (i % 2 === 0) ? "1px solid " + theme.rule : undefined }}>
              <span className="block" style={{ ...fontUtility, fontSize: "9px", letterSpacing: "0.18em", color: theme.ink2 }}>
                {e.label.toUpperCase()}
              </span>
              <span className="block mt-1" style={{ ...fontText, fontSize: "17px", color: theme.ink }}>{e.address}</span>
            </a>
          ))}
        </div>

        <div className="flex flex-wrap justify-center gap-x-6 gap-y-3 mt-9">
          <Instagram account={SOCIAL.official} />
          <Instagram account={SOCIAL.group} />
          <Instagram account={SOCIAL.agency} />
          <Instagram account={SOCIAL.records} />
          <Instagram account={SOCIAL.news} />
        </div>

        <p className="text-center mt-9 m-0"
           style={{ ...fontDisplay, fontStyle: "italic", fontSize: "20px", color: theme.ink2 }}>
          Estd. 2005 — located in Hidden State.
        </p>
      </section>

      <Footer />
    </div>
  );
}
