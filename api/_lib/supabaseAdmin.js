const { createClient } = require("@supabase/supabase-js");

// Service-role client — only ever used server-side (in /api functions).
// Bypasses RLS, so keep SUPABASE_SERVICE_ROLE_KEY out of any browser-facing file.
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

module.exports = { supabaseAdmin };
