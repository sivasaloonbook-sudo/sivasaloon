const { supabaseAdmin } = require("../_lib/supabaseAdmin");
const { requireAdmin } = require("../_lib/auth");

module.exports = async (req, res) => {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  if (!requireAdmin(req, res)) return;

  const range = req.query.range || "7d"; // 7d | 30d | 90d
  const days = { "7d": 7, "30d": 30, "90d": 90 }[range] || 7;

  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceStr = since.toISOString().slice(0, 10);

  const { data: bookings, error } = await supabaseAdmin
    .from("bookings")
    .select("booking_date, final_amount, status")
    .gte("booking_date", sinceStr)
    .neq("status", "cancelled");
  if (error) return res.status(500).json({ error: "Could not load report data." });

  const byDate = {};
  for (const b of bookings) {
    byDate[b.booking_date] = byDate[b.booking_date] || { date: b.booking_date, bookings: 0, revenue: 0 };
    byDate[b.booking_date].bookings += 1;
    byDate[b.booking_date].revenue += Number(b.final_amount || 0);
  }

  const series = Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
  const totalRevenue = series.reduce((sum, d) => sum + d.revenue, 0);
  const totalBookings = series.reduce((sum, d) => sum + d.bookings, 0);

  return res.status(200).json({ range, series, totalRevenue, totalBookings });
};
