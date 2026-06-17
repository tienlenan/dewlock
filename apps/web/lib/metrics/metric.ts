/**
 * A single dashboard metric — either an available value with its source +
 * freshness, or an honest "unavailable" (with an optional reason). NEVER a
 * fabricated placeholder number: a failing/missing source yields `unavailable`.
 */

export type Metric =
  | { value: number; source: string; asOf: string }
  | { unavailable: true; reason?: string };

export function available(value: number, source: string, asOf: string): Metric {
  return { value, source, asOf };
}

export function unavailable(reason?: string): Metric {
  return { unavailable: true, reason };
}

export function isAvailable(m: Metric): m is { value: number; source: string; asOf: string } {
  return !("unavailable" in m);
}
