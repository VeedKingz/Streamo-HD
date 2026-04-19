import { createClient } from '@supabase/supabase-js';

// Function to get credentials from env or local storage
export const getSupabaseConfig = () => {
  const url = import.meta.env.VITE_SUPABASE_URL || localStorage.getItem('supabase_url');
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY || localStorage.getItem('supabase_anon_key');
  return { url, key };
};

const { url, key } = getSupabaseConfig();

export const supabase = createClient(
  url || 'https://placeholder-project.supabase.co',
  key || 'placeholder-anon-key'
);
