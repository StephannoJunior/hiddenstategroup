// Hidden State — placeholder content.
// Everything in this file is sample data so the site has something to show.
// Swap in the real roster, releases, events and articles when ready —
// every page reads from here, so this is the only file you need to edit.

export const ARTISTS = [
  {
    id: 1,
    name: "Stephanno Jr.",
    type: "DJ",
    genres: ["Afro House", "Afro Tech", "Deep House"],
    country: "Romania",
    location: "Romania",
    desc: "DJ, producer and founder of Hidden State.",
    bio:
      "As a DJ, producer and founder of Hidden State and all its divisions, Stephanno Jr. continues to build his own universe within the electronic music scene — connecting music, events, artists and creative experiences under one vision. Bringing his signature sound across Afro House, Afro Tech and Deep House, he plays with a sound shaped by years behind the decks and a constant drive to create something of his own.",
    photo: "/portrait.jpg",
    instagram: "stephannojr",
    soundcloud: null,
    releases: [],
    upcoming: [{ name: "Astryon Festival", date: "18–20 JUN 2027", venue: "Romania — Main Stage" }],
    past: [],
  },
  {
    id: 2,
    name: "DJ Tengu",
    type: "DJ",
    genres: ["Old School Hip-Hop", "R&B", "Funk", "Soul", "Classic Urban"],
    country: null,
    location: null,
    desc: "Old soul, real music, new energy.",
    bio:
      "DJ Tengu is driven by passion, talent, and a genuine love for music. With experience behind the decks and an unmistakable old-school spirit, he brings a sound that connects generations and keeps the energy alive. His selections travel through the golden sounds of old school hip-hop, R&B, funk, soul, rap and classic urban music, blending timeless records with his own style and personality. For DJ Tengu, music is more than just playing tracks — it's about creating an atmosphere, telling a story and making people feel every beat.",
    photo: "/news/dj-tengu.jpg",
    instagram: "djtengu",
    soundcloud: null,
    releases: [],
    upcoming: [],
    past: [],
  },
  {
    id: 3,
    name: "Mario Daniel",
    alias: "DJ Mario",
    type: "DJ",
    genres: ["Afro House", "House"],
    country: null,
    location: null,
    desc: "Deep grooves, rhythm and energy.",
    bio:
      "DJ Mario brings together the energy, warmth and hypnotic character of Afro House in sets designed to be felt from beginning to end. With a carefully selected tracklist, flowing transitions and a strong focus on rhythm, his Fill & Dance set explores the deeper and more energetic side of Afro House — moving naturally between atmospheric moments, powerful grooves and uplifting rhythms. More than a collection of tracks, it captures his approach to music: letting the rhythm build naturally while keeping the energy alive throughout the entire journey.",
    photo: "/artists/dj-mario.jpg",
    instagram: "djmario",
    soundcloud: null,
    releases: [],
    upcoming: [],
    past: [],
  },
];

// Shown under the roster on the Artists and Agency pages.
export const ROSTER_NOTE = "More DJs and producers will join.";

export const FILTERS = ["ALL", "DJS", "PRODUCERS", "LIVE ACTS"];

export const FILTER_MAP = { DJS: "DJ", PRODUCERS: "Producer", "LIVE ACTS": "Live Act" };

export const RELEASES = [
  { id: 1, artist: "Nomi Reyes", title: "Low Light EP", genre: "Deep House", date: "AUG 08", catalog: "HS-013", artwork: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=800&q=80", status: "latest" },
  { id: 2, artist: "Kael Vance", title: "Terra Nova", genre: "Melodic House", date: "JUL 28", catalog: "HS-012", artwork: "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=800&q=80", status: "latest" },
  { id: 3, artist: "Ilé", title: "Root Work", genre: "Afro Tech", date: "JUL 14", catalog: "HS-011", artwork: "https://images.unsplash.com/photo-1571330735066-03aaa9429d89?w=800&q=80", status: "latest" },
  { id: 4, artist: "Dax Marlow", title: "Static Bloom", genre: "Tech House", date: "SEP 05", catalog: "HS-015", artwork: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800&q=80", status: "upcoming" },
  { id: 5, artist: "Sable & Rho", title: "Two Rooms", genre: "Organic House", date: "SEP 19", catalog: "HS-016", artwork: "https://images.unsplash.com/photo-1524368535928-5b5e00ddc76b?w=800&q=80", status: "upcoming" },
  { id: 6, artist: "Stephanno JR.", title: "Hidden State 010", genre: "House", date: "MAY 02", catalog: "HS-010", artwork: "https://images.unsplash.com/photo-1478147427282-58a87a120781?w=800&q=80", status: "discography" },
  { id: 7, artist: "Nomi Reyes", title: "Hidden State 007", genre: "Deep House", date: "FEB 21", catalog: "HS-007", artwork: "https://images.unsplash.com/photo-1571266028243-d220c9c3b31d?w=800&q=80", status: "discography" },
];

export const FEATURED_RELEASE = {
  artist: "Stephanno JR.",
  title: "Hidden State 014",
  genre: "Afro House / Afro Tech",
  date: "AUG 15, 2026",
  catalog: "HS-014",
  description:
    "A five-track EP built around restraint — polyrhythmic percussion, long-form builds, and almost no drop. The label's most understated release to date.",
  artwork: "https://images.unsplash.com/photo-1614149162883-504ce4d13909?w=1200&q=80",
};

export const EVENTS = [
  {
    id: 1,
    slug: "astryon-festival-2027",
    status: "upcoming",
    name: "Astryon Festival",
    subtitle: "The First Chapter",
    date: "18\u201320 JUNE 2027",
    sortDate: "2027-06-18",
    venue: "Main Stage",
    city: "Black Sea Coast",
    country: "Romania",
    artwork: null, // festival artwork not supplied yet — a typographic panel shows instead
    description:
      "Three days of electronic music on Romania's Black Sea coast, with more than 200 DJs and producers playing across multiple stages \u2014 techno, house, Afro House and further out into ambient and experimental. Stephanno Jr. takes the main stage.",
    facts: ["72 HOURS OF MUSIC", "OVER 200 ARTISTS", "MULTIPLE STAGES"],
    lineup: ["Stephanno Jr."],
    tickets: "https://www.astryonfestival.com/tickets",
    website: "https://www.astryonfestival.com",
    instagram: "astryon",
    gallery: [],
  },
];

// Shown under the events list.
export const EVENTS_NOTE = "More events to come.";

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
