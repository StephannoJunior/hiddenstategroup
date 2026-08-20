// Releases live in src/content/records.json for the CMS.
import ALBUMS_JSON from "../content/records.json";

export const ALBUMS = ALBUMS_JSON;

export const watchUrl = (id) => "https://www.youtube.com/watch?v=" + id;
