// Sessions live in src/content/mixes.json for the CMS.
import MIX_JSON from "../content/mixes.json";

export const MIX_ARTISTS = MIX_JSON;

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
