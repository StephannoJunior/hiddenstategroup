import React, { useState } from "react";
import { MapPin, ArrowUpRight } from "lucide-react";
import { Reveal, StampTag, GrainOverlay, Nav, Footer, useGoogleFonts, fontDisplay, fontUtility, fontBody, BookingDrawer } from "../components/Shared";
import { ARTISTS, FILTERS, FILTER_MAP } from "../lib/data";

function Hero() {
  return (
    <section className="pt-40 md:pt-52 pb-16 md:pb-24 px-6 md:px-10 max-w-[1600px] mx-auto">
      <Reveal>
        <StampTag>AGENCY</StampTag>
        <h1 className="mt-6 text-[48px] leading-[1.02] md:text-[96px] md:leading-[0.98]" style={{ ...fontDisplay, fontWeight: 500, color: "#F4F1EA" }}>
          Hidden State
          <br />
          <span style={{ fontStyle: "italic", color: "#B98A2E" }}>Agency</span>
        </h1>
        <p className="mt-6 text-[15px] md:text-[18px] max-w-lg" style={{ ...fontBody, color: "#C7C3B8" }}>
          Artists. Sound. Experiences.
        </p>
      </Reveal>
    </section>
  );
}

function FilterBar({ active, setActive }) {
  return (
    <div className="border-y sticky top-16 md:top-[112px] z-30" style={{ borderColor: "#2A2823", background: "#0A0A09" }}>
      <div className="max-w-[1600px] mx-auto px-6 md:px-10">
        <div className="flex items-center gap-6 md:gap-8 overflow-x-auto no-scrollbar py-4">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setActive(f)}
              className="shrink-0 text-[12px] tracking-[0.14em] pb-1 border-b transition-colors"
              style={{ ...fontUtility, color: active === f ? "#F4F1EA" : "#8C887E", borderColor: active === f ? "#B98A2E" : "transparent" }}
            >
              {f}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ArtistCard({ artist, index, onBook }) {
  return (
    <Reveal delay={index * 60}>
      <div className="group relative">
        <div className="relative overflow-hidden aspect-[4/5]">
          <img src={artist.photo} alt="" className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.05]" style={{ filter: "grayscale(20%)" }} />
          <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(10,10,9,0) 45%, rgba(10,10,9,0.9) 100%)" }} />
          <div className="absolute left-0 right-0 bottom-0 p-5">
            <StampTag>{artist.type.toUpperCase()}</StampTag>
            <h3 className="mt-3 text-[22px]" style={{ ...fontDisplay, fontWeight: 500, color: "#F4F1EA" }}>{artist.name}</h3>
            <p style={{ ...fontUtility, fontSize: "11px", letterSpacing: "0.06em", color: "#C7C3B8" }} className="mt-1">{artist.genres.join(", ")}</p>
            <p className="flex items-center gap-1 mt-1" style={{ ...fontUtility, fontSize: "10.5px", letterSpacing: "0.06em", color: "#8C887E" }}>
              <MapPin size={11} strokeWidth={1.5} /> {artist.location}
            </p>
            <p className="mt-3 text-[12.5px] leading-relaxed max-w-[90%]" style={{ ...fontBody, color: "#C7C3B8" }}>{artist.desc}</p>
            <button
              onClick={() => onBook(artist)}
              className="mt-4 inline-flex items-center gap-2 text-[11px] tracking-[0.16em] pb-1 border-b"
              style={{ ...fontUtility, color: "#B98A2E", borderColor: "#4A3B1C" }}
            >
              BOOKING <ArrowUpRight size={12} strokeWidth={1.5} />
            </button>
          </div>
        </div>
      </div>
    </Reveal>
  );
}

function Roster({ onBook }) {
  const [active, setActive] = useState("ALL");
  const filtered = active === "ALL" ? ARTISTS : ARTISTS.filter((a) => a.type === FILTER_MAP[active]);

  return (
    <>
      <FilterBar active={active} setActive={setActive} />
      <section className="max-w-[1600px] mx-auto px-6 md:px-10 py-16 md:py-20">
        {filtered.length === 0 ? (
          <p style={{ ...fontUtility, letterSpacing: "0.14em", fontSize: "12px", color: "#8C887E" }} className="text-center py-16">
            NOTHING FOUND
          </p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5 md:gap-6">
            {filtered.map((a, i) => (
              <ArtistCard key={a.id} artist={a} index={i} onBook={onBook} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}

export default function Agency() {
  useGoogleFonts();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedArtist, setSelectedArtist] = useState(null);

  const openBooking = (artist) => {
    setSelectedArtist(artist);
    setDrawerOpen(true);
  };

  return (
    <div style={{ background: "#0A0A09", minHeight: "100vh" }}>
      <GrainOverlay />
      <Nav />
      <Hero />
      <Roster onBook={openBooking} />
      <Footer />
      <BookingDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} artist={selectedArtist} />
    </div>
  );
}
