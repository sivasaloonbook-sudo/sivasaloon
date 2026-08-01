const { supabaseAdmin } = require("./_lib/supabaseAdmin");
const { setSessionCookie, COOKIE_CUSTOMER } = require("./_lib/auth");

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { mobile, otp } = req.body || {};
  if (!mobile || !otp) return res.status(400).json({ error: "Mobile and OTP are required." });

  const authkey = process.env.MSG91_AUTH_KEY;
  const fullMobile = `91${mobile}`;

  try {
    const url = `https://control.msg91.com/api/v5/otp/verify?otp=${otp}&mobile=${fullMobile}&authkey=${authkey}`;
    const msgRes = await fetch(url);
    const data = await msgRes.json();

    if (data.type !== "success") {
      return res.status(400).json({ error: data.message || "Invalid OTP." });
    }

    // OTP verified — upsert the customer row keyed by mobile.
    const { data: customer, error } = await supabaseAdmin
      .from("customers")
      .upsert({ mobile, otp_verified: true }, { onConflict: "mobile" })
      .select()
      .single();

    if (error) return res.status(500).json({ error: "Could not save customer record." });

    setSessionCookie(res, COOKIE_CUSTOMER, { customerId: customer.id, mobile });
    return res.status(200).json({ ok: true, customer });
  } catch (err) {
    return res.status(500).json({ error: "OTP service unreachable." });
  }
};
