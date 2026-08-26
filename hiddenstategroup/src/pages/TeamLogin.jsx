import { usePageMeta } from "../lib/seo";
import React from "react";
import { Navigate } from "react-router-dom";

/*
  /admins-staff-boss — the team's way in.

  A separate address from anything a guest sees. It carries no link from the
  site and is excluded from the sitemap, so it does not turn up in search.

  The gate itself lives in DoorGate; this route simply lands the team on the
  admin area, which asks them to sign in.
*/
export default function TeamLogin() {
  usePageMeta({ title: "Team", description: "Hidden State team access." });
  return <Navigate to="/admin" replace />;
}
