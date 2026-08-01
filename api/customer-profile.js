const { supabaseAdmin } = require("./_lib/supabaseAdmin");
const { requireCustomer } = require("./_lib/auth");

module.exports = async (req, res) => {
  const session = requireCustomer(req, res);
  if (!session) return;

  if (req.method === "GET") {
    const { data, error } = await supabaseAdmin
      .from("customers")
      .select("*")
      .eq("id", session.customerId)
      .single();
    if (error) return res.status(500).json({ error: "Could not load profile." });
    return res.status(200).json({ customer: data });
  }

  if (req.method === "POST") {
    const { name, email, address, mobile, profile_photo_url } = req.body || {};
    const { data, error } = await supabaseAdmin
      .from("customers")
      .update({ name, email, address, mobile, profile_photo_url, updated_at: new Date().toISOString() })
      .eq("id", session.customerId)
      .select()
      .single();
    if (error) return res.status(500).json({ error: "Could not update profile." });
    return res.status(200).json({ customer: data });
  }

  return res.status(405).json({ error: "Method not allowed" });
};
