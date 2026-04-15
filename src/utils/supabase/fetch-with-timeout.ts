/** Avoid hung requests when Supabase is unreachable (paused project, DNS, firewall). */
const DEFAULT_MS = 12_000;

export function createSupabaseFetch(timeoutMs = DEFAULT_MS) {
  return function supabaseFetch(
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const parent = init?.signal;
    if (parent) {
      if (parent.aborted) controller.abort();
      else
        parent.addEventListener("abort", () => controller.abort(), {
          once: true,
        });
    }

    return fetch(input, { ...init, signal: controller.signal }).finally(() =>
      clearTimeout(timer)
    );
  };
}

export const supabaseFetch = createSupabaseFetch();
