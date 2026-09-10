// One-off bootstrap script: promote an existing user to admin.
// Usage: node scripts/createAdmin.js someone@example.com
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import User from '../models/User.js';

dotenv.config();

const email = process.argv[2];

if (!email) {
  console.error('Usage: node scripts/createAdmin.js <email>');
  process.exit(1);
}

const run = async () => {
  await connectDB();

  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    console.error(`No user found with email: ${email}`);
    process.exit(1);
  }

  user.role = 'admin';
  await user.save();
  console.log(`${user.email} is now an admin.`);
  await mongoose.disconnect();
  process.exit(0);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
