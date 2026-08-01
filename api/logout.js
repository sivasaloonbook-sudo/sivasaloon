const { clearSessionCookie, COOKIE_CUSTOMER, COOKIE_ADMIN } = require("./_lib/auth");

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  clearSessionCookie(res, COOKIE_CUSTOMER);
  clearSessionCookie(res, COOKIE_ADMIN);
  return res.status(200).json({ ok: true });
};
