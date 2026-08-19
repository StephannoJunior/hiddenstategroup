import React from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import {
  Nav, Footer, useGoogleFonts, Instagram,
  fontDisplay, fontUtility, fontText, fontMasthead, theme,
} from "../components/Shared";
import { getMixArtist, platformOf } from "../lib/mixes";
import { ARTISTS } from "../lib/data";
import { SOCIAL } from "../lib/social";

export default function MixArtist() {
  useGoogleFonts();
  const { slug } = useParams();
  const a = getMixArtist(slug);

  if (!a) {
    return (
      <div style={{ background: theme.bg, minHeight: "100vh" }}>
        <Nav />
        <section className="max-w-[1180px] mx-auto px-[18px] pt-[140px] pb-24 text-center">
          <h1 style={{ ...fontDisplay, fontWeight: 400, color: theme.ink, fontSize: "clamp(28px,6vw,44px)" }}>
            We couldn't find those sessions.
          </h1>
          <Link to="/mixes" className="inline-flex items-center gap-2 mt-6 pb-1"
                style={{ ...fontUtility, fontSize: "10.5px", letterSpacing: "0.2em", color: theme.brass,
                         borderBottom: "1px solid " + theme.brass }}>
            <ArrowLeft size={13} strokeWidth={1.5} /> BACK TO SESSIONS
          </Link>
        </section>
        <Footer />
      </div>
    );
  }

  const profile = ARTISTS.find((x) => x.id === a.artistId);

  return (
    <div style={{ background: theme.bg, minHeight: "100vh" }}>
      <Nav />

      <article className="max-w-[900px] mx-auto px-[18px] pt-[104px] pb-16">
        <Link to="/mixes" className="inline-flex items-center gap-2 mb-6"
              style={{ ...fontUtility, fontSize: "10px", letterSpacing: "0.18em", color: theme.ink2 }}>
          <ArrowLeft size={12} strokeWidth={1.5} /> ALL SESSIONS
        </Link>

        <h1 className="text-center m-0" style={{ ...fontMasthead, color: theme.ink, fontSize: "clamp(26px,6.5vw,42px)" }}>
          Sessions &amp; Radio
        </h1>
        <div className="flex justify-between py-1.5 mt-2"
             style={{ ...fontUtility, fontSize: "9.5px", letterSpacing: "0.18em", color: theme.ink2,
                      borderTop: "1px solid " + theme.ink, borderBottom: "1px solid " + theme.ink }}>
          <span>HIDDEN STATE</span>
          <span>{a.genres[0].toUpperCase()}</span>
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
        </figure>

        <div className="md:columns-2 md:gap-x-9 mt-6"
             style={{ ...fontText, fontSize: "17.5px", lineHeight: 1.64, color: theme.ink }}>
          <p className="mt-0 mb-3.5 hs-drop">{a.intro}</p>
        </div>

        {a.comingSoon ? (
          <div className="mt-9 py-14 text-center"
               style={{ border: "1px dashed " + theme.rule, ...fontDisplay, fontStyle: "italic",
                        fontSize: "20px", color: theme.ink2 }}>
            {a.comingSoonNote || "Sessions coming soon."}
          </div>
        ) : (
          a.sections.map((sec, i) => (
            <div key={i} className="mt-9">
              {sec.label && (
                <p className="m-0 mb-1" style={{ ...fontUtility, fontSize: "9.5px", letterSpacing: "0.2em", color: theme.brass }}>
                  {sec.label.toUpperCase()}
                </p>
              )}
              <div style={{ borderTop: "1px solid " + theme.ink }}>
                {sec.items.map((m, j) => (
                  <a key={m.url} href={m.url} target="_blank" rel="noopener noreferrer"
                     className="flex items-center gap-4 py-3.5"
                     style={{ borderBottom: "1px solid " + theme.rule }}>
                    <span style={{ ...fontUtility, fontSize: "10px", letterSpacing: "0.14em", color: theme.ink2, width: "22px" }}>
                      {String(j + 1).padStart(2, "0")}
                    </span>
                    <span className="flex-1" style={{ ...fontDisplay, fontSize: "20px", color: theme.ink }}>
                      {m.title}
                    </span>
                    <span style={{ ...fontUtility, fontSize: "9px", letterSpacing: "0.16em", color: theme.ink2, whiteSpace: "nowrap" }}>
                      {platformOf(m.url)}
                    </span>
                    <span style={{ ...fontUtility, fontSize: "9.5px", letterSpacing: "0.16em", color: theme.brass, whiteSpace: "nowrap" }}>
                      PLAY →
                    </span>
                  </a>
                ))}
              </div>
            </div>
          ))
        )}

        <div className="flex flex-wrap justify-center gap-x-6 gap-y-3 mt-10 pt-6"
             style={{ borderTop: "1px solid " + theme.rule }}>
          {profile && (
            <Link to={`/artists/${profile.id}`} className="pb-0.5"
                  style={{ ...fontUtility, fontSize: "10px", letterSpacing: "0.2em", color: theme.ink,
                           borderBottom: "1px solid " + theme.brass }}>
              FULL ARTIST PROFILE
            </Link>
          )}
          {profile && profile.instagram && SOCIAL[profile.instagram] && (
            <Instagram account={SOCIAL[profile.instagram]} color={theme.ink2} />
          )}
        </div>
      </article>

      <Footer />
    </div>
  );
}
