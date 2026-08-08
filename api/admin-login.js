const bcrypt = require("bcryptjs");
const { supabaseAdmin } = require("./_lib/supabaseAdmin");
const { setSessionCookie, COOKIE_ADMIN } = require("./_lib/auth");

const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: "Username and password required." });

  const { data: admin, error } = await supabaseAdmin
    .from("admins")
    .select("*")
    .eq("username", username)
    .single();

  if (error || !admin) return res.status(401).json({ error: "Invalid credentials." });

  if (admin.locked_until && new Date(admin.locked_until) > new Date()) {
    return res.status(429).json({ error: "Too many failed attempts. Try again later." });
  }

  const valid = await bcrypt.compare(password, admin.password_hash);
  if (!valid) {
    const attempts = (admin.failed_attempts || 0) + 1;
    const update = { failed_attempts: attempts };
    if (attempts >= MAX_ATTEMPTS) {
      update.locked_until = new Date(Date.now() + LOCK_MINUTES * 60 * 1000).toISOString();
      update.failed_attempts = 0;
    }
    await supabaseAdmin.from("admins").update(update).eq("id", admin.id);
    return res.status(401).json({ error: "Invalid credentials." });
  }

  if (admin.failed_attempts || admin.locked_until) {
    await supabaseAdmin.from("admins").update({ failed_attempts: 0, locked_until: null }).eq("id", admin.id);
  }

  setSessionCookie(res, COOKIE_ADMIN, { adminId: admin.id, username: admin.username, role: admin.role });
  return res.status(200).json({ ok: true, admin: { id: admin.id, username: admin.username, role: admin.role } });
};
