import React from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Reveal, StampTag, GrainOverlay, Nav, Footer, useGoogleFonts, fontDisplay, fontUtility, fontBody } from "../components/Shared";
import { ARTICLES, HERO } from "../lib/data";

function resolveStory(slug) {
  if (slug === "afro-tech-session") {
    return { category: HERO.category, headline: HERO.headline, excerpt: HERO.excerpt, date: HERO.date, readTime: HERO.readTime, image: HERO.image };
  }
  const match = slug.match(/^article-(\d+)$/);
  if (match) {
    const article = ARTICLES.find((a) => String(a.id) === match[1]);
    if (article) {
      return { category: article.category, headline: article.headline, excerpt: article.excerpt, date: article.date, readTime: article.readTime, image: article.image };
    }
  }
  return null;
}

export default function NewsArticle() {
  useGoogleFonts();
  const { slug } = useParams();
  const navigate = useNavigate();
  const story = resolveStory(slug || "");

  if (!story) {
    return (
      <div style={{ background: "#0A0A09", minHeight: "100vh" }}>
        <GrainOverlay />
        <Nav />
        <section className="pt-40 md:pt-52 pb-24 px-6 md:px-10 max-w-[1600px] mx-auto text-center">
          <StampTag>NOT FOUND</StampTag>
          <h1 className="mt-6 text-[32px] md:text-[48px]" style={{ ...fontDisplay, fontWeight: 500, color: "#F4F1EA" }}>
            We couldn't find that story.
          </h1>
          <button
            onClick={() => navigate("/news")}
            className="inline-flex items-center gap-2 mt-8 text-[12px] tracking-[0.16em] pb-1 border-b"
            style={{ ...fontUtility, color: "#B98A2E", borderColor: "#4A3B1C" }}
          >
            <ArrowLeft size={14} strokeWidth={1.5} /> BACK TO NEWS
          </button>
        </section>
        <Footer />
      </div>
    );
  }

  return (
    <div style={{ background: "#0A0A09", minHeight: "100vh" }}>
      <GrainOverlay />
      <Nav />
      <article className="pt-28 md:pt-32 pb-20 md:pb-28 px-6 md:px-10 max-w-[900px] mx-auto">
        <Reveal>
          <Link to="/news" className="inline-flex items-center gap-2 text-[11px] tracking-[0.14em] mb-8" style={{ ...fontUtility, color: "#8C887E" }}>
            <ArrowLeft size={13} strokeWidth={1.5} /> ALL STORIES
          </Link>
          <StampTag>{story.category}</StampTag>
          <h1 className="mt-5 text-[32px] md:text-[48px] leading-[1.08]" style={{ ...fontDisplay, fontWeight: 500, color: "#F4F1EA" }}>
            {story.headline}
          </h1>
          <div className="flex items-center gap-3 mt-5" style={{ ...fontUtility, fontSize: "11px", letterSpacing: "0.08em", color: "#8C887E" }}>
            <span>{story.date}</span>
            <span>·</span>
            <span>{story.readTime}</span>
          </div>
          <div className="relative overflow-hidden aspect-[16/9] mt-8">
            <img src={story.image} alt="" className="w-full h-full object-cover" style={{ filter: "grayscale(10%)" }} />
          </div>
          <p className="mt-8 text-[16px] md:text-[18px] leading-relaxed" style={{ ...fontDisplay, fontStyle: "italic", color: "#C7C3B8" }}>
            {story.excerpt}
          </p>
          <div className="mt-6 text-[15px] leading-relaxed space-y-4" style={{ ...fontBody, color: "#C7C3B8" }}>
            <p>
              The full write-up for this story goes here. This page is wired up and routes
              correctly from every article card on the site — swap in the real article body
              whenever it's ready.
            </p>
          </div>
        </Reveal>
      </article>
      <Footer />
    </div>
  );
}
