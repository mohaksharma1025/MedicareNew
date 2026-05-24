const crypto = require('crypto');
const Appointment = require('../models/Appointment');
const Doctor = require('../models/Doctor');
const { getRazorpayClient } = require('../services/razorpayService');
const {
  sendPatientAppointmentConfirmation,
  sendDoctorPaidAppointmentNotification
} = require('../services/emailService');
const { buildMeetingLink, buildReceiptNumber } = require('../utils/meeting');

async function createOrder(req, res, next) {
  try {
    const { doctorId } = req.body;
    const doctor = await Doctor.findOne({ _id: doctorId, status: 'approved' });
    if (!doctor) return res.status(404).json({ success: false, message: 'Doctor not found' });

    const amount = Number(doctor.price) * 5;
    const razorpay = getRazorpayClient();
    const order = await razorpay.orders.create({
      amount: Math.round(amount * 100),
      currency: 'INR',
      receipt: `order_${Date.now()}`
    });

    return res.json({ success: true, order, amount });
  } catch (error) {
    next(error);
  }
}

async function verifyPayment(req, res, next) {
  try {
    const {
      appointmentId,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    } = req.body;

    const appointment = await Appointment.findById(appointmentId);
    if (!appointment || appointment.orderId !== razorpay_order_id) {
      return res.status(400).json({ success: false, message: 'Invalid appointment or order.' });
    }

    const generatedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '')
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (generatedSignature !== razorpay_signature) {
      appointment.paymentStatus = 'failed';
      await appointment.save();
      return res.status(400).json({ success: false, message: 'Payment signature verification failed.' });
    }

    appointment.paymentStatus = 'paid';
    appointment.appointmentStatus = 'confirmed';
    appointment.paymentId = razorpay_payment_id;
    appointment.paidAt = new Date();
    appointment.receiptNumber = appointment.receiptNumber || buildReceiptNumber(appointment);
    appointment.meetingLink = appointment.meetingLink || buildMeetingLink(appointment);
    await appointment.save();

    const emailResults = await Promise.all([
      sendPatientAppointmentConfirmation(appointment),
      sendDoctorPaidAppointmentNotification(appointment)
    ]);
    console.log('Payment email status:', {
      patient: emailResults[0],
      doctor: emailResults[1],
      appointmentId: appointment._id.toString()
    });

    req.session.lastPaidAppointmentId = appointment._id.toString();
    req.flash('success', 'Payment verified and appointment confirmed.');
    return res.json({
      success: true,
      redirectUrl: `/payments/success/${appointment._id}`
    });
  } catch (error) {
    next(error);
  }
}

async function markFailed(req, res, next) {
  try {
    const { appointmentId } = req.body;
    if (appointmentId) {
      await Appointment.findByIdAndUpdate(appointmentId, { paymentStatus: 'failed' });
    }
    return res.json({ success: true });
  } catch (error) {
    next(error);
  }
}

async function showSuccess(req, res, next) {
  try {
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment || appointment.paymentStatus !== 'paid') {
      req.flash('error', 'Payment confirmation not found.');
      return res.redirect('/appointment');
    }
    return res.render('appointmentSuccess', { appointment });
  } catch (error) {
    next(error);
  }
}

async function downloadReceipt(req, res, next) {
  try {
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment || appointment.paymentStatus !== 'paid') {
      req.flash('error', 'Receipt not found.');
      return res.redirect('/appointment');
    }

    const sessionUserEmail = req.session.user && req.session.user.email;
    const canAccess = req.session.lastPaidAppointmentId === appointment._id.toString()
      || sessionUserEmail === appointment.patientEmail;

    if (!canAccess) {
      req.flash('error', 'Please login with the patient account used for this booking.');
      return res.redirect('/login');
    }

    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Disposition', `attachment; filename="MediCare-Receipt-${appointment.receiptNumber || appointment._id}.html"`);
    return res.render('receipt', { appointment, download: true });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createOrder,
  verifyPayment,
  markFailed,
  showSuccess,
  downloadReceipt
};
