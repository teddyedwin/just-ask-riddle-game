const supabaseConfig = window.RIDDLE_SUPABASE_CONFIG;
const supabaseConfigured = Boolean(
  window.supabase
  && supabaseConfig
  && /^https:\/\/[^/]+\.supabase\.co$/.test(supabaseConfig.url)
  && supabaseConfig.anonKey
  && !supabaseConfig.anonKey.includes('YOUR_')
);

window.riddleSupabase = supabaseConfigured
  ? window.supabase.createClient(supabaseConfig.url, supabaseConfig.anonKey)
  : null;
