/**
 * Phase 04 Migration Script
 * Renames old Book status values:
 *   toRead          → wantToRead
 *   currentlyReading → reading
 *
 * Run once: node server/scripts/migratePhase04.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../.env') });

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;
if (!MONGO_URI) {
  console.error('ERROR: MONGO_URI is not set in server/.env');
  process.exit(1);
}

async function migrate() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB');

  const db = mongoose.connection.db;
  const books = db.collection('books');

  const r1 = await books.updateMany({ status: 'toRead' }, { $set: { status: 'wantToRead' } });
  console.log(`toRead → wantToRead: ${r1.modifiedCount} books updated`);

  const r2 = await books.updateMany(
    { status: 'currentlyReading' },
    { $set: { status: 'reading' } }
  );
  console.log(`currentlyReading → reading: ${r2.modifiedCount} books updated`);

  await mongoose.disconnect();
  console.log('Migration complete. Disconnected.');
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
