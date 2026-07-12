// Modern browsers send `Sec-Fetch-Site` on nearly all requests. For an API
// that is only ever meant to be called from our own frontend (same origin,
// cookie-based sessions, no CORS headers issued), a cross-site value here
// means either a foreign page or a foreign tab is making the request — which
// legitimate use of this app never does. This is a defense-in-depth layer on
// top of SameSite=Lax cookies and the absence of any CORS allow-list.
//
// NOTE: When running inside an iframe (like the AI Studio builder preview),
// the browser may report "cross-site" even though the request originates from
// our own frontend on the same host. We fall back to validating that the Origin
// or Referer header matches the current Host to allow preview environments to function.
export function sameOriginOnly(req, res, next) {
  const site = req.get('sec-fetch-site');
  // Missing header = older browser or a non-browser client (curl, mobile
  // webview); we don't block those since SameSite cookies already protect us.
  if (site && site !== 'same-origin' && site !== 'none') {
    const host = req.headers.host;
    const origin = req.get('origin');
    const referer = req.get('referer');

    let isSameHost = false;
    if (origin) {
      try {
        const originUrl = new URL(origin);
        if (originUrl.host === host) {
          isSameHost = true;
        }
      } catch (_) {}
    }
    if (!isSameHost && referer) {
      try {
        const refererUrl = new URL(referer);
        if (refererUrl.host === host) {
          isSameHost = true;
        }
      } catch (_) {}
    }

    if (!isSameHost) {
      return res.status(403).json({ error: 'Cross-site request blocked.' });
    }
  }
  next();
}
