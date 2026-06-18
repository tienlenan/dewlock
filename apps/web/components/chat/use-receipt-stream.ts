"use client";

/**
 * useReceiptStream — drives the SSE receipt pipeline (/api/receipt/stream) and
 * exposes live per-step progress for the progress dialog. Parses Server-Sent
 * Events over fetch (POST body needed, so EventSource won't do).
 *
 * Never blocks the UI: start() runs async; the dialog renders `state` reactively.
 */

import { useCallback, useRef, useState } from "react";

export type StreamStepStatus = "pending" | "running" | "done" | "skipped" | "failed";

export interface StreamStep {
  id: string;
  label: string;
  status: StreamStepStatus;
  detail?: string;
}

export interface ReceiptStreamResult {
  status: "blob_ready" | "blob_only" | "anchored";
  blobId: string | null;
  blobObjectId: string | null;
  anchorObjectId: string | null;
  anchorTxDigest: string | null;
  suiObjectId: string | null;
  contentHashHex: string | null;
  error?: string;
}

export interface ReceiptStreamState {
  steps: StreamStep[];
  result: ReceiptStreamResult | null;
  error: string | null;
  active: boolean;
}

export interface ReceiptStreamInput {
  txDigest: string | null;
  approvedDigest: string | null;
  action: string;
  args: Record<string, unknown>;
  dryRunEffects?: unknown;
  verdict: "approved" | "blocked";
  walletAddress: string;
  /** Guardian-computed USD value — recorded in the action log for real volume/receipt USD. */
  estimatedUsdValue?: number;
}

const INITIAL: ReceiptStreamState = { steps: [], result: null, error: null, active: false };

/** Parse one SSE block ("event: …\ndata: …") into { event, data }. */
function parseSseBlock(block: string): { event: string; data: unknown } | null {
  let event = "message";
  const dataLines: string[] = [];
  for (const line of block.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
  }
  if (dataLines.length === 0) return null;
  try {
    return { event, data: JSON.parse(dataLines.join("\n")) };
  } catch {
    return null;
  }
}

export function useReceiptStream() {
  const [state, setState] = useState<ReceiptStreamState>(INITIAL);
  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setState(INITIAL);
  }, []);

  const apply = useCallback((event: string, data: unknown) => {
    if (event === "steps") {
      const steps = ((data as { steps?: Array<{ id: string; label: string }> }).steps ?? []).map(
        (x) => ({ id: x.id, label: x.label, status: "pending" as StreamStepStatus }),
      );
      setState((s) => ({ ...s, steps }));
    } else if (event === "step") {
      const p = data as StreamStep;
      setState((s) => ({
        ...s,
        steps: s.steps.map((st) => (st.id === p.id ? { ...st, status: p.status, detail: p.detail } : st)),
      }));
    } else if (event === "done") {
      setState((s) => ({ ...s, result: data as ReceiptStreamResult, active: false }));
    } else if (event === "error") {
      setState((s) => ({ ...s, error: (data as { error?: string }).error ?? "stream error", active: false }));
    }
  }, []);

  const start = useCallback(
    async (input: ReceiptStreamInput) => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setState({ ...INITIAL, active: true });
      try {
        const res = await fetch("/api/receipt/stream", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input),
          signal: ctrl.signal,
        });
        if (!res.ok || !res.body) {
          setState((s) => ({ ...s, active: false, error: `stream ${res.status}` }));
          return;
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const blocks = buf.split("\n\n");
          buf = blocks.pop() ?? ""; // keep the trailing partial block
          for (const block of blocks) {
            const ev = parseSseBlock(block);
            if (ev) apply(ev.event, ev.data);
          }
        }
        setState((s) => ({ ...s, active: false }));
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setState((s) => ({ ...s, active: false, error: err instanceof Error ? err.message : String(err) }));
      }
    },
    [apply],
  );

  return { state, start, reset };
}
