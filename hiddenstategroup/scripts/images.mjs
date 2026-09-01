/*
  MAKE THE IMAGE VARIANTS.

  Run:  npm run images        (needs `npm i -D sharp` once)

  THE PROBLEM THIS SOLVES. There were exactly two sizes of every photograph —
  the original and a hand-made `-sm` — and the small one was made by hand,
  which means a new photo was one forgotten step away from sending a phone a
  1400px file. It also means the browser was choosing between two options
  with no idea how wide either of them actually was.

  WHAT IT MAKES. Three real widths in two formats:

    480   a phone
    800   a phone at 2× and most tablets
    1400  a laptop, and the full-bleed sleeves

  AVIF alongside WebP, because AVIF is typically 30–50% smaller at the same
  quality and every browser that matters has read it for years. The `<picture>`
  element offers it first and falls back on its own — nothing to detect.

  IT WRITES A MANIFEST, AND THE MANIFEST IS THE SAFETY CATCH. The site only
  emits AVIF markup for images this script has actually processed. Run it or
  do not run it; a photograph with no entry is served exactly as before,
  rather than pointing at a file that does not exist.

  Existing files are skipped, so running it again after adding one photo does
  one photo's work.
*/
import { readdir, stat, writeFile, mkdir } from "node:fs/promises";
import { join, dirname, relative, basename, extname } from "node:path";

let sharp;
try {
  sharp = (await import("sharp")).default;
} catch {
  console.error("This needs sharp:  npm i -D sharp");
  process.exit(1);
}

const ROOT = new URL("../", import.meta.url).pathname;
const PUBLIC = join(ROOT, "public");
const WIDTHS = [480, 800, 1400];

// Quality is per-format on purpose: AVIF holds up at a lower number than WebP
// does, and matching them would either waste bytes or soften the WebP.
const WEBP = { quality: 82, effort: 5 };
const AVIF = { quality: 52, effort: 5 };

async function walk(dir, out = []) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) await walk(p, out);
    else if (/\.(webp|jpe?g|png)$/i.test(e.name)) out.push(p);
  }
  return out;
}

const exists = (p) => stat(p).then(() => true).catch(() => false);

async function main() {
  const all = await walk(PUBLIC);

  const sources = all.filter((p) => {
    const b = basename(p);
    // Skip what this script made, the old hand-cut smalls, and the marks —
    // a logo has no business being resampled into three sizes.
    if (/-(?:sm|480|800|1400)\.(webp|avif)$/i.test(b)) return false;
    if (/^(wordmark|icon|apple-touch)/i.test(b)) return false;
    if (p.includes("/icons/")) return false;
    return true;
  });

  const manifest = {};
  let made = 0, skipped = 0, saved = 0;

  for (const src of sources) {
    const rel = "/" + relative(PUBLIC, src).split("\\").join("/");
    const stem = rel.slice(0, -extname(rel).length);
    const image = sharp(src);
    const meta = await image.metadata();
    if (!meta.width) continue;

    // Never invent detail. An image 900px wide gets 480 and 800 and stops —
    // upscaling to 1400 makes a larger file that looks worse.
    const widths = WIDTHS.filter((w) => w <= meta.width);
    if (!widths.length) widths.push(meta.width);

    for (const w of widths) {
      for (const [ext, opts] of [["webp", WEBP], ["avif", AVIF]]) {
        const out = join(PUBLIC, `${stem}-${w}.${ext}`.slice(1));
        if (await exists(out)) { skipped++; continue; }
        await mkdir(dirname(out), { recursive: true });
        const buf = await sharp(src).resize({ width: w, withoutEnlargement: true })
          .toFormat(ext, opts).toBuffer();
        await writeFile(out, buf);
        made++;
        saved += buf.length;
      }
    }

    manifest[rel] = { w: widths, base: stem };
    process.stdout.write(".");
  }

  await writeFile(
    join(ROOT, "src/content/imagesets.json"),
    JSON.stringify(manifest, null, 1) + "\n"
  );

  console.log(`\n${Object.keys(manifest).length} photographs`);
  console.log(`${made} files written, ${skipped} already there, ${(saved / 1048576).toFixed(1)} MB new`);
  console.log("The site picks these up automatically — nothing else to change.");
}

main().catch((e) => { console.error("\nfailed:", e.message); process.exit(1); });
