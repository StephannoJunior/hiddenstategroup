import React, { useEffect, useState } from "react";
import { fontUtility, theme } from "./Shared";
import { useLang, LANGS } from "../lib/lang";

/*
  Dateline — today's date and the time, in the visitor's own timezone.

  Uses Intl, which reads the timezone already set on the device. No location
  permission is requested: asking someone for their GPS position just to print
  a clock would be intrusive, and the device setting is more accurate anyway
  for anyone travelling.

  The clock ticks every 30 seconds — enough for minute-accuracy without waking
  the page constantly.
*/

export function LiveDateline() {
  const { lang } = useLang();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);

  let date = "";
  let time = "";
  let zone = "";
  try {
    date = new Intl.DateTimeFormat(lang, {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
    }).format(now);
    time = new Intl.DateTimeFormat(lang, { hour: "2-digit", minute: "2-digit" }).format(now);
    zone = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  } catch {
    date = now.toDateString();
    time = now.toTimeString().slice(0, 5);
  }

  return (
    <span
      style={{ ...fontUtility, fontSize: "9px", letterSpacing: "0.16em", color: theme.ink2 }}
      title={zone ? `Your time — ${zone}` : undefined}
    >
      {date.toUpperCase()} · {time}
    </span>
  );
}

export function LanguageSwitch({ compact = false }) {
  const { lang, setLang } = useLang();
  const [open, setOpen] = useState(false);
  const current = LANGS.find((l) => l.code === lang) || LANGS[0];

  return (
    <span className="relative inline-block">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Change language"
        aria-expanded={open}
        className="px-2 py-1"
        style={{
          ...fontUtility, fontSize: compact ? "9px" : "9.5px", letterSpacing: "0.16em",
          color: theme.ink, border: "1px solid " + theme.rule,
        }}
      >
        {current.label}
      </button>

      {open && (
        <>
          <span className="fixed inset-0 z-[85]" onClick={() => setOpen(false)} aria-hidden="true" />
          <span
            className="absolute right-0 mt-1 z-[86]"
            style={{ background: theme.bg, border: "1px solid " + theme.ink, minWidth: "140px" }}
          >
            {LANGS.map((l) => (
              <button
                key={l.code}
                onClick={() => { setLang(l.code); setOpen(false); }}
                className="block w-full text-left px-3 py-2"
                style={{
                  ...fontUtility, fontSize: "10px", letterSpacing: "0.12em",
                  color: l.code === lang ? theme.bg : theme.ink,
                  background: l.code === lang ? theme.ink : "transparent",
                  borderBottom: "1px solid " + theme.rule,
                }}
              >
                {l.label} · {l.name}
              </button>
            ))}
          </span>
        </>
      )}
    </span>
  );
}
