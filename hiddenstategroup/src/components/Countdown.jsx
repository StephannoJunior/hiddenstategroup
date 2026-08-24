import React, { useEffect, useState } from "react";
import { fontDisplay, fontUtility, theme } from "./Shared";
import { useLang } from "../lib/lang";

/*
  Countdown — ticking down to a fixed moment.

  THE TARGET IS AN INSTANT, NOT A DATE. It carries a timezone offset, so
  everyone counts toward the same real moment wherever they are. Writing it as
  a bare "2026-12-13" would mean a visitor in Sydney reaching zero nine hours
  before one in Bucharest, which is not what a countdown to an event means.

  The numerals inherit the old-style figures set globally, so they sit in the
  page like typeset text rather than a digital clock.
*/

// 13 December 2026, midnight, Romanian time.
export const DECEMBER_13 = "2026-12-13T00:00:00+02:00";

function remaining(target) {
  const ms = new Date(target).getTime() - Date.now();
  if (ms <= 0) return null;
  return {
    days: Math.floor(ms / 86400000),
    hours: Math.floor((ms % 86400000) / 3600000),
    minutes: Math.floor((ms % 3600000) / 60000),
    seconds: Math.floor((ms % 60000) / 1000),
  };
}

export default function Countdown({ target = DECEMBER_13, label = null, compact = false }) {
  const { t } = useLang();
  const [left, setLeft] = useState(() => remaining(target));

  useEffect(() => {
    // Every second, because the seconds are shown. Cleared on unmount so it
    // never keeps running behind a page the visitor has left.
    const id = setInterval(() => setLeft(remaining(target)), 1000);
    return () => clearInterval(id);
  }, [target]);

  // Past the moment: say so rather than showing zeros or negative numbers.
  if (!left) {
    return (
      <p
        className="text-center m-0"
        style={{ ...fontDisplay, fontStyle: "italic", fontSize: "21px", color: theme.brass }}
      >
        {t("theNightIsHere")}
      </p>
    );
  }

  const units = [
    { value: left.days, label: t("days") },
    { value: left.hours, label: t("hours") },
    { value: left.minutes, label: t("minutes") },
    { value: left.seconds, label: t("seconds") },
  ];

  const size = compact
    ? "clamp(26px,7vw,40px)"
    : "clamp(34px,9vw,60px)";

  return (
    <div className="text-center">
      {label && (
        <p
          className="m-0 mb-2"
          style={{ ...fontUtility, fontSize: "9.5px", letterSpacing: "0.24em", color: theme.brass }}
        >
          {label}
        </p>
      )}

      <div style={{ borderTop: "1px solid " + theme.ink }} />
      <div
        className="flex justify-center items-baseline py-3"
        style={{ gap: "clamp(14px,5vw,42px)" }}
      >
        {units.map((u, i) => (
          <span key={u.label} className="flex flex-col items-center">
            <span
              style={{
                ...fontDisplay,
                fontWeight: 300,
                fontSize: size,
                lineHeight: 1,
                color: theme.ink,
                // Tabular figures here on purpose: the width must not shift as
                // the seconds change, or the whole row jitters every tick.
                fontVariantNumeric: "tabular-nums lining-nums",
                fontFeatureSettings: '"tnum" 1, "lnum" 1',
              }}
            >
              {String(u.value).padStart(2, "0")}
            </span>
            <span
              className="mt-1.5"
              style={{
                ...fontUtility,
                fontSize: compact ? "8px" : "9px",
                letterSpacing: "0.2em",
                color: theme.ink2,
              }}
            >
              {u.label}
            </span>
          </span>
        ))}
      </div>
      <div style={{ borderTop: "1px solid " + theme.ink }} />
    </div>
  );
}
