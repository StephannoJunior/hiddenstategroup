// Sessions live in src/content/mixes.json for the CMS.
import MIX_JSON from "../content/mixes.json";

export const MIX_ARTISTS = MIX_JSON;

export const getMixArtist = (slug) => MIX_ARTISTS.find((a) => a.slug === slug) || null;

/*
  Which platform a session sits on.

  Guessed from the link, unless somebody chose one in the console — a private
  upload, a redirect or a shortened link can point anywhere, and the person
  adding it knows what it is better than a substring match does.
*/
export const platformOf = (url, chosen) => {
  if (chosen) return chosen;
  if (!url) return "";
  if (url.includes("youtu")) return "YOUTUBE";
  if (url.includes("mixcloud")) return "MIXCLOUD";
  if (url.includes("soundcloud")) return "SOUNDCLOUD";
  if (url.includes("spotify")) return "SPOTIFY";
  return "LISTEN";
};

export const countMixes = (a) =>
  (a.sections || []).reduce((n, s) => n + s.items.length, 0);
