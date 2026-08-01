const { supabaseAdmin } = require("./_lib/supabaseAdmin");
const { requireCustomer } = require("./_lib/auth");
const { notify } = require("./_lib/telegram");

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const session = requireCustomer(req, res);
  if (!session) return;

  const { bookingId } = req.body || {};
  if (!bookingId) return res.status(400).json({ error: "bookingId is required." });

  const { data: booking, error: fetchErr } = await supabaseAdmin
    .from("bookings")
    .select("*, services(name)")
    .eq("id", bookingId)
    .eq("customer_id", session.customerId)
    .single();
  if (fetchErr || !booking) return res.status(404).json({ error: "Booking not found." });

  const { error: updateErr } = await supabaseAdmin
    .from("bookings")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", bookingId);
  if (updateErr) return res.status(500).json({ error: "Could not cancel booking." });

  await notify({
    bookingId,
    type: "booking_cancelled",
    message: `❌ <b>Booking Cancelled</b>\nService: ${booking.services?.name}\nDate: ${booking.booking_date} · ${booking.start_time}`,
  });

  return res.status(200).json({ ok: true });
};
