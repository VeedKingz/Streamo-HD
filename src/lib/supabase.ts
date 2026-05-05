import { createClient } from '@supabase/supabase-js';

// Function to get credentials from env or local storage
export const getSupabaseConfig = () => {
  // Use try-catch to handle potential environment access issues
  try {
    const url = import.meta.env.VITE_SUPABASE_URL || localStorage.getItem('supabase_url');
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY || localStorage.getItem('supabase_anon_key');
    return { url: url?.trim(), key: key?.trim() };
  } catch (e) {
    return { url: null, key: null };
  }
};

const config = getSupabaseConfig();

// If missing credentials, use a non-existent but valid-looking URL to avoid immediate crash
const finalUrl = config.url || 'https://placeholder.supabase.co';
const finalKey = config.key || 'placeholder';

export const supabase = createClient(finalUrl, finalKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
    // Disable multi-tab session sync if it's causing "stolen lock" issues in this environment
    storageKey: 'streamo_hd_session'
  }
});

// Helper to check if configuration is missing or placeholder
export const isSupabaseConfigured = () => {
  const { url, key } = getSupabaseConfig();
  return (
    !!url && 
    !!key && 
    url !== 'https://placeholder.supabase.co' && 
    url.startsWith('https://')
  );
};
