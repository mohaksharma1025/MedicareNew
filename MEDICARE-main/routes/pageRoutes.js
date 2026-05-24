const express = require('express');
const pageController = require('../controllers/pageController');

const router = express.Router();

router.get('/', pageController.home);
router.get('/about', pageController.renderPage('about'));
router.get('/services', pageController.renderPage('services'));
router.get('/donate', pageController.renderPage('donation'));
router.get('/contact', pageController.renderPage('Contact'));
router.post('/contact', pageController.submitContact);
router.get('/test', (req, res) => res.send('Test route is working!'));
router.post('/chat', pageController.chat);

module.exports = router;
