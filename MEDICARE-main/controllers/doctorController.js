const bcrypt = require('bcryptjs');
const Doctor = require('../models/Doctor');
const Appointment = require('../models/Appointment');
const { uploadFile } = require('../utils/uploadFile');
const {
  sendDoctorRegistrationPending
} = require('../services/emailService');

function showRegister(req, res) {
  res.render('registerDoctor');
}

function showLogin(req, res) {
  res.render('doctorLogin');
}

async function findDoctorAppointment(doctor, appointmentId) {
  return Appointment.findOne({
    _id: appointmentId,
    $or: [
      { doctor: doctor._id },
      { doctorEmail: doctor.email }
    ]
  });
}

async function showDashboard(req, res, next) {
  try {
    const doctor = await Doctor.findById(req.session.doctor._id);
    if (!doctor || doctor.status !== 'approved') {
      req.session.doctor = null;
      req.flash('error', 'Your account is awaiting admin approval.');
      return res.redirect('/doctor/login');
    }

    req.session.doctor = doctor;

    const appointments = await Appointment.find({
      $or: [
        { doctor: doctor._id },
        { doctorEmail: doctor.email }
      ]
    }).sort({ createdAt: -1 });

    const stats = {
      totalAppointments: appointments.length,
      confirmedAppointments: appointments.filter((appointment) => appointment.appointmentStatus === 'confirmed').length,
      paidAppointments: appointments.filter((appointment) => appointment.paymentStatus === 'paid').length,
      pendingPayments: appointments.filter((appointment) => appointment.paymentStatus === 'pending').length,
      failedPayments: appointments.filter((appointment) => appointment.paymentStatus === 'failed').length,
      totalRevenue: appointments
        .filter((appointment) => appointment.paymentStatus === 'paid')
        .reduce((sum, appointment) => sum + Number(appointment.amount || 0), 0)
    };

    return res.render('doctorDashboard', { doctor, appointments, stats });
  } catch (error) {
    next(error);
  }
}

async function register(req, res, next) {
  try {
    const {
      name,
      email,
      password,
      phone,
      aadhar,
      specialization,
      degree,
      medicalLicense,
      experience,
      price,
      address,
      availableDays
    } = req.body;

    const imagePath = await uploadFile(req.files.image && req.files.image[0], 'doctors/photos');
    const documentPath = await uploadFile(req.files.document && req.files.document[0], 'doctors/documents');
    const certificates = await Promise.all(
      (req.files.certificates || []).map((file) => uploadFile(file, 'doctors/certificates'))
    );

    const hashedPassword = await bcrypt.hash(password, 10);
    const doctor = await Doctor.create({
      name,
      email,
      password: hashedPassword,
      phone,
      aadhar,
      specialization,
      degree,
      medicalLicense,
      experience,
      price,
      address,
      availableDays: (availableDays || '').split(',').map((day) => day.trim()).filter(Boolean),
      image: imagePath,
      document: documentPath,
      certificates,
      status: 'pending'
    });

    await sendDoctorRegistrationPending(doctor);
    req.flash('success', 'Your doctor account has been submitted for admin verification.');
    res.redirect('/doctor/login');
  } catch (error) {
    next(error);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const doctor = await Doctor.findOne({ email });
    if (!doctor) {
      req.flash('error', 'Doctor account not found.');
      return res.redirect('/doctor/login');
    }

    const isMatch = await bcrypt.compare(password, doctor.password || '');
    if (!isMatch) {
      req.flash('error', 'Invalid credentials.');
      return res.redirect('/doctor/login');
    }

    if (doctor.status === 'pending' || !doctor.status) {
      req.flash('error', 'Your account is awaiting admin approval.');
      return res.redirect('/doctor/login');
    }

    if (doctor.status === 'rejected') {
      req.flash('error', `Your account verification was rejected.${doctor.rejectionReason ? ` Reason: ${doctor.rejectionReason}` : ''}`);
      return res.redirect('/doctor/login');
    }

    if (doctor.status !== 'approved') {
      req.flash('error', 'Your account is awaiting admin approval.');
      return res.redirect('/doctor/login');
    }

    req.session.doctor = doctor;
    req.flash('success', 'Doctor login successful.');
    return res.redirect('/doctor/dashboard');
  } catch (error) {
    next(error);
  }
}

function logout(req, res) {
  req.session.doctor = null;
  req.flash('success', 'Doctor logged out successfully.');
  res.redirect('/');
}

async function showPrescriptionForm(req, res, next) {
  try {
    const doctor = await Doctor.findById(req.session.doctor._id);
    const appointment = await findDoctorAppointment(doctor, req.params.id);

    if (!appointment) {
      req.flash('error', 'Appointment not found for your doctor account.');
      return res.redirect('/doctor/dashboard');
    }

    return res.render('prescriptionForm', { doctor, appointment });
  } catch (error) {
    next(error);
  }
}

async function savePrescription(req, res, next) {
  try {
    const doctor = await Doctor.findById(req.session.doctor._id);
    const appointment = await findDoctorAppointment(doctor, req.params.id);

    if (!appointment) {
      req.flash('error', 'Appointment not found for your doctor account.');
      return res.redirect('/doctor/dashboard');
    }

    const medicineNames = Array.isArray(req.body.medicineName) ? req.body.medicineName : [req.body.medicineName];
    const dosages = Array.isArray(req.body.dosage) ? req.body.dosage : [req.body.dosage];
    const frequencies = Array.isArray(req.body.frequency) ? req.body.frequency : [req.body.frequency];
    const durations = Array.isArray(req.body.duration) ? req.body.duration : [req.body.duration];
    const instructions = Array.isArray(req.body.instructions) ? req.body.instructions : [req.body.instructions];

    const medicines = medicineNames
      .map((name, index) => ({
        name: (name || '').trim(),
        dosage: (dosages[index] || '').trim(),
        frequency: frequencies[index] || 'OD',
        duration: (durations[index] || '').trim(),
        instructions: (instructions[index] || '').trim()
      }))
      .filter((medicine) => medicine.name);

    appointment.prescription = {
      diagnosis: (req.body.diagnosis || '').trim(),
      notes: (req.body.notes || '').trim(),
      medicines,
      updatedAt: new Date()
    };

    await appointment.save();
    req.flash('success', 'Prescription saved. Patient can now view it in My Bookings.');
    return res.redirect('/doctor/dashboard');
  } catch (error) {
    next(error);
  }
}

module.exports = {
  showRegister,
  showLogin,
  showDashboard,
  register,
  login,
  logout,
  showPrescriptionForm,
  savePrescription
};
