const mongoose = require('mongoose');

const doctorHistorySchema = new mongoose.Schema({
  doctor: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor' },
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, lowercase: true, trim: true },
  phone: String,
  specialization: String,
  degree: String,
  medicalLicense: String,
  statusBefore: String,
  action: {
    type: String,
    enum: ['rejected', 'removed'],
    required: true
  },
  reason: String,
  performedBy: { type: String, default: 'Admin' },
  actionAt: { type: Date, default: Date.now },
  snapshot: mongoose.Schema.Types.Mixed
}, { timestamps: true });

module.exports = mongoose.model('DoctorHistory', doctorHistorySchema);
