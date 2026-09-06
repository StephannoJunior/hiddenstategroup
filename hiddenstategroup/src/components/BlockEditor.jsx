import React, { useState } from "react";
import { BLOCKS, BLOCK_TYPES } from "./Blocks";
import { fontUtility, fontText, theme, inputStyle } from "./Shared";

/*
  ══ ARRANGING BLOCKS ════════════════════════════════════════════════════════

  The list of blocks, and the controls to add, reorder, edit and remove them.

  ── WHY THE ORDER IS BUTTONS AND NOT DRAG-AND-DROP ────────────────────────

  Dragging looks better in a demonstration. It is also, on a phone, a gesture
  that fights the page's own scrolling — which is where the person actually
  building a page for a night is standing, and the failure mode is that they
  drag a block and the page scrolls away underneath it. Up and down move one
  place per press, work with a thumb, work with a keyboard, and cannot be
  half-completed. If this ever grows dragging it should be IN ADDITION to
  these, never instead of them.

  ── AND WHY EVERY BLOCK IS COLLAPSED UNTIL YOU OPEN IT ────────────────────

  A page of twelve blocks with every field expanded is four screens of form,
  and the thing you are trying to see — the SHAPE of the page — is somewhere
  in the middle of it. Collapsed, the list reads as the page's outline, which
  is what you are arranging.
*/

const Btn = ({ on, danger, children, ...rest }) => (
  <button {...rest} style={{
    ...fontUtility, fontSize: "8.5px", letterSpacing: "0.14em",
    cursor: rest.disabled ? "default" : "pointer", padding: "6px 9px",
    color: on ? theme.onInk : danger ? theme.bad : theme.ink,
    background: on ? theme.ink : "transparent",
    border: `1px solid ${danger ? theme.bad : on ? theme.ink : theme.rule}`,
    opacity: rest.disabled ? 0.35 : 1,
    ...(rest.style || {}),
  }}>{children}</button>
);

/*
  Declared at the top level, not inside the editor. A component defined in a
  render is a new type every render, so React unmounts and remounts it — and a
  remounted text field loses focus after every keystroke. This file is full of
  text fields.
*/
const Rows = ({ value, onChange, termLabel = "Term", detailLabel = "Detail" }) => {
  const rows = Array.isArray(value) ? value : [];
  const set = (i, k, v) => onChange(rows.map((r, n) => (n === i ? { ...r, [k]: v } : r)));
  return (
    <div>
      {rows.map((r, i) => (
        <div key={i} className="flex items-center gap-1.5 mb-1.5">
          <input value={r.term || ""} placeholder={termLabel}
                 onChange={(e) => set(i, "term", e.target.value)}
                 style={{ ...inputStyle, flex: "0 0 36%" }} />
          <input value={r.detail || ""} placeholder={detailLabel}
                 onChange={(e) => set(i, "detail", e.target.value)}
                 style={{ ...inputStyle, flex: 1 }} />
          <Btn onClick={() => onChange(rows.filter((_, n) => n !== i))}
               aria-label="Remove this row">—</Btn>
        </div>
      ))}
      <Btn onClick={() => onChange([...rows, { term: "", detail: "" }])}>ADD A ROW</Btn>
    </div>
  );
};

const Images = ({ value, onChange }) => {
  const rows = Array.isArray(value) ? value : [];
  const set = (i, k, v) => onChange(rows.map((r, n) => (n === i ? { ...r, [k]: v } : r)));
  return (
    <div>
      {rows.map((r, i) => (
        <div key={i} className="flex items-center gap-1.5 mb-1.5">
          <span className="shrink-0" style={{ width: "30px", height: "30px",
                border: `1px solid ${theme.rule}`,
                background: r.src ? `center/cover no-repeat url(${r.src})` : theme.sunk }}
                aria-hidden="true" />
          <input value={r.src || ""} placeholder="a path or a full URL"
                 onChange={(e) => set(i, "src", e.target.value)}
                 style={{ ...inputStyle, flex: 1 }} />
          <input value={r.caption || ""} placeholder="caption"
                 onChange={(e) => set(i, "caption", e.target.value)}
                 style={{ ...inputStyle, flex: "0 0 30%" }} />
          <Btn onClick={() => onChange(rows.filter((_, n) => n !== i))}
               aria-label="Remove this row">—</Btn>
        </div>
      ))}
      <Btn onClick={() => onChange([...rows, { src: "", caption: "" }])}>ADD AN IMAGE</Btn>
    </div>
  );
};

const BlockField = ({ field, value, onChange }) => (
  <div className="py-2.5" style={{ borderBottom: `1px solid ${theme.rule}` }}>
    <p className="m-0 mb-1.5" style={{ ...fontUtility, fontSize: "7.5px",
          letterSpacing: "0.16em", color: theme.ink2 }}>
      {field.label.toUpperCase()}
    </p>

    {field.options ? (
      <div className="flex flex-wrap" style={{ gap: "5px" }}>
        {field.options.map((o) => (
          <Btn key={o} on={value === o} onClick={() => onChange(o)}>{o}</Btn>
        ))}
      </div>
    ) : field.pairs ? (
      <Rows value={value} onChange={onChange}
            termLabel={field.termLabel} detailLabel={field.detailLabel} />
    ) : field.images ? (
      <Images value={value} onChange={onChange} />
    ) : field.long ? (
      <textarea value={value || ""} rows={5} onChange={(e) => onChange(e.target.value)}
                style={{ ...inputStyle, width: "100%", resize: "vertical", lineHeight: 1.5 }} />
    ) : (
      <input value={value || ""} onChange={(e) => onChange(e.target.value)}
             placeholder={field.image ? "a path or a full URL" : undefined}
             style={{ ...inputStyle, width: "100%" }} />
    )}

    {field.help && (
      <p className="m-0 mt-1.5" style={{ ...fontText, fontSize: "13.5px",
            lineHeight: 1.5, color: theme.ink2 }}>{field.help}</p>
    )}
  </div>
);

/*
  A one-line description of what is actually in a block, so a collapsed list
  reads as the page rather than as ten rows saying TEXT. Without it the
  outline is useless the moment a page has more than two of anything.
*/
const summarise = (b) => {
  const t = (s, n = 46) => {
    const v = String(s || "").replace(/\s+/g, " ").trim();
    return v.length > n ? v.slice(0, n - 1) + "…" : v;
  };
  switch (b.type) {
    case "heading": return t(b.text) || "—";
    case "text": return t(b.body) || "—";
    case "photo": return t(b.caption) || (b.src ? t(b.src.split("/").pop()) : "no image yet");
    case "quote": return t(b.text) || "—";
    case "pair": return [b.leftTitle, b.rightTitle].filter(Boolean).join("  ·  ") || "—";
    case "index": return `${(b.items || []).length} rows`;
    case "gallery": return `${(b.images || []).length} images`;
    case "embed": return t(b.label) || t(b.url) || "—";
    case "buttons": return (b.items || []).map((i) => i.term).filter(Boolean).join(", ") || "—";
    case "rule": return b.style === "SINGLE" ? "single" : "double";
    case "space": return String(b.size || "MEDIUM").toLowerCase();
    default: return "";
  }
};

export default function BlockEditor({ blocks, onChange }) {
  const list = Array.isArray(blocks) ? blocks : [];
  const [openAt, setOpenAt] = useState(null);
  const [adding, setAdding] = useState(false);

  const put = (next) => onChange(next);
  const at = (i, patch) => put(list.map((b, n) => (n === i ? { ...b, ...patch } : b)));

  /*
    Moving a block moves the OPEN one with it. Without this, nudging the block
    you are editing up one place silently swaps which block the open form is
    editing — and the next thing you type goes into the wrong one.
  */
  const move = (i, by) => {
    const to = i + by;
    if (to < 0 || to >= list.length) return;
    const next = list.slice();
    [next[i], next[to]] = [next[to], next[i]];
    put(next);
    if (openAt === i) setOpenAt(to);
    else if (openAt === to) setOpenAt(i);
  };

  const remove = (i) => {
    put(list.filter((_, n) => n !== i));
    setOpenAt(null);
  };

  const add = (type) => {
    put([...list, { type, ...JSON.parse(JSON.stringify(BLOCKS[type].blank)) }]);
    setOpenAt(list.length);
    setAdding(false);
  };

  return (
    <div>
      {list.map((b, i) => {
        const def = BLOCKS[b.type];
        const open = openAt === i;
        return (
          <div key={i} className="mb-1.5"
               style={{ border: `1px solid ${open ? theme.ink : theme.rule}`,
                        background: open ? theme.sunk : "transparent" }}>
            <div className="flex items-center gap-2 px-2.5 py-2">
              <span style={{ ...fontUtility, fontSize: "7.5px", letterSpacing: "0.14em",
                    color: theme.ink2, width: "20px" }}>
                {String(i + 1).padStart(2, "0")}
              </span>
              <button onClick={() => setOpenAt(open ? null : i)}
                      className="flex-1 text-left" style={{ background: "transparent",
                        border: "none", cursor: "pointer", minWidth: 0 }}>
                <span className="block" style={{ ...fontUtility, fontSize: "7.5px",
                      letterSpacing: "0.16em", color: theme.brass }}>
                  {def ? def.label : String(b.type || "?").toUpperCase()}
                </span>
                <span className="block" style={{ ...fontText, fontSize: "14.5px",
                      color: theme.ink2, whiteSpace: "nowrap", overflow: "hidden",
                      textOverflow: "ellipsis" }}>
                  {summarise(b)}
                </span>
              </button>
              <Btn onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">↑</Btn>
              <Btn onClick={() => move(i, 1)} disabled={i === list.length - 1} aria-label="Move down">↓</Btn>
              <Btn danger onClick={() => remove(i)} aria-label="Remove">×</Btn>
            </div>

            {open && def && (
              <div className="px-2.5 pb-2.5">
                {def.fields.map((f) => (
                  <BlockField key={f.k} field={f} value={b[f.k]}
                              onChange={(v) => at(i, { [f.k]: v })} />
                ))}
              </div>
            )}
          </div>
        );
      })}

      {!list.length && (
        <p className="m-0 py-5" style={{ ...fontText, fontSize: "15px", color: theme.ink2 }}>
          Nothing here yet. Add a block below.
        </p>
      )}

      {adding ? (
        <div className="mt-2 p-2.5" style={{ border: `1px solid ${theme.rule}`, background: theme.sunk }}>
          <p className="m-0 mb-2" style={{ ...fontUtility, fontSize: "7.5px",
                letterSpacing: "0.18em", color: theme.brass }}>
            WHAT KIND
          </p>
          <div className="flex flex-wrap" style={{ gap: "5px" }}>
            {BLOCK_TYPES.map((t) => (
              <Btn key={t} onClick={() => add(t)}>{BLOCKS[t].label}</Btn>
            ))}
          </div>
          <div className="mt-2.5">
            <Btn onClick={() => setAdding(false)}>NEVER MIND</Btn>
          </div>
        </div>
      ) : (
        <Btn on onClick={() => setAdding(true)} style={{ marginTop: "8px", padding: "10px 16px" }}>
          ADD A BLOCK
        </Btn>
      )}
    </div>
  );
}
