const { supabaseAdmin } = require("../_lib/supabaseAdmin");
const { requireAdmin } = require("../_lib/auth");

module.exports = async (req, res) => {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  if (!requireAdmin(req, res)) return;

  const today = new Date().toISOString().slice(0, 10);

  const { count: todaysBookings } = await supabaseAdmin
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("booking_date", today)
    .neq("status", "cancelled");

  const { data: paidToday } = await supabaseAdmin
    .from("bills")
    .select("total, created_at")
    .eq("payment_status", "paid")
    .gte("created_at", `${today}T00:00:00`)
    .lte("created_at", `${today}T23:59:59`);

  const revenueToday = (paidToday || []).reduce((sum, b) => sum + Number(b.total), 0);

  const { count: pendingPayments } = await supabaseAdmin
    .from("payments")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");

  return res.status(200).json({
    todaysBookings: todaysBookings || 0,
    revenueToday,
    pendingPayments: pendingPayments || 0,
  });
};
