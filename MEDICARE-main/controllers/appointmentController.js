const Appointment = require('../models/Appointment');
const Doctor = require('../models/Doctor');
const { getRazorpayClient } = require('../services/razorpayService');

async function listDoctors(req, res, next) {
  try {
    const doctors = await Doctor.find({ status: 'approved' }).sort({ createdAt: -1 });
    res.render('appointmentpage', { doctors });
  } catch (error) {
    next(error);
  }
}

async function showBookingForm(req, res, next) {
  try {
    const doctor = await Doctor.findOne({ _id: req.params.id, status: 'approved' });
    if (!doctor) {
      req.flash('error', 'Doctor is not available for appointments.');
      return res.redirect('/appointment');
    }
    return res.render('bookDoctor', { doctor });
  } catch (error) {
    next(error);
  }
}

async function bookAppointment(req, res, next) {
  try {
    const {
      doctorId,
      patientName,
      patientEmail,
      appointmentDate,
      appointmentTime,
      appointmentNumber
    } = req.body;

    const doctor = await Doctor.findOne({ _id: doctorId, status: 'approved' });
    if (!doctor) {
      req.flash('error', 'This doctor is not approved for appointments.');
      return res.redirect('/appointment');
    }

    const consultationMinutes = 5;
    const amount = Number(doctor.price) * consultationMinutes;
    if (!amount || amount <= 0) {
      req.flash('error', 'Invalid consultation fee for selected doctor.');
      return res.redirect(`/book/${doctor._id}`);
    }

    const razorpay = getRazorpayClient();
    const order = await razorpay.orders.create({
      amount: Math.round(amount * 100),
      currency: 'INR',
      receipt: `appt_${Date.now()}`
    });

    const appointment = await Appointment.create({
      patientName,
      patientEmail,
      patientPhone: appointmentNumber,
      doctor: doctor._id,
      doctorName: doctor.name,
      doctorEmail: doctor.email,
      doctorSpecialization: doctor.specialization,
      date: appointmentDate,
      time: appointmentTime,
      paymentStatus: 'pending',
      appointmentStatus: 'pending_payment',
      orderId: order.id,
      amount
    });

    return res.render('payment', {
      appointment,
      doctor,
      order,
      razorpayKeyId: process.env.RAZORPAY_KEY_ID,
      amount
    });
  } catch (error) {
    next(error);
  }
}

async function myBookings(req, res, next) {
  try {
    const appointments = await Appointment.find({
      patientEmail: req.session.user.email
    }).sort({ createdAt: -1 });

    return res.render('myBookings', { appointments, user: req.session.user });
  } catch (error) {
    next(error);
  }
}

async function viewBooking(req, res, next) {
  try {
    const appointment = await Appointment.findOne({
      _id: req.params.id,
      patientEmail: req.session.user.email
    });

    if (!appointment) {
      req.flash('error', 'Booking not found for your patient account.');
      return res.redirect('/my-bookings');
    }

    return res.render('bookingDetails', { appointment });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listDoctors,
  showBookingForm,
  bookAppointment,
  myBookings,
  viewBooking
};
