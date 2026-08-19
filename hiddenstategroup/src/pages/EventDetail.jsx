import React from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { MapPin, ArrowLeft } from "lucide-react";
import { Reveal, StampTag, GrainOverlay, Nav, Footer, useGoogleFonts, fontDisplay, fontUtility, fontBody } from "../components/Shared";
import { EVENTS } from "../lib/data";

export default function EventDetail() {
  useGoogleFonts();
  const { id } = useParams();
  const navigate = useNavigate();
  const event = EVENTS.find((e) => String(e.id) === id);

  if (!event) {
    return (
      <div style={{ background: "#0A0A09", minHeight: "100vh" }}>
        <GrainOverlay />
        <Nav />
        <section className="pt-40 md:pt-52 pb-24 px-6 md:px-10 max-w-[1600px] mx-auto text-center">
          <StampTag>NOT FOUND</StampTag>
          <h1 className="mt-6 text-[32px] md:text-[48px]" style={{ ...fontDisplay, fontWeight: 500, color: "#F4F1EA" }}>
            We couldn't find that event.
          </h1>
          <button
            onClick={() => navigate("/events")}
            className="inline-flex items-center gap-2 mt-8 text-[12px] tracking-[0.16em] pb-1 border-b"
            style={{ ...fontUtility, color: "#B98A2E", borderColor: "#4A3B1C" }}
          >
            <ArrowLeft size={14} strokeWidth={1.5} /> BACK TO EVENTS
          </button>
        </section>
        <Footer />
      </div>
    );
  }

  const isPast = event.status === "past";

  return (
    <div style={{ background: "#0A0A09", minHeight: "100vh" }}>
      <GrainOverlay />
      <Nav />
      <section className="relative w-full h-[64vh] min-h-[420px] flex items-end overflow-hidden">
        <img src={event.artwork} alt="" className="absolute inset-0 w-full h-full object-cover" style={{ filter: isPast ? "grayscale(60%)" : "grayscale(10%)" }} />
        <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(10,10,9,0.1) 0%, rgba(10,10,9,0.4) 50%, rgba(10,10,9,0.96) 100%)" }} />
        <div className="relative z-10 max-w-[1600px] mx-auto w-full px-6 md:px-10 pb-10 md:pb-14">
          <button onClick={() => navigate("/events")} className="mb-6 text-[11px] tracking-[0.14em]" style={{ ...fontUtility, color: "#8C887E" }}>
            ← ALL EVENTS
          </button>
          <StampTag tone={isPast ? "plain" : "accent"}>{isPast ? "PAST EVENT" : event.date}</StampTag>
          <h1 className="mt-4 text-[36px] leading-[1.05] md:text-[64px] md:leading-[1.0]" style={{ ...fontDisplay, fontWeight: 500, color: "#F4F1EA" }}>
            {event.name}
          </h1>
          <p className="flex items-center gap-1.5 mt-3" style={{ ...fontUtility, fontSize: "12px", letterSpacing: "0.06em", color: "#C7C3B8" }}>
            <MapPin size={13} strokeWidth={1.5} /> {event.venue}, {event.city}, {event.country}
          </p>
        </div>
      </section>

      <section className="max-w-[1600px] mx-auto px-6 md:px-10 py-14 md:py-20 grid md:grid-cols-3 gap-12">
        <div className="md:col-span-2">
          <Reveal>
            <h2 style={{ ...fontUtility, fontSize: "11px", letterSpacing: "0.16em", color: "#B98A2E" }}>ABOUT</h2>
            <p className="mt-4 text-[15px] md:text-[16px] leading-relaxed max-w-2xl" style={{ ...fontBody, color: "#C7C3B8" }}>
              {event.description}
            </p>
          </Reveal>

          <Reveal delay={100}>
            <div className="mt-14">
              <h2 style={{ ...fontUtility, fontSize: "11px", letterSpacing: "0.16em", color: "#B98A2E" }}>LINE-UP</h2>
              <div className="mt-4">
                {event.lineup.map((name, i) => (
                  <div key={i} className="flex items-center justify-between py-3 border-b" style={{ borderColor: "#2A2823" }}>
                    <p style={{ ...fontDisplay, fontSize: "18px", color: "#F4F1EA" }}>{name}</p>
                    <span style={{ ...fontUtility, fontSize: "10px", letterSpacing: "0.1em", color: "#8C887E" }}>0{i + 1}</span>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>

          {event.gallery.length > 0 && (
            <Reveal delay={150}>
              <div className="mt-14">
                <h2 style={{ ...fontUtility, fontSize: "11px", letterSpacing: "0.16em", color: "#8C887E" }}>GALLERY</h2>
                <div className="mt-4 grid grid-cols-3 gap-3">
                  {event.gallery.map((src, i) => (
                    <div key={i} className="relative overflow-hidden aspect-square">
                      <img src={src} alt="" className="w-full h-full object-cover" style={{ filter: "grayscale(40%)" }} />
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>
          )}
        </div>

        <Reveal delay={100}>
          <div className="border p-6 md:sticky md:top-32" style={{ borderColor: "#2A2823" }}>
            {!isPast ? (
              <Link to="/contact" className="block text-center text-[12px] tracking-[0.16em] py-4" style={{ ...fontUtility, color: "#0A0A09", background: "#F4F1EA" }}>
                TICKETS
              </Link>
            ) : (
              <p style={{ ...fontUtility, fontSize: "11px", letterSpacing: "0.1em", color: "#8C887E" }} className="text-center py-4 border">
                THIS EVENT HAS ENDED
              </p>
            )}
            <div className="mt-6 space-y-2">
              <p style={{ ...fontUtility, fontSize: "10.5px", letterSpacing: "0.1em", color: "#8C887E" }}>SHARE</p>
              <p style={{ ...fontBody, fontSize: "13px", color: "#C7C3B8" }}>Instagram — @hiddenstate</p>
            </div>
          </div>
        </Reveal>
      </section>
      <Footer />
    </div>
  );
}
