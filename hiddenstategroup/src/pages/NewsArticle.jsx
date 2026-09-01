import { useArticleSchema, usePageMeta } from "../lib/seo";
import { useLang } from "../lib/lang";
import Img from "../components/Img";
import { ReadingProgress, ShareRow, BackToTop, readingTime } from "../components/ArticleExtras";
import React from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import {
  Nav, Footer, useGoogleFonts,
  DetailHead, fontDisplay, fontUtility, fontText, theme,
} from "../components/Shared";
import { getArticle, ARTICLES, localised, usePosts } from "../lib/news";

/*
  THE PULL QUOTE.

  A paper lifts a line out of a story and sets it large, so someone flicking
  past reads one sentence and stops. The stylesheet has had a pull-quote rule
  since the redesign and only the sign-off ever used it.

  Choosing the line is the whole problem, and the rule here is deliberately
  dull: from the middle of the piece — never the opening, which the reader is
  about to read anyway, and never the ending, which would give it away — take
  the longest sentence that still fits on three lines. Long-but-not-too-long
  is a decent proxy for "has something in it", and being predictable means it
  never lands on a fragment.

  Returns null rather than guessing when the article is short. Two paragraphs
  do not need a line pulled out of them.
*/
function pullQuote(body) {
  if (!Array.isArray(body) || body.length < 4) return null;

  const middle = body.slice(1, -1).join(" ");
  const sentences = middle
    .split(/(?<=[.!?])\s+/)
    .map((x) => x.trim())
    .filter((x) => x.length >= 60 && x.length <= 150 && !x.includes("http"));

  if (!sentences.length) return null;
  return sentences.reduce((best, x) => (x.length > best.length ? x : best));
}

export default function NewsArticle() {
  useGoogleFonts();
  const { t, lang } = useLang();
  const { slug } = useParams();
  const { posts } = usePosts();
  // Prefer what the console has published; fall back to the bundled copy so
  // the page still renders before the fetch lands.
  const aRaw = posts.find((p) => p.slug === slug) || getArticle(slug);
  const a = localised(aRaw, lang);
  usePageMeta({ title: a ? a.headline : "Story", description: a ? a.summary : "Hidden State news.", image: a ? (a.photo || a.poster) : null, type: "article" });

  if (!a) {
    return (
      <div data-page style={{ background: theme.bg, minHeight: "100vh" }}>
        <Nav />
      {/* where the skip link lands */}
      <span id="main" tabIndex={-1} />
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

  useArticleSchema(a);

  const idx = ARTICLES.findIndex((x) => x.slug === slug);
  const prev = idx > 0 ? ARTICLES[idx - 1] : null;
  const next = idx > -1 && idx < ARTICLES.length - 1 ? ARTICLES[idx + 1] : null;

  // Chosen once per article, not on every render.
  const quote = pullQuote(a?.body);

  return (
    <div data-page style={{ background: theme.bg, minHeight: "100vh" }}>
      <Nav />
      <ReadingProgress />

      {/*
        The old head printed "Daily News" and then "Breaking News" above every
        single article, in the masthead face, before you reached the headline —
        two nameplates and a slogan standing between a reader and the one line
        they came for. The headline IS the page. It goes first, and large.
      */}
      <DetailHead
        items={[
          { label: "ISSUE", value: (a.issue || "—").toUpperCase() },
          { label: "FILED", value: (a.date || "").toUpperCase() },
          { label: "READ", value: `${readingTime(a.body)} MIN` },
        ]}
        image={a.photo || (a.posters || [])[0] || a.poster}
        meta={(a.category || "DISPATCH").toUpperCase()}
        title={a.headline}
        backTo="/news" backLabel="ALL ISSUES" />

      <article className="max-w-[900px] mx-auto px-[18px] pt-8 pb-16">

        {(a.posters || (a.poster ? [a.poster] : [])).length > 0 && (
          <figure className="m-0 mt-6">
            <div className={(a.posters || []).length > 1 ? "grid grid-cols-2 gap-3" : ""}>
              {(a.posters || [a.poster]).map((src) => (
                <Img key={src} src={src} alt={a.headline} className="w-full block"
                     style={{ background: theme.raised, border: "1px solid " + theme.rule }} />
              ))}
            </div>
            <figcaption className="pt-1.5 mt-1.5"
              style={{ ...fontUtility, fontSize: "9.5px", letterSpacing: "0.12em", color: theme.ink2,
                       borderTop: "1px solid " + theme.rule }}>
              {(a.posters || []).length > 1 ? t("printedIssues") : t("printedIssue")}
            </figcaption>
          </figure>
        )}

        {/* not the lead photo again — that is the page's hero now */}
        {a.photo && (a.posters || []).length > 0 && (
          <figure className="m-0 mt-6">
            <Img src={a.photo} alt={a.headline} className="w-full block" style={{ background: theme.raised }} />
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

        <div className="md:columns-2 md:gap-x-9 hs-wide-cols mt-5"
             style={{ ...fontText, fontSize: "17.5px", lineHeight: 1.64, color: theme.ink }}>
          {a.body.map((p, i) => (
            <React.Fragment key={i}>
              <p className={i === 0 ? "mt-0 mb-3.5 hs-drop" : "mb-3.5"}>{p}</p>
              {/* Set after the paragraph nearest a third of the way in, so it
                  falls in the body of the piece rather than beside the
                  opening. In two columns it breaks the run of text at about
                  the point the eye starts skimming. */}
              {quote && i === Math.max(1, Math.floor(a.body.length / 3)) && (
                <p className="hs-pullquote" style={{ breakInside: "avoid" }}>{quote}</p>
              )}
            </React.Fragment>
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

        {a.signoff && <p className="hs-pullquote">{a.signoff}</p>}

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

      <section className="max-w-[900px] mx-auto px-[18px] pb-4">
        <div className="flex flex-wrap justify-center gap-x-6 gap-y-3 pt-6"
             style={{ borderTop: "1px solid " + theme.rule }}>
          <ShareRow title={a.headline} />
        </div>
      </section>

      {(prev || next) && (
        <section className="max-w-[900px] mx-auto px-[18px] pb-16">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-6"
               style={{ borderTop: "2px solid " + theme.ink }}>
            {prev ? (
              <Link to={`/news/${prev.slug}`} className="block py-3">
                <span className="block" style={{ ...fontUtility, fontSize: "9px", letterSpacing: "0.2em", color: theme.brass }}>
                  ← {t("previous")}
                </span>
                <span className="block mt-1.5" style={{ ...fontDisplay, fontSize: "20px", lineHeight: 1.25, color: theme.ink }}>
                  {prev.headline}
                </span>
              </Link>
            ) : <span />}
            {next ? (
              <Link to={`/news/${next.slug}`} className="block py-3 md:text-right">
                <span className="block" style={{ ...fontUtility, fontSize: "9px", letterSpacing: "0.2em", color: theme.brass }}>
                  {t("next")} →
                </span>
                <span className="block mt-1.5" style={{ ...fontDisplay, fontSize: "20px", lineHeight: 1.25, color: theme.ink }}>
                  {next.headline}
                </span>
              </Link>
            ) : <span />}
          </div>
          <BackToTop />
        </section>
      )}

      <Footer />
    </div>
  );
}
