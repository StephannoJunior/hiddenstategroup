// Articles now live in src/content/news.json so the CMS can edit them.
// This file just re-exports them, which means every page importing ARTICLES
// carries on working untouched.
import ARTICLES_JSON from "../content/news.json";

export const ARTICLES = ARTICLES_JSON;

export const getArticle = (slug) => ARTICLES.find((a) => a.slug === slug) || null;

/*
  localised — the article in the reader's language, where one exists.

  Translations live beside the original rather than replacing it, so a missing
  Romanian version falls back to English field by field. A half-translated
  article shows what it has and reads normally, instead of showing gaps.
*/
export function localised(article, lang) {
  if (!article) return article;
  const t = article[lang];
  return t ? { ...article, ...t } : article;
}
