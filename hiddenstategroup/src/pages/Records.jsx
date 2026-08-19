import React from "react";
import { Link } from "react-router-dom";
import { Play } from "lucide-react";
import { Reveal, StampTag, GrainOverlay, Nav, Footer, useGoogleFonts, fontDisplay, fontUtility, fontBody } from "../components/Shared";
import { RELEASES, FEATURED_RELEASE } from "../lib/data";

function Hero() {
  return (
    <section className="pt-40 md:pt-52 pb-16 md:pb-24 px-6 md:px-10 max-w-[1600px] mx-auto">
      <Reveal>
        <StampTag>RECORDS</StampTag>
        <h1
          className="mt-6 text-[48px] leading-[1.02] md:text-[96px] md:leading-[0.98]"
          style={{ ...fontDisplay, fontWeight: 500, color: "#F4F1EA" }}
        >
          Hidden State
          <br />
          <span style={{ fontStyle: "italic", color: "#B98A2E" }}>Records</span>
        </h1>
        <p className="mt-6 text-[15px] md:text-[18px] max-w-lg" style={{ ...fontBody, color: "#C7C3B8" }}>
          Music beyond boundaries.
        </p>
      </Reveal>
    </section>
  );
}

function FeaturedRelease() {
  const r = FEATURED_RELEASE;
  return (
    <section className="px-6 md:px-10 max-w-[1600px] mx-auto pb-20 md:pb-28">
      <Reveal>
        <div className="grid md:grid-cols-2 gap-0 border" style={{ borderColor: "#2A2823" }}>
          <div className="relative aspect-square overflow-hidden group">
            <img src={r.artwork} alt="" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
            <button
              className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity duration-300"
              style={{ background: "rgba(10,10,9,0.4)" }}
              aria-label="Play"
            >
              <span className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: "#F4F1EA" }}>
                <Play size={22} color="#0A0A09" fill="#0A0A09" />
              </span>
            </button>
          </div>
          <div className="p-8 md:p-14 flex flex-col justify-center" style={{ background: "#E9DCC3" }}>
            <span style={{ ...fontUtility, fontSize: "11px", letterSpacing: "0.16em", color: "#4A3B1C" }}>FEATURED RELEASE — {r.catalog}</span>
            <h2 className="mt-4 text-[30px] md:text-[42px] leading-[1.05]" style={{ ...fontDisplay, fontWeight: 500, color: "#1A1712" }}>
              {r.title}
            </h2>
            <p className="mt-2 text-[16px]" style={{ ...fontDisplay, fontStyle: "italic", color: "#1A1712" }}>
              {r.artist}
            </p>
            <div className="flex items-center gap-3 mt-5" style={{ ...fontUtility, fontSize: "11px", letterSpacing: "0.08em", color: "#5A4E38" }}>
              <span>{r.genre}</span>
              <span>·</span>
              <span>{r.date}</span>
            </div>
            <p className="mt-5 text-[14px] leading-relaxed max-w-md" style={{ ...fontBody, color: "#3A331F" }}>
              {r.description}
            </p>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-8" style={{ ...fontUtility, fontSize: "11px", letterSpacing: "0.1em", color: "#1A1712" }}>
              {["SPOTIFY", "APPLE MUSIC", "BEATPORT", "SOUNDCLOUD", "YOUTUBE"].map((p) => (
                <a key={p} href="#" className="border-b pb-0.5" style={{ borderColor: "#1A1712" }}>
                  {p}
                </a>
              ))}
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

function ReleaseCard({ release, index }) {
  return (
    <Reveal delay={index * 60}>
      <Link to={`/records/${release.id}`} className="group block">
        <div className="relative overflow-hidden aspect-square">
          <img src={release.artwork} alt="" className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.06]" />
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center" style={{ background: "rgba(10,10,9,0.45)" }}>
            <span className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: "#F4F1EA" }}>
              <Play size={16} color="#0A0A09" fill="#0A0A09" />
            </span>
          </div>
        </div>
        <div className="mt-3">
          <div className="flex items-center justify-between">
            <span style={{ ...fontUtility, fontSize: "10px", letterSpacing: "0.1em", color: "#8C887E" }}>{release.catalog}</span>
            <span style={{ ...fontUtility, fontSize: "10px", letterSpacing: "0.1em", color: "#8C887E" }}>{release.date}</span>
          </div>
          <h3 className="mt-1 text-[17px]" style={{ ...fontDisplay, fontWeight: 500, color: "#F4F1EA" }}>
            {release.title}
          </h3>
          <p style={{ ...fontBody, fontSize: "13px", color: "#8C887E" }}>{release.artist} — {release.genre}</p>
        </div>
      </Link>
    </Reveal>
  );
}

function ReleaseSection({ title, releases }) {
  if (releases.length === 0) {
    return (
      <section className="px-6 md:px-10 max-w-[1600px] mx-auto py-16 border-t" style={{ borderColor: "#2A2823" }}>
        <p style={{ ...fontUtility, letterSpacing: "0.14em", fontSize: "12px", color: "#8C887E" }} className="text-center py-8">
          {title === "Latest Releases" ? "NO RELEASES YET" : title === "Upcoming Releases" ? "NO UPCOMING RELEASES" : "NOTHING FOUND"}
        </p>
      </section>
    );
  }
  return (
    <section className="px-6 md:px-10 max-w-[1600px] mx-auto py-16 md:py-20 border-t" style={{ borderColor: "#2A2823" }}>
      <Reveal>
        <h2 className="mb-8 md:mb-10 text-[24px] md:text-[30px]" style={{ ...fontDisplay, fontStyle: "italic", fontWeight: 500, color: "#F4F1EA" }}>
          {title}
        </h2>
      </Reveal>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
        {releases.map((r, i) => (
          <ReleaseCard key={r.id} release={r} index={i} />
        ))}
      </div>
    </section>
  );
}

export default function Records() {
  useGoogleFonts();
  const latest = RELEASES.filter((r) => r.status === "latest");
  const upcoming = RELEASES.filter((r) => r.status === "upcoming");
  const discography = RELEASES.filter((r) => r.status === "discography");

  return (
    <div style={{ background: "#0A0A09", minHeight: "100vh" }}>
      <GrainOverlay />
      <Nav />
      <Hero />
      <FeaturedRelease />
      <ReleaseSection title="Latest Releases" releases={latest} />
      <ReleaseSection title="Upcoming Releases" releases={upcoming} />
      <ReleaseSection title="Discography" releases={discography} />
      <Footer />
    </div>
  );
}
