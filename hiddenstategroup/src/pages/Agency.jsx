import { usePageMeta } from "../lib/seo";
import { useLang } from "../lib/lang";
import Img from "../components/Img";
import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  Nav, Footer, useGoogleFonts, Instagram, BookingDrawer,
  PageHead, fontDisplay, fontUtility, fontText, theme,
} from "../components/Shared";
import { ARTISTS, ROSTER_NOTE, useArtists } from "../lib/data";
import { SOCIAL } from "../lib/social";

export default function Agency() {
  useGoogleFonts();
  const { t } = useLang();
  const artists = useArtists();
  usePageMeta({ title: "Agency", description: "Booking and representation for the Hidden State roster." });
  const [drawer, setDrawer] = useState(false);
  const [chosen, setChosen] = useState(null);
  const book = (a) => { setChosen(a); setDrawer(true); };

  return (
    <div data-page style={{ background: theme.bg, minHeight: "100vh" }}>
      <Nav />
      {/* where the skip link lands */}
      <span id="main" tabIndex={-1} />

      <PageHead kicker="BOOKING &amp; REPRESENTATION" title={t("theAgency")} sub={t("agencySub")} />

      <section className="max-w-[900px] mx-auto px-[18px] pt-8">
        <p className="m-0" style={{ ...fontText, fontSize: "17.5px", lineHeight: 1.64, color: theme.ink }}>
          Hidden State Agency handles booking and representation for the artists on our roster —
          from club nights to festival stages. Tell us about the event and we'll come back with
          availability and terms.
        </p>
        <p className="text-center mt-5 mb-0">
          <Instagram account={SOCIAL.agency} size="11px" />
        </p>
        <div className="text-center mt-7">
          <button onClick={() => book(null)} className="inline-block px-10 py-3.5"
                  style={{ ...fontUtility, fontSize: "10.5px", letterSpacing: "0.2em", background: theme.ink, color: theme.bg }}>
            MAKE A BOOKING ENQUIRY
          </button>
        </div>
      </section>

      <section className="max-w-[1180px] mx-auto px-[18px] pt-12 pb-4">
        <p className="m-0 mb-1" style={{ ...fontUtility, fontSize: "9.5px", letterSpacing: "0.2em", color: theme.brass }}>
          AVAILABLE FOR BOOKING
        </p>
        <div style={{ borderTop: "1px solid " + theme.ink }} className="mb-2" />
        {artists.map((a) => (
          <div key={a.id} className="grid md:grid-cols-[180px_1fr_auto] gap-4 md:gap-7 items-center py-6"
               style={{ borderBottom: "1px solid " + theme.rule }}>
            <Link to={`/artists/${a.id}`}>
              <Img src={a.photo} alt={a.name} className="w-full block"
                   style={{ background: theme.raised, aspectRatio: "3 / 4", objectFit: "cover" }} />
            </Link>
            <div>
              <p className="m-0" style={{ ...fontUtility, fontSize: "9.5px", letterSpacing: "0.2em", color: theme.brass }}>
                {a.type}
              </p>
              <Link to={`/artists/${a.id}`}>
                <h2 className="mt-1.5 mb-1" style={{ ...fontDisplay, fontWeight: 400, color: theme.ink, fontSize: "clamp(22px,4.4vw,30px)" }}>
                  {a.name}{a.alias ? <span style={{ fontStyle: "italic", color: theme.brass }}> — {a.alias}</span> : null}
                </h2>
              </Link>
              <p className="m-0" style={{ ...fontText, fontSize: "16.5px", lineHeight: 1.55, color: theme.ink2 }}>
                {a.desc}
              </p>
              <p className="mt-2 mb-0" style={{ ...fontUtility, fontSize: "9.5px", letterSpacing: "0.14em", color: theme.ink2 }}>
                {a.genres.join(" · ").toUpperCase()}
              </p>
              {a.instagram && SOCIAL[a.instagram] && (
                <p className="mt-2.5 mb-0">
                  <Instagram account={SOCIAL[a.instagram]} color={theme.ink2} />
                </p>
              )}
            </div>
            <button onClick={() => book(a)} className="px-7 py-3 justify-self-start"
                    style={{ ...fontUtility, fontSize: "10px", letterSpacing: "0.2em", color: theme.ink,
                             border: "1px solid " + theme.ink, whiteSpace: "nowrap" }}>
              BOOK
            </button>
          </div>
        ))}
        <p className="text-center py-10 m-0"
           style={{ ...fontDisplay, fontStyle: "italic", fontSize: "20px", color: theme.ink2 }}>
          {ROSTER_NOTE}
        </p>
      </section>

      <Footer />
      <BookingDrawer open={drawer} onClose={() => setDrawer(false)} artist={chosen} />
    </div>
  );
}
