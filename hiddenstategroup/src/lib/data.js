// Roster and events live in src/content/*.json so the CMS can edit them.
// Everything below re-exports under the original names.
import { useEffect, useState } from "react";
import * as api from "./api";
import ARTISTS_JSON from "../content/artists.json";
import EVENTS_JSON from "../content/events.json";
import SETTINGS from "../content/settings.json";

export const ARTISTS = ARTISTS_JSON;
export const EVENTS = EVENTS_JSON;

// Shown under the roster on the Artists and Agency pages.
export const ROSTER_NOTE = SETTINGS.rosterNote;

// Shown under the events list.
export const EVENTS_NOTE = SETTINGS.eventsNote;

export const FILTERS = ["ALL", "DJS", "PRODUCERS", "LIVE ACTS"];

export const FILTER_MAP = { DJS: "DJ", PRODUCERS: "Producer", "LIVE ACTS": "Live Act" };

export const HERO = {
  category: "EXCLUSIVE",
  headline: "Inside the Session That Redefined Afro Tech",
  excerpt:
    "A year after their breakout Boiler Room set, Stephanno JR. opens the studio door on the record that pulled a continent's sound into the main room.",
  date: "AUG 14, 2026",
  readTime: "9 MIN READ",
  image:
    "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=1600&q=80",
};

export const ARTICLES = [
  {
    id: 1,
    category: "ARTISTS",
    headline: "The Producers Quietly Building Organic House's Second Wave",
    excerpt: "Five names A&Rs are watching before the festival circuit catches up.",
    date: "AUG 12",
    readTime: "6 MIN",
    image: "https://images.unsplash.com/photo-1571266028243-d220c9c3b31d?w=1200&q=80",
    span: "lg",
  },
  {
    id: 2,
    category: "RELEASES",
    headline: "HIDDEN STATE 014: A Catalog Built on Restraint",
    excerpt: "Track-by-track notes from the label's most understated EP yet.",
    date: "AUG 11",
    readTime: "4 MIN",
    image: "https://images.unsplash.com/photo-1524368535928-5b5e00ddc76b?w=900&q=80",
    span: "md",
  },
  {
    id: 3,
    category: "INTERVIEWS",
    headline: "\u201cI Don't Design for the Drop\u201d — A Conversation on Tension",
    excerpt: "One of dance music's most private producers finally talks process.",
    date: "AUG 09",
    readTime: "11 MIN",
    image: "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=900&q=80",
    span: "md",
  },
  {
    id: 4,
    category: "INDUSTRY",
    headline: "What Door Policy Actually Protects, According to Four Promoters",
    excerpt: "Inside the unglamorous mechanics keeping underground rooms underground.",
    date: "AUG 08",
    readTime: "7 MIN",
    image: "https://images.unsplash.com/photo-1478147427282-58a87a120781?w=1000&q=80",
    span: "wide",
  },
  {
    id: 5,
    category: "EVENTS",
    headline: "Notes From Three Nights at the Warehouse Nobody Announced",
    excerpt: "A dispatch from the room dance music forgot to put on a flyer.",
    date: "AUG 06",
    readTime: "5 MIN",
    image: "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=900&q=80",
    span: "md",
  },
  {
    id: 6,
    category: "MUSIC",
    headline: "The Slow Return of the 90-Minute Set",
    excerpt: "Why more DJs are asking promoters for the room back.",
    date: "AUG 05",
    readTime: "8 MIN",
    image: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=900&q=80",
    span: "md",
  },
];

/*
  useContent — a content type from the database, with the bundled copy as a
  fallback.

  The bundle renders immediately and is kept if the fetch fails, so pages are
  never blank while waiting and still work with no connection. The database
  wins as soon as it answers.
*/
export function useContent(kind, fallback) {
  const [items, setItems] = useState(fallback);

  useEffect(() => {
    let alive = true;
    api.listContent(kind).then((res) => {
      if (!alive || !res.ok || !res.items?.length) return;
      setItems(res.items.map((x) => ({
        ...x,
        // The database column names differ slightly from what the pages read.
        desc: x.descr ?? x.desc,
        releaseDate: x.release_date ?? x.releaseDate,
        artistId: x.artist_id ?? x.artistId,
        comingSoon: x.coming_soon ?? x.comingSoon,
        comingSoonNote: x.coming_soon_note ?? x.comingSoonNote,
      })));
    });
    return () => { alive = false; };
  }, [kind]);

  return items;
}

export const useArtists = () => useContent("artists", ARTISTS_JSON);
