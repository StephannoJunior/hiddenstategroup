import { usePageMeta } from "../lib/seo";
import React from "react";
import { Navigate } from "react-router-dom";

/*
  /admin used to be its own dashboard, built before the server existed. The
  console replaced it. Keeping the address alive means any bookmark or link
  still works instead of landing on a 404.
*/
export default function Admin() {
  usePageMeta({ title: "Console", description: "Hidden State door console." });
  return <Navigate to="/console" replace />;
}
