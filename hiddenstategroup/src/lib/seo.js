import { useEffect } from "react";

/*
  usePageMeta — gives each page its own title and description.

  Before this, every page was titled "Hidden State", so Google showed the same
  thing for an artist profile, a release and a news story. Search engines and
  share previews both read these tags, so this is what makes an individual
  artist findable by name.
*/

const SITE = "Hidden State";
const BASE = "https://hiddenstategroup.com";

function setTag(selector, attr, value) {
  if (!value) return;
  let el = document.head.querySelector(selector);
  if (!el) {
    el = document.createElement("meta");
    const [, name] = selector.match(/\[(?:name|property)="([^"]+)"\]/) || [];
    if (selector.includes("property=")) el.setAttribute("property", name);
    else el.setAttribute("name", name);
    document.head.appendChild(el);
  }
  el.setAttribute(attr, value);
}

export function usePageMeta({ title = null, description = "", image = null, type = "website" }) {
  useEffect(() => {
    const full = title ? `${title} — ${SITE}` : SITE;
    document.title = full;

    setTag('meta[name="description"]', "content", description);
    setTag('meta[property="og:title"]', "content", full);
    setTag('meta[property="og:description"]', "content", description);
    setTag('meta[property="og:type"]', "content", type);
    if (image) setTag('meta[property="og:image"]', "content", BASE + image);

    // canonical, so the same page under different URLs isn't treated as duplicates
    let link = document.head.querySelector('link[rel="canonical"]');
    if (!link) {
      link = document.createElement("link");
      link.setAttribute("rel", "canonical");
      document.head.appendChild(link);
    }
    link.setAttribute("href", BASE + window.location.pathname);
  }, [title, description, image, type]);
}

/*
  useStructuredData — describes an event in the format Google reads.

  This is what allows a listing to appear as a rich result with its date and
  location shown directly in the search page, rather than a plain blue link.
*/
export function useEventSchema(event) {
  useEffect(() => {
    if (!event) return;
    const id = "hs-event-schema";
    document.getElementById(id)?.remove();

    const place = [event.venue, event.city, event.country].filter(Boolean).join(", ");
    const data = {
      "@context": "https://schema.org",
      "@type": "MusicEvent",
      name: event.name,
      startDate: event.sortDate || undefined,
      eventStatus: "https://schema.org/EventScheduled",
      eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
      description: event.description,
      image: event.artwork ? BASE + event.artwork : undefined,
      url: `${BASE}/events/${event.id}`,
      location: place
        ? { "@type": "Place", name: place, address: place }
        : { "@type": "Place", name: "To be announced", address: "To be announced" },
      performer: (event.lineup || []).map((n) => ({ "@type": "PerformingGroup", name: n })),
      organizer: { "@type": "Organization", name: SITE, url: BASE },
      offers: event.tickets
        ? { "@type": "Offer", url: event.tickets, availability: "https://schema.org/InStock" }
        : undefined,
    };

    const tag = document.createElement("script");
    tag.type = "application/ld+json";
    tag.id = id;
    tag.textContent = JSON.stringify(data);
    document.head.appendChild(tag);

    return () => document.getElementById(id)?.remove();
  }, [event]);
}

/*
  useArtistSchema — describes a musician in the format Google reads.

  Google has a distinct rich result for musicians. Without this, an artist
  page is just another blue link; with it, the name, image and genres can be
  understood as a person rather than as words on a page.
*/
export function useArtistSchema(artist) {
  useEffect(() => {
    if (!artist) return;
    const id = "hs-artist-schema";
    document.getElementById(id)?.remove();

    const data = {
      "@context": "https://schema.org",
      "@type": "MusicGroup",
      name: artist.alias ? `${artist.name} (${artist.alias})` : artist.name,
      description: artist.bio,
      image: artist.photo ? BASE + artist.photo : undefined,
      url: `${BASE}/artists/${artist.id}`,
      genre: artist.genres,
      foundingLocation: artist.country
        ? { "@type": "Place", name: artist.country }
        : undefined,
      memberOf: { "@type": "Organization", name: SITE, url: BASE },
    };

    const tag = document.createElement("script");
    tag.type = "application/ld+json";
    tag.id = id;
    tag.textContent = JSON.stringify(data);
    document.head.appendChild(tag);
    return () => document.getElementById(id)?.remove();
  }, [artist]);
}

/*
  useAlbumSchema — describes a release, with its tracks.

  This is what lets a release appear in search with its track listing rather
  than as a page title alone.
*/
export function useAlbumSchema(album) {
  useEffect(() => {
    if (!album) return;
    const id = "hs-album-schema";
    document.getElementById(id)?.remove();

    const data = {
      "@context": "https://schema.org",
      "@type": "MusicAlbum",
      name: album.title,
      byArtist: { "@type": "MusicGroup", name: album.artist },
      description: album.note,
      image: album.cover ? BASE + album.cover : undefined,
      url: `${BASE}/records`,
      numTracks: (album.tracks || []).length,
      datePublished: album.releaseDate || undefined,
      track: (album.tracks || []).map((t) => ({
        "@type": "MusicRecording",
        name: t.title,
        position: t.n,
        url: t.youtube ? `https://www.youtube.com/watch?v=${t.youtube}` : undefined,
      })),
      publisher: { "@type": "Organization", name: "Hidden State Records", url: BASE },
    };

    const tag = document.createElement("script");
    tag.type = "application/ld+json";
    tag.id = id;
    tag.textContent = JSON.stringify(data);
    document.head.appendChild(tag);
    return () => document.getElementById(id)?.remove();
  }, [album]);
}
