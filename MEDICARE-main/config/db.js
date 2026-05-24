const mongoose = require('mongoose');

async function connectDB() {
  try {
    if (mongoose.connection.readyState === 1) {
      return mongoose.connection;
    }

    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/medicare';
    await mongoose.connect(uri);
    console.log('MongoDB connected');
    return mongoose.connection;
  } catch (error) {
    console.error('Mongo error:', error);
  }
}

module.exports = connectDB;
