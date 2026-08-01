const { supabaseAdmin } = require("./_lib/supabaseAdmin");
const { generateDaySlots } = require("./_lib/slotRules");

module.exports = async (req, res) => {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const date = req.query.date || new Date().toISOString().slice(0, 10);

  const { data: employees, error: empErr } = await supabaseAdmin
    .from("employees")
    .select("id, name")
    .eq("is_active", true);
  if (empErr) return res.status(500).json({ error: "Could not load employees." });

  const { data: bookings, error: bookErr } = await supabaseAdmin
    .from("bookings")
    .select("employee_id, start_time")
    .eq("booking_date", date)
    .neq("status", "cancelled");
  if (bookErr) return res.status(500).json({ error: "Could not load bookings." });

  const bookedKey = (employeeId, start) => `${employeeId}_${start}`;
  const bookedSet = new Set(bookings.map((b) => bookedKey(b.employee_id, b.start_time)));

  const grid = generateDaySlots();
  const result = [];
  for (const emp of employees) {
    for (const slot of grid) {
      result.push({
        employeeId: emp.id,
        employeeName: emp.name,
        start: slot.start,
        end: slot.end,
        booked: bookedSet.has(bookedKey(emp.id, slot.start)),
      });
    }
  }

  return res.status(200).json({ date, slots: result });
};
