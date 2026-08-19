// Hidden State — news articles.
//
// TO ADD AN ARTICLE: copy one block, put it at the TOP of the list, and change
// the fields. Newest first. `slug` becomes the web address (/news/<slug>) so
// keep it lowercase with dashes and never reuse one.
//
// Photos live in /public/news/ — drop the image there and reference it as
// "/news/your-file.jpg". Use the PHOTO from your poster, not the whole poster:
// each article is typeset in code so it reads on a phone and can be found by
// search engines. Add `lineup: [...]` for events and it renders as a line-up block.

export const ARTICLES = [
  {
    slug: "dj-tengu-joins-hidden-state",
    issue: "VOL. 01, NO. 3",
    date: "16 AUGUST 2026",
    sortDate: "2026-08-16",
    category: "ARTISTS",
    headline: "DJ Tengu joins Hidden State, shaping the world of music",
    summary:
      "An old-school spirit joins the roster — hip-hop, R&B, funk, soul and classic urban records, played for atmosphere rather than effect.",
    photo: "/news/dj-tengu.jpg",
    caption: "DJ Tengu behind the decks",
    body: [
      "DJ Tengu is driven by passion, talent, and a genuine love for music. With experience behind the decks and an unmistakable old-school spirit, he brings a sound that connects generations and keeps the energy alive.",
      "His selections travel through the golden sounds of old school hip-hop, R&B, funk, soul, rap and classic urban music, blending timeless records with his own style and personality.",
      "For DJ Tengu, music is more than just playing tracks — it's about creating an atmosphere, telling a story and making people feel every beat. With dedication, character and a constant desire to evolve, he continues to shape his own path through sound.",
    ],
    kicker: "Old soul. Real music. New energy.",
    signoff: "DJ Tengu — Creating the art.",
    tags: ["OLD SCHOOL HIP-HOP", "R&B / FUNK / SOUL", "CLASSIC URBAN"],
    footnote: "Some sounds are heard. Others are remembered.",
    link: null,
    linkLabel: null,
  },
  {
    slug: "astryon-festival-launch-party",
    issue: "VOL. 01, NO. 2",
    date: "15 AUGUST 2026",
    sortDate: "2026-08-15",
    category: "EVENTS",
    headline: "Astryon Festival Launch Party",
    summary:
      "The first chapter opens on 28 August 2026 with a thirteen-artist line-up ahead of the festival itself.",
    photo: "/news/astryon-launch.jpg",
    caption: "Astryon Festival Launch Party — 28 August 2026",
    body: [
      "The Astryon Festival Launch Party lands on 28 August 2026 — the opening moment before the festival's first chapter.",
      "Thirteen artists play across the night, spanning the range the festival itself will cover.",
    ],
    lineup: [
      "Maria", "RKO", "ANDREEA X", "Deysa", "Just Eddie", "Antoche Leon", "K SET",
      "RON HEWITT", "Damian", "Mike", "IXY", "Baranovschi", "No Form",
    ],
    eventDate: "28 AUGUST 2026",
    kicker: "28 August 2026",
    signoff: null,
    tags: ["LAUNCH PARTY", "13 ARTISTS", "ASTRYON FESTIVAL"],
    partners: [
      "Sonique Radio", "Electric Side Vision", "AHT Auto Haus Tudor",
      "MAVNO", "EDM Global News", "Arcentia Global Marketing",
    ],
    footnote: null,
    link: null,
    linkLabel: null,
  },
  {
    slug: "dj-mario-fill-and-dance",
    issue: "VOL. 01, NO. 1",
    date: "13 AUGUST 2025",
    sortDate: "2025-08-13",
    category: "MUSIC",
    headline: "Mario Daniel aka DJ Mario — new set",
    summary:
      "Fill & Dance explores the deeper, more energetic side of Afro House across a set built to be felt from beginning to end.",
    photo: "/news/dj-mario.jpg",
    caption: "DJ Mario — Fill & Dance",
    body: [
      "A new soundscape arrives through the latest set from DJ Mario, bringing together the energy, warmth and hypnotic character of Afro House in a journey designed to be felt from beginning to end.",
      "With a carefully selected tracklist, flowing transitions and a strong focus on rhythm, \u201CFill & Dance\u201D explores the deeper and more energetic side of Afro House. The set moves naturally between atmospheric moments, powerful grooves and uplifting rhythms, creating an experience that feels equally at home on the dancefloor, during a late-night drive, or simply with the volume turned up.",
      "More than just a collection of tracks, this set captures Mario's approach to music — letting the rhythm build naturally while keeping the energy alive throughout the entire journey.",
      "From the first beat to the final transition, Fill & Dance is about movement, atmosphere and connection through sound.",
    ],
    kicker: "DJ Mario — Fill & Dance",
    signoff: "Press play. Feel the rhythm. Fill the space.",
    tags: ["AFRO HOUSE / HOUSE", "DEEP GROOVES", "RHYTHM & ENERGY"],
    footnote: "Available now on YouTube.",
    link: null, // paste the YouTube link here to turn the button on
    linkLabel: "WATCH ON YOUTUBE",
  },
];

export const getArticle = (slug) => ARTICLES.find((a) => a.slug === slug) || null;
