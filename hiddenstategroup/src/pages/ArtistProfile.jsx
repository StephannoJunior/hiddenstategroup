import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { MapPin, ArrowLeft } from "lucide-react";
import { Reveal, StampTag, GrainOverlay, Nav, Footer, useGoogleFonts, fontDisplay, fontUtility, fontBody, BookingDrawer } from "../components/Shared";
import { ARTISTS } from "../lib/data";

function EventRow({ e }) {
  return (
    <div className="flex items-center justify-between py-3 border-b" style={{ borderColor: "#2A2823" }}>
      <div>
        <p style={{ ...fontDisplay, fontSize: "15px", color: "#F4F1EA" }}>{e.name}</p>
        <p style={{ ...fontUtility, fontSize: "10.5px", letterSpacing: "0.06em", color: "#8C887E" }}>{e.venue}</p>
      </div>
      <span style={{ ...fontUtility, fontSize: "10.5px", letterSpacing: "0.08em", color: "#8C887E" }}>{e.date}</span>
    </div>
  );
}

export default function ArtistProfile() {
  useGoogleFonts();
  const { id } = useParams();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const artist = ARTISTS.find((a) => String(a.id) === id);

  if (!artist) {
    return (
      <div style={{ background: "#0A0A09", minHeight: "100vh" }}>
        <GrainOverlay />
        <Nav />
        <section className="pt-40 md:pt-52 pb-24 px-6 md:px-10 max-w-[1600px] mx-auto text-center">
          <StampTag>NOT FOUND</StampTag>
          <h1 className="mt-6 text-[32px] md:text-[48px]" style={{ ...fontDisplay, fontWeight: 500, color: "#F4F1EA" }}>
            We couldn't find that artist.
          </h1>
          <button
            onClick={() => navigate("/artists")}
            className="inline-flex items-center gap-2 mt-8 text-[12px] tracking-[0.16em] pb-1 border-b"
            style={{ ...fontUtility, color: "#B98A2E", borderColor: "#4A3B1C" }}
          >
            <ArrowLeft size={14} strokeWidth={1.5} /> BACK TO ARTISTS
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
      <section className="relative w-full h-[70vh] min-h-[440px] flex items-end overflow-hidden">
        <img src={artist.photo} alt="" className="absolute inset-0 w-full h-full object-cover" style={{ filter: "grayscale(15%)" }} />
        <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(10,10,9,0.1) 0%, rgba(10,10,9,0.4) 50%, rgba(10,10,9,0.96) 100%)" }} />
        <div className="relative z-10 max-w-[1600px] mx-auto w-full px-6 md:px-10 pb-10 md:pb-14">
          <button onClick={() => navigate("/artists")} className="mb-6 text-[11px] tracking-[0.14em]" style={{ ...fontUtility, color: "#8C887E" }}>
            ← ALL ARTISTS
          </button>
          <StampTag>{artist.type.toUpperCase()}</StampTag>
          <h1 className="mt-4 text-[42px] leading-[1.0] md:text-[76px]" style={{ ...fontDisplay, fontWeight: 500, color: "#F4F1EA" }}>
            {artist.name}
          </h1>
          <p className="flex items-center gap-1.5 mt-3" style={{ ...fontUtility, fontSize: "12px", letterSpacing: "0.06em", color: "#C7C3B8" }}>
            <MapPin size={13} strokeWidth={1.5} /> {artist.location} · {artist.genres.join(", ")}
          </p>
        </div>
      </section>

      <section className="max-w-[1600px] mx-auto px-6 md:px-10 py-14 md:py-20 grid md:grid-cols-3 gap-12">
        <div className="md:col-span-2">
          <Reveal>
            <h2 style={{ ...fontUtility, fontSize: "11px", letterSpacing: "0.16em", color: "#B98A2E" }}>BIOGRAPHY</h2>
            <p className="mt-4 text-[15px] md:text-[16px] leading-relaxed max-w-2xl" style={{ ...fontBody, color: "#C7C3B8" }}>
              {artist.bio}
            </p>
          </Reveal>

          {artist.releases.length > 0 && (
            <Reveal delay={100}>
              <div className="mt-14">
                <h2 style={{ ...fontUtility, fontSize: "11px", letterSpacing: "0.16em", color: "#B98A2E" }}>RELEASES</h2>
                <div className="mt-4">
                  {artist.releases.map((r) => (
                    <div key={r.cat} className="flex items-center justify-between py-3 border-b" style={{ borderColor: "#2A2823" }}>
                      <p style={{ ...fontDisplay, fontSize: "16px", color: "#F4F1EA" }}>{r.title}</p>
                      <span style={{ ...fontUtility, fontSize: "10.5px", letterSpacing: "0.08em", color: "#8C887E" }}>{r.cat}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>
          )}

          {artist.upcoming.length > 0 && (
            <Reveal delay={150}>
              <div className="mt-14">
                <h2 style={{ ...fontUtility, fontSize: "11px", letterSpacing: "0.16em", color: "#B98A2E" }}>UPCOMING EVENTS</h2>
                <div className="mt-4">{artist.upcoming.map((e, i) => <EventRow key={i} e={e} />)}</div>
              </div>
            </Reveal>
          )}

          {artist.past.length > 0 && (
            <Reveal delay={200}>
              <div className="mt-14">
                <h2 style={{ ...fontUtility, fontSize: "11px", letterSpacing: "0.16em", color: "#8C887E" }}>PAST EVENTS</h2>
                <div className="mt-4">{artist.past.map((e, i) => <EventRow key={i} e={e} />)}</div>
              </div>
            </Reveal>
          )}
        </div>

        <Reveal delay={100}>
          <div className="border p-6 md:sticky md:top-32" style={{ borderColor: "#2A2823" }}>
            <button
              onClick={() => setDrawerOpen(true)}
              className="w-full text-[12px] tracking-[0.16em] py-4"
              style={{ ...fontUtility, color: "#0A0A09", background: "#F4F1EA" }}
            >
              BOOK THIS ARTIST
            </button>
            <div className="mt-6 space-y-2">
              <p style={{ ...fontUtility, fontSize: "10.5px", letterSpacing: "0.1em", color: "#8C887E" }}>SOCIAL</p>
              <p style={{ ...fontBody, fontSize: "13px", color: "#C7C3B8" }}>Instagram — {artist.instagram}</p>
              <p style={{ ...fontBody, fontSize: "13px", color: "#C7C3B8" }}>SoundCloud — {artist.soundcloud}</p>
            </div>
          </div>
        </Reveal>
      </section>
      <Footer />
      <BookingDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} artist={artist} />
    </div>
  );
}
