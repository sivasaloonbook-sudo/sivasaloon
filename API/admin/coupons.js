const { supabaseAdmin } = require("../_lib/supabaseAdmin");
const { requireAdmin } = require("../_lib/auth");

module.exports = async (req, res) => {
  if (!requireAdmin(req, res)) return;

  if (req.method === "GET") {
    const { data, error } = await supabaseAdmin.from("coupons").select("*").order("created_at", { ascending: false });
    if (error) return res.status(500).json({ error: "Could not load coupons." });
    return res.status(200).json({ coupons: data });
  }

  if (req.method === "POST") {
    const { code, discount_type, discount_value, max_discount, valid_from, valid_to, usage_limit } = req.body || {};
    if (!code || !discount_type || !discount_value) {
      return res.status(400).json({ error: "code, discount_type and discount_value are required." });
    }
    const { data, error } = await supabaseAdmin
      .from("coupons")
      .insert({ code, discount_type, discount_value, max_discount, valid_from, valid_to, usage_limit })
      .select()
      .single();
    if (error) return res.status(500).json({ error: "Could not create coupon (code may already exist)." });
    return res.status(200).json({ ok: true, coupon: data });
  }

  if (req.method === "PATCH") {
    const { couponId, is_active } = req.body || {};
    if (!couponId || typeof is_active !== "boolean") {
      return res.status(400).json({ error: "couponId and is_active are required." });
    }
    const { data, error } = await supabaseAdmin
      .from("coupons")
      .update({ is_active })
      .eq("id", couponId)
      .select()
      .single();
    if (error) return res.status(500).json({ error: "Could not update coupon." });
    return res.status(200).json({ ok: true, coupon: data });
  }

  return res.status(405).json({ error: "Method not allowed" });
};
