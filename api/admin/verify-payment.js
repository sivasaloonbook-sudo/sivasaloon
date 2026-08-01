const { supabaseAdmin } = require("../_lib/supabaseAdmin");
const { requireAdmin } = require("../_lib/auth");
const { notify } = require("../_lib/telegram");

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const admin = requireAdmin(req, res);
  if (!admin) return;

  const { bookingId, amount, method, referenceNumber } = req.body || {};
  if (!bookingId || !amount) return res.status(400).json({ error: "bookingId and amount are required." });

  const { data: payment, error: payErr } = await supabaseAdmin
    .from("payments")
    .insert({
      booking_id: bookingId,
      amount,
      method,
      reference_number: referenceNumber,
      status: "verified",
      verified_by: admin.adminId,
      verified_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (payErr) return res.status(500).json({ error: "Could not record payment." });

  await supabaseAdmin.from("bills").update({ payment_status: "paid" }).eq("booking_id", bookingId);

  const { data: booking } = await supabaseAdmin
    .from("bookings")
    .select("*, services(name)")
    .eq("id", bookingId)
    .single();

  await notify({
    bookingId,
    type: "payment_verified",
    message: `✅ <b>Payment Verified</b>\nService: ${booking?.services?.name}\nAmount: ₹${amount}\nMethod: ${method || "—"}`,
  });

  return res.status(200).json({ ok: true, payment });
};
