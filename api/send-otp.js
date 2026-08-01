module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { mobile } = req.body || {};
  if (!mobile || !/^\d{10}$/.test(mobile)) {
    return res.status(400).json({ error: "Enter a valid 10-digit mobile number." });
  }

  const authkey = process.env.MSG91_AUTH_KEY;
  const templateId = process.env.MSG91_OTP_TEMPLATE_ID;
  const fullMobile = `91${mobile}`;

  try {
    const url = `https://control.msg91.com/api/v5/otp?template_id=${templateId}&mobile=${fullMobile}&authkey=${authkey}&otp_expiry=5`;
    const msgRes = await fetch(url, { method: "POST" });
    const data = await msgRes.json();

    if (data.type !== "success") {
      return res.status(502).json({ error: data.message || "Could not send OTP." });
    }
    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: "OTP service unreachable." });
  }
};
