require('dotenv').config();

const express = require('express');
const session = require('express-session');
const path = require('path');
const connectDB = require('./config/db');
const flashMiddleware = require('./middleware/flash');

const pageRoutes = require('./routes/pageRoutes');
const authRoutes = require('./routes/authRoutes');
const doctorRoutes = require('./routes/doctorRoutes');
const appointmentRoutes = require('./routes/appointmentRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: process.env.SESSION_SECRET || 'medicare-secret-key',
  resave: false,
  saveUninitialized: false
}));

app.use(flashMiddleware);

app.use((req, res, next) => {
  res.locals.currentUser = req.session.user || null;
  res.locals.currentDoctor = req.session.doctor || null;
  res.locals.isAdmin = Boolean(req.session.isAdmin);
  next();
});

app.use(async (req, res, next) => {
  const dbFreeAnyMethodRoutes = new Set([
    '/api/doctors',
    '/admin/login',
    '/chat',
    '/test'
  ]);

  const dbFreeGetRoutes = new Set([
    '/',
    '/appointment',
    '/appointments',
    '/find-doctors',
    '/admin/login',
    '/login',
    '/signup',
    '/doctor/login',
    '/doctor/register',
    '/contact',
    '/services',
    '/about',
    '/donate',
    '/logout',
    '/doctor/logout',
    '/admin/logout'
  ]);

  if (dbFreeAnyMethodRoutes.has(req.path) || (req.method === 'GET' && dbFreeGetRoutes.has(req.path))) {
    return next();
  }

  try {
    await connectDB();
    return next();
  } catch (error) {
    return next(error);
  }
});

app.use('/', pageRoutes);
app.use('/', authRoutes);
app.use('/', doctorRoutes);
app.use('/', appointmentRoutes);
app.use('/payments', paymentRoutes);
app.use('/admin', adminRoutes);

app.use((req, res) => {
  res.status(404).send('Page not found');
});

app.use((err, req, res, next) => {
  console.error(err);
  if (req.path.startsWith('/payments') || req.xhr || req.headers.accept === 'application/json') {
    return res.status(err.status || 500).json({
      success: false,
      message: err.message || 'Something went wrong'
    });
  }

  req.flash('error', err.message || 'Something went wrong');
  res.status(err.status || 500).redirect(req.get('Referrer') || '/');
});

const PORT = process.env.PORT || 4000;
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

module.exports = app;
