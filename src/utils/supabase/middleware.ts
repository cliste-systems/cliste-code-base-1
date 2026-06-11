import { createServerClient } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";

import { supabaseFetch } from "./fetch-with-timeout";

export type MiddlewareSession = {
  response: NextResponse;
  user: User | null;
};

function nextResponseInit(
  request: NextRequest,
  forwardHeaders?: Headers,
) {
  if (!forwardHeaders) {
    return { request };
  }
  return { request: { headers: forwardHeaders } };
}

export async function updateSession(
  request: NextRequest,
  forwardHeaders?: Headers,
): Promise<MiddlewareSession> {
  const nextInit = nextResponseInit(request, forwardHeaders);
  let supabaseResponse = NextResponse.next(nextInit);
  let user: User | null = null;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) {
    console.error(
      "[middleware] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY — add them to .env.local in this project folder."
    );
    return { response: supabaseResponse, user };
  }

  const supabase = createServerClient(
    url,
    anonKey,
    {
      global: { fetch: supabaseFetch },
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next(nextInit);
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch (err) {
    console.error(
      "[middleware] Supabase getUser failed (timeout or network). Continuing without refreshing the session.",
      err
    );
  }

  return { response: supabaseResponse, user };
}
