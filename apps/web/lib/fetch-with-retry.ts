/**
 * fetchJsonWithRetry — fetch a JSON endpoint with a per-attempt abort timeout and
 * automatic retries. For self-fetching cards whose backend has a COLD path: the first
 * (cold serverless + warm-up of upstream memwal/BlockVision) call can exceed the timeout
 * while a warm retry returns instantly. Without a retry the user sees a hard error on the
 * first load even though "try again" works — so retry transparently.
 *
 * - `attempts` total tries (default 3); `timeoutMs` per-attempt abort (default 10s).
 * - Linear backoff between tries (`backoffMs * attempt`).
 * - `signal`: external cancellation (caller unmount) — when it fires we stop and rethrow,
 *   distinguishing a real cancel from a per-attempt timeout (which retries).
 * Throws the last error after all attempts are exhausted.
 */

export interface FetchRetryOptions {
  attempts?: number;
  timeoutMs?: number;
  backoffMs?: number;
  signal?: AbortSignal;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function fetchJsonWithRetry<T>(url: string, opts: FetchRetryOptions = {}): Promise<T> {
  const attempts = opts.attempts ?? 3;
  const timeoutMs = opts.timeoutMs ?? 10_000;
  const backoffMs = opts.backoffMs ?? 500;

  let lastErr: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    if (opts.signal?.aborted) throw new DOMException("Aborted", "AbortError");

    const ctrl = new AbortController();
    const onExternalAbort = () => ctrl.abort();
    opts.signal?.addEventListener("abort", onExternalAbort, { once: true });
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);

    try {
      const res = await fetch(url, { signal: ctrl.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as T;
    } catch (err) {
      lastErr = err;
      // A real caller-cancel (unmount) → stop immediately, don't retry.
      if (opts.signal?.aborted) throw err;
      // Otherwise it was a per-attempt timeout / transient failure → back off + retry.
      if (attempt < attempts) await sleep(backoffMs * attempt);
    } finally {
      clearTimeout(timer);
      opts.signal?.removeEventListener("abort", onExternalAbort);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Request failed");
}
