const Doctor = require('../models/Doctor');
const DoctorHistory = require('../models/DoctorHistory');
const User = require('../models/user');
const Appointment = require('../models/Appointment');
const {
  sendDoctorApproval,
  sendDoctorRejection
} = require('../services/emailService');
const {
  isAdminRequest,
  setAdminCookie,
  clearAdminCookie
} = require('../utils/adminSession');

const pendingDoctorQuery = {
  $or: [
    { status: 'pending' },
    { status: { $exists: false } }
  ]
};

function getDoctorSnapshot(doctor) {
  return {
    name: doctor.name,
    email: doctor.email,
    phone: doctor.phone,
    aadhar: doctor.aadhar,
    specialization: doctor.specialization,
    degree: doctor.degree,
    medicalLicense: doctor.medicalLicense,
    experience: doctor.experience,
    price: doctor.price,
    address: doctor.address,
    availableDays: doctor.availableDays,
    image: doctor.image,
    document: doctor.document,
    certificates: doctor.certificates,
    status: doctor.status,
    approvedAt: doctor.approvedAt,
    rejectionReason: doctor.rejectionReason,
    createdAt: doctor.createdAt,
    updatedAt: doctor.updatedAt
  };
}

async function recordDoctorHistory(doctor, action, reason, statusBefore) {
  return DoctorHistory.create({
    doctor: doctor._id,
    name: doctor.name,
    email: doctor.email,
    phone: doctor.phone,
    specialization: doctor.specialization,
    degree: doctor.degree,
    medicalLicense: doctor.medicalLicense,
    statusBefore,
    action,
    reason,
    performedBy: 'Admin',
    actionAt: new Date(),
    snapshot: getDoctorSnapshot(doctor)
  });
}

function getPatientRegisteredAt(user) {
  if (user.createdAt) return user.createdAt;
  if (user._id && typeof user._id.getTimestamp === 'function') {
    return user._id.getTimestamp();
  }
  return null;
}

function buildPatientRows(users, appointments) {
  const appointmentMap = new Map();

  appointments.forEach((appointment) => {
    const email = String(appointment.patientEmail || '').toLowerCase();
    if (!email) return;

    if (!appointmentMap.has(email)) {
      appointmentMap.set(email, {
        totalAppointments: 0,
        pendingAppointments: 0,
        confirmedAppointments: 0,
        paidAppointments: 0,
        failedPayments: 0,
        totalSpent: 0,
        latestAppointment: null
      });
    }

    const summary = appointmentMap.get(email);
    summary.totalAppointments += 1;
    if (appointment.appointmentStatus === 'pending_payment') summary.pendingAppointments += 1;
    if (appointment.appointmentStatus === 'confirmed') summary.confirmedAppointments += 1;
    if (appointment.paymentStatus === 'paid') {
      summary.paidAppointments += 1;
      summary.totalSpent += Number(appointment.amount || 0);
    }
    if (appointment.paymentStatus === 'failed') summary.failedPayments += 1;

    const latestTime = summary.latestAppointment ? new Date(summary.latestAppointment.createdAt || 0).getTime() : 0;
    const currentTime = new Date(appointment.createdAt || 0).getTime();
    if (!summary.latestAppointment || currentTime > latestTime) {
      summary.latestAppointment = appointment;
    }
  });

  return users.map((user) => {
    const email = String(user.email || '').toLowerCase();
    const summary = appointmentMap.get(email) || {
      totalAppointments: 0,
      pendingAppointments: 0,
      confirmedAppointments: 0,
      paidAppointments: 0,
      failedPayments: 0,
      totalSpent: 0,
      latestAppointment: null
    };

    return {
      user,
      registeredAt: getPatientRegisteredAt(user),
      ...summary
    };
  });
}

function buildDoctorHistoryRows(historyEvents, rejectedDoctors) {
  const recordedRejectedDoctorIds = new Set(
    historyEvents
      .filter((event) => event.action === 'rejected' && event.doctor)
      .map((event) => String(event.doctor))
  );

  const fallbackRejectedEvents = rejectedDoctors
    .filter((doctor) => !recordedRejectedDoctorIds.has(String(doctor._id)))
    .map((doctor) => ({
      doctor: doctor._id,
      name: doctor.name,
      email: doctor.email,
      phone: doctor.phone,
      specialization: doctor.specialization,
      degree: doctor.degree,
      medicalLicense: doctor.medicalLicense,
      statusBefore: 'pending',
      action: 'rejected',
      reason: doctor.rejectionReason || 'Rejected by admin',
      performedBy: 'Admin',
      actionAt: doctor.updatedAt || doctor.createdAt,
      snapshot: getDoctorSnapshot(doctor),
      isCurrentDoctorRecord: true
    }));

  return [...historyEvents, ...fallbackRejectedEvents]
    .sort((first, second) => new Date(second.actionAt || 0) - new Date(first.actionAt || 0));
}

function showLogin(req, res) {
  if (isAdminRequest(req)) return res.redirect('/admin/dashboard');
  return res.render('admin/login');
}

function login(req, res) {
  const { email, password } = req.body;
  const configuredEmail = process.env.ADMIN_EMAIL;
  const configuredPassword = process.env.ADMIN_PASSWORD;

  if (!configuredEmail || !configuredPassword) {
    req.flash('error', 'Admin credentials are not configured in environment variables.');
    return res.redirect('/admin/login');
  }

  if (String(email || '').trim().toLowerCase() === configuredEmail.toLowerCase() && password === configuredPassword) {
    req.session.isAdmin = true;
    setAdminCookie(res);
    req.flash('success', 'Welcome back, admin.');
    return res.redirect('/admin/dashboard');
  }

  req.flash('error', 'Invalid admin credentials.');
  return res.redirect('/admin/login');
}

function logout(req, res) {
  req.session.isAdmin = false;
  clearAdminCookie(res);
  req.flash('success', 'Admin logged out successfully.');
  res.redirect('/admin/login');
}

async function dashboard(req, res, next) {
  try {
    const activeView = req.query.view === 'patients' ? 'patients' : 'doctors';
    const [
      totalDoctors,
      pendingDoctors,
      approvedDoctors,
      rejectedDoctors,
      removedDoctors,
      totalPatients,
      totalAppointments,
      pendingAppointments,
      confirmedAppointments,
      cancelledAppointments,
      paidAppointments,
      failedPayments,
      patients,
      appointments,
      pendingDoctorList,
      doctorHistoryEvents,
      rejectedHistoryDoctors
    ] = await Promise.all([
      Doctor.countDocuments(),
      Doctor.countDocuments(pendingDoctorQuery),
      Doctor.countDocuments({ status: 'approved' }),
      Doctor.countDocuments({ status: 'rejected' }),
      DoctorHistory.countDocuments({ action: 'removed' }),
      User.countDocuments(),
      Appointment.countDocuments(),
      Appointment.countDocuments({ appointmentStatus: 'pending_payment' }),
      Appointment.countDocuments({ appointmentStatus: 'confirmed' }),
      Appointment.countDocuments({ appointmentStatus: 'cancelled' }),
      Appointment.countDocuments({ paymentStatus: 'paid' }),
      Appointment.countDocuments({ paymentStatus: 'failed' }),
      User.find().sort({ _id: -1 }),
      Appointment.find().sort({ createdAt: -1 }),
      Doctor.find(pendingDoctorQuery).sort({ createdAt: -1 }).limit(8),
      DoctorHistory.find().sort({ actionAt: -1 }).limit(20),
      Doctor.find({ status: 'rejected' }).sort({ updatedAt: -1 }).limit(20)
    ]);

    const totalRevenue = appointments
      .filter((appointment) => appointment.paymentStatus === 'paid')
      .reduce((sum, appointment) => sum + Number(appointment.amount || 0), 0);

    res.render('admin/dashboard', {
      activeView,
      stats: {
        totalDoctors,
        pendingDoctors,
        approvedDoctors,
        rejectedDoctors,
        removedDoctors,
        totalPatients,
        totalAppointments,
        pendingAppointments,
        confirmedAppointments,
        cancelledAppointments,
        paidAppointments,
        failedPayments,
        totalRevenue
      },
      pendingDoctorList,
      recentDoctorHistory: buildDoctorHistoryRows(doctorHistoryEvents, rejectedHistoryDoctors).slice(0, 8),
      patientRows: buildPatientRows(patients, appointments),
      recentAppointments: appointments.slice(0, 8)
    });
  } catch (error) {
    next(error);
  }
}

async function doctorsByStatus(req, res, next) {
  try {
    const { status } = req.params;
    const allowed = ['pending', 'approved', 'rejected'];
    if (!allowed.includes(status)) return res.redirect('/admin/dashboard');

    const query = status === 'pending' ? pendingDoctorQuery : { status };
    const doctors = await Doctor.find(query).sort({ createdAt: -1 });
    res.render('admin/doctors', {
      doctors,
      status,
      pageTitle: `${status.charAt(0).toUpperCase()}${status.slice(1)} Doctors`
    });
  } catch (error) {
    next(error);
  }
}

async function approveDoctor(req, res, next) {
  try {
    const doctor = await Doctor.findByIdAndUpdate(
      req.params.id,
      {
        status: 'approved',
        approvedAt: new Date(),
        rejectionReason: ''
      },
      { new: true }
    );

    if (!doctor) {
      req.flash('error', 'Doctor not found.');
      return res.redirect('/admin/doctors/pending');
    }

    await sendDoctorApproval(doctor);
    req.flash('success', `${doctor.name} has been approved.`);
    return res.redirect('/admin/doctors/pending');
  } catch (error) {
    next(error);
  }
}

async function showRejectForm(req, res, next) {
  try {
    const doctor = await Doctor.findById(req.params.id);
    if (!doctor) {
      req.flash('error', 'Doctor not found.');
      return res.redirect('/admin/doctors/pending');
    }
    return res.render('admin/rejectDoctor', { doctor });
  } catch (error) {
    next(error);
  }
}

async function rejectDoctor(req, res, next) {
  try {
    const rejectionReason = (req.body.rejectionReason || '').trim();
    if (!rejectionReason) {
      req.flash('error', 'Rejection reason is required.');
      return res.redirect(`/admin/reject/${req.params.id}`);
    }

    const doctor = await Doctor.findById(req.params.id);
    if (!doctor) {
      req.flash('error', 'Doctor not found.');
      return res.redirect('/admin/doctors/pending');
    }

    const statusBefore = doctor.status || 'pending';
    doctor.status = 'rejected';
    doctor.rejectionReason = rejectionReason;
    doctor.approvedAt = null;
    await doctor.save();
    await recordDoctorHistory(doctor, 'rejected', rejectionReason, statusBefore);
    await sendDoctorRejection(doctor, rejectionReason);
    req.flash('success', `${doctor.name} has been rejected.`);
    return res.redirect('/admin/doctors/pending');
  } catch (error) {
    next(error);
  }
}

async function doctorAppointments(req, res, next) {
  try {
    const doctor = await Doctor.findById(req.params.id);
    if (!doctor) {
      req.flash('error', 'Doctor not found.');
      return res.redirect('/admin/dashboard');
    }

    const appointments = await Appointment.find({
      $or: [
        { doctor: doctor._id },
        { doctorEmail: doctor.email }
      ]
    }).sort({ createdAt: -1 });

    return res.render('admin/doctorAppointments', { doctor, appointments });
  } catch (error) {
    next(error);
  }
}

async function deleteDoctor(req, res, next) {
  try {
    const doctor = await Doctor.findById(req.params.id);
    if (!doctor) {
      req.flash('error', 'Doctor not found.');
      return res.redirect('/admin/dashboard');
    }

    const statusBefore = doctor.status || 'pending';
    const removalReason = (req.body.removalReason || 'Removed by admin').trim();
    await recordDoctorHistory(doctor, 'removed', removalReason, statusBefore);
    await Doctor.findByIdAndDelete(doctor._id);
    req.flash('success', `Dr. ${doctor.name} has been removed from MediCare.`);
    return res.redirect(req.get('Referrer') || '/admin/dashboard');
  } catch (error) {
    next(error);
  }
}

async function doctorHistory(req, res, next) {
  try {
    const [historyEvents, rejectedDoctors] = await Promise.all([
      DoctorHistory.find().sort({ actionAt: -1 }),
      Doctor.find({ status: 'rejected' }).sort({ updatedAt: -1 })
    ]);

    const history = buildDoctorHistoryRows(historyEvents, rejectedDoctors);

    return res.render('admin/doctorHistory', { history });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  showLogin,
  login,
  logout,
  dashboard,
  doctorsByStatus,
  approveDoctor,
  showRejectForm,
  rejectDoctor,
  doctorAppointments,
  deleteDoctor,
  doctorHistory
};
