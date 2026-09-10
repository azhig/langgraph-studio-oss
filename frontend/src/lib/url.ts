/**
 * UI state in the address bar — as in the reference: `assistantId`, `mode`
 * and `threadId` live in the query, so a link to a thread can be shared.
 * Writes go through `replaceState`: the browser history is not polluted.
 */

export type UrlParam = "assistantId" | "mode" | "threadId";

export function readParam(name: UrlParam): string | null {
  return new URLSearchParams(window.location.search).get(name);
}

/** `null` removes the parameter. */
export function writeParams(patch: Partial<Record<UrlParam, string | null>>): void {
  const url = new URL(window.location.href);
  for (const [name, value] of Object.entries(patch)) {
    if (value === null || value === undefined) url.searchParams.delete(name);
    else url.searchParams.set(name, value);
  }
  window.history.replaceState(null, "", url);
}
