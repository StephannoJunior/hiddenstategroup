import React, { useCallback, useEffect, useRef, useState } from "react";
import { fontText, fontUtility, theme } from "./Shared";
import * as api from "../lib/api";
import BUNDLED from "../content/images.json";

/*
  ImagePicker — choose a photograph, or upload one.

  Two sources, deliberately shown together:
    • what is already in the site (the images sent and built in)
    • what has been uploaded since

  They behave identically once chosen, so nobody has to care which is which.

  Uploading happens straight away rather than on save. A photo that only
  uploads when the post is saved means a failed upload loses the writing too.
*/

export default function ImagePicker({ label, value, onChange, folder = "posts" }) {
  const [uploaded, setUploaded] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const fileInput = useRef(null);

  const load = useCallback(async () => {
    const res = await api.listMedia();
    if (res.ok) setUploaded(res.files || []);
  }, []);

  useEffect(() => { if (open) load(); }, [open, load]);

  const upload = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setError(""); setBusy(true);

    const res = await api.uploadImage(file, folder);
    setBusy(false);
    if (fileInput.current) fileInput.current.value = "";

    if (!res.ok) { setError(res.error || "That didn't upload."); return; }
    // Choose it immediately: uploading a photo and then having to find it in
    // a list would be a strange way to work.
    onChange(res.path);
    setOpen(false);
    load();
  };

  const options = [...uploaded.map((f) => f.path), ...BUNDLED];

  return (
    <div>
      <p className="m-0 mb-2" style={{ ...fontUtility, fontSize: "9px", letterSpacing: "0.18em", color: theme.brass }}>
        {label}
      </p>

      <div className="flex items-start gap-3">
        {/* What is chosen, so nobody has to read a path to know. */}
        <div style={{ width: "72px", height: "72px", flexShrink: 0,
                      border: `1px solid ${theme.rule}`, background: "#EFE6D0",
                      display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
          {value ? (
            <img src={value} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <span style={{ ...fontUtility, fontSize: "8px", letterSpacing: "0.12em", color: theme.ink2 }}>
              NONE
            </span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => fileInput.current?.click()} disabled={busy}
                    style={{ ...fontUtility, fontSize: "9px", letterSpacing: "0.14em",
                             background: theme.ink, color: theme.bg, border: 0,
                             padding: "9px 14px", cursor: "pointer", opacity: busy ? 0.6 : 1 }}>
              {busy ? "UPLOADING…" : "UPLOAD"}
            </button>
            <button type="button" onClick={() => setOpen((o) => !o)}
                    style={{ ...fontUtility, fontSize: "9px", letterSpacing: "0.14em",
                             color: theme.ink, background: "transparent",
                             border: `1px solid ${theme.ink}`, padding: "9px 14px", cursor: "pointer" }}>
              {open ? "CLOSE" : "CHOOSE EXISTING"}
            </button>
            {value && (
              <button type="button" onClick={() => onChange("")}
                      style={{ ...fontUtility, fontSize: "9px", letterSpacing: "0.14em",
                               color: theme.ink2, background: "transparent", border: 0,
                               padding: "9px 4px", cursor: "pointer" }}>
                REMOVE
              </button>
            )}
          </div>

          {value && (
            <p className="m-0 mt-2" style={{ ...fontText, fontSize: "13px", color: theme.ink2, wordBreak: "break-all" }}>
              {value}
            </p>
          )}
          {error && (
            <p className="m-0 mt-2" style={{ ...fontText, fontSize: "14px", color: "#7A2E2E" }}>
              {error}
            </p>
          )}
        </div>
      </div>

      <input ref={fileInput} type="file" accept="image/*" onChange={upload} style={{ display: "none" }} />

      {open && (
        <div className="mt-3 p-2"
             style={{ border: `1px solid ${theme.rule}`, maxHeight: "260px", overflowY: "auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(74px, 1fr))", gap: "6px" }}>
            {options.map((path) => (
              <button key={path} type="button"
                      onClick={() => { onChange(path); setOpen(false); }}
                      style={{ padding: 0, border: value === path ? `2px solid ${theme.ink}` : `1px solid ${theme.rule}`,
                               background: "transparent", cursor: "pointer", aspectRatio: "1", overflow: "hidden" }}>
                <img src={path} alt="" loading="lazy"
                     style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              </button>
            ))}
          </div>
          {options.length === 0 && (
            <p className="m-0 p-3" style={{ ...fontText, fontSize: "15px", color: theme.ink2 }}>
              Nothing yet. Upload one.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
