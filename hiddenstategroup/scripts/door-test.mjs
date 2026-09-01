/*
  THE DOOR QUEUE, TESTED.

  This is the code that runs when the door has no signal, which is the one
  moment nobody can afford to debug it. It has never been exercised outside a
  real night, so this exercises it: the queue, the code reader, and the
  removal of exactly what a server acknowledged.

  It runs the REAL module — src/lib/door.js, unmodified — against a stand-in
  for localStorage. Testing a copy of the logic would prove nothing about the
  logic that ships.

  Run:  npm run test:door
*/
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
};

const door = await import("../src/lib/door.js");

let failed = 0;
const check = (what, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? "  ok" : "FAIL"}  ${what}`);
  if (!ok) console.log(`        wanted ${JSON.stringify(want)}\n        got    ${JSON.stringify(got)}`);
};

// ── reading a code out of whatever the camera saw ────────────────────────
check("a full QR payload gives the code", door.codeOf("HS|ABC123|4821"), "ABC123");
check("a bare code is left alone", door.codeOf("ABC123"), "ABC123");
check("an empty scan gives an empty code", door.codeOf(""), "");
check("a null scan does not throw", door.codeOf(null), "");
// This is the case that was losing admissions: a pass with no name attached
// used to have its ENTIRE payload stored as the code.
check("a payload with a trailing field still gives the code",
  door.codeOf("HS|XYZ789|0000"), "XYZ789");

// ── the queue ────────────────────────────────────────────────────────────
store.clear();
door.queueAdmission("A1", "party-1");
door.queueAdmission("A2", "party-1");
check("two admissions queue", door.getQueue().map((e) => e.code), ["A1", "A2"]);

door.queueAdmission("A1", "party-1");
check("a double tap does not queue twice", door.getQueue().map((e) => e.code), ["A1", "A2"]);

// ── removing only what the server confirmed ──────────────────────────────
door.queueAdmission("A3", "party-1");
door.dequeue(["A1", "A3"]);
check("only the acknowledged codes are removed", door.getQueue().map((e) => e.code), ["A2"]);

door.dequeue([]);
check("acknowledging nothing removes nothing", door.getQueue().map((e) => e.code), ["A2"]);

door.dequeue([null, undefined, ""]);
check("empty acknowledgements are ignored", door.getQueue().map((e) => e.code), ["A2"]);

door.dequeue(["A2"]);
check("the last one clears", door.getQueue(), []);

// ── the shape the server is sent ─────────────────────────────────────────
store.clear();
door.queueAdmission("B1", "party-2");
const [entry] = door.getQueue();
check("an entry carries a code", entry.code, "B1");
check("an entry carries the night", entry.party, "party-2");
check("an entry carries a real timestamp",
  !Number.isNaN(Date.parse(entry.at || "")), true);

// ── a queue bigger than one batch ────────────────────────────────────────
store.clear();
for (let i = 0; i < 450; i++) door.queueAdmission(`C${i}`, "party-3");
check("450 admissions queue", door.getQueue().length, 450);
const first = door.getQueue().slice(0, 200).map((e) => e.code);
door.dequeue(first);
check("a batch of 200 leaves the rest", door.getQueue().length, 250);
check("the remainder starts where the batch ended", door.getQueue()[0].code, "C200");

console.log(failed ? `\n${failed} failed` : "\nthe door queue is sound");
process.exit(failed ? 1 : 0);
