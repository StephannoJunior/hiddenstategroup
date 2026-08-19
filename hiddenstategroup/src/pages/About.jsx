import React from "react";
import { Reveal, StampTag, DoubleRule, GrainOverlay, Nav, Footer, MarkClipping, useGoogleFonts, fontDisplay, fontUtility, fontBody } from "../components/Shared";
import { MARK_SJ, MARK_SEAL, MARK_NOPROBLEM } from "../lib/marks";

const PILLARS = [
  { label: "NEWS", desc: "Music & Culture" },
  { label: "RECORDS", desc: "Releases & Label" },
  { label: "AGENCY", desc: "Booking & Representation" },
  { label: "ARTISTS", desc: "Artist Roster" },
  { label: "EVENTS", desc: "Events & Experiences" },
  { label: "MIXES", desc: "Sessions & Radio" },
];

export default function About() {
  useGoogleFonts();
  return (
    <div style={{ background: "#0A0A09", minHeight: "100vh" }}>
      <GrainOverlay />
      <Nav />
      <section className="pt-40 md:pt-52 pb-14 md:pb-20 px-6 md:px-10 max-w-[1600px] mx-auto">
        <Reveal>
          <StampTag>ABOUT</StampTag>
          <h1 className="mt-6 text-[42px] leading-[1.05] md:text-[80px] md:leading-[0.98]" style={{ ...fontDisplay, fontWeight: 500, color: "#F4F1EA" }}>
            The Hidden State
            <br />
            <span style={{ fontStyle: "italic", color: "#B98A2E" }}>Ecosystem</span>
          </h1>
          <p className="mt-6 text-[15px] md:text-[18px] max-w-xl leading-relaxed" style={{ ...fontBody, color: "#C7C3B8" }}>
            Founded by Stephanno JR. in 2020, Hidden State connects a label, a booking
            agency, an artist roster, and the events and media that tie them together.
            This paragraph is placeholder copy — replace it with the real story whenever
            it's ready.
          </p>
        </Reveal>
      </section>

      <section className="max-w-[1600px] mx-auto px-6 md:px-10 pb-16 md:pb-24">
        <DoubleRule className="mb-10" />
        <Reveal>
          <h2 style={{ ...fontUtility, fontSize: "11px", letterSpacing: "0.16em", color: "#B98A2E" }}>THE ECOSYSTEM</h2>
        </Reveal>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-6 md:gap-8 mt-8">
          {PILLARS.map((p, i) => (
            <Reveal key={p.label} delay={i * 60}>
              <div className="border p-5 md:p-6" style={{ borderColor: "#2A2823" }}>
                <h3 className="text-[20px]" style={{ ...fontDisplay, fontWeight: 500, color: "#F4F1EA" }}>{p.label}</h3>
                <p className="mt-1" style={{ ...fontUtility, fontSize: "11px", letterSpacing: "0.06em", color: "#8C887E" }}>{p.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="max-w-[1600px] mx-auto px-6 md:px-10 pb-20 md:pb-28">
        <DoubleRule className="mb-10" />
        <Reveal>
          <h2 style={{ ...fontUtility, fontSize: "11px", letterSpacing: "0.16em", color: "#B98A2E" }}>MARKS</h2>
          <div className="flex flex-wrap items-center gap-4 mt-6">
            <MarkClipping src={MARK_SJ} alt="SJ — Stephanno JR." />
            <MarkClipping src={MARK_SEAL} alt="Hidden State seal, est. 2005" w={100} />
            <MarkClipping src={MARK_NOPROBLEM} alt="No Problem imprint" />
          </div>
        </Reveal>
      </section>
      <Footer />
    </div>
  );
}
