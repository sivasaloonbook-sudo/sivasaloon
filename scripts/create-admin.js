// Run once, locally (not deployed): creates or resets an admin account.
//
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
//   node scripts/create-admin.js <username> <password>
//
// This talks directly to Supabase with the service-role key, so run it
// from your own machine — never expose this script or its env vars to
// the browser.

const { createClient } = require("@supabase/supabase-js");
const bcrypt = require("bcryptjs");

const [, , username, password] = process.argv;

if (!username || !password) {
  console.error("Usage: node scripts/create-admin.js <username> <password>");
  process.exit(1);
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  const password_hash = await bcrypt.hash(password, 10);
  const { data, error } = await supabase
    .from("admins")
    .upsert({ username, password_hash, role: "admin" }, { onConflict: "username" })
    .select()
    .single();

  if (error) {
    console.error("Failed:", error.message);
    process.exit(1);
  }
  console.log(`Admin "${data.username}" is ready. You can log in at /admin/index.html`);
})();
