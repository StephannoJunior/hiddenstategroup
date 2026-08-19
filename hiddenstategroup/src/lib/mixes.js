// Hidden State — sessions & radio.
//
// TO ADD A MIX: find the artist below and add an entry to the right section's
// `items` list. `url` is the full link; the platform is worked out from it.
// To add a new section, copy a `{ label, items }` block.
//
// An artist with `comingSoon: true` shows a holding note instead of a list.

export const MIX_ARTISTS = [
  {
    slug: "stephanno-jr",
    artistId: 1,
    name: "Stephanno Jr.",
    alias: null,
    photo: "/portrait.jpg",
    genres: ["Afro House", "Afro Tech", "Deep House"],
    intro:
      "Recorded sets from the founder of Hidden State — Afro House, Afro Tech and Deep House, built around rhythm and the long build.",
    comingSoon: false,
    sections: [
      {
        label: null,
        items: [
          { title: "Set 01", url: "https://youtu.be/dmfmefK6UQM" },
          { title: "Set 02", url: "https://youtu.be/U9fzm1eR2rQ" },
        ],
      },
    ],
  },
  {
    slug: "dj-tengu",
    artistId: 2,
    name: "DJ Tengu",
    alias: null,
    photo: "/news/dj-tengu.jpg",
    genres: ["Old School Hip-Hop", "R&B", "Funk", "Soul"],
    intro:
      "Old soul, real music, new energy. Tengu's sets travel through the golden sounds of hip-hop, R&B, funk and soul.",
    comingSoon: false,
    sections: [
      {
        label: "90's Hip-Hop & R&B",
        items: [
          { title: "Urban Nation — 90's R&B Edition 02", url: "https://www.mixcloud.com/dj-league/urban-nation-dj-tengu-rou-90iesrbedition-02/" },
          { title: "Urban Nation — 90's R&B Edition 03", url: "https://www.mixcloud.com/dj-league/urban-nation-dj-tengu-rou-90iesrbedition-03/" },
          { title: "Urban Nation — 90's R&B Edition 04", url: "https://www.mixcloud.com/dj-league/urban-nation-dj-tengu-rou-90iesrbedition-04/" },
          { title: "Urban Nation — 90's R&B Edition 05", url: "https://www.mixcloud.com/dj-league/urban-nation-dj-tengu-rou-90iesrbedition-05/" },
          { title: "Urban Nation — 07", url: "https://www.mixcloud.com/dj-league/urban-nation-dj-tengu-rou-7/" },
        ],
      },
      {
        label: "80's – 90's Classic Funk",
        items: [
          { title: "Urban Nation — Classic Funk Edition 01", url: "https://www.mixcloud.com/dj-league/urban-nation-dj-tengu-rou-classicfunkedition-01/" },
          { title: "Urban Nation — Classic Funk Edition 04", url: "https://www.mixcloud.com/dj-league/urban-nation-dj-tengu-rou-classicfunkedition-04/" },
          { title: "Urban Nation — Classic Funk Edition 06", url: "https://www.mixcloud.com/dj-league/urban-nation-dj-tengu-rou-classicfunkedition-06/" },
        ],
      },
    ],
  },
  {
    slug: "mario-daniel",
    artistId: 3,
    name: "Mario Daniel",
    alias: "DJ Mario",
    photo: "/artists/dj-mario.jpg",
    genres: ["Afro House", "House"],
    intro:
      "Deep grooves, rhythm and energy — sets designed to be felt from beginning to end.",
    comingSoon: false,
    sections: [
      {
        label: null,
        items: [
          { title: "Set 01", url: "https://youtu.be/2BOnHk-kbg0" },
          { title: "Set 02", url: "https://youtu.be/AxMYaD55ceA" },
          { title: "Set 03", url: "https://youtu.be/JnmMk5GlJys" },
          { title: "Fill & Dance", url: "https://youtu.be/oxJ0M7Qin5s" },
        ],
      },
    ],
  },
  {
    slug: "b-mike",
    artistId: 4,
    name: "B.MIKE",
    alias: "Heartbeat Vibes",
    photo: "/artists/b-mike.jpg",
    genres: ["EDM", "House", "Tech-House", "Drum & Bass"],
    intro:
      "2000s retro through to drum & bass, anywhere from 128 to 175 BPM.",
    comingSoon: true,
    comingSoonNote: "Soon we will display his discography.",
    sections: [],
  },
];

export const getMixArtist = (slug) => MIX_ARTISTS.find((a) => a.slug === slug) || null;

// Works out which platform a link points at, for the little label on each row.
export const platformOf = (url) => {
  if (!url) return "";
  if (url.includes("youtu")) return "YOUTUBE";
  if (url.includes("mixcloud")) return "MIXCLOUD";
  if (url.includes("soundcloud")) return "SOUNDCLOUD";
  if (url.includes("spotify")) return "SPOTIFY";
  return "LISTEN";
};

export const countMixes = (a) =>
  (a.sections || []).reduce((n, s) => n + s.items.length, 0);
