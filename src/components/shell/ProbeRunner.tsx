"use client";
import { useEffect } from "react";
import { startProbes } from "@/lib/probe-store";
import { useRouterState } from "@tanstack/react-router";

export function ProbeRunner() {
  const path = useRouterState({ select: (s) => s.location.pathname.replace(/\/+$/, "") });
  const offline = path === "/quantotalus" || path === "/proof-fulcrum";
  useEffect(() => {
    if (!offline) return startProbes();
  }, [offline]);
  return null;
}
