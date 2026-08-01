const { supabaseAdmin } = require("./supabaseAdmin");

async function sendTelegram(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return { ok: false, error: "Telegram not configured" };

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  });
  return res.json();
}

// Sends the message AND logs it to `notifications` for audit/debugging.
async function notify({ bookingId, type, message }) {
  const result = await sendTelegram(message);
  await supabaseAdmin.from("notifications").insert({
    booking_id: bookingId || null,
    type,
    message,
    sent_successfully: !!result.ok,
  });
  return result;
}

module.exports = { sendTelegram, notify };
