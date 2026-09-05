import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Home, Newspaper, Disc, Users, Calendar } from "lucide-react";
import { IndexBand, fontDisplay, fontUtility, fontText, theme, inputStyle }
  from "../components/Shared";
import { Spring, springSet, driveSprings, glassStyle, lipStyle, specStyle,
         lozengeStyle, resolveFinish } from "../lib/liquid";
import * as api from "../lib/api";

/*
  ── TWO DESKS OF THEIR OWN ─────────────────────────────────────────────────

  THE LIQUID BAR and THE POOL. Both were things the console could not do:

    the bar's look was four numbers buried in a subsection of SETTINGS, and
    two of the numbers that mattered most were not settings at all — they were
    hardcoded in the stylesheet, which is how the bar ended up too dark to see
    through with no way to say so;

    the pool had no console screen whatsoever. The endpoints to read it and to
    moderate it have existed since it was built, and nobody on the team could
    reach them without a terminal. People have been putting songs in a box the
    team could only read from the public page, exactly as a stranger sees it.

  Kept out of Console.jsx, which passed three and a half thousand lines some
  time ago, and rendered by it exactly like the panels in ConsoleExtra.
*/

/* ── shared furniture ────────────────────────────────────────────────────── */

const Panel = ({ title, right, children }) => (
  <section className="mb-10">
    <div className="flex items-baseline gap-3" style={{ borderBottom: `1px solid ${theme.ink}`, paddingBottom: "7px" }}>
      <h2 className="m-0" style={{ ...fontUtility, fontSize: "11px", letterSpacing: "0.2em", fontWeight: 700 }}>
        {title}
      </h2>
      {right != null && (
        <span className="flex-1 text-right" style={{ ...fontUtility, fontSize: "9px", letterSpacing: "0.16em", color: theme.ink2 }}>
          {right}
        </span>
      )}
    </div>
    <div className="mt-4">{children}</div>
  </section>
);

const Btn = ({ on, wide, danger, children, ...rest }) => (
  <button {...rest} style={{
    ...fontUtility, fontSize: "9px", letterSpacing: "0.16em", cursor: "pointer",
    padding: wide ? "11px 20px" : "8px 12px",
    color: on ? theme.onInk : danger ? theme.bad : theme.ink,
    background: on ? (danger ? theme.bad : theme.ink) : "transparent",
    border: `1px solid ${danger ? theme.bad : on ? theme.ink : theme.rule}`,
    ...(rest.style || {}),
  }}>{children}</button>
);

const Note = ({ children, tone = "bad" }) =>
  children ? (
    <p className="m-0 my-3 px-3 py-2.5" style={{
      ...fontText, fontSize: "15px", lineHeight: 1.5,
      color: tone === "bad" ? theme.bad : theme.ink,
      border: `1px solid ${tone === "bad" ? theme.badLine : theme.rule}`,
      background: tone === "bad" ? "transparent" : theme.sunk,
    }}>{children}</p>
  ) : null;

/*
  A slider with the number beside it AND a readout of what the number means.

  The second half is the point. "62" is not a thing anybody can judge; "39% of
  the page shows through" is exactly the thing you are squinting at the bar
  trying to decide. A control that reports its own units in the units of the
  decision is worth three that report themselves in the units of the code.
*/
const Slide = ({ label, value, min, max, step = 1, unit, readout, help, onChange }) => (
  <div className="py-4" style={{ borderBottom: `1px solid ${theme.rule}` }}>
    <div className="flex items-baseline gap-3">
      <span className="flex-1" style={{ ...fontText, fontSize: "16px", color: theme.ink }}>{label}</span>
      {readout && (
        <span style={{ ...fontUtility, fontSize: "9px", letterSpacing: "0.14em", color: theme.brass }}>
          {readout}
        </span>
      )}
      <span style={{ ...fontUtility, fontSize: "10px", letterSpacing: "0.1em", color: theme.ink,
                     fontVariantNumeric: "tabular-nums", minWidth: "54px", textAlign: "right" }}>
        {value}{unit}
      </span>
    </div>
    <input
      type="range" min={min} max={max} step={step} value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full mt-2.5"
      style={{ accentColor: theme.brass, cursor: "pointer" }}
      aria-label={label}
    />
    {help && (
      <p className="m-0 mt-1.5" style={{ ...fontText, fontSize: "14px", lineHeight: 1.5, color: theme.ink2 }}>
        {help}
      </p>
    )}
  </div>
);

/* ══ THE LIQUID BAR ════════════════════════════════════════════════════════ */

const SPECIMEN_TABS = [
  { key: "home", label: "HOME", Icon: Home },
  { key: "news", label: "NEWS", Icon: Newspaper },
  { key: "records", label: "RECORDS", Icon: Disc },
  { key: "artists", label: "ARTISTS", Icon: Users },
  { key: "events", label: "EVENTS", Icon: Calendar },
];

/*
  THE SPECIMEN.

  Built from the SAME lib/liquid functions the real bar is built from, and
  moved by the same springs at the same speed, so it cannot tell you a
  comfortable lie. This is the whole reason the desk exists: darkness is not a
  number anybody can choose in the abstract — you choose it by looking at the
  bar over the thing it will actually sit on, on the screen you will actually
  hold. Judging it from a hex value in a stylesheet is what produced a bar
  that let fourteen per cent of the page through.

  Which is also why it sits over BOTH grounds. Glass that reads beautifully
  over cream paper can be unreadable over a photograph and the other way
  round, and the bar floats over both on the same site.
*/
function Specimen({ finish, tune, speed, ground }) {
  const [picked, setPicked] = useState("records");
  const rowRef = useRef(null);
  const tabRefs = useRef({});
  const lozRef = useRef(null);
  const rig = useRef(null);
  const springs = useRef(null);
  if (!springs.current) {
    const K = springSet(1);
    springs.current = { lx: new Spring(0, K.lx), lw: new Spring(0, K.lw) };
  }

  useLayoutEffect(() => {
    rig.current = driveSprings(springs.current, ({ lx, lw }) => {
      const el = lozRef.current;
      if (!el) return;
      const sp = springs.current.lx;
      const reach = Math.abs(sp.vel) / Math.sqrt(sp.k / sp.m);
      const extra = Math.min(reach * 0.34, lw * 0.5, 28);
      const w = Math.round(lw + extra);
      el.style.width = w + "px";
      el.style.borderRadius = Math.min(20, w / 2) + "px";
      el.style.transform = `translate3d(${Math.round(lx - (sp.vel < 0 ? extra : 0))}px,0,0)`;
    });
    return () => rig.current?.stop();
  }, []);

  // The speed control, felt rather than read.
  useEffect(() => { rig.current?.tune(springSet(speed)); }, [speed]);

  // Placed without travelling the first time, exactly as the real bar does.
  const placed = useRef(false);
  useLayoutEffect(() => {
    const el = tabRefs.current[picked];
    if (!el || !el.offsetWidth) return;
    const at = { lx: el.offsetLeft, lw: el.offsetWidth };
    if (placed.current) rig.current?.to(at);
    else { rig.current?.set(at); placed.current = true; }
  }, [picked, finish, tune.darkness, tune.blur, tune.saturation]);

  const mat = resolveFinish(finish, tune);
  const onDark = mat.dark && mat.darkness >= 34;
  const ink = onDark ? theme.bg : theme.ink;
  const lit = onDark ? theme.bg : theme.brass;

  const paper = ground === "PAPER";

  return (
    <div className="relative overflow-hidden" style={{ border: `1px solid ${theme.rule}` }}>
      {/* what the bar is sitting on */}
      <div className="px-6 pt-7 pb-24" style={{
        background: paper ? theme.bg : "#1A1712",
        /*
          A stand-in for a photograph rather than a photograph: the specimen
          has to render before anything has loaded, and a bar judged against a
          missing image is a bar judged against white.
        */
        backgroundImage: paper ? "none"
          : "radial-gradient(120% 90% at 22% 12%, rgba(220,196,150,.42), rgba(0,0,0,0) 58%)," +
            "radial-gradient(90% 70% at 82% 82%, rgba(110,33,24,.55), rgba(0,0,0,0) 62%)",
      }}>
        <p className="m-0" style={{ ...fontUtility, fontSize: "8px", letterSpacing: "0.22em",
                                    color: paper ? theme.brass : "rgba(237,228,208,.62)" }}>
          {paper ? "OVER THE STOCK" : "OVER A PHOTOGRAPH"}
        </p>
        <p className="m-0 mt-2" style={{ ...fontDisplay, fontSize: "34px", lineHeight: 1.02,
                                         letterSpacing: "-0.02em",
                                         color: paper ? theme.ink : theme.bg }}>
          Everything the bar<br />has to stay legible over.
        </p>
        <p className="m-0 mt-3" style={{ ...fontText, fontSize: "15px", lineHeight: 1.55, maxWidth: "44ch",
                                         color: paper ? theme.ink2 : "rgba(237,228,208,.74)" }}>
          Drag the sliders and watch this, not the numbers. Tap a tab to feel
          the speed — the selection here runs on the same springs as the real
          one.
        </p>
      </div>

      {/* the bar itself */}
      <div className="absolute left-0 right-0 flex justify-center px-4" style={{ bottom: "16px" }}>
        <div className="relative overflow-hidden w-full" style={{
          ...glassStyle(finish, theme.ink, tune),
          maxWidth: "420px", height: "68px", borderRadius: "34px",
        }}>
          <span aria-hidden="true" style={lipStyle(finish, tune)} />
          <span aria-hidden="true" style={specStyle(finish, 0, tune)} />
          <div ref={rowRef} className="flex relative h-full" style={{ padding: "6px", gap: "2px" }}>
            <span aria-hidden="true" ref={lozRef} className="absolute" style={{
              top: "50%", height: "44px", marginTop: "-22px", left: 0,
              ...lozengeStyle(finish, tune), pointerEvents: "none",
            }} />
            {SPECIMEN_TABS.map(({ key, label, Icon }) => {
              const on = key === picked;
              return (
                <button key={key} ref={(el) => { tabRefs.current[key] = el; }}
                        onClick={() => setPicked(key)}
                        className="flex flex-col items-center justify-center shrink-0 relative"
                        style={{ flex: "1 1 0", minWidth: 0, padding: "8px 2px", gap: "4px",
                                 borderRadius: "999px", background: "transparent",
                                 border: "none", cursor: "pointer" }}>
                  <Icon size={18} strokeWidth={on ? 1.9 : 1.6} color={on ? lit : ink} aria-hidden="true" />
                  <span style={{ ...fontUtility, fontSize: "7px", letterSpacing: "0.02em",
                                 color: on ? lit : ink, fontWeight: on ? 700 : 400 }}>
                    {label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export function LiquidBar() {
  const [values, setValues] = useState(null);
  const [saved0, setSaved0] = useState(null);
  const [defaults, setDefaults] = useState({});
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [ground, setGround] = useState("PAPER");

  useEffect(() => {
    api.fetchSettings().then((res) => {
      if (res.ok) { setValues(res.settings); setSaved0(res.settings); setDefaults(res.defaults || {}); }
      else setMsg(res.error || "Couldn't load the settings.");
    });
  }, []);

  const set = (k, v) => setValues((s) => ({ ...s, [k]: v }));

  const dirty = values && saved0
    ? Object.keys(values).filter((k) => String(values[k]) !== String(saved0[k]))
    : [];

  const save = async () => {
    setBusy(true);
    const res = await api.saveSettings(values);
    setBusy(false);
    setMsg(res.ok ? "" : (res.error || "Couldn't save."));
    if (res.ok) {
      setSaved0(values);
      setDone(true);
      setTimeout(() => setDone(false), 2600);
    }
  };

  const finish = (values && values.barFinish) || "INK";
  const tune = values ? {
    darkness: values.barDarkness,
    blur: values.barBlur,
    saturation: values.barSaturation,
  } : {};
  const mat = useMemo(() => resolveFinish(finish, tune),
    [finish, tune.darkness, tune.blur, tune.saturation]);

  if (!values) {
    return (
      <Panel title="THE LIQUID BAR">
        <Note tone="plain">{msg || "Loading…"}</Note>
      </Panel>
    );
  }

  const speed = Math.max(0.5, Math.min(2, Number(values.barSpeed) || 1));

  return (
    <>
      <IndexBand items={[
        { label: "FINISH", value: finish },
        { label: "SHOWING THROUGH", value: `${mat.seeThrough}%` },
        { label: "SPEED", value: `${Math.round(speed * 100)}%` },
        { label: "UNSAVED", value: String(dirty.length).padStart(2, "0") },
      ]} />

      <Panel title="THE LIQUID BAR"
             right={dirty.length ? `${dirty.length} CHANGED` : "NOTHING CHANGED"}>
        <p className="m-0 mb-4" style={{ ...fontText, fontSize: "15px", lineHeight: 1.55, color: theme.ink2 }}>
          The floating bar has its own desk because it is the one part of the
          site you can only judge by looking at it, on the screen you will
          actually be holding. Everything below changes the specimen as you
          drag; nothing reaches the site until you save.
        </p>

        <div className="flex gap-1.5 mb-3">
          {["PAPER", "PHOTOGRAPH"].map((g) => (
            <Btn key={g} on={ground === g} onClick={() => setGround(g)}>{g}</Btn>
          ))}
        </div>

        <Specimen finish={finish} tune={tune} speed={speed} ground={ground} />

        <div className="mt-7 mb-1 flex items-baseline gap-3">
          <span style={{ ...fontUtility, fontSize: "8.5px", letterSpacing: "0.2em", color: theme.brass }}>
            THE MATERIAL
          </span>
          <span className="flex-1" style={{ borderTop: `1px solid ${theme.rule}`, transform: "translateY(-3px)" }} />
        </div>

        <div className="py-4" style={{ borderBottom: `1px solid ${theme.rule}` }}>
          <p className="m-0 mb-2.5" style={{ ...fontText, fontSize: "16px", color: theme.ink }}>Glass finish</p>
          <div className="flex flex-wrap" style={{ gap: "6px" }}>
            {[
              { value: "LENS",  swatch: "#DCD3C0" },
              { value: "CLEAR", swatch: "#F4F1E9" },
              { value: "INK",   swatch: "#2A2620" },
            ].map((o) => (
              <Btn key={o.value} on={finish === o.value}
                   onClick={() => {
                     /*
                       Switching finish resets the three numbers to that
                       finish's own designed values. Carrying INK's darkness
                       across to CLEAR would produce a pane that is neither,
                       and the person would reasonably conclude CLEAR is
                       broken rather than that they are still wearing INK's
                       settings.
                     */
                     const d = resolveFinish(o.value, {});
                     setValues((s) => ({ ...s, barFinish: o.value,
                       barDarkness: d.darkness, barBlur: d.blurPx, barSaturation: d.saturation }));
                   }}
                   style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ width: "13px", height: "13px", background: o.swatch, display: "block",
                               border: `1px solid ${finish === o.value ? "rgba(237,228,208,0.5)" : theme.rule}` }} />
                {o.value}
              </Btn>
            ))}
          </div>
          <p className="m-0 mt-2" style={{ ...fontText, fontSize: "14px", lineHeight: 1.5, color: theme.ink2 }}>
            LENS carries almost no colour of its own — it works by squeezing
            whatever is behind it toward a middle tone, so it holds up over
            paper and over a photograph alike. CLEAR is the most transparent
            and the least forgiving over busy content. INK leans dark and
            belongs over photography.
          </p>
        </div>

        <Slide label="Darkness" value={Number(values.barDarkness)} min={0} max={100}
               readout={`${mat.seeThrough}% OF THE PAGE SHOWS THROUGH`}
               onChange={(v) => set("barDarkness", v)}
               help={"One control, not two. The tint and the backdrop brightness used to be " +
                     "separate hardcoded numbers and both were darkening at once — multiplied " +
                     "out, about fourteen per cent of the page was reaching the eye, which is a " +
                     "black slab rather than dark glass. They move together on one curve now."} />

        <Slide label="Blur" value={Number(values.barBlur)} min={0} max={40} unit="px"
               onChange={(v) => set("barBlur", v)}
               help={"The expensive one. The compositor re-samples everything behind the bar " +
                     "through this on every frame the bar changes size, and the cost climbs " +
                     "fast. Past about twenty-two nothing more is visible and the phone is " +
                     "simply working harder."} />

        <Slide label="Colour kept" value={Number(values.barSaturation)} min={100} max={300} unit="%"
               onChange={(v) => set("barSaturation", v)}
               help={"How much colour survives the backdrop. Under 100 drains it toward grey; " +
                     "over 200 is where glass starts reading as glass rather than as tracing paper."} />

        <Slide label="Speed" value={Math.round(speed * 100)} min={50} max={200} step={5} unit="%"
               onChange={(v) => set("barSpeed", v / 100)}
               help={"A multiplier on how quickly everything moves, not a duration. It scales " +
                     "every spring at once, so the bar keeps its character — the selection still " +
                     "leads, the corners still arrive last — and only the tempo changes. Tap a " +
                     "tab in the specimen to feel it."} />

        <div className="mt-7 mb-1 flex items-baseline gap-3">
          <span style={{ ...fontUtility, fontSize: "8.5px", letterSpacing: "0.2em", color: theme.brass }}>
            THE TABS
          </span>
          <span className="flex-1" style={{ borderTop: `1px solid ${theme.rule}`, transform: "translateY(-3px)" }} />
        </div>

        <p className="m-0 mb-3" style={{ ...fontText, fontSize: "14.5px", lineHeight: 1.55, color: theme.ink2 }}>
          The bar measures itself rather than counting tabs: it shares the width
          while they fit and scrolls once they genuinely do not, on any screen.
          These two set how big each tab is when it does scroll.
        </p>

        {[
          { key: "barTabWidth", label: "Tab width when scrolling", unit: "px", step: "1" },
          { key: "barLabelSize", label: "Label size", unit: "px", step: "0.5" },
        ].map((r) => (
          <div key={r.key} className="flex items-center gap-3 py-3"
               style={{ borderBottom: `1px solid ${theme.rule}` }}>
            <span className="flex-1" style={{ ...fontText, fontSize: "16px", color: theme.ink }}>
              {r.label}
            </span>
            <input type="number" step={r.step} value={values[r.key]}
                   onChange={(e) => set(r.key, Number(e.target.value))}
                   style={{ ...inputStyle, width: "90px", textAlign: "right" }} />
            <span style={{ ...fontUtility, fontSize: "8.5px", letterSpacing: "0.14em",
                           color: theme.ink2, width: "34px" }}>{r.unit}</span>
          </div>
        ))}

        <label className="flex items-start gap-3 py-3" style={{ cursor: "pointer" }}>
          <input type="checkbox" checked={!!values.barShowLabels} style={{ marginTop: "4px" }}
                 onChange={(e) => set("barShowLabels", e.target.checked)} />
          <span>
            <span className="block" style={{ ...fontText, fontSize: "16px", color: theme.ink }}>
              Show labels under the icons
            </span>
            <span className="block mt-1" style={{ ...fontText, fontSize: "14px", lineHeight: 1.5, color: theme.ink2 }}>
              Off leaves icons only, which fits far more across before the bar
              has to scroll.
            </span>
          </span>
        </label>

        <Note>{msg}</Note>

        <div className="mt-5 flex items-center gap-3 flex-wrap">
          <Btn wide on onClick={save} disabled={busy || !dirty.length}
               style={{ opacity: busy || !dirty.length ? 0.45 : 1 }}>
            {busy ? "SAVING…" : done ? "SAVED" : "SAVE"}
          </Btn>
          <Btn onClick={() => {
            const d = resolveFinish(finish, {});
            setValues((s) => ({ ...s,
              barDarkness: d.darkness, barBlur: d.blurPx, barSaturation: d.saturation,
              barSpeed: defaults.barSpeed ?? 1 }));
          }}>
            BACK TO THE DESIGNED VALUES
          </Btn>
          {done && (
            <span style={{ ...fontUtility, fontSize: "9px", letterSpacing: "0.16em", color: theme.good }}>
              APPLIES STRAIGHT AWAY
            </span>
          )}
        </div>
      </Panel>
    </>
  );
}

/* ══ THE POOL ══════════════════════════════════════════════════════════════ */

const when = (t) => {
  if (!t) return "—";
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return "—";
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return "JUST NOW";
  if (mins < 60) return `${mins}M AGO`;
  if (mins < 1440) return `${Math.round(mins / 60)}H AGO`;
  return d.toISOString().slice(5, 10).replace("-", ".");
};

/*
  ── ONE ROW OF THE POOL ────────────────────────────────────────────────────

  Read-only except for its status. A song is a thing somebody sent; the team
  decides whether it gets PLAYED or HIDDEN and nothing else. Editing the title
  of a request would make the list a record of what we wish had been asked
  for, which is not a record of anything.

  NO NATIVE confirm() ON THE DELETE. On iOS a system dialog blocks the whole
  page behind it and this site has been bitten by that before. The button says
  what a second press will do instead.
*/
function SongRow({ song, onStatus, onDelete }) {
  const [arming, setArming] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!arming) return undefined;
    const t = setTimeout(() => setArming(false), 4000);
    return () => clearTimeout(t);
  }, [arming]);

  const hidden = song.status === "HIDDEN";
  const played = song.status === "PLAYED";

  const act = async (fn) => { setBusy(true); await fn(); setBusy(false); };

  return (
    <div className="flex items-start gap-3 py-3"
         style={{ borderBottom: `1px solid ${theme.rule}`, opacity: hidden ? 0.5 : 1 }}>
      <div className="shrink-0" style={{
        width: "46px", height: "46px", border: `1px solid ${theme.rule}`,
        background: song.artwork ? `center/cover no-repeat url(${song.artwork})` : theme.sunk,
      }} aria-hidden="true" />

      <div className="flex-1" style={{ minWidth: 0 }}>
        <p className="m-0" style={{ ...fontText, fontSize: "16px", lineHeight: 1.3, color: theme.ink,
                                    textDecoration: played ? "line-through" : "none" }}>
          {song.title || "Untitled"}
        </p>
        {song.artist && (
          <p className="m-0" style={{ ...fontText, fontSize: "14.5px", color: theme.ink2 }}>{song.artist}</p>
        )}
        <p className="m-0 mt-1 flex flex-wrap items-center" style={{
          ...fontUtility, fontSize: "8px", letterSpacing: "0.14em", color: theme.ink2, gap: "10px",
        }}>
          <span>{song.provider || "LINK"}</span>
          <span>{when(song.created_at)}</span>
          {song.by_name && <span>— {song.by_name}</span>}
          {song.votes != null && <span style={{ color: theme.brass }}>{song.votes} VOTES</span>}
          {hidden && <span style={{ color: theme.bad }}>HIDDEN</span>}
          {played && <span style={{ color: theme.good }}>PLAYED</span>}
          {song.url && (
            <a href={song.url} target="_blank" rel="noreferrer noopener"
               style={{ color: theme.brass, textDecoration: "underline" }}>OPEN</a>
          )}
        </p>
      </div>

      <div className="flex shrink-0 flex-wrap justify-end" style={{ gap: "5px", maxWidth: "220px" }}>
        <Btn on={played} disabled={busy}
             onClick={() => act(() => onStatus(song.id, played ? "NEW" : "PLAYED"))}>
          {played ? "UNPLAY" : "PLAYED"}
        </Btn>
        <Btn on={hidden} disabled={busy}
             onClick={() => act(() => onStatus(song.id, hidden ? "NEW" : "HIDDEN"))}>
          {hidden ? "SHOW" : "HIDE"}
        </Btn>
        <Btn danger disabled={busy}
             onClick={() => { if (arming) act(() => onDelete(song.id)); else setArming(true); }}>
          {arming ? "PRESS AGAIN" : "DELETE"}
        </Btn>
      </div>
    </div>
  );
}

/*
  ── THE POOL DESK ──────────────────────────────────────────────────────────

  HIDE IS NOT DELETE, and both are here on purpose. Hiding takes a song off
  the public list and leaves it on this one; deleting takes it off both. The
  distinction matters because most of what needs taking down is not abuse —
  it is the fourth copy of the same track, or something already played — and
  a team that only has DELETE will use DELETE for all of it and lose the
  record of what the room actually asked for.

  THE SWITCHES ARE HERE, not only in SETTINGS. The moment you need to shut the
  pool is the moment a set is going badly, and that is not the moment to go
  hunting through fourteen sections of a settings screen. They are the same
  settings — saved through the same endpoint, shown in both places.
*/
export function PoolDesk({ parties }) {
  const [pool, setPool] = useState("EVENT");
  const [party, setParty] = useState("");
  const [songs, setSongs] = useState([]);
  const [only, setOnly] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [cfg, setCfg] = useState(null);

  const live = useMemo(
    () => (parties || []).filter((p) => !p.archived),
    [parties]
  );

  useEffect(() => {
    if (pool === "EVENT" && !party && live.length) setParty(String(live[0].id));
  }, [pool, party, live]);

  useEffect(() => {
    api.fetchSettings().then((res) => { if (res.ok) setCfg(res.settings); });
  }, []);

  const load = React.useCallback(() => {
    if (pool === "EVENT" && !party) { setSongs([]); setLoading(false); return; }
    setLoading(true);
    api.listSongs(pool, pool === "EVENT" ? party : "").then((res) => {
      setLoading(false);
      if (res.ok) { setSongs(res.songs || []); setMsg(""); }
      else setMsg(res.error || "Couldn't read the pool.");
    });
  }, [pool, party]);

  useEffect(() => { load(); }, [load]);

  const setStatus = async (id, status) => {
    const res = await api.editSong(id, status);
    if (res.ok) setSongs((list) => list.map((s) => (s.id === id ? { ...s, status } : s)));
    else setMsg(res.error || "Couldn't change that.");
  };

  const remove = async (id) => {
    const res = await api.deleteSong(id);
    if (res.ok) setSongs((list) => list.filter((s) => s.id !== id));
    else setMsg(res.error || "Couldn't delete that.");
  };

  // The switches save through the whole settings object, like every other
  // control in the console — there is one settings endpoint and this is it.
  const toggle = async (k) => {
    if (!cfg) return;
    const next = { ...cfg, [k]: !cfg[k] };
    setCfg(next);
    const res = await api.saveSettings(next);
    if (!res.ok) { setCfg(cfg); setMsg(res.error || "Couldn't change that."); }
  };

  const shown = songs.filter((s) =>
    only === "ALL" ? true
      : only === "NEW" ? s.status === "NEW"
      : only === "PLAYED" ? s.status === "PLAYED"
      : s.status === "HIDDEN");

  const count = (st) => songs.filter((s) => s.status === st).length;

  return (
    <>
      <IndexBand items={[
        { label: "POOL", value: pool === "HOUSE" ? "THE HOUSE LIST" : "A NIGHT" },
        { label: "IN THE POOL", value: loading ? "—" : String(songs.length).padStart(3, "0") },
        { label: "NOT YET PLAYED", value: loading ? "—" : String(count("NEW")).padStart(3, "0") },
        { label: "PLAYED", value: loading ? "—" : String(count("PLAYED")).padStart(3, "0") },
      ]} />

      <Panel title="THE POOL" right={
        cfg ? (cfg.poolOpen === false ? "CLOSED" : "OPEN") : ""
      }>
        <p className="m-0 mb-4" style={{ ...fontText, fontSize: "15px", lineHeight: 1.55, color: theme.ink2 }}>
          What people have asked for, and the switches to stop them asking. Hiding
          takes a song off the public list and leaves it here; deleting takes it
          off both. Most of what needs taking down is a duplicate rather than a
          problem, so it is worth keeping the difference.
        </p>

        <div className="flex flex-wrap items-center mb-4" style={{ gap: "6px" }}>
          {["EVENT", "HOUSE"].map((p) => (
            <Btn key={p} on={pool === p} onClick={() => setPool(p)}>
              {p === "HOUSE" ? "THE HOUSE LIST" : "A NIGHT"}
            </Btn>
          ))}
          {pool === "EVENT" && (
            <select value={party} onChange={(e) => setParty(e.target.value)}
                    style={{ ...inputStyle, maxWidth: "260px" }} aria-label="Which night">
              {!live.length && <option value="">No nights yet</option>}
              {live.map((p) => (
                <option key={p.id} value={String(p.id)}>{p.name}</option>
              ))}
            </select>
          )}
          <span className="flex-1" />
          <Btn onClick={load}>REFRESH</Btn>
        </div>

        {cfg && (
          <div className="flex flex-wrap mb-5" style={{ gap: "6px" }}>
            {[
              { k: "poolOpen", label: "THE POOL" },
              { k: "poolEventOpen", label: "TONIGHT'S" },
              { k: "poolHouseOpen", label: "THE HOUSE LIST" },
            ].map((s) => (
              <Btn key={s.k} on={cfg[s.k] !== false} onClick={() => toggle(s.k)}>
                {s.label} · {cfg[s.k] !== false ? "OPEN" : "CLOSED"}
              </Btn>
            ))}
          </div>
        )}

        <div className="flex flex-wrap mb-2" style={{ gap: "5px" }}>
          {["ALL", "NEW", "PLAYED", "HIDDEN"].map((f) => (
            <Btn key={f} on={only === f} onClick={() => setOnly(f)}>
              {f === "NEW" ? "NOT YET PLAYED" : f}
            </Btn>
          ))}
        </div>

        <Note>{msg}</Note>

        {loading ? (
          <p className="m-0 py-6" style={{ ...fontText, fontSize: "16px", color: theme.ink2 }}>Reading…</p>
        ) : !shown.length ? (
          <p className="m-0 py-6" style={{ ...fontText, fontSize: "16px", color: theme.ink2 }}>
            {songs.length
              ? "Nothing in this pool matches that filter."
              : pool === "EVENT" && !party
                ? "Pick a night to see what has been asked for."
                : "Nothing in the pool yet."}
          </p>
        ) : (
          shown.map((s) => (
            <SongRow key={s.id} song={s} onStatus={setStatus} onDelete={remove} />
          ))
        )}
      </Panel>
    </>
  );
}

/* ══ THE POLLS ═════════════════════════════════════════════════════════════ */

/*
  ── WRITING A POLL ─────────────────────────────────────────────────────────

  IT IS BORN A DRAFT, ALWAYS. There is no "create and open" button, and that
  is deliberate: a poll goes out to everyone the instant it opens, a typo in a
  question is public the moment you press the key, and the votes you collect
  on a badly-worded option cannot be un-collected. So writing it and
  publishing it are two decisions, made at two moments, with the poll readable
  on this screen in between.

  THE AUDIENCE IS A DECISION, NOT A DEFAULT. PUBLIC goes on /polls where
  anybody can answer. TEAM never leaves the console — it is how the four of you
  settle which track goes first without putting the question to the internet.
  The worker enforces the difference in three separate places; this control
  only chooses it.
*/
function NewPoll({ onMade }) {
  const [question, setQuestion] = useState("");
  const [note, setNote] = useState("");
  const [audience, setAudience] = useState("PUBLIC");
  const [picks, setPicks] = useState(1);
  const [options, setOptions] = useState(["", ""]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const setOpt = (i, v) => setOptions((was) => was.map((o, n) => (n === i ? v : o)));
  const filled = options.map((o) => o.trim()).filter(Boolean);

  const make = async () => {
    setErr("");
    if (!question.trim()) { setErr("A poll needs a question."); return; }
    if (filled.length < 2) { setErr("A poll needs at least two options."); return; }
    setBusy(true);
    const res = await api.createPoll({
      question: question.trim(), note: note.trim(), audience,
      picks: Math.min(picks, filled.length), options: filled,
    });
    setBusy(false);
    if (!res.ok) { setErr(res.error || "Couldn't write that."); return; }
    setQuestion(""); setNote(""); setOptions(["", ""]); setPicks(1);
    onMade();
  };

  return (
    <div className="mb-9 p-4" style={{ border: `1px solid ${theme.rule}`, background: theme.sunk }}>
      <p className="m-0 mb-3" style={{ ...fontUtility, fontSize: "8.5px", letterSpacing: "0.2em", color: theme.brass }}>
        WRITE ONE
      </p>

      <input value={question} onChange={(e) => setQuestion(e.target.value)}
             placeholder="The question" maxLength={200}
             style={{ ...inputStyle, width: "100%", marginBottom: "8px" }} />
      <input value={note} onChange={(e) => setNote(e.target.value)}
             placeholder="A line under it — optional" maxLength={200}
             style={{ ...inputStyle, width: "100%", marginBottom: "12px" }} />

      {options.map((o, i) => (
        <div key={i} className="flex items-center gap-2 mb-1.5">
          <span style={{ ...fontUtility, fontSize: "8px", letterSpacing: "0.14em",
                         color: theme.ink2, width: "22px" }}>
            {String(i + 1).padStart(2, "0")}
          </span>
          <input value={o} onChange={(e) => setOpt(i, e.target.value)}
                 placeholder={`Option ${i + 1}`} maxLength={120}
                 style={{ ...inputStyle, flex: 1 }} />
          {options.length > 2 && (
            <Btn onClick={() => setOptions((was) => was.filter((_, n) => n !== i))}>—</Btn>
          )}
        </div>
      ))}

      <div className="flex flex-wrap items-center mt-3" style={{ gap: "6px" }}>
        <Btn onClick={() => setOptions((was) => (was.length < 12 ? [...was, ""] : was))}
             disabled={options.length >= 12}>
          ADD AN OPTION
        </Btn>
        <span className="flex-1" />
        <span style={{ ...fontUtility, fontSize: "8px", letterSpacing: "0.14em", color: theme.ink2 }}>
          WHO SEES IT
        </span>
        {["PUBLIC", "TEAM"].map((a) => (
          <Btn key={a} on={audience === a} onClick={() => setAudience(a)}>{a}</Btn>
        ))}
      </div>

      <div className="flex items-center gap-3 py-3 mt-1" style={{ borderTop: `1px solid ${theme.rule}` }}>
        <span className="flex-1" style={{ ...fontText, fontSize: "15px", color: theme.ink }}>
          How many one person may pick
        </span>
        <input type="number" min="1" max={Math.max(2, filled.length || 2)} value={picks}
               onChange={(e) => setPicks(Math.max(1, Number(e.target.value) || 1))}
               style={{ ...inputStyle, width: "70px", textAlign: "right" }} />
      </div>

      <Note>{err}</Note>

      <Btn wide on onClick={make} disabled={busy} style={{ opacity: busy ? 0.5 : 1 }}>
        {busy ? "WRITING…" : "SAVE AS A DRAFT"}
      </Btn>
      <p className="m-0 mt-2" style={{ ...fontText, fontSize: "14px", lineHeight: 1.5, color: theme.ink2 }}>
        It is a draft until you open it. Nothing is visible to anybody, and
        nothing can be voted on, until you press OPEN below.
      </p>
    </div>
  );
}

/* One poll on the desk: its numbers, and the two decisions you can make. */
function PollRow({ poll, onChange, onDelete }) {
  const [arming, setArming] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!arming) return undefined;
    const t = setTimeout(() => setArming(false), 4000);
    return () => clearTimeout(t);
  }, [arming]);

  const total = poll.options.reduce((n, o) => n + (o.votes || 0), 0);
  /*
    VOTES, NOT VOTERS. On a poll where one person may pick three, the numbers
    on the options add up to three times the turnout, and calling that total
    "people" would overstate the room by exactly the pick limit. Where the two
    genuinely differ the label says which one it is.
  */
  const people = poll.picks > 1 ? Math.ceil(total / poll.picks) : total;
  const top = Math.max(1, ...poll.options.map((o) => o.votes || 0));

  const act = async (fn) => { setBusy(true); await fn(); setBusy(false); };

  return (
    <div className="mb-7 pb-5" style={{ borderBottom: `1px solid ${theme.rule}` }}>
      <div className="flex items-baseline flex-wrap gap-2 mb-1.5">
        <span style={{ ...fontUtility, fontSize: "8px", letterSpacing: "0.18em",
                       color: poll.status === "OPEN" ? theme.good
                            : poll.status === "CLOSED" ? theme.ink2 : theme.warn }}>
          {poll.status}
        </span>
        <span style={{ ...fontUtility, fontSize: "8px", letterSpacing: "0.18em",
                       color: poll.audience === "TEAM" ? theme.brass : theme.ink2 }}>
          {poll.audience === "TEAM" ? "TEAM ONLY" : "ON THE SITE"}
        </span>
        <span style={{ ...fontUtility, fontSize: "8px", letterSpacing: "0.14em", color: theme.ink2 }}>
          {poll.picks > 1 ? `UP TO ${poll.picks}` : "ONE PICK"}
        </span>
        <span className="flex-1" />
        <span style={{ ...fontUtility, fontSize: "8px", letterSpacing: "0.14em", color: theme.ink2 }}>
          {poll.picks > 1
            ? `${total} VOTES · ABOUT ${people} ${people === 1 ? "PERSON" : "PEOPLE"}`
            : `${total} ${total === 1 ? "VOTE" : "VOTES"}`}
        </span>
      </div>

      <p className="m-0" style={{ ...fontText, fontSize: "18px", lineHeight: 1.3, color: theme.ink }}>
        {poll.question}
      </p>
      {poll.note && (
        <p className="m-0 mt-0.5" style={{ ...fontText, fontSize: "14.5px", color: theme.ink2 }}>{poll.note}</p>
      )}

      <div className="mt-3">
        {poll.options.map((o) => {
          const n = o.votes || 0;
          return (
            <div key={o.id} className="relative overflow-hidden mb-1"
                 style={{ border: `1px solid ${theme.rule}`, padding: "8px 11px" }}>
              {/* Scaled to the LEADER, not to the total — on a poll where one
                  person picks three, shares of the total are all small and
                  every bar looks the same. Against the leader the shape of
                  the result is readable at a glance, which is the only reason
                  to draw a bar rather than print the number. */}
              <span aria-hidden="true" style={{
                position: "absolute", left: 0, top: 0, bottom: 0,
                width: `${Math.round((n / top) * 100)}%`,
                background: n === top && n > 0 ? "rgba(110,33,24,0.14)" : theme.sunk,
              }} />
              <span className="relative flex items-baseline gap-3">
                <span className="flex-1" style={{ ...fontText, fontSize: "15px", color: theme.ink }}>
                  {o.label}
                </span>
                <span style={{ ...fontUtility, fontSize: "9.5px", letterSpacing: "0.08em",
                               color: theme.ink, fontVariantNumeric: "tabular-nums" }}>
                  {n}
                </span>
              </span>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap mt-3" style={{ gap: "5px" }}>
        {poll.status !== "OPEN" && (
          <Btn on disabled={busy} onClick={() => act(() => onChange(poll.id, { status: "OPEN" }))}>
            {poll.status === "CLOSED" ? "OPEN IT AGAIN" : "OPEN"}
          </Btn>
        )}
        {poll.status === "OPEN" && (
          <Btn disabled={busy} onClick={() => act(() => onChange(poll.id, { status: "CLOSED" }))}>
            CLOSE
          </Btn>
        )}
        <Btn danger disabled={busy}
             onClick={() => { if (arming) act(() => onDelete(poll.id)); else setArming(true); }}>
          {arming ? `PRESS AGAIN — ${total} ${total === 1 ? "VOTE GOES" : "VOTES GO"}` : "DELETE"}
        </Btn>
      </div>
    </div>
  );
}

/*
  ── ONE TEXT FIELD, DEFINED AT THE TOP LEVEL ───────────────────────────────

  It matters that this is out here rather than inside the component that uses
  it. A component declared inside a render is a NEW FUNCTION on every render,
  and React compares component types by identity — so it does not see the same
  input with a new value, it sees one component disappear and a different one
  arrive. It unmounts the old node and mounts a fresh one.

  For a row of buttons that is invisible. For a TEXT FIELD it is fatal: the
  new node is not the focused one, so focus is lost after every single
  keystroke and typing a headline means clicking back into the box for each
  letter. Declared here, it is one type for the life of the module.
*/
const SettingLine = ({ label, value, placeholder, help, onChange }) => (
  <div className="py-3" style={{ borderBottom: `1px solid ${theme.rule}` }}>
    <p className="m-0 mb-1.5" style={{ ...fontText, fontSize: "15.5px", color: theme.ink }}>{label}</p>
    <input value={value || ""} onChange={(e) => onChange(e.target.value)}
           placeholder={placeholder} style={{ ...inputStyle, width: "100%" }} />
    {help && (
      <p className="m-0 mt-1.5" style={{ ...fontText, fontSize: "14px", lineHeight: 1.5, color: theme.ink2 }}>
        {help}
      </p>
    )}
  </div>
);

/*
  The words the page uses, and the one rule that is not per-poll.

  These live HERE rather than in SETTINGS for the same reason the pool's
  switches do: the moment you want to shut voting is the moment something has
  gone wrong with a poll, and that is not the moment to go hunting through
  thirteen sections of a settings screen. They are the same settings, saved
  through the same endpoint — they simply appear where the work is.
*/
function PollRules() {
  const [cfg, setCfg] = useState(null);
  const [saved0, setSaved0] = useState(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [msg, setMsg] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    api.fetchSettings().then((res) => {
      if (res.ok) { setCfg(res.settings); setSaved0(res.settings); }
    });
  }, []);

  if (!cfg) return null;
  const set = (k, v) => setCfg((s) => ({ ...s, [k]: v }));
  const dirty = saved0 && Object.keys(cfg).some((k) => String(cfg[k]) !== String(saved0[k]));

  const save = async () => {
    setBusy(true);
    const res = await api.saveSettings(cfg);
    setBusy(false);
    if (res.ok) { setSaved0(cfg); setDone(true); setTimeout(() => setDone(false), 2600); setMsg(""); }
    else setMsg(res.error || "Couldn't save.");
  };

  return (
    <div className="mb-8">
      <div className="flex flex-wrap items-center" style={{ gap: "6px" }}>
        <Btn on={cfg.pollsOpen !== false} onClick={() => { set("pollsOpen", cfg.pollsOpen === false); }}>
          VOTING · {cfg.pollsOpen !== false ? "OPEN" : "CLOSED"}
        </Btn>
        <Btn on={open} onClick={() => setOpen((v) => !v)}>
          {open ? "HIDE THE WORDS" : "THE WORDS & THE LIMIT"}
        </Btn>
        {dirty && (
          <Btn wide on onClick={save} disabled={busy} style={{ opacity: busy ? 0.5 : 1 }}>
            {busy ? "SAVING…" : done ? "SAVED" : "SAVE"}
          </Btn>
        )}
      </div>
      <p className="m-0 mt-2" style={{ ...fontText, fontSize: "14px", lineHeight: 1.5, color: theme.ink2 }}>
        The master switch hides the whole page from visitors. An individual
        poll is opened and closed on its own, below.
      </p>

      {open && (
        <div className="mt-4 p-4" style={{ border: `1px solid ${theme.rule}`, background: theme.sunk }}>
          <SettingLine value={cfg.pollsHeadline} onChange={(v) => set("pollsHeadline", v)} label="Headline" placeholder="Polls"
                help="Leave empty for “Polls”." />
          <SettingLine value={cfg.pollsSub} onChange={(v) => set("pollsSub", v)} label="Under the headline"
                placeholder="THE COUNT APPEARS ONCE YOU HAVE VOTED"
                help="Set in small tracked capitals, so keep it short." />
          <SettingLine value={cfg.pollsNote} onChange={(v) => set("pollsNote", v)} label="A line above the list"
                placeholder="e.g. We read every one of these."
                help="Empty means nothing is shown." />
          <SettingLine value={cfg.pollsClosedMessage} onChange={(v) => set("pollsClosedMessage", v)} label="When voting is closed"
                placeholder="Nothing to vote on right now."
                help="Shown in place of the list when the master switch is off, and when there is nothing open." />

          <div className="flex items-center gap-3 py-3" style={{ borderBottom: `1px solid ${theme.rule}` }}>
            <span className="flex-1">
              <span className="block" style={{ ...fontText, fontSize: "15.5px", color: theme.ink }}>
                Different people per hour, from one address
              </span>
              <span className="block mt-1" style={{ ...fontText, fontSize: "14px", lineHeight: 1.5, color: theme.ink2 }}>
                One vote per browser is the honest half of this, and a private
                window clears it. This is what stops one person voting forty
                times. It is never sent to the page — a limit nobody can read
                is a limit nobody games. Zero switches it off.
              </span>
            </span>
            <input type="number" min="0" value={cfg.pollsPerHour ?? 6}
                   onChange={(e) => set("pollsPerHour", Math.max(0, Number(e.target.value) || 0))}
                   style={{ ...inputStyle, width: "80px", textAlign: "right" }} />
          </div>

          <Note>{msg}</Note>
        </div>
      )}
    </div>
  );
}

export function PollDesk() {
  const [polls, setPolls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [only, setOnly] = useState("ALL");
  const [msg, setMsg] = useState("");

  const load = React.useCallback(() => {
    api.listPolls().then((res) => {
      setLoading(false);
      if (res.ok) { setPolls(res.polls || []); setMsg(""); }
      else setMsg(res.error || "Couldn't read the polls.");
    });
  }, []);

  useEffect(() => { load(); }, [load]);

  const change = async (id, changes) => {
    const res = await api.editPoll(id, changes);
    if (res.ok) load();
    else setMsg(res.error || "Couldn't change that.");
  };

  const remove = async (id) => {
    const res = await api.deletePoll(id);
    if (res.ok) setPolls((list) => list.filter((p) => p.id !== id));
    else setMsg(res.error || "Couldn't delete that.");
  };

  const shown = polls.filter((p) =>
    only === "ALL" ? true
      : only === "TEAM" ? p.audience === "TEAM"
      : p.status === only);

  const count = (st) => polls.filter((p) => p.status === st).length;

  return (
    <>
      <IndexBand items={[
        { label: "POLLS", value: loading ? "—" : String(polls.length).padStart(2, "0") },
        { label: "OPEN", value: loading ? "—" : String(count("OPEN")).padStart(2, "0") },
        { label: "DRAFTS", value: loading ? "—" : String(count("DRAFT")).padStart(2, "0") },
        { label: "TEAM ONLY", value: loading ? "—" : String(polls.filter((p) => p.audience === "TEAM").length).padStart(2, "0") },
      ]} />

      <Panel title="THE POLLS" right={shown.length ? `${shown.length} SHOWN` : ""}>
        <p className="m-0 mb-4" style={{ ...fontText, fontSize: "15px", lineHeight: 1.55, color: theme.ink2 }}>
          A question with options, answered once per browser. Nobody outside
          sees a count until they have voted — a visible tally steers the vote,
          and a poll that steers its own vote measures itself. You see every
          number here from the moment the first one arrives.
        </p>

        <PollRules />

        <NewPoll onMade={load} />

        <div className="flex flex-wrap mb-4" style={{ gap: "5px" }}>
          {["ALL", "OPEN", "DRAFT", "CLOSED", "TEAM"].map((f) => (
            <Btn key={f} on={only === f} onClick={() => setOnly(f)}>
              {f === "TEAM" ? "TEAM ONLY" : f}
            </Btn>
          ))}
          <span className="flex-1" />
          <Btn onClick={load}>REFRESH</Btn>
        </div>

        <Note>{msg}</Note>

        {loading ? (
          <p className="m-0 py-6" style={{ ...fontText, fontSize: "16px", color: theme.ink2 }}>Reading…</p>
        ) : !shown.length ? (
          <p className="m-0 py-6" style={{ ...fontText, fontSize: "16px", color: theme.ink2 }}>
            {polls.length ? "Nothing matches that filter." : "No polls yet. Write one above."}
          </p>
        ) : (
          shown.map((p) => (
            <PollRow key={p.id} poll={p} onChange={change} onDelete={remove} />
          ))
        )}
      </Panel>
    </>
  );
}
