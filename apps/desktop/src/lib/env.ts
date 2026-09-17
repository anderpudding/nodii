const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? '';
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '';

export const env = {
  supabaseUrl,
  supabasePublishableKey,
  isSupabaseConfigured: supabaseUrl.length > 0 && supabasePublishableKey.length > 0,
} as const;
