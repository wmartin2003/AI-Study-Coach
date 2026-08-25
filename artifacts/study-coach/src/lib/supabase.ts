import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!url) throw new Error("VITE_SUPABASE_URL is required but was not provided.");
if (!publishableKey) throw new Error("VITE_SUPABASE_PUBLISHABLE_KEY is required but was not provided.");

export const supabase = createClient(url, publishableKey);
