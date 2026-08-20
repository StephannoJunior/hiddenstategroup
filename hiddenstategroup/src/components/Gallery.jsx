import { useLang } from "../lib/lang";
import Img from "./Img";
import React, { useState } from "react";
import { fontUtility, fontDisplay, fontText, theme } from "./Shared";

/*
  Gallery — photos from a past event.

  Two ways to save a photo, because phones and computers behave differently:

    • On a phone, a long press on the image is the native way to save it. That
      is why the instruction line says so — it is more reliable than any button
      we could add, and it is what people already expect.
    • On a computer, each photo has a download button, and "download all"
      builds a zip in the browser.

  JSZip is loaded only when someone actually presses "download all", so it
  costs nothing on pages where it is never used.
*/

function fileNameFor(src, i, prefix) {
  const ext = (src.split(".").pop() || "jpg").split("?")[0];
  return `${prefix}-${String(i + 1).padStart(2, "0")}.${ext}`;
}

export default function Gallery({ photos = [], prefix = "hidden-state", title = null }) {
  const { t } = useLang();
  const [zipping, setZipping] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [lightbox, setLightbox] = useState(null);

  if (!photos.length) return null;

  const downloadOne = async (src, i) => {
    try {
      const res = await fetch(src);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileNameFor(src, i, prefix);
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      window.open(src, "_blank");
    }
  };

  const downloadAll = async () => {
    setError("");
    setZipping(true);
    setProgress(0);
    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      for (let i = 0; i < photos.length; i++) {
        const res = await fetch(photos[i]);
        zip.file(fileNameFor(photos[i], i, prefix), await res.blob());
        setProgress(Math.round(((i + 1) / photos.length) * 100));
      }
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${prefix}-photos.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError("Couldn't build the zip. Save the photos one at a time instead.");
    } finally {
      setZipping(false);
      setProgress(0);
    }
  };

  return (
    <section className="mt-10">
      <p className="m-0 mb-1" style={{ ...fontUtility, fontSize: "9.5px", letterSpacing: "0.2em", color: theme.brass }}>
        {title || t("fromTheNight")}
      </p>
      <div style={{ borderTop: "1px solid " + theme.ink }} />

      <p className="mt-3 mb-0" style={{ ...fontText, fontSize: "16px", lineHeight: 1.55, color: theme.ink2 }}>
        Want a photo? Press and hold any picture to save it to your phone, or use the
        download button on each one. You can also take the whole set at once.
      </p>

      <div className="flex flex-wrap items-center gap-4 mt-4">
        <button onClick={downloadAll} disabled={zipping} className="px-7 py-3"
          style={{ ...fontUtility, fontSize: "10px", letterSpacing: "0.2em",
                   background: theme.ink, color: theme.bg, opacity: zipping ? 0.6 : 1 }}>
          {zipping ? `PREPARING… ${progress}%` : `DOWNLOAD ALL (${photos.length})`}
        </button>
        <span style={{ ...fontUtility, fontSize: "9px", letterSpacing: "0.14em", color: theme.ink2 }}>
          {photos.length} PHOTO{photos.length === 1 ? "" : "S"}
        </span>
      </div>

      {error && (
        <p className="mt-3 mb-0 px-3 py-2.5"
           style={{ ...fontText, fontSize: "15px", color: "#7A2E2E", border: "1px solid #C08A8A" }}>
          {error}
        </p>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5 mt-5">
        {photos.map((src, i) => (
          <figure key={src} className="m-0 relative">
            <button onClick={() => setLightbox(src)} className="block w-full"
                    aria-label={`Open photo ${i + 1}`}>
              <Img src={src} alt="" className="w-full block"
                   style={{ aspectRatio: "1 / 1", objectFit: "cover", background: theme.raised }} />
            </button>
            <button
              onClick={() => downloadOne(src, i)}
              aria-label={`Download photo ${i + 1}`}
              className="absolute bottom-1.5 right-1.5 px-2.5 py-1.5"
              style={{
                ...fontUtility, fontSize: "8.5px", letterSpacing: "0.14em", color: theme.ink,
                background: "rgba(243,235,217,0.82)",
                backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
                border: "1px solid rgba(22,19,14,0.16)",
              }}
            >
              SAVE
            </button>
          </figure>
        ))}
      </div>

      {lightbox && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4"
             style={{ background: "rgba(22,19,14,0.92)" }}
             onClick={() => setLightbox(null)}>
          <Img src={lightbox} alt="" style={{ maxWidth: "100%", maxHeight: "86vh", display: "block" }} />
          <button onClick={() => setLightbox(null)}
                  className="absolute top-4 right-4 px-4 py-2"
                  style={{ ...fontUtility, fontSize: "10px", letterSpacing: "0.16em",
                           color: theme.bg, border: "1px solid rgba(243,235,217,0.4)" }}>
            CLOSE
          </button>
          <p className="absolute left-0 right-0 bottom-4 text-center m-0"
             style={{ ...fontUtility, fontSize: "9px", letterSpacing: "0.14em", color: "rgba(243,235,217,0.7)" }}>
            PRESS AND HOLD TO SAVE
          </p>
        </div>
      )}
    </section>
  );
}
