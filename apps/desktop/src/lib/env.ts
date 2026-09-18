const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? '';
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '';

export const env = {
  reviewAccountEmail: import.meta.env.VITE_REVIEW_ACCOUNT_EMAIL ?? '',
  appStoreId: (import.meta.env.VITE_APP_STORE_ID ?? '').trim(),
  supabaseUrl,
  supabasePublishableKey,
  isSupabaseConfigured: supabaseUrl.length > 0 && supabasePublishableKey.length > 0,
} as const;
