import React from "react";
import { useNavigate } from "react-router-dom";
import { MapPin } from "lucide-react";
import { Reveal, StampTag, GrainOverlay, Nav, Footer, useGoogleFonts, fontDisplay, fontUtility, fontBody } from "../components/Shared";
import { EVENTS } from "../lib/data";

function EventsHero() {
  return (
    <section className="pt-40 md:pt-52 pb-14 md:pb-20 px-6 md:px-10 max-w-[1600px] mx-auto">
      <Reveal>
        <StampTag>EVENTS</StampTag>
        <h1 className="mt-6 text-[48px] leading-[1.02] md:text-[96px] md:leading-[0.98]" style={{ ...fontDisplay, fontWeight: 500, color: "#F4F1EA" }}>
          Hidden State
          <br />
          <span style={{ fontStyle: "italic", color: "#B98A2E" }}>Events</span>
        </h1>
        <p className="mt-6 text-[15px] md:text-[18px] max-w-lg" style={{ ...fontBody, color: "#C7C3B8" }}>
          The rooms where Hidden State lives.
        </p>
      </Reveal>
    </section>
  );
}

function EventCard({ event, index, onOpen }) {
  const isPast = event.status === "past";
  return (
    <Reveal delay={index * 60}>
      <button onClick={() => onOpen(event)} className="group block w-full text-left">
        <div className="relative overflow-hidden aspect-[16/10]">
          <img
            src={event.artwork}
            alt=""
            className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.05]"
            style={{ filter: isPast ? "grayscale(70%)" : "grayscale(10%)" }}
          />
          <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(10,10,9,0) 55%, rgba(10,10,9,0.9) 100%)" }} />
          <div className="absolute left-0 right-0 bottom-0 p-5">
            <StampTag tone={isPast ? "plain" : "accent"}>{isPast ? "PAST" : event.date}</StampTag>
            <h3 className="mt-3 text-[20px] md:text-[22px] leading-tight" style={{ ...fontDisplay, fontWeight: 500, color: "#F4F1EA" }}>
              {event.name}
            </h3>
            <p className="flex items-center gap-1.5 mt-2" style={{ ...fontUtility, fontSize: "11px", letterSpacing: "0.06em", color: "#C7C3B8" }}>
              <MapPin size={12} strokeWidth={1.5} /> {event.venue}, {event.city}, {event.country}
            </p>
            <p style={{ ...fontBody, fontSize: "12.5px", color: "#8C887E" }} className="mt-2">
              {event.lineup.join(" · ")}
            </p>
          </div>
        </div>
      </button>
    </Reveal>
  );
}

function EventSection({ title, events, onOpen }) {
  return (
    <section className="max-w-[1600px] mx-auto px-6 md:px-10 py-14 md:py-16 border-t" style={{ borderColor: "#2A2823" }}>
      <Reveal>
        <h2 className="mb-8 md:mb-10 text-[24px] md:text-[30px]" style={{ ...fontDisplay, fontStyle: "italic", fontWeight: 500, color: "#F4F1EA" }}>
          {title}
        </h2>
      </Reveal>
      {events.length === 0 ? (
        <p style={{ ...fontUtility, letterSpacing: "0.14em", fontSize: "12px", color: "#8C887E" }} className="text-center py-16">
          {title === "Upcoming Events" ? "NO UPCOMING EVENTS" : "NO PAST EVENTS"}
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
          {events.map((e, i) => <EventCard key={e.id} event={e} index={i} onOpen={onOpen} />)}
        </div>
      )}
    </section>
  );
}

function EventsList({ onOpen }) {
  const upcoming = EVENTS.filter((e) => e.status === "upcoming");
  const past = EVENTS.filter((e) => e.status === "past");
  return (
    <>
      <EventsHero />
      <EventSection title="Upcoming Events" events={upcoming} onOpen={onOpen} />
      <EventSection title="Past Events" events={past} onOpen={onOpen} />
    </>
  );
}

export default function Events() {
  useGoogleFonts();
  const navigate = useNavigate();
  const openEvent = (event) => navigate(`/events/${event.id}`);

  return (
    <div style={{ background: "#0A0A09", minHeight: "100vh" }}>
      <GrainOverlay />
      <Nav />
      <EventsList onOpen={openEvent} />
      <Footer />
    </div>
  );
}
