const express = require('express');
const paymentController = require('../controllers/paymentController');

const router = express.Router();

router.post('/create-order', paymentController.createOrder);
router.post('/verify', paymentController.verifyPayment);
router.post('/failed', paymentController.markFailed);
router.get('/success/:id', paymentController.showSuccess);
router.get('/receipt/:id', paymentController.downloadReceipt);

module.exports = router;
