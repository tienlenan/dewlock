/**
 * Client wrapper for ColorSwatches — owns the document.documentElement ref
 * so individual swatches can call getComputedStyle to resolve live token values.
 * Kept separate so the page itself can remain a Server Component.
 */
"use client";

import { useEffect, useState } from "react";
import { ColorSwatches } from "./color-swatches";

export function ColorSwatchesWrapper() {
  const [rootEl, setRootEl] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setRootEl(document.documentElement);
  }, []);

  return <ColorSwatches rootEl={rootEl} />;
}
