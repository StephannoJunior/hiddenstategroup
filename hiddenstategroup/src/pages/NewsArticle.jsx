import React from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import {
  Nav, Footer, useGoogleFonts,
  fontDisplay, fontUtility, fontText, fontMasthead, theme,
} from "../components/Shared";
import { getArticle, ARTICLES } from "../lib/news";

export default function NewsArticle() {
  useGoogleFonts();
  const { slug } = useParams();
  const a = getArticle(slug);

  if (!a) {
    return (
      <div style={{ background: theme.bg, minHeight: "100vh" }}>
        <Nav />
        <section className="max-w-[1180px] mx-auto px-[18px] pt-[140px] pb-24 text-center">
          <h1 style={{ ...fontDisplay, fontWeight: 400, color: theme.ink, fontSize: "clamp(28px,6vw,44px)" }}>
            We couldn't find that story.
          </h1>
          <Link to="/news" className="inline-flex items-center gap-2 mt-6 pb-1"
                style={{ ...fontUtility, fontSize: "10.5px", letterSpacing: "0.2em",
                         color: theme.brass, borderBottom: "1px solid " + theme.brass }}>
            <ArrowLeft size={13} strokeWidth={1.5} /> BACK TO NEWS
          </Link>
        </section>
        <Footer />
      </div>
    );
  }

  const others = ARTICLES.filter((x) => x.slug !== a.slug).slice(0, 2);

  return (
    <div style={{ background: theme.bg, minHeight: "100vh" }}>
      <Nav />

      <article className="max-w-[900px] mx-auto px-[18px] pt-[104px] pb-16">
        <Link to="/news" className="inline-flex items-center gap-2 mb-6"
              style={{ ...fontUtility, fontSize: "10px", letterSpacing: "0.18em", color: theme.ink2 }}>
          <ArrowLeft size={12} strokeWidth={1.5} /> ALL ISSUES
        </Link>

        <h1 className="text-center m-0" style={{ ...fontMasthead, color: theme.ink, fontSize: "clamp(26px,6.5vw,42px)" }}>
          Daily News
        </h1>
        <div className="flex justify-between py-1.5 mt-2"
             style={{ ...fontUtility, fontSize: "9.5px", letterSpacing: "0.18em", color: theme.ink2,
                      borderTop: "1px solid " + theme.ink, borderBottom: "1px solid " + theme.ink }}>
          <span>{a.issue}</span>
          <span>{a.category}</span>
          <span>{a.date}</span>
        </div>

        <h2 className="text-center mt-6 mb-4" style={{ ...fontMasthead, color: theme.ink, fontSize: "clamp(30px,8.5vw,56px)", lineHeight: 1 }}>
          Breaking News
        </h2>

        <p className="text-center py-2.5 m-0"
           style={{ ...fontDisplay, color: theme.ink, fontSize: "clamp(17px,3.8vw,27px)", lineHeight: 1.2,
                    borderTop: "2px solid " + theme.ink, borderBottom: "2px solid " + theme.ink }}>
          {a.headline}
        </p>

        {(a.posters || (a.poster ? [a.poster] : [])).length > 0 && (
          <figure className="m-0 mt-6">
            <div className={(a.posters || []).length > 1 ? "grid grid-cols-2 gap-3" : ""}>
              {(a.posters || [a.poster]).map((src) => (
                <img key={src} src={src} alt={a.headline} className="w-full block"
                     style={{ background: theme.raised, border: "1px solid " + theme.rule }} />
              ))}
            </div>
            <figcaption className="pt-1.5 mt-1.5"
              style={{ ...fontUtility, fontSize: "9.5px", letterSpacing: "0.12em", color: theme.ink2,
                       borderTop: "1px solid " + theme.rule }}>
              {(a.posters || []).length > 1 ? "THE PRINTED ISSUES" : "THE PRINTED ISSUE"}
            </figcaption>
          </figure>
        )}

        {a.photo && (
          <figure className="m-0 mt-6">
            <img src={a.photo} alt={a.headline} className="w-full block" style={{ background: theme.raised }} />
            <figcaption className="pt-1.5 mt-1.5"
              style={{ ...fontUtility, fontSize: "9.5px", letterSpacing: "0.12em", color: theme.ink2,
                       borderTop: "1px solid " + theme.rule }}>
              {(a.caption || a.headline).toUpperCase()}
            </figcaption>
          </figure>
        )}

        {a.kicker && (
          <p className="text-center mt-6 mb-0"
             style={{ ...fontUtility, fontSize: "11px", letterSpacing: "0.2em", color: theme.brass }}>
            {a.kicker.toUpperCase()}
          </p>
        )}

        <div className="md:columns-2 md:gap-x-9 mt-5"
             style={{ ...fontText, fontSize: "17.5px", lineHeight: 1.64, color: theme.ink }}>
          {a.body.map((p, i) => (
            <p key={i} className={i === 0 ? "mt-0 mb-3.5 hs-drop" : "mb-3.5"}>{p}</p>
          ))}
        </div>

        {a.lineup && (
          <div className="mt-8 pt-5" style={{ borderTop: "1px solid " + theme.ink, borderBottom: "1px solid " + theme.ink }}>
            <p className="text-center m-0 mb-3"
               style={{ ...fontUtility, fontSize: "9.5px", letterSpacing: "0.26em", color: theme.brass }}>
              — LINE-UP —
            </p>
            <div className="flex flex-wrap justify-center gap-x-5 gap-y-1.5 pb-4">
              {a.lineup.map((n) => (
                <span key={n} style={{ ...fontDisplay, fontSize: "19px", color: theme.ink }}>{n}</span>
              ))}
            </div>
          </div>
        )}

        {a.eventDate && (
          <p className="text-center mt-6 m-0"
             style={{ ...fontUtility, fontSize: "13px", letterSpacing: "0.24em", color: theme.ink }}>
            {a.eventDate}
          </p>
        )}

        {a.partners && (
          <div className="mt-8 pt-5" style={{ borderTop: "1px solid " + theme.rule }}>
            <p className="m-0 mb-2.5" style={{ ...fontUtility, fontSize: "9.5px", letterSpacing: "0.2em", color: theme.brass }}>
              OFFICIAL PARTNERS
            </p>
            <p className="m-0" style={{ ...fontText, fontSize: "16px", lineHeight: 1.6, color: theme.ink2 }}>
              {a.partners.join(" · ")}
            </p>
          </div>
        )}

        {a.tags && (
          <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 mt-8 pt-5"
               style={{ borderTop: "1px solid " + theme.rule }}>
            {a.tags.map((t) => (
              <span key={t} style={{ ...fontUtility, fontSize: "9.5px", letterSpacing: "0.18em", color: theme.ink2 }}>
                {t}
              </span>
            ))}
          </div>
        )}

        {a.signoff && (
          <p className="text-center mt-7 m-0"
             style={{ ...fontDisplay, fontStyle: "italic", fontSize: "20px", color: theme.ink }}>
            {a.signoff}
          </p>
        )}

        {a.link && (
          <div className="text-center mt-7">
            <a href={a.link} target="_blank" rel="noopener noreferrer" className="inline-block px-10 py-3.5"
               style={{ ...fontUtility, fontSize: "10.5px", letterSpacing: "0.2em", background: theme.ink, color: theme.bg }}>
              {a.linkLabel || "OPEN"}
            </a>
          </div>
        )}

        {a.footnote && (
          <p className="text-center mt-6 m-0"
             style={{ ...fontUtility, fontSize: "9.5px", letterSpacing: "0.14em", color: theme.ink2 }}>
            {a.footnote.toUpperCase()}
          </p>
        )}
      </article>

      {others.length > 0 && (
        <section className="max-w-[900px] mx-auto px-[18px] pb-20">
          <div style={{ borderTop: "2px solid " + theme.ink }} className="mb-5" />
          <p className="m-0 mb-4" style={{ ...fontUtility, fontSize: "9.5px", letterSpacing: "0.2em", color: theme.brass }}>
            MORE FROM HIDDEN STATE
          </p>
          {others.map((o) => (
            <Link key={o.slug} to={`/news/${o.slug}`} className="flex gap-4 py-4"
                  style={{ borderTop: "1px solid " + theme.rule }}>
              <img src={o.photo || o.poster} alt="" className="block" style={{ width: "84px", background: theme.raised }} />
              <span>
                <span className="block" style={{ ...fontUtility, fontSize: "9px", letterSpacing: "0.18em", color: theme.brass }}>
                  {o.date}
                </span>
                <span className="block mt-1" style={{ ...fontDisplay, fontSize: "19px", color: theme.ink, lineHeight: 1.2 }}>
                  {o.headline}
                </span>
              </span>
            </Link>
          ))}
        </section>
      )}

      <Footer />
    </div>
  );
}
