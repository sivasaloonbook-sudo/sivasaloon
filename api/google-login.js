const { supabaseAdmin } = require("./_lib/supabaseAdmin");
const { setSessionCookie, COOKIE_CUSTOMER } = require("./_lib/auth");

// Verifies the ID token Google's "Sign in with Google" button hands us,
// using Google's own tokeninfo endpoint — no extra library needed.
// This confirms the token is genuine and reads who it belongs to.
module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { credential } = req.body || {};
  if (!credential) return res.status(400).json({ error: "Missing Google credential." });

  try {
    const verifyRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${credential}`);
    const payload = await verifyRes.json();

    if (!verifyRes.ok || payload.aud !== process.env.GOOGLE_CLIENT_ID) {
      return res.status(401).json({ error: "Invalid Google sign-in." });
    }

    const googleId = payload.sub;
    const email = payload.email;
    const name = payload.name;
    const picture = payload.picture;

    const { data: customer, error } = await supabaseAdmin
      .from("customers")
      .upsert(
        { google_id: googleId, email, name, profile_photo_url: picture },
        { onConflict: "google_id" }
      )
      .select()
      .single();

    if (error) return res.status(500).json({ error: "Could not save customer record." });

    setSessionCookie(res, COOKIE_CUSTOMER, { customerId: customer.id, email });
    return res.status(200).json({ ok: true, customer });
  } catch (err) {
    return res.status(500).json({ error: "Google sign-in verification failed." });
  }
};
