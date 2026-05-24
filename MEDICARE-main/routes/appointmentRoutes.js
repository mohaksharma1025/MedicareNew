const express = require('express');
const appointmentController = require('../controllers/appointmentController');
const { isPatient } = require('../middleware/auth');

const router = express.Router();

router.get('/appointment', appointmentController.listDoctors);
router.get('/book/:id', appointmentController.showBookingForm);
router.post('/book-appointment', appointmentController.bookAppointment);
router.get('/my-bookings', isPatient, appointmentController.myBookings);
router.get('/my-bookings/:id', isPatient, appointmentController.viewBooking);

module.exports = router;
