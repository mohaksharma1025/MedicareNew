const express = require('express');
const appointmentController = require('../controllers/appointmentController');
const { isPatient } = require('../middleware/auth');

const router = express.Router();

router.get('/api/doctors', appointmentController.apiListDoctors);
router.get(['/appointment', '/appointments', '/find-doctors'], appointmentController.listDoctors);
router.get('/book/:id', appointmentController.showBookingForm);
router.post('/book-appointment', appointmentController.bookAppointment);
router.get('/my-bookings', isPatient, appointmentController.myBookings);
router.get('/my-bookings/:id', isPatient, appointmentController.viewBooking);

module.exports = router;
