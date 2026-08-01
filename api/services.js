const { supabaseAdmin } = require("./_lib/supabaseAdmin");

module.exports = async (req, res) => {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const { data, error } = await supabaseAdmin
    .from("services")
    .select("*")
    .eq("is_active", true)
    .order("price", { ascending: true });

  if (error) return res.status(500).json({ error: "Could not load services." });
  return res.status(200).json({ services: data });
};
