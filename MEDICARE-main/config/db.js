const mongoose = require('mongoose');

let connectionPromise;

async function connectDB() {
  try {
    if (mongoose.connection.readyState === 1) {
      return mongoose.connection;
    }

    if (connectionPromise) {
      await connectionPromise;
      return mongoose.connection;
    }

    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/medicare';
    connectionPromise = mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000
    });

    await connectionPromise;
    console.log('MongoDB connected');
    return mongoose.connection;
  } catch (error) {
    connectionPromise = null;
    console.error('Mongo error:', error.message);
    throw new Error('Database connection failed. Check MONGODB_URI and MongoDB Atlas network access.');
  }
}

module.exports = connectDB;
