import React from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Play } from "lucide-react";
import { Reveal, StampTag, GrainOverlay, Nav, Footer, useGoogleFonts, fontDisplay, fontUtility, fontBody } from "../components/Shared";
import { RELEASES } from "../lib/data";

export default function ReleaseDetail() {
  useGoogleFonts();
  const { id } = useParams();
  const navigate = useNavigate();
  const release = RELEASES.find((r) => String(r.id) === id);

  if (!release) {
    return (
      <div style={{ background: "#0A0A09", minHeight: "100vh" }}>
        <GrainOverlay />
        <Nav />
        <section className="pt-40 md:pt-52 pb-24 px-6 md:px-10 max-w-[1600px] mx-auto text-center">
          <StampTag>NOT FOUND</StampTag>
          <h1 className="mt-6 text-[32px] md:text-[48px]" style={{ ...fontDisplay, fontWeight: 500, color: "#F4F1EA" }}>
            We couldn't find that release.
          </h1>
          <Link to="/records" className="inline-flex items-center gap-2 mt-8 text-[12px] tracking-[0.16em] pb-1 border-b" style={{ ...fontUtility, color: "#B98A2E", borderColor: "#4A3B1C" }}>
            <ArrowLeft size={14} strokeWidth={1.5} /> BACK TO RECORDS
          </Link>
        </section>
        <Footer />
      </div>
    );
  }

  return (
    <div style={{ background: "#0A0A09", minHeight: "100vh" }}>
      <GrainOverlay />
      <Nav />
      <section className="pt-28 md:pt-32 pb-20 md:pb-28 px-6 md:px-10 max-w-[1600px] mx-auto">
        <Reveal>
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 text-[11px] tracking-[0.14em] mb-8 md:mb-10"
            style={{ ...fontUtility, color: "#8C887E" }}
          >
            <ArrowLeft size={13} strokeWidth={1.5} /> BACK
          </button>

          <div className="grid md:grid-cols-2 gap-10 md:gap-16">
            <div className="relative overflow-hidden aspect-square group">
              <img src={release.artwork} alt="" className="w-full h-full object-cover" />
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

            <div className="flex flex-col justify-center">
              <div className="flex items-center gap-3" style={{ ...fontUtility, fontSize: "11px", letterSpacing: "0.12em", color: "#8C887E" }}>
                <span>{release.catalog}</span>
                <span>·</span>
                <span>{release.date}</span>
              </div>
              <h1 className="mt-4 text-[36px] md:text-[52px] leading-[1.04]" style={{ ...fontDisplay, fontWeight: 500, color: "#F4F1EA" }}>
                {release.title}
              </h1>
              <p className="mt-2 text-[17px]" style={{ ...fontDisplay, fontStyle: "italic", color: "#B98A2E" }}>
                {release.artist}
              </p>
              <p className="mt-5 text-[13px]" style={{ ...fontUtility, letterSpacing: "0.08em", color: "#8C887E" }}>
                {release.genre}
              </p>
              <p className="mt-6 text-[14px] md:text-[15px] leading-relaxed max-w-md" style={{ ...fontBody, color: "#C7C3B8" }}>
                Full release notes for {release.title} go here — track list, credits, and a short
                writeup on the record. This page is wired up and ready; swap in the real copy
                whenever you have it.
              </p>
              <Link
                to="/contact"
                className="inline-flex items-center gap-2 mt-8 text-[12px] tracking-[0.16em] px-6 py-3 border w-fit"
                style={{ ...fontUtility, color: "#0A0A09", background: "#F4F1EA" }}
              >
                STREAM / BUY
              </Link>
            </div>
          </div>
        </Reveal>
      </section>
      <Footer />
    </div>
  );
}
