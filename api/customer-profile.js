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
    let { name, email, address, mobile, profile_photo_url } = req.body || {};

    // Strip any HTML tags and cap length on free-text fields — defense in
    // depth against stored XSS, on top of front-end escaping on display.
    const clean = (v, maxLen) =>
      typeof v === "string" ? v.replace(/<[^>]*>/g, "").trim().slice(0, maxLen) : v;
    name = clean(name, 100);
    email = clean(email, 150);
    address = clean(address, 300);

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: "Enter a valid email address." });
    }
    if (mobile && !/^\d{10}$/.test(mobile)) {
      return res.status(400).json({ error: "Enter a valid 10-digit mobile number." });
    }

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
