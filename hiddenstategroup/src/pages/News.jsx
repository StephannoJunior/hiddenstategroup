import { usePageMeta } from "../lib/seo";
import { useLang } from "../lib/lang";
import Img from "../components/Img";
import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  Nav, Footer, useGoogleFonts, Instagram,
  fontDisplay, fontUtility, fontText, fontMasthead, theme,
} from "../components/Shared";
import { ARTICLES, localised } from "../lib/news";
import { SOCIAL } from "../lib/social";

/*
  NEWS — the index of issues. Each article opens its own page at /news/<slug>.
  Add articles in src/lib/news.js; nothing here needs changing.
*/

const CATS = ["ALL", "NEWS", "ARTISTS", "MUSIC", "RECORDS", "EVENTS", "INTERVIEWS", "INDUSTRY"];

function Issue({ a: raw, lang }) {
  const { t } = useLang();
  const a = localised(raw, lang);
  return (
    <Link to={`/news/${a.slug}`} className="block group">
      <article className="grid md:grid-cols-[300px_1fr] gap-5 md:gap-8 py-8"
               style={{ borderBottom: "1px solid " + theme.rule }}>
        <Img src={a.photo || a.poster} alt={a.headline} className="w-full block"
             style={{ background: theme.raised, border: "1px solid " + theme.rule }} />
        <div>
          <div className="flex flex-wrap gap-x-4 gap-y-1"
               style={{ ...fontUtility, fontSize: "9.5px", letterSpacing: "0.18em", color: theme.brass }}>
            <span>{a.category}</span>
            <span style={{ color: theme.ink2 }}>{a.issue}</span>
            <span style={{ color: theme.ink2 }}>{a.date}</span>
          </div>
          <h2 className="mt-2.5 mb-2.5"
              style={{ ...fontDisplay, fontWeight: 400, color: theme.ink,
                       fontSize: "clamp(22px,4.6vw,34px)", lineHeight: 1.14 }}>
            {a.headline}
          </h2>
          <p className="m-0" style={{ ...fontText, fontSize: "17px", lineHeight: 1.6, color: theme.ink2 }}>
            {a.summary}
          </p>
          <span className="inline-block mt-4 pb-0.5"
                style={{ ...fontUtility, fontSize: "10px", letterSpacing: "0.2em", color: theme.ink,
                         borderBottom: "1px solid " + theme.brass }}>
            {t("readFullStory")}
          </span>
        </div>
      </article>
    </Link>
  );
}

export default function News() {
  useGoogleFonts();
  const { t, lang } = useLang();
  usePageMeta({ title: "News", description: "Announcements, signings and dispatches from inside Hidden State." });
  const [active, setActive] = useState("ALL");
  const inTab = (a, tab) =>
    tab === "ALL" || (a.categories || [a.category]).includes(tab);
  const shown = ARTICLES.filter((a) => inTab(a, active));

  return (
    <div data-page style={{ background: theme.bg, minHeight: "100vh" }}>
      <Nav />

      <section className="max-w-[1180px] mx-auto px-[18px] pt-[104px] pb-2 text-center">
        <h1 className="m-0" style={{ ...fontMasthead, color: theme.ink, fontSize: "clamp(30px,8vw,52px)" }}>
          {t("dailyNews")}
        </h1>
        <div className="mt-2" style={{ borderTop: "2px solid " + theme.ink }} />
        <div style={{ borderTop: "1px solid " + theme.ink, marginTop: "3px" }} />
        <p className="mt-3 mb-0">
          <Instagram account={SOCIAL.news} size="10.5px" />
        </p>
      </section>

      <div className="max-w-[1180px] mx-auto px-[18px] mt-4">
        <div className="flex gap-6 overflow-x-auto no-scrollbar"
             style={{ borderBottom: "1px solid " + theme.rule }}>
          {CATS.map((c) => (
            <button key={c} onClick={() => setActive(c)} className="py-3"
              style={{ ...fontUtility, fontSize: "10.5px", letterSpacing: "0.16em", whiteSpace: "nowrap",
                       color: active === c ? theme.ink : theme.ink2,
                       borderBottom: `2px solid ${active === c ? theme.brass : "transparent"}` }}>
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-[1180px] mx-auto px-[18px] pb-20">
        {shown.length === 0 ? (
          <div className="my-10 py-14 text-center"
               style={{ border: "1px dashed " + theme.rule, ...fontUtility,
                        fontSize: "10.5px", letterSpacing: "0.16em", color: theme.ink2 }}>
            {active} — NOTHING FILED YET
          </div>
        ) : (
          shown.map((a) => <Issue key={a.slug} a={a} lang={lang} />)
        )}
      </div>

      <Footer />
    </div>
  );
}
