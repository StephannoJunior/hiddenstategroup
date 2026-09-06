/*
  Run:  npm run test:a11y

  Catches one thing, exactly, and catches it everywhere:

    A CONTROL A SCREEN READER WOULD ANNOUNCE AS NOTHING.

  A button whose only content is an icon or a symbol has no accessible name
  unless something gives it one. To somebody using the console with a screen
  reader in a dark room at a venue that button is announced as "button", and
  this site has plenty of them, because a row of ↑ ↓ × is a good console for
  everyone else.

  ── TWO THINGS THIS GOT WRONG BEFORE IT GOT THEM RIGHT ─────────────────────

  1. IT WAS TOO BROAD. The first version flagged any button whose label was
     not a plain string and reported twenty-seven problems, of which
     twenty-five were every `{busy ? "SAVING…" : "SAVE"}` in the codebase. A
     check that is wrong twenty-five times out of twenty-seven does not get
     fixed, it gets ignored — and then it is worse than no check, because a
     green tick that means nothing still reads as a green tick.

  2. IT WAS PARSED WITH A REGULAR EXPRESSION, and JSX is not a regular
     language. `<Btn onClick={() => move(i, -1)} aria-label="Move up">` has a
     `>` inside an arrow function, so a regex reading attributes up to the
     first `>` stopped in the middle of one and never saw the label. It
     reported zero named controls while dozens carried names. That is the
     worse failure of the two: it was quietly not looking.

  So it uses the real parser. A control is reported only when its children are
  empty, or are elements with no text (an icon alone), or are a literal string
  of symbols — and never when an expression might resolve to words.
*/
import { parse } from "@babel/parser";
import _traverse from "@babel/traverse";
import { readFileSync, readdirSync, statSync } from "node:fs";
const traverse = _traverse.default || _traverse;

const BUTTONS = new Set(["button", "Btn", "Chip", "IconButton"]);
const NAMES = new Set(["aria-label", "aria-labelledby", "title"]);
const SYMBOLS = /^[\s!-/:-@[-`{-~×÷–—←↑→↓✓✗·•…]+$/;

const files = [];
(function walk(d) {
  for (const e of readdirSync(d)) {
    const p = d + "/" + e;
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.jsx$/.test(p)) files.push(p);
  }
})("src");

let problems = 0, checked = 0, named = 0;

for (const f of files) {
  const ast = parse(readFileSync(f, "utf8"), { sourceType: "module", plugins: ["jsx"] });

  traverse(ast, {
    JSXElement(path) {
      const open = path.node.openingElement;
      if (open.name.type !== "JSXIdentifier" || !BUTTONS.has(open.name.name)) return;
      checked++;

      const hasName = open.attributes.some(
        (a) => a.type === "JSXAttribute" && NAMES.has(a.name.name)
      );
      if (hasName) { named++; return; }

      /*
        DESCENDANTS, NOT CHILDREN. Nearly every button in this console wraps
        its label in a <span> for the typography — <button><span>SAVE</span>
        </button> — so a check that only read direct children saw "one
        element, no text" and called six perfectly good buttons nameless. The
        label is in there; it is just one level down.

        An <img alt="something"> counts as text, because that is exactly what
        alt is. An <img alt=""> does not, because that is exactly what an
        empty alt means.
      */
      let text = "", elements = 0, expressions = 0;
      const look = (nodes) => {
        for (const child of nodes || []) {
          if (child.type === "JSXText") text += child.value;
          else if (child.type === "JSXExpressionContainer") expressions++;
          else if (child.type === "JSXElement") {
            const nm = child.openingElement.name;
            if (nm.type === "JSXIdentifier" && nm.name === "img") {
              const alt = child.openingElement.attributes.find(
                (a) => a.type === "JSXAttribute" && a.name.name === "alt"
              );
              const v = alt && alt.value;
              if (v && (v.type !== "StringLiteral" || v.value.trim())) text += "x";
            }
            elements++;
            look(child.children);
          } else if (child.type === "JSXFragment") {
            elements++;
            look(child.children);
          }
        }
      };
      look(path.node.children);

      // An expression is assumed to resolve to words. Sometimes wrong, and
      // still the right assumption: the alternative is noise.
      if (expressions) return;

      const trimmed = text.trim();
      if (trimmed && !SYMBOLS.test(trimmed)) return;

      const line = open.loc.start.line;
      const what = trimmed || (elements ? "an icon on its own" : "(empty)");
      console.log(`  ✗ ${f}:${line} — <${open.name.name}> announced as nothing: ${what}`);
      problems++;
    },
  });
}

console.log(problems
  ? `\n${problems} of ${checked} controls announce nothing — ${named} carry an explicit name\n`
  : `  ok — ${checked} controls, none announce nothing (${named} carry an explicit name)\n`);
process.exit(problems ? 1 : 0);
