import React, { useEffect, useState } from "react";
import * as api from "../../lib/api";
import { fontText, fontUtility, inputStyle, theme } from "../../components/Shared";
import { Notice, Section, btn, ghost, sectionId } from "./parts";

/*
  ── SETTINGS ────────────────────────────────────────────────────────────────

  A hundred and three of them, in fourteen sections, and it was forty-seven
  kilobytes in the middle of a file people were trying to find a route in.
  Moved unchanged.
*/
const SETTING_SECTIONS = [
  "THE LOOK",
  "THE HOME PAGE",
  "THE DOOR",
  "THE STAFF DOOR",
  "MOVEMENT",
  "THE SONG POOL",
  "THE SITE",
  "THE CONTENT SECURITY POLICY",
  "THE GUEST LIST",
  "THE WAITING LIST",
  "PRESS KITS",
  "DEMOS",
  "BOOKINGS",
  "EMAIL",
];

function Maintenance({ parties }) {
  const [msg, setMsg] = useState("");
  const [tone, setTone] = useState("good");
  const [party, setParty] = useState(parties?.[0]?.id || "");
  const [count, setCount] = useState(1000);

  const run = async (action, phrase, extra = {}) => {
    if (phrase) {
      const typed = window.prompt(`This cannot be undone.\n\nType ${phrase} to continue.`);
      if (typed !== phrase) { setTone("bad"); setMsg("Not confirmed — nothing was changed."); return; }
    }
    const res = await api.maintenance(action, { confirm: phrase, ...extra });
    setTone(res.ok ? "good" : "bad");
    if (!res.ok) { setMsg(res.error || "That didn't work."); return; }
    if (res.added !== undefined) setMsg(`Added ${res.added} codes. ${res.unused} unused now.`);
    else if (res.removed !== undefined) setMsg(`Replaced ${res.removed} codes. ${res.unused} unused now.`);
    else setMsg(`Done — ${res.deleted} removed.`);
  };

  const row = (label, help, onClick, danger) => (
    <div className="py-3.5" style={{ borderBottom: `1px solid ${theme.rule}` }}>
      <div className="flex items-center gap-3">
        <span className="flex-1" style={{ ...fontText, fontSize: "16px", color: theme.ink }}>{label}</span>
        <button onClick={onClick}
                style={{ ...fontUtility, fontSize: "9px", letterSpacing: "0.16em",
                         color: danger ? theme.bad : theme.ink,
                         background: "transparent", border: `1px solid ${danger ? theme.badLine : theme.ink}`,
                         padding: "9px 14px", cursor: "pointer" }}>
          RUN
        </button>
      </div>
      <p className="m-0 mt-1" style={{ ...fontText, fontSize: "14px", lineHeight: 1.5, color: theme.ink2 }}>
        {help}
      </p>
    </div>
  );

  return (
    <>
      <Section title="CODES">
        <div className="flex items-center gap-3 pb-3">
          <input type="number" value={count} onChange={(e) => setCount(Number(e.target.value))}
                 style={{ ...inputStyle, width: "110px" }} />
          <button onClick={() => run("codes.add", null, { count })} style={btn}>ADD CODES</button>
        </div>
        {row("Delete unused codes",
             "Clears the pool of codes nobody holds yet. Used codes are never touched — a pass points at each one.",
             () => run("codes.purgeUnused", "DELETE UNUSED CODES"), true)}
        {row("Replace all unused codes",
             "Deletes the unused pool and generates a fresh one. Anyone already holding a pass is unaffected.",
             () => run("codes.regenerate", "REGENERATE ALL CODES"), true)}
      </Section>

      <Section title="A NIGHT'S DATA">
        <select value={party} onChange={(e) => setParty(e.target.value)}
                style={{ ...inputStyle, width: "100%", marginBottom: "10px" }}>
          {(parties || []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        {row("Clear the door record",
             "Wipes who was admitted and refused, leaving the passes themselves. Useful after a rehearsal.",
             () => run("scans.clearForParty", "CLEAR THE DOOR RECORD", { party }), true)}
        {row("Delete every pass for this event",
             "Removes the passes and the door record together. The codes stay used, so old links never point at someone new.",
             () => run("passes.deleteForParty", "DELETE ALL PASSES", { party }), true)}
        {row("Clear decided requests",
             "Removes approved and declined guest list requests. Anything still waiting is kept.",
             () => run("requests.clearDecided", "CLEAR DECIDED REQUESTS"), true)}
      </Section>

      <Notice message={msg} tone={tone} />
    </>
  );
}

export function Settings({ parties }) {
  const [values, setValues] = useState(null);
  const [defaults, setDefaults] = useState({});
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.fetchSettings().then((res) => {
      if (res.ok) { setValues(res.settings); setSaved0(res.settings); setDefaults(res.defaults || {}); }
      else setMsg(res.error || "Couldn't load the settings.");
    });
  }, []);

  const [savedAt, setSavedAt] = useState(null);   // which section last confirmed

  /*
    WHAT HAS BEEN CHANGED BUT NOT SAVED.

    Every save button writes the whole settings object, so pressing any of
    them saves everything — which is convenient and also the reason this is
    needed. With seventy-odd controls across ten sections it was possible to
    change three things in three places, save one of them, and have no way to
    tell whether the other two had gone with it. Now the count is on screen
    and the answer is always yes.
  */
  const [saved0, setSaved0] = useState(null);      // what the server last gave us
  const dirty = values && saved0
    ? Object.keys(values).filter((k) => String(values[k]) !== String(saved0[k]))
    : [];

  const save = async (which) => {
    setBusy(true);
    const res = await api.saveSettings(values);
    setBusy(false);
    setMsg(res.ok ? "Saved. Changes apply straight away." : (res.error || "Couldn't save."));
    if (res.ok) {
      setSaved0(values);
      setSavedAt(which);
      setTimeout(() => setSavedAt((w) => (w === which ? null : w)), 2600);
    }
  };
  // Handed to each Section so the button beside the controls you just changed
  // is the one that confirms.
  const saver = (which) => ({
    onSave: () => save(which),
    saving: busy,
    saved: savedAt === which,
  });

  if (!values) return <><Notice message={msg} /><Section title="SETTINGS"><p className="m-0" style={{ ...fontText, fontSize: "16px", color: theme.ink2 }}>Loading…</p></Section></>;

  const set = (k, v) => setValues((s) => ({ ...s, [k]: v }));

  /*
    A named choice, not a free field.

    Every one of these could have been a colour picker or a slider, and every
    one of them would then have been able to produce an unreadable site in two
    seconds. A system with no edges is not a system. Three papers that all work
    with the ink; three accents that all work on the paper.
  */
  const Choice = ({ k, label, help, options }) => (
    <div className="py-4" style={{ borderBottom: `1px solid ${theme.rule}` }}>
      <p className="m-0 mb-2.5" style={{ ...fontText, fontSize: "16px", color: theme.ink }}>{label}</p>
      <div className="flex flex-wrap" style={{ gap: "6px" }}>
        {options.map((o) => {
          const on = values[k] === o.value;
          return (
            <button key={o.value} onClick={() => set(k, o.value)}
                    style={{ ...fontUtility, fontSize: "9.5px", letterSpacing: "0.16em",
                             padding: "10px 14px", cursor: "pointer",
                             display: "flex", alignItems: "center", gap: "8px",
                             color: on ? theme.bg : theme.ink,
                             background: on ? theme.ink : "transparent",
                             border: `1px solid ${on ? theme.ink : theme.rule}` }}>
              {o.swatch && (
                <span style={{ width: "13px", height: "13px", background: o.swatch,
                               border: `1px solid ${on ? "rgba(237,228,208,0.5)" : theme.rule}`,
                               display: "block" }} />
              )}
              {o.label}
            </button>
          );
        })}
      </div>
      {help && (
        <p className="m-0 mt-2" style={{ ...fontText, fontSize: "14px", lineHeight: 1.5, color: theme.ink2 }}>
          {help}
        </p>
      )}
    </div>
  );

  const Switch = ({ k, label, help }) => (
    <label className="flex items-start gap-3 py-3.5" style={{ cursor: "pointer", borderBottom: `1px solid ${theme.rule}` }}>
      <input type="checkbox" checked={!!values[k]} style={{ marginTop: "4px" }}
             onChange={(e) => set(k, e.target.checked)} />
      <span>
        <span className="block" style={{ ...fontText, fontSize: "16px", color: theme.ink }}>{label}</span>
        {help && (
          <span className="block" style={{ ...fontText, fontSize: "14px", lineHeight: 1.5, color: theme.ink2 }}>{help}</span>
        )}
      </span>
    </label>
  );

  const Line = ({ k, label, help, placeholder }) => (
    <div className="py-4" style={{ borderBottom: `1px solid ${theme.rule}` }}>
      <p className="m-0 mb-2" style={{ ...fontText, fontSize: "16px", color: theme.ink }}>{label}</p>
      <input value={values[k] || ""} placeholder={placeholder}
             onChange={(e) => set(k, e.target.value)}
             style={{ ...inputStyle, width: "100%" }} />
      {help && (
        <p className="m-0 mt-1.5" style={{ ...fontText, fontSize: "14px", lineHeight: 1.5, color: theme.ink2 }}>{help}</p>
      )}
    </div>
  );

  const rows = [
    { key: "scanCooldown", label: "Scan cooldown", unit: "seconds",
      help: "How long the same pass is ignored after being read, so a camera left pointing at it doesn't report a refusal." },
    { key: "codeDrift", label: "Clock tolerance", unit: "windows",
      help: "How far a guest's clock may be out and still be accepted. Each window is 30 seconds." },
    { key: "sessionHours", label: "Session length", unit: "hours",
      help: "How long a team member stays signed in. A shift, not a fortnight." },
    { key: "loginMaxFails", label: "Failed logins allowed", unit: "attempts",
      help: "Wrong passwords from one address before a pause." },
    { key: "loginWindowMinutes", label: "Login pause window", unit: "minutes",
      help: "How long those failures are counted for." },
    { key: "poolLowWater", label: "Top up codes below", unit: "codes",
      help: "More codes are generated automatically when fewer than this remain." },
    { key: "capacityWarnAt", label: "Capacity warning at", unit: "%",
      help: "The door turns amber at this share of the room, so a full night is seen coming rather than hit blind." },
    { key: "reminderHoursBefore", label: "Reminder sent", unit: "hours before",
      help: "How far ahead guests get their pass again. Set to 0 to stop sending reminders." },
    { key: "maxPeoplePerRequest", label: "Most people per request", unit: "people",
      help: "The largest group someone may ask for on the public form." },
    { key: "idleSignOutMinutes", label: "Sign out after idle", unit: "minutes",
      help: "Ends a team session after this long doing nothing. 0 leaves sessions running for their full length." },
    { key: "autoCloseAfterMinutes", label: "Refuse entry after", unit: "min from open",
      help: "An earlier cut-off than the event's closing time, so late arrivals are refused by the system rather than by a judgement call. 0 means no cut-off." },
  ];

  return (
    <>
      <Notice message={msg} tone={msg.startsWith("Saved") ? "good" : "bad"} />

      {/*
        THE INDEX.

        Ten sections and seventy-odd controls is past the point where scrolling
        to find one is reasonable. These are the section names, in order, and
        they jump. It is the same INDEX register the public site uses for its
        metadata bands — a list of what exists and where it is.
      */}
      <nav aria-label="Settings sections" className="mt-6">
        <div className="flex items-baseline gap-3 mb-2">
          <span style={{ ...fontUtility, fontSize: "8.5px", letterSpacing: "0.22em", color: theme.brass }}>
            SETTINGS
          </span>
          <span className="flex-1" style={{ borderTop: `1px solid ${theme.rule}`, transform: "translateY(-3px)" }} />
          <span style={{ ...fontUtility, fontSize: "8.5px", letterSpacing: "0.14em",
                         color: theme.ink2, fontVariantNumeric: "tabular-nums" }}>
            {String(SETTING_SECTIONS.length).padStart(2, "0")}
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {SETTING_SECTIONS.map((title, i) => (
            <a key={title} href={`#${sectionId(title)}`}
               style={{ ...fontUtility, fontSize: "8.5px", letterSpacing: "0.14em",
                        color: theme.ink, textDecoration: "none",
                        border: `1px solid ${theme.rule}`, borderLeft: `3px solid ${theme.rule}`,
                        padding: "7px 9px", display: "inline-flex", gap: "7px" }}>
               <span style={{ color: theme.brass, fontVariantNumeric: "tabular-nums" }}>
                 {String(i + 1).padStart(2, "0")}
               </span>
               {title}
            </a>
          ))}
        </div>
      </nav>

      {/*
        A change that has not been saved is invisible otherwise, and every save
        button writes ALL of them — so this both warns and reassures: whatever
        you touched, in whatever section, one press takes the lot.
      */}
      {dirty.length > 0 && (
        <div className="flex flex-wrap items-center gap-4 mt-5 px-4 py-3"
             style={{ border: `1px solid ${theme.ink}`, borderLeft: `3px solid ${theme.brass}` }}>
          <span className="flex-1" style={{ ...fontText, fontSize: "16px", color: theme.ink }}>
            {dirty.length} change{dirty.length === 1 ? "" : "s"} not saved yet.
            <span style={{ color: theme.ink2 }}> Any save button below saves all of them.</span>
          </span>
          <button onClick={() => save("EVERYTHING")} disabled={busy}
                  style={{ ...btn, opacity: busy ? 0.6 : 1 }}>
            {busy ? "SAVING…" : "SAVE EVERYTHING"}
          </button>
          <button onClick={() => setValues(saved0)} disabled={busy}
                  style={{ ...ghost, opacity: busy ? 0.6 : 1 }}>
            UNDO
          </button>
        </div>
      )}

      <Section title="THE LOOK" {...saver("THE LOOK")}>
        <p className="m-0 mb-4" style={{ ...fontText, fontSize: "15px", lineHeight: 1.55, color: theme.ink2 }}>
          These change the site itself. Everything here saves and applies at
          once — open the site in another tab and reload to see it.
        </p>

        <Choice k="paperTone" label="Paper"
                help="The stock everything is printed on. Board is the darkest and the most physical; bone is the coolest."
                options={[
                  /* Literals, deliberately. A swatch has to show the colour
                     it names — reading these from the theme made all three
                     preview whatever the site is currently set to. */
                  { value: "BOARD", label: "BOARD", swatch: "#EDE4D0" },
                  { value: "IVORY", label: "IVORY", swatch: "#F3EBD9" },
                  { value: "BONE",  label: "BONE",  swatch: "#E6DFD2" },
                ]} />

        <Choice k="accentTone" label="Accent"
                help="The one colour that is not ink or paper — drop caps, numbers, kickers, the italic in a headline."
                options={[
                  { value: "OXBLOOD", label: "OXBLOOD", swatch: "#6E2118" },
                  { value: "BRASS",   label: "BRASS",   swatch: "#8A6A28" },
                  { value: "INK",     label: "NONE",    swatch: "#14120E" },
                ]} />

        <Choice k="grainStrength" label="Paper grain"
                help="The fibre in the stock. Heavy reads as board and card; none reads as a screen."
                options={[
                  { value: "NONE",   label: "NONE" },
                  { value: "LIGHT",  label: "LIGHT" },
                  { value: "NORMAL", label: "NORMAL" },
                  { value: "HEAVY",  label: "HEAVY" },
                ]} />

        <Switch k="photoHalftone" label="Print photographs through a dot screen"
                help="What makes a picture read as ink rather than as a photograph on a screen. Off gives clean, modern photography." />
        <Switch k="photoDuotone" label="Warm duotone on the full-bleed photographs"
                help="Ties every picture to the same shoot. Off leaves them close to their original colour." />
      </Section>

      <Section title="THE HOME PAGE" {...saver("THE HOME PAGE")}>
        <Choice k="heroImage" label="The opening photograph"
                options={[
                  { value: "club",     label: "THE ROOM" },
                  { value: "booth",    label: "THE BOOTH" },
                  { value: "portrait", label: "PORTRAIT" },
                ]} />

        <div className="flex items-center gap-3 py-4" style={{ borderBottom: `1px solid ${theme.rule}` }}>
          <span className="flex-1" style={{ ...fontText, fontSize: "16px", color: theme.ink }}>
            How tall it opens
          </span>
          <input type="number" value={values.heroHeightVw}
                 onChange={(e) => set("heroHeightVw", Number(e.target.value))}
                 style={{ ...inputStyle, width: "90px", textAlign: "right" }} />
          <span style={{ ...fontUtility, fontSize: "8.5px", letterSpacing: "0.14em", color: theme.ink2, width: "62px" }}>
            % of width
          </span>
        </div>

        <Switch k="showContactSheet" label="Show the contact sheet"
                help="The numbered strip of photographs under the story." />

        <Line k="storyHeadline" label="The big headline" placeholder="Leave empty for the built-in line"
              help="The line set large under THE STORY. Empty keeps the one that is written in." />
        <Line k="closingLine" label="The closing line" placeholder="Leave empty for the built-in line"
              help="Set in italic over the last photograph on the page." />
        <Line k="footerNote" label="A note in the footer" placeholder="Optional"
              help="One or two sentences at the bottom of every page. Empty shows nothing." />
      </Section>

      <Section title="THE DOOR" {...saver("THE DOOR")}>
        <Choice k="capacityFullAction" label="When the room is full"
                help="Capacity was watched and warned about, and nothing decided what to do at a hundred percent — which meant it was decided at the door, by whoever was holding the phone, differently each time."
                options={[
                  { value: "WARN",   label: "ADMIT AND SAY SO" },
                  { value: "REFUSE", label: "REFUSE" },
                  { value: "IGNORE", label: "JUST COUNT" },
                ]} />
        {rows.map((r) => (
          <div key={r.key} className="py-3.5" style={{ borderBottom: `1px solid ${theme.rule}` }}>
            <div className="flex items-center gap-3">
              <span className="flex-1" style={{ ...fontText, fontSize: "16px", color: theme.ink }}>
                {r.label}
              </span>
              <input
                type="number"
                value={values[r.key]}
                onChange={(e) => set(r.key, Number(e.target.value))}
                style={{ ...inputStyle, width: "90px", textAlign: "right" }}
              />
              <span style={{ ...fontUtility, fontSize: "8.5px", letterSpacing: "0.14em", color: theme.ink2, width: "62px" }}>
                {r.unit}
              </span>
            </div>
            <p className="m-0 mt-1" style={{ ...fontText, fontSize: "14px", lineHeight: 1.5, color: theme.ink2 }}>
              {r.help}
              {defaults[r.key] !== undefined && ` Default: ${defaults[r.key]}.`}
            </p>
          </div>
        ))}
      </Section>

      <Section title="THE STAFF DOOR" {...saver("THE STAFF DOOR")}>
        <p className="m-0 mb-4" style={{ ...fontText, fontSize: "15px", lineHeight: 1.55, color: theme.ink2 }}>
          Press and hold the logo in the masthead and this login opens. Nothing
          on the public site says so — it replaced a visible link that guests
          could find and that vanished whenever you happened to be holding a
          ticket yourself.
        </p>
        <p className="m-0 mb-4 px-3 py-2.5" style={{ ...fontText, fontSize: "15px",
           lineHeight: 1.5, color: theme.ink, border: `1px solid ${theme.rule}`, background: theme.sunk }}>
          None of this can lock you out. <strong>/admins-staff-boss</strong> is
          a real address and always works, typed straight into a browser,
          whatever is set here. Worth a bookmark.
        </p>

        <Switch k="staffDoorHold" label="Press and hold the logo to sign in"
                help="Off, the shortcut goes away and only the address above works." />

        <div className="py-3.5" style={{ borderBottom: `1px solid ${theme.rule}` }}>
          <div className="flex items-center gap-3">
            <span className="flex-1" style={{ ...fontText, fontSize: "16px", color: theme.ink }}>
              How long to hold
            </span>
            <input type="number" min="300" max="3000" step="50"
                   value={values.staffDoorHoldMs}
                   onChange={(e) => set("staffDoorHoldMs", Number(e.target.value))}
                   style={{ ...inputStyle, width: "90px", textAlign: "right" }} />
            <span style={{ ...fontUtility, fontSize: "8.5px", letterSpacing: "0.14em",
                           color: theme.ink2, width: "40px" }}>ms</span>
          </div>
          <p className="m-0 mt-1.5" style={{ ...fontText, fontSize: "14px", lineHeight: 1.5, color: theme.ink2 }}>
            Below about 500 an ordinary slow tap starts opening it by accident;
            above about 1500 it feels broken while you wait. Default: 900.
          </p>
        </div>

        <Switch k="staffDoorBuzz" label="Buzz when it opens"
                help="A short vibration. On a control with nothing to look at it is the only confirmation there is — though not every phone obliges." />
      </Section>

      <Section title="MOVEMENT" {...saver("MOVEMENT")}>
        <p className="m-0 mb-4" style={{ ...fontText, fontSize: "15px", lineHeight: 1.55, color: theme.ink2 }}>
          How much the site moves. Separate switches rather than one blunt
          control, because these are different kinds of movement and you may
          want one without the others.
        </p>
        <p className="m-0 mb-4" style={{ ...fontText, fontSize: "14.5px", lineHeight: 1.5, color: theme.ink2 }}>
          Anyone whose phone or laptop asks for reduced motion gets none of it
          regardless of what is set here. That setting is theirs, not yours,
          and it wins.
        </p>

        <Switch k="motionReveals" label="Sections arrive as you reach them"
                help="Each part of a page rises into place as it comes into view, instead of the whole page being there at once." />
        <Switch k="motionDevelop" label="Photographs develop"
                help="A picture comes up flat and overexposed and resolves into full tone, the way a print does in a tray. Off, photographs simply appear." />
        <Switch k="motionRoll" label="The countdown's digits roll"
                help="The numbers turn over like a clock rather than snapping from one to the next." />
        <Switch k="motionLogoInk" label="The mark inks itself on"
                help="On the home page, the first time somebody arrives in a session, the logo is pressed onto the photograph. Once per visit, never again." />
        <Switch k="showFolio" label="Running head in the margin"
                help="Section name and how far down the page you are, set vertically in the left margin on wide screens. Hidden on phones, where there is no margin to put it in." />
      </Section>

      <Section title="THE SONG POOL" {...saver("THE SONG POOL")}>
        <p className="m-0 mb-4" style={{ ...fontText, fontSize: "15px", lineHeight: 1.55, color: theme.ink2 }}>
          Every rule the pool runs on. All of it is enforced on the server, so
          switching something off here actually stops it — it does not merely
          hide the form from people who would use it anyway.
        </p>

        <Switch k="poolOpen" label="The pool is open"
                help="The master switch. Off, the page stays up and explains itself rather than 404-ing — a link that has already gone out should never land on nothing. Everything already in the pool is kept." />

        <Choice k="poolEventMode" label="The night's pool is"
                help="ADD is a suggestion box — anybody puts songs in, and the list is whatever the room brought. VOTE is a ballot — only the team puts options on it and everybody else picks between them. Use VOTE for “which of these five closes the night”."
                options={[
                  { value: "ADD",  label: "OPEN — ANYONE ADDS" },
                  { value: "VOTE", label: "A VOTE" },
                ]} />

        <Choice k="poolHouseMode" label="The house list is"
                help="Usually left open: the house list is a standing record of what the room likes, which only works if the room can write to it."
                options={[
                  { value: "ADD",  label: "OPEN — ANYONE ADDS" },
                  { value: "VOTE", label: "A VOTE" },
                ]} />

        <div className="py-3.5" style={{ borderBottom: `1px solid ${theme.rule}` }}>
          <div className="flex items-center gap-3">
            <span className="flex-1" style={{ ...fontText, fontSize: "16px", color: theme.ink }}>
              Picks each person gets
            </span>
            <input type="number" min="0" value={values.poolVotesPerPerson}
                   onChange={(e) => set("poolVotesPerPerson", Number(e.target.value))}
                   style={{ ...inputStyle, width: "90px", textAlign: "right" }} />
            <span style={{ ...fontUtility, fontSize: "8.5px", letterSpacing: "0.14em",
                           color: theme.ink2, width: "40px" }}>picks</span>
          </div>
          <p className="m-0 mt-1.5" style={{ ...fontText, fontSize: "14px", lineHeight: 1.5, color: theme.ink2 }}>
            1 makes it a straight choice. More makes it an approval vote, which
            is friendlier and gives a more useful ranking — people are rarely
            certain about exactly one. 0 means unlimited. Only applies to a pool
            set to VOTE. Default: 3.
          </p>
        </div>

        <Switch k="poolShowVotes" label="Show the tallies while voting is open"
                help="Off, people see that they have picked but not how anyone else is doing — which is how you stop an early lead snowballing. You always see the counts." />

        <Switch k="poolEventOpen" label="Songs for a specific night"
                help="The pool tied to an event. This is the one to close when a set starts." />

        <Switch k="poolHouseOpen" label="The house list"
                help="The standing list, not tied to any date. Usually left open — it is the real record of what the room likes." />

        <div className="mt-7 mb-1 flex items-baseline gap-3">
          <span style={{ ...fontUtility, fontSize: "8.5px", letterSpacing: "0.2em", color: theme.brass }}>
            WHO MAY ADD
          </span>
          <span className="flex-1" style={{ borderTop: `1px solid ${theme.rule}`, transform: "translateY(-3px)" }} />
        </div>

        <Switch k="poolNeedPass" label="Ticket holders only"
                help="Somebody must have opened their pass on that phone before they can add anything. The team is exempt — nobody in the booth is going to look up their own code first." />

        <Switch k="poolRequireName" label="A name is required"
                help="Off, the name is optional. Bear in mind that every field you insist on is a person who does not bother — the link alone is what makes this work at two in the morning." />

        {[
          { key: "poolPerHour", label: "Songs per person, per hour", unit: "songs",
            help: "The burst limit. One person with a playlist can fill a pool in a minute, and then it is their pool. 0 turns it off entirely." },
          { key: "poolMaxPerPerson", label: "Songs per person, in total", unit: "songs",
            help: "Counted per pool, so somebody gets this many for the night AND this many on the house list. 0 means no total cap." },
        ].map((r) => (
          <div key={r.key} className="py-3.5" style={{ borderBottom: `1px solid ${theme.rule}` }}>
            <div className="flex items-center gap-3">
              <span className="flex-1" style={{ ...fontText, fontSize: "16px", color: theme.ink }}>
                {r.label}
              </span>
              <input type="number" min="0" value={values[r.key]}
                     onChange={(e) => set(r.key, Number(e.target.value))}
                     style={{ ...inputStyle, width: "90px", textAlign: "right" }} />
              <span style={{ ...fontUtility, fontSize: "8.5px", letterSpacing: "0.14em",
                             color: theme.ink2, width: "40px" }}>
                {r.unit}
              </span>
            </div>
            <p className="m-0 mt-1.5" style={{ ...fontText, fontSize: "14px", lineHeight: 1.5, color: theme.ink2 }}>
              {r.help}
              {defaults[r.key] !== undefined && ` Default: ${defaults[r.key]}.`}
            </p>
          </div>
        ))}

        <Switch k="poolAllowDuplicates" label="The same song may go in twice"
                help="Off, a repeat is answered with “that one's already in — good taste” and nothing is added. On, it goes in again, which turns the list into a rough vote." />

        <div className="mt-7 mb-1 flex items-baseline gap-3">
          <span style={{ ...fontUtility, fontSize: "8.5px", letterSpacing: "0.2em", color: theme.brass }}>
            WHAT THE PUBLIC SEES
          </span>
          <span className="flex-1" style={{ borderTop: `1px solid ${theme.rule}`, transform: "translateY(-3px)" }} />
        </div>

        <Switch k="poolShowList" label="Show the list"
                help="Off, people can still add a song but cannot read what anyone else put in — a suggestion box rather than a noticeboard. You always see all of it." />

        <Switch k="poolShowNames" label="Show who asked"
                help="Off, the songs are there and the names are not. The names are removed before they leave the server, not merely hidden by the page." />

        <Switch k="poolShowPlayed" label="Show what has been played"
                help="Off, nobody outside the team can tell which requests made it into a set. Worth switching off if you would rather not answer for the ones that did not." />

        <div className="mt-7 mb-1 flex items-baseline gap-3">
          <span style={{ ...fontUtility, fontSize: "8.5px", letterSpacing: "0.2em", color: theme.brass }}>
            THE WORDS
          </span>
          <span className="flex-1" style={{ borderTop: `1px solid ${theme.rule}`, transform: "translateY(-3px)" }} />
        </div>

        <Line k="poolHeadline" label="Headline" placeholder="The Pool"
              help="Leave empty for “The Pool”." />
        <Line k="poolSub" label="Under the headline" placeholder="PASTE A LINK — WE'LL FIND THE NAME"
              help="Set in small tracked capitals, so keep it short." />
        <Line k="poolNote" label="A line under the form" placeholder="e.g. No hard techno before midnight."
              help="Where to say what you will and will not play. Empty means nothing is shown." />
        <Line k="poolClosedMessage" label="When the pool is closed"
              placeholder="The pool is closed right now."
              help="Shown in place of the form when the master switch above is off." />
      </Section>

      {/*
        THE FLOATING BAR HAS ITS OWN DESK.

        Its controls used to be a subsection here, which was the wrong shape
        for them twice over: two of the numbers that mattered most were not
        settings at all but constants in the stylesheet, and the ones that
        were settings could only be judged by saving, leaving, and looking at
        the bar. It is the one part of the site you cannot choose in the
        abstract, so it now has a screen with the real material on it.
      */}
      <Section title="THE SITE" {...saver("THE SITE")}>
        <div className="py-3">
          <p className="m-0 mb-2" style={{ ...fontText, fontSize: "16px", color: theme.ink }}>
            Banner across every page
          </p>
          <input value={values.announcement} placeholder="Leave empty for no banner"
                 onChange={(e) => set("announcement", e.target.value)}
                 style={{ ...inputStyle, width: "100%" }} />
          <input value={values.announcementLink} placeholder="Link (optional)"
                 onChange={(e) => set("announcementLink", e.target.value)}
                 style={{ ...inputStyle, width: "100%", marginTop: "8px" }} />
          <p className="m-0 mt-1" style={{ ...fontText, fontSize: "14px", lineHeight: 1.5, color: theme.ink2 }}>
            One line at the top of the site. Useful for a last-minute change of
            venue or a sold-out notice.
          </p>
        </div>

        <label className="flex items-start gap-3 py-3" style={{ cursor: "pointer" }}>
          <input type="checkbox" checked={!!values.showCountdown} style={{ marginTop: "4px" }}
                 onChange={(e) => set("showCountdown", e.target.checked)} />
          <span>
            <span className="block" style={{ ...fontText, fontSize: "16px", color: theme.ink }}>
              Show the countdown on the home page
            </span>
          </span>
        </label>

        {values.showCountdown && (
          <div className="py-3">
            <p className="m-0 mb-2" style={{ ...fontText, fontSize: "16px", color: theme.ink }}>
              Counting down to
            </p>
            <input value={values.countdownTarget}
                   onChange={(e) => set("countdownTarget", e.target.value)}
                   style={{ ...inputStyle, width: "100%" }} />
            <input value={values.countdownLabel} placeholder="Label above it"
                   onChange={(e) => set("countdownLabel", e.target.value)}
                   style={{ ...inputStyle, width: "100%", marginTop: "8px" }} />
            <p className="m-0 mt-1" style={{ ...fontText, fontSize: "14px", lineHeight: 1.5, color: theme.ink2 }}>
              The moment must carry a timezone, like 2026-12-13T00:00:00+02:00,
              or visitors in other countries reach zero at the wrong time.
            </p>
          </div>
        )}

        <div className="py-3">
          <p className="m-0 mb-2" style={{ ...fontText, fontSize: "16px", color: theme.ink }}>
            Note under the roster
          </p>
          <input value={values.rosterNote} onChange={(e) => set("rosterNote", e.target.value)}
                 style={{ ...inputStyle, width: "100%" }} />
        </div>

        <div className="py-3">
          <p className="m-0 mb-2" style={{ ...fontText, fontSize: "16px", color: theme.ink }}>
            Note under the events list
          </p>
          <input value={values.eventsNote} onChange={(e) => set("eventsNote", e.target.value)}
                 style={{ ...inputStyle, width: "100%" }} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 py-3">
          <div>
            <p className="m-0 mb-2" style={{ ...fontText, fontSize: "16px", color: theme.ink }}>Contact email</p>
            <input value={values.contactEmail} onChange={(e) => set("contactEmail", e.target.value)}
                   style={{ ...inputStyle, width: "100%" }} />
          </div>
          <div>
            <p className="m-0 mb-2" style={{ ...fontText, fontSize: "16px", color: theme.ink }}>Booking email</p>
            <input value={values.bookingEmail} onChange={(e) => set("bookingEmail", e.target.value)}
                   style={{ ...inputStyle, width: "100%" }} />
          </div>
        </div>

        <label className="flex items-start gap-3 py-3" style={{ cursor: "pointer" }}>
          <input type="checkbox" checked={!!values.guestListLinkVisible} style={{ marginTop: "4px" }}
                 onChange={(e) => set("guestListLinkVisible", e.target.checked)} />
          <span style={{ ...fontText, fontSize: "16px", color: theme.ink }}>
            Show the guest list link publicly
          </span>
        </label>
      </Section>

      <Section title="ISSUING PASSES">
        <div className="grid grid-cols-2 gap-3 py-3">
          <div>
            <p className="m-0 mb-2" style={{ ...fontText, fontSize: "16px", color: theme.ink }}>Default kind</p>
            <select value={values.defaultKind} onChange={(e) => set("defaultKind", e.target.value)}
                    style={{ ...inputStyle, width: "100%" }}>
              {["TICKET","COUPLE","FAMILY","INVITATION","GUEST","PRESS","ARTIST","STAFF"].map((k) =>
                <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
          <div>
            <p className="m-0 mb-2" style={{ ...fontText, fontSize: "16px", color: theme.ink }}>Default tier</p>
            <select value={values.defaultTier} onChange={(e) => set("defaultTier", e.target.value)}
                    style={{ ...inputStyle, width: "100%" }}>
              {["", "EARLY", "STANDARD", "VIP"].map((k) =>
                <option key={k} value={k}>{k || "— none —"}</option>)}
            </select>
          </div>
        </div>

        <label className="flex items-start gap-3 py-3" style={{ cursor: "pointer" }}>
          <input type="checkbox" checked={!!values.emailPassOnIssue} style={{ marginTop: "4px" }}
                 onChange={(e) => set("emailPassOnIssue", e.target.checked)} />
          <span>
            <span className="block" style={{ ...fontText, fontSize: "16px", color: theme.ink }}>
              Email the pass as soon as it is issued
            </span>
            <span className="block" style={{ ...fontText, fontSize: "14px", lineHeight: 1.5, color: theme.ink2 }}>
              Turn off if you would rather send links yourself.
            </span>
          </span>
        </label>

        <label className="flex items-start gap-3 py-3" style={{ cursor: "pointer" }}>
          <input type="checkbox" checked={!!values.warnOnDuplicate} style={{ marginTop: "4px" }}
                 onChange={(e) => set("warnOnDuplicate", e.target.checked)} />
          <span style={{ ...fontText, fontSize: "16px", color: theme.ink }}>
            Warn before issuing a second pass to the same person
          </span>
        </label>
      </Section>

      <Section title="THE GUEST LIST" {...saver("THE GUEST LIST")}>
        <div className="py-3">
          <p className="m-0 mb-2" style={{ ...fontText, fontSize: "16px", color: theme.ink }}>
            What someone sees after asking
          </p>
          <textarea rows={2} value={values.requestThanksMessage}
                    onChange={(e) => set("requestThanksMessage", e.target.value)}
                    style={{ ...inputStyle, width: "100%", resize: "vertical", lineHeight: 1.5 }} />
        </div>
      </Section>

      <Section title="THE WAITING LIST" {...saver("THE WAITING LIST")}>
        <Switch k="waitlistOpen" label="Queue people when a night is full"
                help="A request that arrives at a full night joins a queue in the order it came, instead of being turned away for good. Offering a place is always a decision you make — nothing issues itself." />
        <div className="py-3">
          <p className="m-0 mb-2" style={{ ...fontText, fontSize: "16px", color: theme.ink }}>
            What someone sees when they land on the queue
          </p>
          <textarea rows={2} value={values.waitlistMessage}
                    onChange={(e) => set("waitlistMessage", e.target.value)}
                    style={{ ...inputStyle, width: "100%", resize: "vertical", lineHeight: 1.5 }} />
          <p className="m-0 mt-2" style={{ ...fontText, fontSize: "14px", lineHeight: 1.5, color: theme.ink2 }}>
            Their position is shown underneath this, in figures. A number is
            something to wait for; "full" is a door closing.
          </p>
        </div>
      </Section>

      <Section title="PRESS KITS" {...saver("PRESS KITS")}>
        <Switch k="kitZip" label="Let a promoter take everything in one download"
                help="A ZIP with the photographs at full size, the logos, the rider and the biographies. This is the single most requested thing from any press kit, and the reason people ask for a Dropbox folder instead of using the link you sent." />
        <Switch k="kitOnesheet" label="Offer a printable one-sheet"
                help="One page built from the kit — the main photograph, the short biography, selected dates and the contact. Because it is generated it can never disagree with the kit." />
        <Switch k="kitWatermark" label="Mark the photographs on the page"
                help="A faint mark on what is shown, never on what is downloaded. It makes a screenshot obviously a screenshot without handing a promoter a watermarked file they cannot use — which would be worse than no watermark at all." />
        <div className="py-3">
          <p className="m-0 mb-2" style={{ ...fontText, fontSize: "16px", color: theme.ink }}>
            What the mark says
          </p>
          <input value={values.kitWatermarkText}
                 onChange={(e) => set("kitWatermarkText", e.target.value)}
                 style={{ ...inputStyle, width: "100%" }} />
        </div>

        <Choice k="kitLinkDays" label="How long a new kit link lasts"
                help="Nothing here is retrospective — links you have already made keep whatever they were given. A kit link that never expires is the right default: it lives in a promoter's inbox for a year, and it is killed on purpose rather than by surprise."
                options={[
                  { value: 0, label: "UNTIL REVOKED" },
                  { value: 30, label: "30 DAYS" },
                  { value: 90, label: "90 DAYS" },
                  { value: 365, label: "A YEAR" },
                ]} />

        <div className="py-3">
          <p className="m-0 mb-2" style={{ ...fontText, fontSize: "16px", color: theme.ink }}>
            The line at the foot of every kit
          </p>
          <input value={values.kitFooterNote}
                 onChange={(e) => set("kitFooterNote", e.target.value)}
                 style={{ ...inputStyle, width: "100%" }} />
        </div>
        <div className="py-3">
          <p className="m-0 mb-2" style={{ ...fontText, fontSize: "16px", color: theme.ink }}>
            Who to write to when an artist has nobody set
          </p>
          <input value={values.kitContactFallback}
                 onChange={(e) => set("kitContactFallback", e.target.value)}
                 placeholder="bookings@hiddenstategroup.com"
                 style={{ ...inputStyle, width: "100%" }} />
          <p className="m-0 mt-2" style={{ ...fontText, fontSize: "14px", lineHeight: 1.5, color: theme.ink2 }}>
            So a promoter is never left with a kit and no way to reach anybody.
          </p>
        </div>
      </Section>

      <Section title="DEMOS" {...saver("DEMOS")}>
        <Switch k="demosOpen" label="Accept demos"
                help="Turned off, the form is hidden and anything sent to it is refused by the server — not just by the page." />
        <div className="py-3">
          <p className="m-0 mb-2" style={{ ...fontText, fontSize: "16px", color: theme.ink }}>
            What the form says above itself
          </p>
          <textarea rows={2} value={values.demosNote}
                    onChange={(e) => set("demosNote", e.target.value)}
                    style={{ ...inputStyle, width: "100%", resize: "vertical", lineHeight: 1.5 }} />
        </div>
        <div className="py-3">
          <p className="m-0 mb-2" style={{ ...fontText, fontSize: "16px", color: theme.ink }}>
            What it says when demos are closed
          </p>
          <textarea rows={2} value={values.demosClosedMessage}
                    onChange={(e) => set("demosClosedMessage", e.target.value)}
                    style={{ ...inputStyle, width: "100%", resize: "vertical", lineHeight: 1.5 }} />
        </div>
      </Section>

      <Section title="BOOKINGS" {...saver("BOOKINGS")}>
        <Switch k="bookingsOpen" label="Accept booking enquiries"
                help="Every enquiry is emailed to the address in EMAIL as it arrives, so a date does not sit unseen for a week." />
        <div className="py-3">
          <p className="m-0 mb-2" style={{ ...fontText, fontSize: "16px", color: theme.ink }}>
            What the booking form says above itself
          </p>
          <textarea rows={2} value={values.bookingsNote}
                    onChange={(e) => set("bookingsNote", e.target.value)}
                    style={{ ...inputStyle, width: "100%", resize: "vertical", lineHeight: 1.5 }} />
        </div>
      </Section>

      <Section title="EMAIL" {...saver("EMAIL")}>
        <div className="py-3">
          <p className="m-0 mb-2" style={{ ...fontText, fontSize: "16px", color: theme.ink }}>
            Sign-off at the foot of every email
          </p>
          <input value={values.emailSignoff} onChange={(e) => set("emailSignoff", e.target.value)}
                 style={{ ...inputStyle, width: "100%" }} />
        </div>
      </Section>

      <Section title="THE CONTENT SECURITY POLICY" {...saver("THE CONTENT SECURITY POLICY")}>
        <p className="m-0 mb-3" style={{ ...fontText, fontSize: "15px", lineHeight: 1.55, color: theme.ink2 }}>
          The policy names exactly where the site may load things from — its own
          scripts and styles, Google&rsquo;s fonts, images from anywhere, and
          players from precisely four hosts. It is the layer that limits the
          damage of a mistake nobody has made yet.
        </p>

        <label className="flex items-start gap-3 py-3" style={{ cursor: "pointer" }}>
          <input type="checkbox" checked={!!values.cspEnforce} style={{ marginTop: "4px" }}
                 onChange={(e) => set("cspEnforce", e.target.checked)} />
          <span>
            <span className="block" style={{ ...fontText, fontSize: "16px", color: theme.ink }}>
              Block, rather than only report
            </span>
            <span className="block mt-1" style={{ ...fontText, fontSize: "14px", lineHeight: 1.5, color: theme.ink2 }}>
              Off, anything the policy disagrees with is filed in FAULTS and
              still loads. On, it stops loading. Leave this off until FAULTS has
              been quiet for a week &mdash; a policy that turns out to be wrong
              does not degrade gracefully, it blanks the site, and you would
              hear about it from a person rather than from a log.
            </span>
          </span>
        </label>
      </Section>

      <Section title="TAKING THE SITE DOWN">
        <label className="flex items-start gap-3 py-3" style={{ cursor: "pointer" }}>
          <input type="checkbox" checked={!!values.siteClosed} style={{ marginTop: "4px" }}
                 onChange={(e) => set("siteClosed", e.target.checked)} />
          <span>
            <span className="block" style={{ ...fontText, fontSize: "16px", color: theme.bad }}>
              Close the site to visitors
            </span>
            <span className="block" style={{ ...fontText, fontSize: "14px", lineHeight: 1.5, color: theme.ink2 }}>
              Shows a holding message instead of the site. The door tools and
              guests' passes keep working, so this can be used mid-night
              without stranding anyone.
            </span>
          </span>
        </label>
        {values.siteClosed && (
          <input value={values.siteClosedMessage}
                 onChange={(e) => set("siteClosedMessage", e.target.value)}
                 style={{ ...inputStyle, width: "100%" }} />
        )}
      </Section>

      <Section title="ACCESS">
        <label className="flex items-start gap-3 py-3" style={{ cursor: "pointer" }}>
          <input type="checkbox" checked={!!values.staffSeeDoorList} style={{ marginTop: "4px" }}
                 onChange={(e) => set("staffSeeDoorList", e.target.checked)} />
          <span>
            <span className="block" style={{ ...fontText, fontSize: "16px", color: theme.ink }}>
              Door staff can see the full door list
            </span>
            <span className="block" style={{ ...fontText, fontSize: "14px", lineHeight: 1.5, color: theme.ink2 }}>
              Useful when one person works the door alone. Turn it off and they
              can scan but not browse who is coming.
            </span>
          </span>
        </label>

        <label className="flex items-start gap-3 py-3" style={{ cursor: "pointer" }}>
          <input type="checkbox" checked={!!values.managementCanIssue} style={{ marginTop: "4px" }}
                 onChange={(e) => set("managementCanIssue", e.target.checked)} />
          <span>
            <span className="block" style={{ ...fontText, fontSize: "16px", color: theme.ink }}>
              Management can issue and cancel passes
            </span>
            <span className="block" style={{ ...fontText, fontSize: "14px", lineHeight: 1.5, color: theme.ink2 }}>
              Off by default, so only you can create or cancel a pass. Turn it
              on when you need someone else able to.
            </span>
          </span>
        </label>

        <label className="flex items-start gap-3 py-3" style={{ cursor: "pointer" }}>
          <input type="checkbox" checked={!!values.staffSeeContacts} style={{ marginTop: "4px" }}
                 onChange={(e) => set("staffSeeContacts", e.target.checked)} />
          <span>
            <span className="block" style={{ ...fontText, fontSize: "16px", color: theme.ink }}>
              Door staff can see guests' email and phone
            </span>
            <span className="block" style={{ ...fontText, fontSize: "14px", lineHeight: 1.5, color: theme.ink2 }}>
              Off by default. A door phone gets borrowed, and contact details
              are the part worth protecting.
            </span>
          </span>
        </label>

        <label className="flex items-start gap-3 py-3" style={{ cursor: "pointer" }}>
          <input type="checkbox" checked={!!values.guestListOpen} style={{ marginTop: "4px" }}
                 onChange={(e) => set("guestListOpen", e.target.checked)} />
          <span>
            <span className="block" style={{ ...fontText, fontSize: "16px", color: theme.ink }}>
              The guest list form is open
            </span>
            <span className="block" style={{ ...fontText, fontSize: "14px", lineHeight: 1.5, color: theme.ink2 }}>
              Turn it off between events and the public form stops accepting
              requests, rather than collecting ones nobody will read.
            </span>
          </span>
        </label>

        <label className="flex items-start gap-3 py-3" style={{ cursor: "pointer" }}>
          <input type="checkbox" checked={!!values.idOnEveryPass} style={{ marginTop: "4px" }}
                 onChange={(e) => set("idOnEveryPass", e.target.checked)} />
          <span>
            <span className="block" style={{ ...fontText, fontSize: "16px", color: theme.ink }}>
              Ask for ID on every pass
            </span>
            <span className="block" style={{ ...fontText, fontSize: "14px", lineHeight: 1.5, color: theme.ink2 }}>
              Normally only sold tickets prompt for ID. This makes the door ask
              for every pass, including guest list and press.
            </span>
          </span>
        </label>

        <div className="py-3">
          <p className="m-0 mb-2" style={{ ...fontText, fontSize: "16px", color: theme.ink }}>
            Copy new accounts to
          </p>
          <input value={values.accountCopyTo}
                 onChange={(e) => set("accountCopyTo", e.target.value)}
                 style={{ ...inputStyle, width: "100%" }} />
          <p className="m-0 mt-1" style={{ ...fontText, fontSize: "14px", lineHeight: 1.5, color: theme.ink2 }}>
            Every new account's details are blind-copied here, so there is
            always a second record of who was given access.
          </p>
        </div>
      </Section>

      <button onClick={() => save("FOOT")} disabled={busy} style={{ ...btn, marginTop: "8px", opacity: busy ? 0.6 : 1 }}>
        {busy ? "SAVING…" : "SAVE SETTINGS"}
      </button>

      <Maintenance parties={parties} />
    </>
  );
}
