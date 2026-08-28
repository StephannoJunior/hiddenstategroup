// Articles now live in src/content/news.json so the CMS can edit them.
// This file just re-exports them, which means every page importing ARTICLES
// carries on working untouched.
import { useEffect, useState } from "react";
import ARTICLES_JSON from "../content/news.json";
import * as api from "./api";

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

/*
  usePosts — the articles, from the database where possible.

  The bundled JSON is used until the fetch returns, and kept if it fails. That
  means the news pages render instantly and still work if the server is
  unreachable, rather than showing an empty page while they wait.
*/
export function usePosts() {
  const [posts, setPosts] = useState(ARTICLES_JSON);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    api.listPosts().then((res) => {
      if (!alive) return;
      if (res.ok && res.posts?.length) {
        // Map the database's shape onto the one the pages already render.
        setPosts(res.posts.map((p) => ({
          ...p,
          date: p.date_label,
          sortDate: p.sort_date,
          linkLabel: p.link_label,
        })));
      }
      setLoaded(true);
    });
    return () => { alive = false; };
  }, []);

  return { posts, loaded };
}
