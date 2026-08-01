const { supabaseAdmin } = require("../_lib/supabaseAdmin");
const { requireAdmin } = require("../_lib/auth");
const { notify } = require("../_lib/telegram");

// Consolidates what used to be 7 separate files (stats, bookings, customers,
// employees, coupons, verify-payment, reports) into one Serverless Function,
// dispatched by the [resource] URL segment — Vercel's Hobby plan caps a
// deployment at 12 functions, so this keeps the api/ directory well under
// that limit. URLs are unchanged: /api/admin/bookings still works exactly
// as before, now routed through this file instead of admin/bookings.js.

module.exports = async (req, res) => {
  const admin = requireAdmin(req, res);
  if (!admin) return;

  const { resource } = req.query;

  try {
    switch (resource) {
      case "stats":
        return await handleStats(req, res);
      case "bookings":
        return await handleBookings(req, res, admin);
      case "customers":
        return await handleCustomers(req, res);
      case "employees":
        return await handleEmployees(req, res);
      case "coupons":
        return await handleCoupons(req, res);
      case "verify-payment":
        return await handleVerifyPayment(req, res, admin);
      case "reports":
        return await handleReports(req, res);
      default:
        return res.status(404).json({ error: "Unknown admin resource." });
    }
  } catch (err) {
    return res.status(500).json({ error: "Unexpected server error." });
  }
};

// ---------------- stats ----------------
async function handleStats(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

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
}

// ---------------- bookings ----------------
async function handleBookings(req, res, admin) {
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
}

// ---------------- customers ----------------
async function handleCustomers(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const { search } = req.query;
  let query = supabaseAdmin.from("customers").select("*").order("created_at", { ascending: false });
  if (search) query = query.or(`name.ilike.%${search}%,mobile.ilike.%${search}%,email.ilike.%${search}%`);

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: "Could not load customers." });
  return res.status(200).json({ customers: data });
}

// ---------------- employees ----------------
async function handleEmployees(req, res) {
  if (req.method === "GET") {
    const { data, error } = await supabaseAdmin.from("employees").select("*").order("created_at", { ascending: false });
    if (error) return res.status(500).json({ error: "Could not load employees." });
    return res.status(200).json({ employees: data });
  }

  if (req.method === "POST") {
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
}

// ---------------- coupons ----------------
async function handleCoupons(req, res) {
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
}

// ---------------- verify-payment ----------------
async function handleVerifyPayment(req, res, admin) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

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
}

// ---------------- reports ----------------
async function handleReports(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const range = req.query.range || "7d";
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
}
