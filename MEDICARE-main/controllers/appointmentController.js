const Appointment = require('../models/Appointment');
const Doctor = require('../models/Doctor');
const connectDB = require('../config/db');
const { getRazorpayClient } = require('../services/razorpayService');
const { isPastDateOnly, normalizeDateOnly } = require('../utils/dateFormat');

async function listDoctors(req, res, next) {
  return res.render('appointmentpage', { doctors: [], directoryError: null });
}

async function apiListDoctors(req, res) {
  try {
    await connectDB();
    const doctors = await Doctor.find({ status: 'approved' })
      .sort({ createdAt: -1 })
      .maxTimeMS(5000)
      .lean();

    return res.json({
      success: true,
      doctors: doctors.map((doctor) => ({
        _id: doctor._id.toString(),
        name: doctor.name,
        degree: doctor.degree,
        specialization: doctor.specialization,
        experience: doctor.experience,
        price: doctor.price,
        image: doctor.image || '/uploads/home-doctor-male.jpg',
        availableDays: doctor.availableDays || []
      }))
    });
  } catch (error) {
    console.error('Doctor directory error:', error.message);
    return res.status(503).json({
      success: false,
      message: 'Doctor list is temporarily unavailable. Check the MongoDB connection in Vercel, then refresh this page.'
    });
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
    const normalizedAppointmentDate = normalizeDateOnly(appointmentDate);

    if (!normalizedAppointmentDate) {
      req.flash('error', 'Please select a valid appointment date.');
      return res.redirect(`/book/${doctorId}`);
    }

    if (isPastDateOnly(normalizedAppointmentDate)) {
      req.flash('error', 'Please select today or a future appointment date.');
      return res.redirect(`/book/${doctorId}`);
    }

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
      date: normalizedAppointmentDate,
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
  apiListDoctors,
  showBookingForm,
  bookAppointment,
  myBookings,
  viewBooking
};
