const Contact = require('../models/Contact');

function home(req, res) {
  res.render('home', { user: req.session.user });
}

function renderPage(view) {
  return (req, res) => res.render(view);
}

async function submitContact(req, res, next) {
  try {
    const { name, email, subject, message } = req.body;
    await Contact.create({ name, email, subject, message });
    req.flash('success', 'Your message has been sent successfully.');
    res.redirect('/');
  } catch (error) {
    next(error);
  }
}

function chat(req, res) {
  const userMessage = (req.body.message || '').toLowerCase();
  const user = req.session.user;
  let botReply = "Sorry, I didn't understand that.";

  if (userMessage.includes('hello') || userMessage.includes('hi')) {
    botReply = user ? `Hello ${user.name}! How can I assist you today?` : 'Hello! How can I assist you today?';
  } else if (userMessage.includes('book') || userMessage.includes('appointment')) {
    botReply = user ? 'You can book an appointment here: /appointment.' : 'Please log in to book an appointment: /login';
  } else if (userMessage.includes('doctor') || userMessage.includes('specialist')) {
    botReply = 'We have specialists in cardiology, dermatology, dentistry, and more!';
  } else if (userMessage.includes('pharmacy') || userMessage.includes('medicine')) {
    botReply = 'Our pharmacy is available for your needs. Check the services section!';
  } else if (userMessage.includes('donate') || userMessage.includes('donation')) {
    botReply = 'You can donate here: /donate. Thank you!';
  } else if (userMessage.includes('services')) {
    botReply = 'We offer doctor appointments, pharmacy services, and donation options.';
  } else if (userMessage.includes('thanks') || userMessage.includes('thank you')) {
    botReply = "You're welcome!";
  }

  res.json({ reply: botReply });
}

module.exports = {
  home,
  renderPage,
  submitContact,
  chat
};
