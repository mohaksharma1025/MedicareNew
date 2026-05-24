const bcrypt = require('bcryptjs');
const User = require('../models/user');

function showSignup(req, res) {
  res.render('signup');
}

function showLogin(req, res) {
  res.render('login');
}

async function signup(req, res, next) {
  try {
    const { name, email, password, age, gender } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    await User.create({ name, email, password: hashedPassword, age, gender });
    req.flash('success', 'Account created successfully. Please login.');
    res.redirect('/login');
  } catch (error) {
    next(error);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      req.flash('error', 'User not found.');
      return res.redirect('/login');
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      req.flash('error', 'Invalid credentials.');
      return res.redirect('/login');
    }

    req.session.user = user;
    req.flash('success', 'Logged in successfully.');
    return res.redirect('/logindone');
  } catch (error) {
    next(error);
  }
}

function logout(req, res) {
  req.session.user = null;
  req.flash('success', 'Logged out successfully.');
  res.redirect('/');
}

function loginDone(req, res) {
  if (!req.session.user) return res.redirect('/login');
  return res.render('logindone', { user: req.session.user });
}

module.exports = {
  showSignup,
  showLogin,
  signup,
  login,
  logout,
  loginDone
};
