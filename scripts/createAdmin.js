const mongoose = require('mongoose');
const Admin = require('../models/Admin');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Connect to database
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB Connected');
  } catch (error) {
    console.error('Database connection error:', error);
    process.exit(1);
  }
};

// Create default admin user
const createDefaultAdmin = async () => {
  try {
    // Check if admin already exists
    const existingAdmin = await Admin.findOne({ username: 'admin' });
    
    if (existingAdmin) {
      console.log('Default admin user already exists');
      return;
    }

    // Create default admin
    const admin = new Admin({
      username: 'admin',
      password: 'admin123', // Default password
      role: 'admin'
    });

    await admin.save();
    console.log('Default admin user created successfully');
    console.log('Username: admin');
    console.log('Password: admin123');
    console.log('Please change the password after first login!');
  } catch (error) {
    console.error('Error creating default admin:', error);
  }
};

// Main function
const main = async () => {
  await connectDB();
  await createDefaultAdmin();
  process.exit(0);
};

main();
