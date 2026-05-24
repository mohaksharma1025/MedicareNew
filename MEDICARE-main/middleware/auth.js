function isAdmin(req, res, next) {
  if (req.session.isAdmin) return next();
  req.flash('error', 'Please login as admin to continue.');
  return res.redirect('/admin/login');
}

function isPatient(req, res, next) {
  if (req.session.user) return next();
  req.flash('error', 'Please login to continue.');
  return res.redirect('/login');
}

function isDoctor(req, res, next) {
  if (req.session.doctor) return next();
  req.flash('error', 'Please login as doctor to continue.');
  return res.redirect('/doctor/login');
}

module.exports = {
  isAdmin,
  isPatient,
  isDoctor
};
