const { supabaseAdmin } = require("../_lib/supabaseAdmin");
const { requireAdmin } = require("../_lib/auth");
const { notify } = require("../_lib/telegram");

module.exports = async (req, res) => {
  if (!requireAdmin(req, res)) return;

  if (req.method === "GET") {
    const { date, status } = req.query;
    let query = supabaseAdmin
      .from("bookings")
      .select("*, customers(name, mobile), services(name, price), employees(name), bills(invoice_number, payment_status, total)")
      .order("booking_date", { ascending: false })
      .order("start_time", { ascending: false });

    if (date) query = query.eq("booking_date", date);
    if (status) query = query.eq("status", status);

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: "Could not load bookings." });
    return res.status(200).json({ bookings: data });
  }

  if (req.method === "POST") {
    // Admin updates a booking's status (confirm / complete / cancel).
    const { bookingId, status } = req.body || {};
    if (!bookingId || !status) return res.status(400).json({ error: "bookingId and status required." });

    const { data: booking, error } = await supabaseAdmin
      .from("bookings")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", bookingId)
      .select("*, services(name)")
      .single();
    if (error) return res.status(500).json({ error: "Could not update booking." });

    if (status === "cancelled") {
      await notify({
        bookingId,
        type: "booking_cancelled",
        message: `❌ <b>Booking Cancelled by Admin</b>\nService: ${booking.services?.name}\nDate: ${booking.booking_date} · ${booking.start_time}`,
      });
    }

    return res.status(200).json({ ok: true, booking });
  }

  return res.status(405).json({ error: "Method not allowed" });
};
