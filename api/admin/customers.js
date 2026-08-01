const { supabaseAdmin } = require("../_lib/supabaseAdmin");
const { requireAdmin } = require("../_lib/auth");

module.exports = async (req, res) => {
  if (!requireAdmin(req, res)) return;

  if (req.method === "GET") {
    const { search } = req.query;
    let query = supabaseAdmin.from("customers").select("*").order("created_at", { ascending: false });
    if (search) query = query.or(`name.ilike.%${search}%,mobile.ilike.%${search}%,email.ilike.%${search}%`);

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: "Could not load customers." });
    return res.status(200).json({ customers: data });
  }

  return res.status(405).json({ error: "Method not allowed" });
};
