import React from "react";
import { Play } from "lucide-react";
import { Reveal, StampTag, GrainOverlay, Nav, Footer, useGoogleFonts, fontDisplay, fontUtility, fontBody } from "../components/Shared";

const PLACEHOLDER_SESSIONS = [
  { id: 1, title: "Hidden State Sessions Vol. 4", host: "Stephanno JR.", length: "62 MIN" },
  { id: 2, title: "Studio Dispatch — Deep House Selects", host: "Nomi Reyes", length: "48 MIN" },
  { id: 3, title: "Live From Warehouse 12", host: "Ilé", length: "71 MIN" },
];

export default function Mixes() {
  useGoogleFonts();
  return (
    <div style={{ background: "#0A0A09", minHeight: "100vh" }}>
      <GrainOverlay />
      <Nav />
      <section className="pt-40 md:pt-52 pb-14 md:pb-20 px-6 md:px-10 max-w-[1600px] mx-auto">
        <Reveal>
          <StampTag>MIXES</StampTag>
          <h1 className="mt-6 text-[48px] leading-[1.02] md:text-[96px] md:leading-[0.98]" style={{ ...fontDisplay, fontWeight: 500, color: "#F4F1EA" }}>
            Sessions
            <br />
            <span style={{ fontStyle: "italic", color: "#B98A2E" }}>&amp; Radio</span>
          </h1>
          <p className="mt-6 text-[15px] md:text-[18px] max-w-lg" style={{ ...fontBody, color: "#C7C3B8" }}>
            Recorded sets from the Hidden State roster. This page is a placeholder —
            swap these three cards for real embeds (SoundCloud, Mixcloud, or hosted audio)
            whenever the first session is ready.
          </p>
        </Reveal>
      </section>

      <section className="max-w-[1600px] mx-auto px-6 md:px-10 pb-20 md:pb-28">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
          {PLACEHOLDER_SESSIONS.map((s, i) => (
            <Reveal key={s.id} delay={i * 70}>
              <div className="border p-6 flex flex-col justify-between h-full" style={{ borderColor: "#2A2823" }}>
                <div>
                  <span
                    className="inline-flex items-center justify-center w-10 h-10 rounded-full mb-5"
                    style={{ background: "#131211", border: "1px solid #2A2823" }}
                  >
                    <Play size={14} color="#B98A2E" fill="#B98A2E" />
                  </span>
                  <h3 className="text-[19px]" style={{ ...fontDisplay, fontWeight: 500, color: "#F4F1EA" }}>{s.title}</h3>
                  <p className="mt-2" style={{ ...fontUtility, fontSize: "11px", letterSpacing: "0.08em", color: "#8C887E" }}>
                    {s.host} · {s.length}
                  </p>
                </div>
                <p className="mt-6 text-[12.5px]" style={{ ...fontUtility, letterSpacing: "0.08em", color: "#4A3B1C" }}>
                  COMING SOON
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>
      <Footer />
    </div>
  );
}
