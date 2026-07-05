// Modern browsers send `Sec-Fetch-Site` on nearly all requests. For an API
// that is only ever meant to be called from our own frontend (same origin,
// cookie-based sessions, no CORS headers issued), a cross-site value here
// means either a foreign page or a foreign tab is making the request — which
// legitimate use of this app never does. This is a defense-in-depth layer on
// top of SameSite=Lax cookies and the absence of any CORS allow-list.
export function sameOriginOnly(req, res, next) {
  const site = req.get('sec-fetch-site');
  // Missing header = older browser or a non-browser client (curl, mobile
  // webview); we don't block those since SameSite cookies already protect us.
  if (site && site !== 'same-origin' && site !== 'none') {
    return res.status(403).json({ error: 'Cross-site request blocked.' });
  }
  next();
}
