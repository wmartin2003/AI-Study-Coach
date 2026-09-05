import { QueryCache, QueryClient } from "@tanstack/react-query";
import { ApiError } from "@workspace/api-client-react";
import { supabase } from "./supabase";

// A 401 from the API means the session Supabase handed us is no longer
// valid — the access token expired and either there was no refresh token to
// silently renew it, or the refresh itself was rejected (e.g. a project
// restart invalidated it). Rather than let every query on the page fail
// forever and show a generic "couldn't load" card in a loop, treat any 401
// as "signed out": clear the stale session and send the user back to login
// so they can pick up where they left off with a fresh one.
let handlingSessionExpiry = false;

function handleUnauthorized() {
  if (handlingSessionExpiry) return;
  handlingSessionExpiry = true;
  void supabase.auth.signOut().finally(() => {
    window.location.href = "/login";
  });
}

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => {
      if (error instanceof ApiError && error.status === 401) handleUnauthorized();
    },
  }),
  defaultOptions: {
    mutations: {
      onError: (error) => {
        if (error instanceof ApiError && error.status === 401) handleUnauthorized();
      },
    },
  },
});
