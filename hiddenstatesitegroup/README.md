# Hidden State — website

The five page designs, merged into one working site with real navigation.

---

## Run it locally

You need [Node.js](https://nodejs.org) (version 18 or newer). Then, in this folder:

```bash
npm install     # once, downloads dependencies
npm run dev     # starts the site
```

It'll print a URL like `http://localhost:5173` — open that in your browser.
Edits save instantly, no refresh needed.

To build the deployable version: `npm run build` (output lands in `dist/`).

---

## What's here

```
src/
  lib/data.js         ← ALL CONTENT LIVES HERE (see below)
  lib/marks.js        ← the three brand marks (SJ, seal, No Problem)
  components/Shared.jsx ← nav, footer, masthead, booking form, article cards
  pages/              ← one file per page
  App.jsx             ← the URL → page map
```

### Pages and their URLs

| URL | Page |
|---|---|
| `/` | Home |
| `/news` · `/news/:slug` | News index · single story |
| `/records` · `/records/:id` | Records · single release |
| `/agency` | Agency (roster + booking) |
| `/artists` · `/artists/:id` | Artist directory · artist profile |
| `/events` · `/events/:id` | Events · single event |
| `/mixes` | Mixes |
| `/about` | About |
| `/contact` | Contact |

---

## Changing content

**Almost everything you'll want to edit is in `src/lib/data.js`.** Artists,
releases, events, and articles all live there, and every page reads from it.
Change a name there and it updates everywhere on the site.

Current content is placeholder text with stock photos — real names, real
artwork, and real copy all go in that one file.

Longer prose that isn't in `data.js` yet (the About story, article bodies,
release notes) is marked with a comment in the relevant page file.

---

## Before going live — three things to sort out

### 1. Connect the forms — SET THIS UP BEFORE TAKING BOOKINGS

The booking and contact forms are wired to send, but they need one setting:
open **`src/lib/config.js`** and paste your Formspree form ID into
`FORMSPREE_ID`. Full instructions are in the comments at the top of that file.

Until that ID is filled in, both forms display a message telling visitors to
email instead. They will NOT show a false "thank you" — that matters, because
a silently-lost booking enquiry looks like you ignored someone.

### 2. Photos are stock placeholders

Every image currently points at Unsplash. They're fine for previewing, but
you don't want to launch on them — they're generic, and you're relying on
someone else's server. Once you have real photos, put them in `public/` and
reference them as `/photo-name.jpg` in `data.js`.

### 3. A date inconsistency to resolve

The press strip at the top of every page reads **EST. 2020**, and the About
page says founded 2020 — but one of the brand marks is labelled **est. 2005**.
Worth picking one before launch. (Search for `2005` and `EST. 2020` to find them.)

---

## Hosting (Cloudflare)

This site is hosted on Cloudflare, deployed from GitHub. Every push to the
repository rebuilds and redeploys automatically — usually live within a minute.

Build settings in the Cloudflare dashboard:

- **Build command:** `npm run build`
- **Build output directory:** `dist`

### wrangler.jsonc — don't delete this

Cloudflare deploys this as a **Worker**, and `wrangler.jsonc` is what tells it
where the built site lives. Two things in it matter:

- `directory: "./dist/"` — where `npm run build` puts the finished site.
- `not_found_handling: "single-page-application"` — serves `index.html` for any
  path that isn't a file, so React Router can handle `/records`, `/artists/1`
  and the rest. **Without this, every page except the homepage 404s on refresh.**

The `name` field must match the Worker name in the Cloudflare dashboard
(`hiddenstategroup`). If the project is ever renamed, rename it here too.

### Don't add a `_redirects` file

A `_redirects` file containing `/* /index.html 200` is the standard SPA fix on
Netlify and Cloudflare *Pages* — but this project deploys as a **Worker**, which
rejects that rule as an infinite loop and fails the deploy. `not_found_handling`
above already does the same job. Same goes for `vercel.json` — not used here.

---

## A note on versions

Dependencies in `package.json` are pinned to major versions known to work
together (React 18, Vite 5, Tailwind 3, React Router 6). If you or a developer
later upgrade Tailwind to 4, note that its config format changed — 
`tailwind.config.js` would need rewriting.

Note that Vite 5 is deliberate: Cloudflare's automatic Worker configuration
only works on Vite 6+, which is why `wrangler.jsonc` is committed explicitly
instead. Upgrading Vite later is fine, but keep that file.
