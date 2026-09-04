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

export function usePageMeta({ title = null, description = "", image = null, type = "website", noIndex = false }) {
  useEffect(() => {
    const full = title ? `${title} — ${SITE}` : SITE;
    document.title = full;

    /*
      KEEPING A PAGE OUT OF SEARCH.

      Two pages exist only behind an unguessable link — an artist's press kit
      and the headcount on a wall. Neither is in the sitemap and neither is
      linked from anywhere, but that is not enough on its own: a token pasted
      into a chat app that prefetches links, or into a browser that syncs
      history, is a token that can find its way to a crawler.

      Removed again when a page that does not ask for it mounts, because this
      tag lives in the document head and would otherwise be inherited by every
      page visited afterwards — silently de-indexing the whole site after one
      visit to a press kit.
    */
    const robots = document.head.querySelector('meta[name="robots"]');
    if (noIndex) setTag('meta[name="robots"]', "content", "noindex, nofollow");
    else if (robots) robots.remove();

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
  }, [title, description, image, type, noIndex]);
}

/*
  ── A HELPER, BECAUSE THIS WAS WRITTEN OUT FOUR TIMES ────────────────────

  Every schema hook below builds an object, stringifies it into a script tag
  with a known id, and removes that tag on the way out. Doing it once means a
  fifth kind of page is three lines rather than twenty, and it fixes a
  hazard the copies shared: an object holding `undefined` values serialises
  them away silently, but an object holding `null` does not, and a null in
  structured data is an error in Google's eyes.
*/
function useSchema(id, build, deps) {
  useEffect(() => {
    const data = build();
    if (!data) return undefined;

    document.getElementById(id)?.remove();
    const tag = document.createElement("script");
    tag.type = "application/ld+json";
    tag.id = id;
    // Nulls and empty strings are dropped rather than published.
    tag.textContent = JSON.stringify(data, (k, v) =>
      v === null || v === "" || (Array.isArray(v) && !v.length) ? undefined : v);
    document.head.appendChild(tag);

    return () => document.getElementById(id)?.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/*
  useArticleSchema — describes a news story.

  This was the gap. Events, artists and releases already described themselves;
  the news did not, so every article was a plain blue link with no date, no
  headline treatment and no publisher attached to it.

  DATES ARE THE PART THAT MATTERS. A news result without a date is treated as
  undated and drops out of anything time-sensitive, which is most of what a
  label publishes. `sortDate` is already a real ISO date in the content, which
  is exactly what this needs — the human "21 AUGUST 2026" is unusable here.
*/
export function useArticleSchema(article) {
  useSchema("hs-article-schema", () => {
    if (!article) return null;
    const image = article.poster || article.photo;
    return {
      "@context": "https://schema.org",
      "@type": "NewsArticle",
      headline: article.headline,
      description: article.summary,
      datePublished: article.sortDate || undefined,
      dateModified: article.sortDate || undefined,
      image: image ? BASE + image : undefined,
      articleSection: article.category,
      keywords: article.tags,
      url: `${BASE}/news/${article.slug}`,
      mainEntityOfPage: { "@type": "WebPage", "@id": `${BASE}/news/${article.slug}` },
      author: { "@type": "Organization", name: SITE, url: BASE },
      publisher: {
        "@type": "Organization",
        name: SITE,
        url: BASE,
        logo: { "@type": "ImageObject", url: `${BASE}/mark.svg` },
      },
      // Word count is a weak signal on its own, but it separates a real piece
      // from a two-line notice, and both live in this list.
      wordCount: Array.isArray(article.body)
        ? article.body.join(" ").split(/\s+/).length
        : undefined,
    };
  }, [article]);
}

/*
  useOrganisationSchema — who this is, said once, on the home page.

  The rich results for events and artists all point at an "Organization"
  called Hidden State, and until now nothing anywhere said what that
  organisation actually is. This is the page that says it: the name, the mark,
  and the accounts that are verifiably the same body elsewhere.

  sameAs is the important line. It is how a search engine works out that this
  site, that Instagram account and that label are one thing rather than three.
*/
export function useOrganisationSchema(accounts = []) {
  useSchema("hs-org-schema", () => ({
    "@context": "https://schema.org",
    "@type": "MusicGroup",
    "@id": `${BASE}/#organisation`,
    name: SITE,
    alternateName: "Hidden State Group",
    url: BASE,
    logo: `${BASE}/mark.svg`,
    image: `${BASE}/club.webp`,
    description:
      "Hidden State — record label, booking agency and artist roster.",
    sameAs: accounts,
  }), [accounts.join("|")]);
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
