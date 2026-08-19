// Hidden State — placeholder content.
// Everything in this file is sample data so the site has something to show.
// Swap in the real roster, releases, events and articles when ready —
// every page reads from here, so this is the only file you need to edit.

export const ARTISTS = [
  {
    id: 1, name: "Stephanno JR.", type: "DJ", genres: ["Afro House", "Afro Tech"], country: "Romania", location: "Bucharest, RO",
    desc: "Founder of Hidden State. Signature sets built on restraint and long-form tension.",
    bio: "Stephanno JR. founded Hidden State in 2020 and has spent the years since building it into a connected ecosystem of music, media and events. His sets move slowly on purpose — long builds, deep pockets of groove, and a refusal to chase the drop. He headlines the Hidden State Sessions series and takes the main stage at Astryon Festival in June 2027.",
    photo: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=1200&q=80",
    instagram: "@stephannojr", soundcloud: "stephannojr",
    releases: [{ title: "Hidden State 014", cat: "HS-014" }, { title: "Hidden State 010", cat: "HS-010" }],
    upcoming: [{ name: "Astryon Festival", date: "JUN 18–20, 2027", venue: "Bucharest, RO" }],
    past: [{ name: "Hidden State Sessions Vol. 3", date: "MAR 2026", venue: "Warehouse 12, Berlin" }],
  },
  {
    id: 2, name: "Nomi Reyes", type: "DJ", genres: ["Deep House"], country: "Portugal", location: "Lisbon, PT",
    desc: "Slow-building sets rooted in dub-inflected deep house.",
    bio: "Nomi Reyes plays deep house the way it was originally meant to be played — patient, dub-heavy, built for a room that's willing to stay past 4am. She joined Hidden State Records in 2025 with her debut EP and has been a fixture of the label's live sessions since.",
    photo: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=1200&q=80",
    instagram: "@nomireyes", soundcloud: "nomi-reyes",
    releases: [{ title: "Low Light EP", cat: "HS-013" }],
    upcoming: [],
    past: [{ name: "Hidden State Radio — Guest Mix", date: "JUL 2026", venue: "Live broadcast" }],
  },
  {
    id: 3, name: "Kael Vance", type: "Producer", genres: ["Melodic House"], country: "Germany", location: "Berlin, DE",
    desc: "Studio-first producer, occasional live hybrid sets.",
    bio: "Kael Vance works primarily in the studio, releasing melodic, widescreen productions that favor atmosphere over impact. Terra Nova, his most recent EP, was written over eight months and mixed entirely on analog gear.",
    photo: "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=1200&q=80",
    instagram: "@kaelvance", soundcloud: "kael-vance",
    releases: [{ title: "Terra Nova", cat: "HS-012" }],
    upcoming: [],
    past: [],
  },
  {
    id: 4, name: "Ilé", type: "Producer", genres: ["Afro Tech"], country: "Nigeria", location: "Lagos, NG",
    desc: "Polyrhythmic production drawing on West African percussion.",
    bio: "Ilé builds tracks from live-recorded percussion up, layering polyrhythms into club-ready structures without losing the source material's character. Root Work is her first release for Hidden State Records.",
    photo: "https://images.unsplash.com/photo-1571330735066-03aaa9429d89?w=1200&q=80",
    instagram: "@ile.sound", soundcloud: "ile-sound",
    releases: [{ title: "Root Work", cat: "HS-011" }],
    upcoming: [{ name: "Astryon Festival", date: "JUN 18–20, 2027", venue: "Bucharest, RO" }],
    past: [],
  },
  {
    id: 5, name: "Dax Marlow", type: "DJ", genres: ["Tech House"], country: "United Kingdom", location: "London, UK",
    desc: "High-energy peak-time sets for main-stage and warehouse rooms.",
    bio: "Dax Marlow is Hidden State Agency's most-booked peak-time DJ, known for reading a room fast and rebuilding a set on the fly. Static Bloom, his upcoming EP, is his first vocal-forward release.",
    photo: "https://images.unsplash.com/photo-1478147427282-58a87a120781?w=1200&q=80",
    instagram: "@daxmarlow", soundcloud: "dax-marlow",
    releases: [{ title: "Static Bloom", cat: "HS-015" }],
    upcoming: [],
    past: [{ name: "Notes From the Warehouse", date: "AUG 2026", venue: "Undisclosed" }],
  },
  {
    id: 6, name: "Sable & Rho", type: "Live Act", genres: ["Organic House"], country: "Spain", location: "Barcelona, ES",
    desc: "Duo live hardware set — modular synths and hand percussion.",
    bio: "Sable & Rho perform entirely live, pairing modular synthesis with hand percussion in real time. Two Rooms, their upcoming release, was recorded in a single unedited take.",
    photo: "https://images.unsplash.com/photo-1524368535928-5b5e00ddc76b?w=1200&q=80",
    instagram: "@sableandrho", soundcloud: "sable-rho",
    releases: [{ title: "Two Rooms", cat: "HS-016" }],
    upcoming: [],
    past: [],
  },
  {
    id: 7, name: "Ferro", type: "Live Act", genres: ["Electronic"], country: "Netherlands", location: "Amsterdam, NL",
    desc: "Full live band arrangement of club-scale electronic music.",
    bio: "Ferro translates club-scale electronic music into a full live band arrangement — drums, bass, synths — without losing the floor. A regular at Hidden State's live session nights.",
    photo: "https://images.unsplash.com/photo-1571266028243-d220c9c3b31d?w=1200&q=80",
    instagram: "@ferrolive", soundcloud: "ferro-live",
    releases: [],
    upcoming: [],
    past: [{ name: "Hidden State Sessions Vol. 2", date: "NOV 2025", venue: "De School, Amsterdam" }],
  },
  {
    id: 8, name: "Juno Marsh", type: "DJ", genres: ["House", "Organic House"], country: "South Africa", location: "Cape Town, ZA",
    desc: "Sun-up-to-sun-down open-format specialist.",
    bio: "Juno Marsh built a reputation on long open-format sets that move from sunset to sunrise without a single obvious transition. She joined the Hidden State roster in 2024.",
    photo: "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=1200&q=80",
    instagram: "@junomarsh", soundcloud: "juno-marsh",
    releases: [],
    upcoming: [],
    past: [{ name: "Astryon Festival — Warm-up", date: "JUN 2026", venue: "Cape Town, ZA" }],
  },
];

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
    id: 1, status: "upcoming",
    name: "Astryon Festival — The First Chapter",
    date: "JUN 18–20, 2027", venue: "Main Stage", city: "Bucharest", country: "Romania",
    lineup: ["Stephanno JR.", "Ilé", "+ 200 international artists"],
    description: "Hidden State takes the Romanian main stage at Astryon Festival's inaugural edition — 72 hours of music across a global lineup of 200+ artists. Stephanno JR. headlines, joined by Ilé for a live Afro Tech set.",
    artwork: "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=1400&q=80",
    gallery: [],
  },
  {
    id: 2, status: "upcoming",
    name: "Hidden State Sessions Vol. 4",
    date: "SEP 12, 2026", venue: "Kapitel Bar", city: "Berlin", country: "Germany",
    lineup: ["Stephanno JR.", "Nomi Reyes", "Kael Vance"],
    description: "The label's flagship showcase returns to Berlin for a fourth edition — an intimate room, no phones policy, and a lineup built entirely from the Hidden State roster.",
    artwork: "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=1400&q=80",
    gallery: [],
  },
  {
    id: 3, status: "upcoming",
    name: "Warehouse Nights Vol. 2",
    date: "OCT 03, 2026", venue: "Undisclosed", city: "London", country: "United Kingdom",
    lineup: ["Dax Marlow", "Ferro"],
    description: "The follow-up to the warehouse night nobody announced. Location shared 24 hours before doors, capacity capped at 400.",
    artwork: "https://images.unsplash.com/photo-1478147427282-58a87a120781?w=1400&q=80",
    gallery: [],
  },
  {
    id: 4, status: "past",
    name: "Hidden State Sessions Vol. 3",
    date: "MAR 2026", venue: "Warehouse 12", city: "Berlin", country: "Germany",
    lineup: ["Stephanno JR.", "Sable & Rho"],
    description: "Three hundred people, one room, and a set from Stephanno JR. that ran ninety minutes without a single obvious transition.",
    artwork: "https://images.unsplash.com/photo-1524368535928-5b5e00ddc76b?w=1400&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1571330735066-03aaa9429d89?w=600&q=80",
      "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=600&q=80",
      "https://images.unsplash.com/photo-1571266028243-d220c9c3b31d?w=600&q=80",
    ],
  },
  {
    id: 5, status: "past",
    name: "Notes From the Warehouse",
    date: "AUG 2026", venue: "Undisclosed", city: "London", country: "United Kingdom",
    lineup: ["Dax Marlow", "Juno Marsh"],
    description: "Three nights at a warehouse dance music forgot to put on a flyer. No recordings, no photos policy — the recap exists only as a memory for the 250 people who were there.",
    artwork: "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=1400&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600&q=80",
      "https://images.unsplash.com/photo-1478147427282-58a87a120781?w=600&q=80",
    ],
  },
  {
    id: 6, status: "past",
    name: "Astryon Festival — Warm-up",
    date: "JUN 2026", venue: "Main Beach Stage", city: "Cape Town", country: "South Africa",
    lineup: ["Juno Marsh"],
    description: "A sunset-to-sunrise warm-up party ahead of Astryon Festival's first chapter, headlined by Juno Marsh's signature open-format set.",
    artwork: "https://images.unsplash.com/photo-1571330735066-03aaa9429d89?w=1400&q=80",
    gallery: [
      "https://images.unsplash.com/photo-1524368535928-5b5e00ddc76b?w=600&q=80",
    ],
  },
];

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
