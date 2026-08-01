const SHOP_OPEN = "10:00";
const SHOP_CLOSE = "21:00";
const LUNCH_START = "13:00";
const LUNCH_END = "13:30";
const SLOT_MINUTES = 20;

function toMinutes(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}
function toHHMM(mins) {
  const h = Math.floor(mins / 60).toString().padStart(2, "0");
  const m = (mins % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

// One day's time grid — same for every chair.
function generateDaySlots() {
  const open = toMinutes(SHOP_OPEN);
  const close = toMinutes(SHOP_CLOSE);
  const lunchStart = toMinutes(LUNCH_START);
  const lunchEnd = toMinutes(LUNCH_END);

  const slots = [];
  for (let t = open; t + SLOT_MINUTES <= close; t += SLOT_MINUTES) {
    const slotEnd = t + SLOT_MINUTES;
    if (t < lunchEnd && slotEnd > lunchStart) continue;
    slots.push({ start: toHHMM(t), end: toHHMM(slotEnd) });
  }
  return slots;
}

module.exports = { generateDaySlots, SLOT_MINUTES };
