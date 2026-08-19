import React, { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import {
  Nav, Footer, useGoogleFonts, BookingDrawer, Instagram,
  fontDisplay, fontUtility, fontText, fontMasthead, theme,
} from "../components/Shared";
import { ARTISTS } from "../lib/data";
import { SOCIAL } from "../lib/social";

export default function ArtistProfile() {
  useGoogleFonts();
  const { id } = useParams();
  const [drawer, setDrawer] = useState(false);
  const a = ARTISTS.find((x) => String(x.id) === id);

  if (!a) {
    return (
      <div style={{ background: theme.bg, minHeight: "100vh" }}>
        <Nav />
        <section className="max-w-[1180px] mx-auto px-[18px] pt-[140px] pb-24 text-center">
          <h1 style={{ ...fontDisplay, fontWeight: 400, color: theme.ink, fontSize: "clamp(28px,6vw,44px)" }}>
            We couldn't find that artist.
          </h1>
          <Link to="/artists" className="inline-flex items-center gap-2 mt-6 pb-1"
                style={{ ...fontUtility, fontSize: "10.5px", letterSpacing: "0.2em", color: theme.brass,
                         borderBottom: "1px solid " + theme.brass }}>
            <ArrowLeft size={13} strokeWidth={1.5} /> BACK TO THE ROSTER
          </Link>
        </section>
        <Footer />
      </div>
    );
  }

  return (
    <div style={{ background: theme.bg, minHeight: "100vh" }}>
      <Nav />

      <article className="max-w-[900px] mx-auto px-[18px] pt-[104px] pb-16">
        <Link to="/artists" className="inline-flex items-center gap-2 mb-6"
              style={{ ...fontUtility, fontSize: "10px", letterSpacing: "0.18em", color: theme.ink2 }}>
          <ArrowLeft size={12} strokeWidth={1.5} /> THE ROSTER
        </Link>

        <h1 className="text-center m-0" style={{ ...fontMasthead, color: theme.ink, fontSize: "clamp(26px,6.5vw,42px)" }}>
          Hidden State
        </h1>
        <div className="flex justify-between py-1.5 mt-2"
             style={{ ...fontUtility, fontSize: "9.5px", letterSpacing: "0.18em", color: theme.ink2,
                      borderTop: "1px solid " + theme.ink, borderBottom: "1px solid " + theme.ink }}>
          <span>{a.type}</span>
          <span>ROSTER</span>
          {a.location && <span>{a.location.toUpperCase()}</span>}
        </div>

        <h2 className="text-center mt-6 mb-1"
            style={{ ...fontDisplay, fontWeight: 400, color: theme.ink, fontSize: "clamp(32px,8vw,58px)", lineHeight: 1.05 }}>
          {a.name}
        </h2>
        {a.alias && (
          <p className="text-center m-0" style={{ ...fontDisplay, fontStyle: "italic", fontSize: "22px", color: theme.brass }}>
            {a.alias}
          </p>
        )}
        <p className="text-center py-2.5 mt-4 m-0"
           style={{ ...fontUtility, fontSize: "9.5px", letterSpacing: "0.2em", color: theme.ink2,
                    borderTop: "2px solid " + theme.ink, borderBottom: "2px solid " + theme.ink }}>
          {a.genres.join(" · ").toUpperCase()}
        </p>

        <figure className="m-0 mt-6">
          <img src={a.photo} alt={a.name} className="w-full block" style={{ background: theme.raised }} />
          <figcaption className="pt-1.5 mt-1.5"
            style={{ ...fontUtility, fontSize: "9.5px", letterSpacing: "0.12em", color: theme.ink2,
                     borderTop: "1px solid " + theme.rule }}>
            {a.name.toUpperCase()}{a.alias ? ` — ${a.alias.toUpperCase()}` : ""}
          </figcaption>
        </figure>

        <div className="md:columns-2 md:gap-x-9 mt-6"
             style={{ ...fontText, fontSize: "17.5px", lineHeight: 1.64, color: theme.ink }}>
          <p className="mt-0 mb-3.5 hs-drop">{a.bio}</p>
        </div>

        {a.upcoming && a.upcoming.length > 0 && (
          <div className="mt-8 pt-5" style={{ borderTop: "1px solid " + theme.ink }}>
            <p className="m-0 mb-3" style={{ ...fontUtility, fontSize: "9.5px", letterSpacing: "0.2em", color: theme.brass }}>
              UPCOMING
            </p>
            {a.upcoming.map((e, i) => (
              <div key={i} className="flex justify-between items-baseline gap-4 py-2.5"
                   style={{ borderTop: i ? "1px solid " + theme.rule : undefined }}>
                <span>
                  <span className="block" style={{ ...fontDisplay, fontSize: "19px", color: theme.ink }}>{e.name}</span>
                  <span className="block" style={{ ...fontUtility, fontSize: "9.5px", letterSpacing: "0.12em", color: theme.ink2 }}>
                    {e.venue}
                  </span>
                </span>
                <span style={{ ...fontUtility, fontSize: "10px", letterSpacing: "0.14em", color: theme.ink2, whiteSpace: "nowrap" }}>
                  {e.date}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="text-center mt-9">
          <button onClick={() => setDrawer(true)} className="inline-block px-10 py-3.5"
                  style={{ ...fontUtility, fontSize: "10.5px", letterSpacing: "0.2em", background: theme.ink, color: theme.bg }}>
            BOOK {a.name.toUpperCase()}
          </button>
        </div>

        {a.instagram && SOCIAL[a.instagram] && (
          <p className="text-center mt-6 m-0">
            <Instagram account={SOCIAL[a.instagram]} size="11px" />
          </p>
        )}
      </article>

      <Footer />
      <BookingDrawer open={drawer} onClose={() => setDrawer(false)} artist={a} />
    </div>
  );
}
