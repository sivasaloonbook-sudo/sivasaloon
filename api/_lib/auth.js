const jwt = require("jsonwebtoken");
const cookie = require("cookie");

const COOKIE_CUSTOMER = "siva_customer";
const COOKIE_ADMIN = "siva_admin";
const SESSION_DAYS = 30;

function sign(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: `${SESSION_DAYS}d` });
}

function verify(token) {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return null;
  }
}

function setSessionCookie(res, name, payload) {
  const token = sign(payload);
  res.setHeader(
    "Set-Cookie",
    cookie.serialize(name, token, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * SESSION_DAYS,
    })
  );
}

function clearSessionCookie(res, name) {
  res.setHeader(
    "Set-Cookie",
    cookie.serialize(name, "", { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 0 })
  );
}

function getSession(req, name) {
  const cookies = cookie.parse(req.headers.cookie || "");
  const token = cookies[name];
  if (!token) return null;
  return verify(token);
}

function requireCustomer(req, res) {
  const session = getSession(req, COOKIE_CUSTOMER);
  if (!session) {
    res.status(401).json({ error: "Not logged in." });
    return null;
  }
  return session; // { customerId, mobile }
}

function requireAdmin(req, res) {
  const session = getSession(req, COOKIE_ADMIN);
  if (!session) {
    res.status(401).json({ error: "Not logged in." });
    return null;
  }
  return session; // { adminId, username, role }
}

module.exports = {
  COOKIE_CUSTOMER,
  COOKIE_ADMIN,
  setSessionCookie,
  clearSessionCookie,
  requireCustomer,
  requireAdmin,
};
