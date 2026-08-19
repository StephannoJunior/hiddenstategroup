import React from "react";
import {
  Nav, Footer, useGoogleFonts,
  fontDisplay, fontUtility, fontText, fontMasthead, theme,
} from "../components/Shared";

/*
  NEWS — the Astryon announcement, set as a broadsheet page.
  Rebuilt as real text rather than a flat poster image so it is readable
  on a phone and can be found by search engines.
  TICKETS_URL: paste the real ticket link here.
*/
const TICKETS_URL = "";

const BODY = [
  "A new name joins an international gathering of sound.",
  "Stephanno Jr. is set to take the Romanian main stage at Astryon Festival, standing alongside a powerful line-up of international artists and over 200 artists from around the world.",
  "As a DJ, producer and founder of Hidden State and all its divisions, he continues to build his own universe within the electronic music scene — connecting music, events, artists and creative experiences under one vision.",
  "Bringing his signature sound across Afro House, Afro Tech and Deep House, he arrives at Astryon with a sound shaped by years behind the decks and a constant drive to create something of his own.",
  "This appearance marks another chapter in the journey of an artist who is not only performing — but building a movement around his sound.",
  "Over 200 artists. One festival. One global gathering. One unforgettable moment.",
  "Astryon Festival — Stephanno Jr. The journey continues.",
];

export default function News() {
  useGoogleFonts();
  const rule = "1px solid " + theme.rule;

  return (
    <div style={{ background: theme.bg, minHeight: "100vh" }}>
      <Nav />

      <article className="max-w-[1180px] mx-auto px-[18px] pt-[104px] pb-20">
        <h1 className="text-center m-0" style={{ ...fontMasthead, color: theme.ink, fontSize: "clamp(28px,7vw,44px)" }}>
          Daily News
        </h1>

        <div
          className="flex justify-between py-1.5 mt-1"
          style={{ ...fontUtility, fontSize: "9.5px", letterSpacing: "0.2em", color: theme.ink2,
                   borderTop: "1px solid " + theme.ink, borderBottom: "1px solid " + theme.ink }}
        >
          <span>SPECIAL EDITION</span>
          <span>18–20 JUNE 2027</span>
        </div>

        <h2 className="text-center mt-4 mb-2" style={{ ...fontMasthead, color: theme.ink, fontSize: "clamp(32px,9vw,60px)", lineHeight: 1 }}>
          Breaking News
        </h2>

        <p
          className="text-center py-2.5 mb-5 m-0"
          style={{ ...fontDisplay, color: theme.ink, fontSize: "clamp(16px,3.6vw,25px)",
                   borderTop: "2px solid " + theme.ink, borderBottom: "2px solid " + theme.ink }}
        >
          Stephanno Jr. joins the line-up at{" "}
          <em style={{ fontStyle: "italic", color: theme.brass }}>Astryon Festival</em>
        </p>

        <div className="flex justify-between items-center gap-3 text-center"
             style={{ ...fontUtility, fontSize: "10px", letterSpacing: "0.1em", color: theme.ink2 }}>
          <div><strong style={{ color: theme.ink }}>72</strong><br />HOURS<br />OF MUSIC</div>
          <div className="flex-1">
            <div style={{ ...fontUtility, fontWeight: 500, fontSize: "clamp(22px,6.4vw,36px)", letterSpacing: "0.16em", color: theme.ink }}>
              ASTRYON
            </div>
            <div style={{ ...fontUtility, fontSize: "9.5px", letterSpacing: "0.36em", color: theme.ink }} className="mt-1">
              FESTIVAL
            </div>
            <div style={{ ...fontUtility, fontSize: "9px", letterSpacing: "0.24em", color: theme.brass }} className="mt-2">
              — THE FIRST CHAPTER —
            </div>
          </div>
          <div><strong style={{ color: theme.ink }}>18·19·20</strong><br />JUNE<br />2027</div>
        </div>

        <div className="md:columns-2 md:gap-x-9 mt-6"
             style={{ ...fontText, fontSize: "17px", lineHeight: 1.62, color: theme.ink }}>
          {BODY.map((t, i) => (
            <p key={i} className={i === 0 ? "mt-0 mb-3.5" : "mb-3.5"}>{t}</p>
          ))}
        </div>

        <figure className="m-0 mt-6">
          <img src="/booth.jpg" alt="" className="w-full block" style={{ background: theme.raised }} />
          <figcaption className="pt-1.5 mt-1.5"
            style={{ ...fontUtility, fontSize: "9.5px", letterSpacing: "0.12em", color: theme.ink2, borderTop: rule }}>
            STEPHANNO JR. BEHIND THE DECKS — FILL &amp; DANCE
          </figcaption>
        </figure>

        <div className="text-center mt-8">
          <div style={{ ...fontMasthead, fontSize: "30px", color: theme.ink }} className="mb-3">Tickets</div>
          {TICKETS_URL ? (
            <a href={TICKETS_URL} target="_blank" rel="noopener noreferrer"
               className="inline-block px-10 py-3.5"
               style={{ ...fontUtility, fontSize: "10.5px", letterSpacing: "0.2em", background: theme.ink, color: theme.bg }}>
              GET TICKETS
            </a>
          ) : (
            <p className="m-0" style={{ ...fontUtility, fontSize: "9.5px", letterSpacing: "0.1em", color: theme.ink2 }}>
              TICKET LINK COMING SOON
            </p>
          )}
        </div>
      </article>

      <Footer />
    </div>
  );
}
