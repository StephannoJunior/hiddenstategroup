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
check("a single pass never queues twice", door.getQueue().map((e) => e.code), ["A1", "A2"]);

/*
  ── N02 · A PASS FOR MORE THAN ONE ───────────────────────────────────────

  The rule that used to be "never queue the same code twice" was right while a
  pass meant one person. It silently threw away the second, third and fourth
  of a group at an offline door: they walked in, and the record said they did
  not. These are the cases that must hold.
*/
store.clear();
door.queueAdmission("P4", "party-1", 4);
door.queueAdmission("P4", "party-1", 4);
door.queueAdmission("P4", "party-1", 4);
check("a pass for four queues three of them", door.getQueue().length, 3);
door.queueAdmission("P4", "party-1", 4);
check("and the fourth", door.getQueue().length, 4);
door.queueAdmission("P4", "party-1", 4);
check("but never a fifth", door.getQueue().length, 4);

store.clear();
door.queueAdmission("P1", "party-1", 1);
door.queueAdmission("P1", "party-1", 1);
check("a pass for one still queues once", door.getQueue().length, 1);
door.queueAdmission("P0", "party-1", 0);
door.queueAdmission("P0", "party-1", 0);
check("a nonsense allowance is treated as one", door.getQueue().filter((e) => e.code === "P0").length, 1);

// ── the offline check counts places, net of exits ────────────────────────
store.clear();
door.saveRoster({
  party: { id: "party-9", doors_close_at: new Date(Date.now() + 36e5).toISOString(), capacity: 100 },
  passes: [
    { code: "SOLO", name: "One Person", status: "ACTIVE", admits: 1, ins: 0, outs: 0 },
    { code: "FOUR", name: "A Group", status: "ACTIVE", admits: 4, ins: 2, outs: 0 },
    { code: "BACK", name: "Stepped Out", status: "ACTIVE", admits: 1, ins: 1, outs: 1 },
    { code: "DONE", name: "All In", status: "ACTIVE", admits: 2, ins: 2, outs: 0 },
    { code: "GONE", name: "Cancelled", status: "REVOKED", admits: 1, ins: 0, outs: 0 },
  ],
});
check("an unused pass is admitted", door.checkOffline("SOLO").ok, true);
check("a group with two already in still has room", door.checkOffline("FOUR").ok, true);
check("and it says which of them this is", door.checkOffline("FOUR").inHere, 3);
check("somebody who stepped out can come back", door.checkOffline("BACK").ok, true);
check("a pass with every place taken is refused", door.checkOffline("DONE").ok, false);
check("and says so as USED", door.checkOffline("DONE").reason, "USED");
check("a revoked pass is still refused", door.checkOffline("GONE").reason, "REVOKED");
check("an unknown code is still refused", door.checkOffline("NOPE").reason, "UNKNOWN");

// The headcount is in PLACES and net of exits: 0 + 2 + 0 + 2 = 4.
check("the local headcount counts places, not passes", door.localAdmittedCount(), 4);
door.queueAdmission("FOUR", "party-9", 4);
check("and adds what this phone has queued since", door.localAdmittedCount(), 5);

store.clear();
door.queueAdmission("A1", "party-1");
door.queueAdmission("A2", "party-1");

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
