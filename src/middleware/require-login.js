export function requireLogin(req, res, next) {
  if (!req.session.user) {
    req.session.alert = '🚫 You must be logged in.';
    return res.redirect('/login');
  }
  next();
}
