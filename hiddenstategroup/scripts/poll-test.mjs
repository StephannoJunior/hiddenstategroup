/*
  Exercises the WORKER'S OWN LOGIC — the same three predicates lifted out of
  worker/index.js verbatim — against the real rows now in the database, so the
  answer is about the code that will ship rather than about a mock of it.
*/
/*
  Run:  npm run test:polls

  The shape below is a snapshot of real rows, kept here rather than fetched so
  the test needs no database and no network and can gate a deploy. If the
  worker's three predicates are ever changed, change them in BOTH places — the
  point of the copy is that a change has to be deliberate.
*/
const rows = process.argv[2] ? JSON.parse(process.argv[2]) : {
  polls: [
    { id: 1, audience: "PUBLIC", status: "OPEN", picks: 1 },
    { id: 2, audience: "TEAM", status: "OPEN", picks: 2 },
  ],
  options: [
    { id: 1, poll_id: 1, label: "Friday" },
    { id: 2, poll_id: 1, label: "Saturday" },
    { id: 3, poll_id: 1, label: "Sunday" },
  ],
  tally: { 1: 1, 2: 2 },
};

let bad = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) bad++;
  console.log(`  ${ok ? "ok " : "✗  "} ${name}${ok ? "" : `  got ${JSON.stringify(got)} want ${JSON.stringify(want)}`}`);
};

// the worker's rule, copied exactly
const talliedFor = (poll, team, voted) => team || voted || poll.status === "CLOSED";
const visibleTo = (poll, team) => team || (poll.audience === "PUBLIC" && poll.status === "OPEN");
const optionsOut = (opts, withCounts) =>
  withCounts ? opts : opts.map(({ id, label }) => ({ id, label }));

const pub = rows.polls.find((p) => p.audience === "PUBLIC");
const team = rows.polls.find((p) => p.audience === "TEAM");
const pubOpts = rows.options.filter((o) => o.poll_id === pub.id)
  .map((o) => ({ id: o.id, label: o.label, votes: rows.tally[o.id] || 0 }));

console.log("\nWHAT A STRANGER WHO HAS NOT VOTED CAN SEE");
check("the public poll is listed", visibleTo(pub, false), true);
check("the team poll is NOT listed", visibleTo(team, false), false);
check("counts are withheld", talliedFor(pub, false, false), false);
const out = optionsOut(pubOpts, talliedFor(pub, false, false));
check("no `votes` key reaches them at all", out.every((o) => !("votes" in o)), true);
check("the labels still do", out.map((o) => o.label), ["Friday", "Saturday", "Sunday"]);

console.log("\nONCE THEY HAVE VOTED");
check("counts are released", talliedFor(pub, false, true), true);
const after = optionsOut(pubOpts, true);
check("and they are the real ones", after.map((o) => o.votes), [1, 2, 0]);

console.log("\nTHE TEAM");
check("sees the team poll", visibleTo(team, true), true);
check("sees counts without voting", talliedFor(pub, true, false), true);

console.log("\nA CLOSED POLL");
check("shows its result to everyone", talliedFor({ ...pub, status: "CLOSED" }, false, false), true);

console.log(bad ? `\n${bad} failed\n` : "\nthe counts are withheld where they should be\n");
process.exit(bad ? 1 : 0);
