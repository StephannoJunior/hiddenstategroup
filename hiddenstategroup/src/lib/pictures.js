/*
  ── K23 · ONE UPLOAD, THREE SIZES ───────────────────────────────────────────

  A press photograph off a real camera is fifteen to thirty megabytes and six
  thousand pixels wide. Three different things want it, and they want it at
  three different sizes:

    · the editor wants a THUMBNAIL, forty of them on a screen at once;
    · the kit page wants a WEB copy — sharp on a laptop, quick on a phone in
      the back of a taxi;
    · the promoter wants the FULL original, because they are putting it on a
      poster two metres wide.

  Send only the original and a kit with eight photographs is a page that takes
  half a minute to open. Send only a web copy and the poster is soft. So all
  three are made, and the browser makes them.

  WHY THE BROWSER AND NOT THE SERVER. Resizing on the server would mean either
  an image library the Workers runtime cannot run, or Cloudflare Images, which
  is a monthly bill. The browser already has the file in memory, already has a
  hardware-accelerated image decoder, and is sitting idle while the person
  looks at the upload button. It costs nothing and it happens before the slow
  part — so the two derived copies are also far quicker to send than they
  would be to receive and process.

  WHAT IT DELIBERATELY DOES NOT DO: it never replaces the original. The full
  file is uploaded untouched, EXIF and colour profile and all, because that is
  the copy a printer will use and re-encoding it would be a quiet loss nobody
  would notice until it was on a wall.
*/

const WEB_EDGE = 1800;    // longest side of the copy the kit page shows
const THUMB_EDGE = 320;   // longest side of the copy the editor shows
const WEB_QUALITY = 0.86;
const THUMB_QUALITY = 0.78;

/*
  createImageBitmap over an <img> with an object URL: it decodes off the main
  thread, so dropping twelve photographs at once does not freeze the page
  while they are prepared. Safari has supported it for years; the fallback is
  there for anything that has not, and for a decode that simply fails.
*/
async function decode(file) {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file);
    } catch {
      /* fall through — a CMYK JPEG or a broken file lands here */
    }
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("could not read that image")); };
    img.src = url;
  });
}

function scaled(bitmap, edge) {
  const w = bitmap.width || bitmap.naturalWidth;
  const h = bitmap.height || bitmap.naturalHeight;
  const long = Math.max(w, h);
  // Never enlarge. A photograph that is already small is already the web copy.
  const k = long <= edge ? 1 : edge / long;
  return { w: Math.round(w * k), h: Math.round(h * k), scale: k, srcW: w, srcH: h };
}

function draw(bitmap, w, h) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  // The default is already this, but browsers have differed and a logo
  // downscaled with nearest-neighbour looks like a mistake somebody made.
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, w, h);
  return canvas;
}

function toBlob(canvas, type, quality) {
  return new Promise((resolve) => {
    if (canvas.toBlob) canvas.toBlob((b) => resolve(b), type, quality);
    else resolve(null);
  });
}

/*
  WebP, with a JPEG fallback that is checked rather than assumed. Every browser
  this site supports writes WebP, and it is roughly a third smaller than JPEG
  at the same quality — but a canvas asked for a type it cannot write silently
  returns a PNG, which for a photograph is several times LARGER than the
  original and would make this whole exercise counterproductive.
*/
async function encode(canvas, quality) {
  const webp = await toBlob(canvas, "image/webp", quality);
  if (webp && webp.type === "image/webp") return webp;
  const jpeg = await toBlob(canvas, "image/jpeg", quality);
  return jpeg || null;
}

const named = (blob, name, suffix) => {
  const stem = String(name || "photo").replace(/\.[^.]+$/, "").slice(0, 60);
  const ext = blob.type === "image/webp" ? "webp" : "jpg";
  return new File([blob], `${stem}-${suffix}.${ext}`, { type: blob.type });
};

/*
  Returns { full, web, thumb, width, height } — `full` is the file exactly as
  it arrived. `web` and `thumb` are null when they could not be made, which is
  a state the caller must handle rather than a reason to refuse the upload: a
  photograph that only uploads at full size is worth more than no photograph.
*/
export async function threeSizes(file) {
  if (!/^image\//.test(file.type)) {
    return { full: file, web: null, thumb: null, width: 0, height: 0 };
  }

  let bitmap;
  try {
    bitmap = await decode(file);
  } catch {
    return { full: file, web: null, thumb: null, width: 0, height: 0 };
  }

  const w = scaled(bitmap, WEB_EDGE);
  const t = scaled(bitmap, THUMB_EDGE);

  let web = null;
  let thumb = null;
  try {
    // Skip the web copy when the original is already smaller than one —
    // re-encoding it would only lose quality to save nothing.
    if (w.scale < 1) {
      const blob = await encode(draw(bitmap, w.w, w.h), WEB_QUALITY);
      if (blob && blob.size < file.size) web = named(blob, file.name, "web");
    }
    const tb = await encode(draw(bitmap, t.w, t.h), THUMB_QUALITY);
    if (tb) thumb = named(tb, file.name, "thumb");
  } catch {
    /* out of memory on a very large image; the original still uploads */
  }

  if (bitmap.close) bitmap.close();
  return { full: file, web, thumb, width: w.srcW, height: w.srcH };
}

/*
  A short, human description of a file, for the editor to show beside it.
  Bytes are what a computer cares about; "4.2MB · 6000 × 4000" is what tells a
  person whether they have chosen the right file.
*/
export function describe(bytes, width, height) {
  const size = bytes >= 1048576
    ? `${(bytes / 1048576).toFixed(1)}MB`
    : `${Math.max(1, Math.round(bytes / 1024))}KB`;
  return width && height ? `${size} · ${width} × ${height}` : size;
}
