import React from "react";
import { Link } from "react-router-dom";
import {
  Nav, Footer, useGoogleFonts,
  fontDisplay, fontUtility, fontText, fontMasthead, theme,
} from "../components/Shared";
import { MIX_ARTISTS, countMixes } from "../lib/mixes";

function Card({ a }) {
  const n = countMixes(a);
  return (
    <Link to={`/mixes/${a.slug}`} className="block">
      <article className="grid md:grid-cols-[260px_1fr] gap-5 md:gap-8 py-8"
               style={{ borderBottom: "1px solid " + theme.rule }}>
        <img src={a.photo} alt={a.name} className="w-full block"
             style={{ background: theme.raised, aspectRatio: "3 / 4", objectFit: "cover" }} />
        <div>
          <p className="m-0" style={{ ...fontUtility, fontSize: "9.5px", letterSpacing: "0.2em", color: theme.brass }}>
            {a.comingSoon ? "COMING SOON" : `${n} ${n === 1 ? "MIX" : "MIXES"}`}
          </p>
          <h2 className="mt-2 mb-1"
              style={{ ...fontDisplay, fontWeight: 400, color: theme.ink, fontSize: "clamp(24px,5vw,36px)", lineHeight: 1.12 }}>
            {a.name}
          </h2>
          {a.alias && (
            <p className="m-0" style={{ ...fontDisplay, fontStyle: "italic", fontSize: "19px", color: theme.brass }}>
              {a.alias}
            </p>
          )}
          <p className="mt-3 mb-0" style={{ ...fontText, fontSize: "17px", lineHeight: 1.6, color: theme.ink2 }}>
            {a.intro}
          </p>
          <p className="mt-3 mb-0" style={{ ...fontUtility, fontSize: "9.5px", letterSpacing: "0.14em", color: theme.ink2 }}>
            {a.genres.join(" · ").toUpperCase()}
          </p>
          <span className="inline-block mt-4 pb-0.5"
                style={{ ...fontUtility, fontSize: "10px", letterSpacing: "0.2em", color: theme.ink,
                         borderBottom: "1px solid " + theme.brass }}>
            {a.comingSoon ? "SEE THE PAGE" : "LISTEN TO THE SETS"}
          </span>
        </div>
      </article>
    </Link>
  );
}

export default function Mixes() {
  useGoogleFonts();
  return (
    <div style={{ background: theme.bg, minHeight: "100vh" }}>
      <Nav />
      <section className="max-w-[1180px] mx-auto px-[18px] pt-[104px] text-center">
        <h1 className="m-0" style={{ ...fontMasthead, color: theme.ink, fontSize: "clamp(30px,8vw,52px)" }}>
          Sessions &amp; Radio
        </h1>
        <div className="mt-2" style={{ borderTop: "2px solid " + theme.ink }} />
        <div style={{ borderTop: "1px solid " + theme.ink, marginTop: "3px" }} />
        <p className="mt-3 mb-0" style={{ ...fontUtility, fontSize: "9.5px", letterSpacing: "0.2em", color: theme.ink2 }}>
          RECORDED SETS FROM THE HIDDEN STATE ROSTER
        </p>
      </section>

      <div className="max-w-[1180px] mx-auto px-[18px] pb-4">
        {MIX_ARTISTS.map((a) => <Card key={a.slug} a={a} />)}
        <p className="text-center py-10 m-0"
           style={{ ...fontDisplay, fontStyle: "italic", fontSize: "20px", color: theme.ink2 }}>
          More sessions to come.
        </p>
      </div>

      <Footer />
    </div>
  );
}
