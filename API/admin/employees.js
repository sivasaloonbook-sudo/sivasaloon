const { supabaseAdmin } = require("../_lib/supabaseAdmin");
const { requireAdmin } = require("../_lib/auth");

module.exports = async (req, res) => {
  if (!requireAdmin(req, res)) return;

  if (req.method === "GET") {
    const { data, error } = await supabaseAdmin.from("employees").select("*").order("created_at", { ascending: false });
    if (error) return res.status(500).json({ error: "Could not load employees." });
    return res.status(200).json({ employees: data });
  }

  if (req.method === "POST") {
    // Adding an active employee automatically increases slot capacity —
    // no extra step needed, since /api/slots.js recomputes the grid per
    // active employee on every request.
    const { name, mobile } = req.body || {};
    if (!name) return res.status(400).json({ error: "Employee name is required." });

    const { data, error } = await supabaseAdmin.from("employees").insert({ name, mobile }).select().single();
    if (error) return res.status(500).json({ error: "Could not add employee." });
    return res.status(200).json({ ok: true, employee: data });
  }

  if (req.method === "PATCH") {
    const { employeeId, is_active } = req.body || {};
    if (!employeeId || typeof is_active !== "boolean") {
      return res.status(400).json({ error: "employeeId and is_active are required." });
    }
    const { data, error } = await supabaseAdmin
      .from("employees")
      .update({ is_active })
      .eq("id", employeeId)
      .select()
      .single();
    if (error) return res.status(500).json({ error: "Could not update employee." });
    return res.status(200).json({ ok: true, employee: data });
  }

  return res.status(405).json({ error: "Method not allowed" });
};
