// Hidden State Records — releases.
//
// TO ADD A RELEASE: copy the block below and add it to the list.
// Covers live in /public/records/. Each track's `youtube` is the video ID —
// the part after youtu.be/ in the share link.

export const ALBUMS = [
  {
    slug: "aymara",
    title: "AYMARA",
    artist: "Stephanno Jr.",
    kind: "ALBUM",
    tagline: "sounds of hearts",
    catalog: "HS-001",
    releaseDate: null, // e.g. "13 AUGUST 2025" — appears once you set it
    cover: "/records/aymara.jpg",
    playlist: "https://www.youtube.com/playlist?list=PLboGw-g1tS4k",
    note:
      "Six tracks built around rhythm and atmosphere — the first full-length release on Hidden State Records.",
    tracks: [
      { n: 1, title: "Kasbah",         cover: "/records/kasbah.jpg",         youtube: "SPWGalk7gW4" },
      { n: 2, title: "Mestizo",        cover: "/records/mestizo.jpg",        youtube: "Qo5dlQ5_ano" },
      { n: 3, title: "Nenge",          cover: "/records/nenge.jpg",          youtube: "1fhB8U8P6mA" },
      { n: 4, title: "Aymara",         cover: "/records/aymara.jpg",         youtube: "Qq3ipZDiENE" },
      { n: 5, title: "To The Unknown", cover: "/records/to-the-unknown.jpg", youtube: "er3TTUZS87s" },
      { n: 6, title: "Sing Chu",       cover: "/records/sing-chu.jpg",       youtube: "elLTDFL5L1Q" },
    ],
  },
];

export const watchUrl = (id) => "https://www.youtube.com/watch?v=" + id;
