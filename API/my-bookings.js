const { supabaseAdmin } = require("./_lib/supabaseAdmin");
const { requireCustomer } = require("./_lib/auth");

module.exports = async (req, res) => {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const session = requireCustomer(req, res);
  if (!session) return;

  const { data, error } = await supabaseAdmin
    .from("bookings")
    .select("*, services(name, price), employees(name), bills(invoice_number, payment_status, total)")
    .eq("customer_id", session.customerId)
    .order("booking_date", { ascending: false })
    .order("start_time", { ascending: false });

  if (error) return res.status(500).json({ error: "Could not load bookings." });
  return res.status(200).json({ bookings: data });
};
