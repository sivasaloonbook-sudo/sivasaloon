// Shared front-end utilities.

// Escapes text before it's inserted into innerHTML template literals,
// so customer-supplied data (name, email, address, etc.) can never be
// interpreted as HTML/script by the browser.
function escapeHtml(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
