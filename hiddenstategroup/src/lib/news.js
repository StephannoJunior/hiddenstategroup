// Articles now live in src/content/news.json so the CMS can edit them.
// This file just re-exports them, which means every page importing ARTICLES
// carries on working untouched.
import ARTICLES_JSON from "../content/news.json";

export const ARTICLES = ARTICLES_JSON;

export const getArticle = (slug) => ARTICLES.find((a) => a.slug === slug) || null;
