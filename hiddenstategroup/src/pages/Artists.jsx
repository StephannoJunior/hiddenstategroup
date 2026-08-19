import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapPin } from "lucide-react";
import { Reveal, StampTag, GrainOverlay, Nav, Footer, useGoogleFonts, fontDisplay, fontUtility, BookingDrawer } from "../components/Shared";
import { ARTISTS } from "../lib/data";

const GENRES = ["ALL GENRES", "Afro House", "Afro Tech", "Deep House", "House", "Melodic House", "Tech House", "Organic House", "Electronic"];
const COUNTRIES = ["ALL COUNTRIES", "Romania", "Portugal", "Germany", "Nigeria", "United Kingdom", "Spain", "Netherlands", "South Africa"];
const TYPES = ["ALL TYPES", "DJ", "Producer", "Live Act"];

const selectStyle = {
  ...fontUtility,
  fontSize: "11px",
  letterSpacing: "0.08em",
  background: "transparent",
  border: "1px solid #2A2823",
  color: "#F4F1EA",
  padding: "9px 12px",
  outline: "none",
};

function DirectoryHero() {
  return (
    <section className="pt-40 md:pt-52 pb-14 md:pb-20 px-6 md:px-10 max-w-[1600px] mx-auto">
      <Reveal>
        <StampTag>ARTISTS</StampTag>
        <h1 className="mt-6 text-[48px] leading-[1.02] md:text-[96px] md:leading-[0.98]" style={{ ...fontDisplay, fontWeight: 500, color: "#F4F1EA" }}>
          The Hidden State
          <br />
          <span style={{ fontStyle: "italic", color: "#B98A2E" }}>Roster</span>
        </h1>
      </Reveal>
    </section>
  );
}

function DirectoryFilters({ genre, setGenre, country, setCountry, type, setType }) {
  return (
    <div className="border-y sticky top-16 md:top-[112px] z-30" style={{ borderColor: "#2A2823", background: "#0A0A09" }}>
      <div className="max-w-[1600px] mx-auto px-6 md:px-10 py-3 flex flex-wrap items-center gap-3">
        <select style={selectStyle} value={genre} onChange={(e) => setGenre(e.target.value)}>
          {GENRES.map((g) => <option key={g} value={g}>{g.toUpperCase()}</option>)}
        </select>
        <select style={selectStyle} value={country} onChange={(e) => setCountry(e.target.value)}>
          {COUNTRIES.map((c) => <option key={c} value={c}>{c.toUpperCase()}</option>)}
        </select>
        <select style={selectStyle} value={type} onChange={(e) => setType(e.target.value)}>
          {TYPES.map((t) => <option key={t} value={t}>{t.toUpperCase()}</option>)}
        </select>
      </div>
    </div>
  );
}

function DirectoryCard({ artist, index, onOpen }) {
  return (
    <Reveal delay={index * 50}>
      <button onClick={() => onOpen(artist)} className="group block w-full text-left">
        <div className="relative overflow-hidden aspect-[4/5]">
          <img src={artist.photo} alt="" className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.05]" style={{ filter: "grayscale(20%)" }} />
        </div>
        <div className="mt-3">
          <h3 className="text-[18px]" style={{ ...fontDisplay, fontWeight: 500, color: "#F4F1EA" }}>{artist.name}</h3>
          <p style={{ ...fontUtility, fontSize: "10.5px", letterSpacing: "0.06em", color: "#8C887E" }} className="mt-1">
            {artist.genres.join(", ")}
          </p>
          <p className="flex items-center gap-1 mt-1" style={{ ...fontUtility, fontSize: "10.5px", letterSpacing: "0.06em", color: "#8C887E" }}>
            <MapPin size={11} strokeWidth={1.5} /> {artist.location}
          </p>
        </div>
      </button>
    </Reveal>
  );
}

function Directory({ onOpen }) {
  const [genre, setGenre] = useState("ALL GENRES");
  const [country, setCountry] = useState("ALL COUNTRIES");
  const [type, setType] = useState("ALL TYPES");

  const filtered = ARTISTS.filter((a) => {
    if (genre !== "ALL GENRES" && !a.genres.includes(genre)) return false;
    if (country !== "ALL COUNTRIES" && a.country !== country) return false;
    if (type !== "ALL TYPES" && a.type !== type) return false;
    return true;
  });

  return (
    <>
      <DirectoryHero />
      <DirectoryFilters genre={genre} setGenre={setGenre} country={country} setCountry={setCountry} type={type} setType={setType} />
      <section className="max-w-[1600px] mx-auto px-6 md:px-10 py-16 md:py-20">
        {filtered.length === 0 ? (
          <p style={{ ...fontUtility, letterSpacing: "0.14em", fontSize: "12px", color: "#8C887E" }} className="text-center py-16">
            NOTHING FOUND
          </p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
            {filtered.map((a, i) => (
              <DirectoryCard key={a.id} artist={a} index={i} onOpen={onOpen} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}

export default function Artists() {
  useGoogleFonts();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [bookingArtist, setBookingArtist] = useState(null);

  const openProfile = (artist) => {
    navigate(`/artists/${artist.id}`);
  };
  const handleBook = (artist) => {
    setBookingArtist(artist);
    setDrawerOpen(true);
  };

  return (
    <div style={{ background: "#0A0A09", minHeight: "100vh" }}>
      <GrainOverlay />
      <Nav />
      <Directory onOpen={openProfile} />
      <Footer />
      <BookingDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} artist={bookingArtist} />
    </div>
  );
}
