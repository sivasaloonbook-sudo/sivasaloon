const { supabaseAdmin } = require("./_lib/supabaseAdmin");
const { requireCustomer } = require("./_lib/auth");
const { notify } = require("./_lib/telegram");

async function applyCoupon(code, subtotal) {
  if (!code) return { discount: 0, coupon: null };

  const { data: coupon } = await supabaseAdmin
    .from("coupons")
    .select("*")
    .eq("code", code)
    .eq("is_active", true)
    .single();

  if (!coupon) return { discount: 0, coupon: null, error: "Invalid or expired coupon." };

  const today = new Date().toISOString().slice(0, 10);
  if (coupon.valid_from && today < coupon.valid_from) return { discount: 0, coupon: null, error: "Coupon not yet active." };
  if (coupon.valid_to && today > coupon.valid_to) return { discount: 0, coupon: null, error: "Coupon has expired." };
  if (coupon.usage_limit && coupon.times_used >= coupon.usage_limit) return { discount: 0, coupon: null, error: "Coupon usage limit reached." };

  let discount =
    coupon.discount_type === "percent" ? (subtotal * coupon.discount_value) / 100 : coupon.discount_value;
  if (coupon.max_discount) discount = Math.min(discount, coupon.max_discount);
  discount = Math.min(discount, subtotal);

  return { discount, coupon };
}

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const session = requireCustomer(req, res);
  if (!session) return;

  const { employeeId, serviceId, date, startTime, endTime, couponCode } = req.body || {};
  if (!employeeId || !serviceId || !date || !startTime || !endTime) {
    return res.status(400).json({ error: "Missing booking details." });
  }

  // Re-check the slot is still free (race-safety, on top of the unique
  // constraint on booking_slots and the .neq('status','cancelled') check).
  const { data: clash } = await supabaseAdmin
    .from("bookings")
    .select("id")
    .eq("employee_id", employeeId)
    .eq("booking_date", date)
    .eq("start_time", startTime)
    .neq("status", "cancelled")
    .maybeSingle();
  if (clash) return res.status(409).json({ error: "That slot was just booked. Pick another." });

  const { data: service, error: svcErr } = await supabaseAdmin
    .from("services")
    .select("*")
    .eq("id", serviceId)
    .single();
  if (svcErr || !service) return res.status(400).json({ error: "Invalid service." });

  const subtotal = Number(service.price);
  const { discount, coupon, error: couponError } = await applyCoupon(couponCode, subtotal);
  if (couponError) return res.status(400).json({ error: couponError });
  const total = subtotal - discount;

  const { data: booking, error: bookErr } = await supabaseAdmin
    .from("bookings")
    .insert({
      customer_id: session.customerId,
      employee_id: employeeId,
      service_id: serviceId,
      booking_date: date,
      start_time: startTime,
      end_time: endTime,
      status: "confirmed",
      coupon_id: coupon ? coupon.id : null,
      final_amount: total,
    })
    .select()
    .single();
  if (bookErr) {
    // Postgres unique_violation — another request won the same slot in the
    // gap between our pre-check above and this insert.
    if (bookErr.code === "23505") {
      return res.status(409).json({ error: "That slot was just booked. Pick another." });
    }
    return res.status(500).json({ error: "Could not create booking." });
  }

  const invoiceNumber = `SS-${Date.now()}`;
  await supabaseAdmin.from("bills").insert({
    booking_id: booking.id,
    invoice_number: invoiceNumber,
    subtotal,
    discount,
    total,
    payment_status: "unpaid",
  });

  if (coupon) {
    await supabaseAdmin.from("coupons").update({ times_used: coupon.times_used + 1 }).eq("id", coupon.id);
  }

  const { data: customer } = await supabaseAdmin
    .from("customers")
    .select("name, mobile")
    .eq("id", session.customerId)
    .single();

  await notify({
    bookingId: booking.id,
    type: "booking_created",
    message:
      `🪒 <b>New Booking</b>\n` +
      `Customer: ${customer?.name || "—"} (${customer?.mobile})\n` +
      `Service: ${service.name}\n` +
      `Date: ${date} · ${startTime}–${endTime}\n` +
      `Amount: ₹${total}`,
  });

  return res.status(200).json({ ok: true, booking });
};
