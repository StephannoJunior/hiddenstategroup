import React, { useEffect, useState } from "react";
import { fontUtility, theme } from "./Shared";
import { useLang } from "../lib/lang";

/*
  Small additions that make a long article easier to live with.
*/

// A hairline that fills as you read. Tells people how much is left without
// taking up any space of its own.
export function ReadingProgress() {
  const [pct, setPct] = useState(0);

  useEffect(() => {
    let queued = false;
    const onScroll = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        const h = document.documentElement;
        const max = h.scrollHeight - h.clientHeight;
        setPct(max > 0 ? Math.min(100, (h.scrollTop / max) * 100) : 0);
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      aria-hidden="true"
      style={{ height: "2px", background: "transparent", pointerEvents: "none" }}
      className="fixed left-0 right-0 z-[41] top-[76px] lg:top-[136px]"
    >
      <div style={{ width: `${pct}%`, height: "100%", background: theme.brass, transition: "width 80ms linear" }} />
    </div>
  );
}

// Rough reading time. 200 words a minute is the usual figure for adults
// reading for interest rather than study.
export function readingTime(paragraphs = []) {
  const words = paragraphs.join(" ").trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

// Share. Uses the phone's own share sheet where it exists — that puts
// WhatsApp, Instagram and Messages in front of people without us having to
// guess which they use. Falls back to copying the link.
export function ShareRow({ title }) {
  const { t } = useLang();
  const [copied, setCopied] = useState(false);

  const share = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try { await navigator.share({ title, url }); return; } catch { /* dismissed */ }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard blocked — nothing useful left to try */ }
  };

  return (
    <button
      onClick={share}
      className="inline-block pb-0.5"
      style={{
        ...fontUtility, fontSize: "10px", letterSpacing: "0.2em",
        color: theme.ink, borderBottom: "1px solid " + theme.brass,
      }}
    >
      {copied ? t("linkCopied") : t("share")}
    </button>
  );
}

// A quiet way back up from the bottom of a long page.
export function BackToTop() {
  const { t } = useLang();
  const [show, setShow] = useState(false);

  useEffect(() => {
    let queued = false;
    const onScroll = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => { queued = false; setShow(window.scrollY > 1400); });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!show) return null;
  return (
    <p className="text-center mt-10 m-0">
      <button
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        className="inline-block pb-0.5"
        style={{
          ...fontUtility, fontSize: "10px", letterSpacing: "0.2em",
          color: theme.ink2, borderBottom: "1px solid " + theme.rule,
        }}
      >
        {t("backToTop")}
      </button>
    </p>
  );
}
