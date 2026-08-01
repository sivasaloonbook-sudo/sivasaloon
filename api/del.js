const bcrypt = require("bcryptjs");
const { supabaseAdmin } = require("./_lib/supabaseAdmin");
const { setSessionCookie, COOKIE_ADMIN } = require("./_lib/auth");

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

  const valid = await bcrypt.compare(password, admin.password_hash);
  if (!valid) return res.status(401).json({ error: "Invalid credentials." });

  setSessionCookie(res, COOKIE_ADMIN, { adminId: admin.id, username: admin.username, role: admin.role });
  return res.status(200).json({ ok: true, admin: { id: admin.id, username: admin.username, role: admin.role } });
};
