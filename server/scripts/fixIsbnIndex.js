/**
 * Phase 18 fix: rebuilds the books.user_1_isbn_1 index.
 *
 * The old index was `{ user: 1, isbn: 1 }` with `sparse: true`, which only
 * skips documents where `isbn` is *missing* — every book saved without an
 * ISBN stores `isbn: null` explicitly (see models/Book.js's comment), which
 * a sparse index still enforces uniqueness on. Net effect: a user's second
 * book with no ISBN always failed with a false "duplicate" 409.
 *
 * models/Book.js now defines the same index as a partial index on
 * `{ isbn: { $type: 'string' } }` instead, which actually excludes null
 * ISBNs from the uniqueness check. Mongoose won't touch an existing index
 * that already has this name just because its definition changed underneath
 * it — MongoDB refuses to silently redefine an index, it has to be dropped
 * first. Run this once against any database that was ever run against the
 * old schema (any local/dev database from before this fix):
 *
 *   node server/scripts/fixIsbnIndex.js
 *
 * A brand new database (fresh `docker compose up`, a new deployment, the
 * test suite's own mongodb-memory-server) never had the old index in the
 * first place — Mongoose just builds the correct one directly. This script
 * is only needed to repair a database that already has the broken one.
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

async function fix() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB');

  const books = mongoose.connection.db.collection('books');
  const existing = await books.indexes();
  const old = existing.find((idx) => idx.name === 'user_1_isbn_1');

  if (!old) {
    console.log(
      'No user_1_isbn_1 index found — nothing to fix (already clean, or a fresh database).'
    );
  } else if (old.partialFilterExpression) {
    console.log('user_1_isbn_1 is already a partial index — nothing to fix.');
  } else {
    await books.dropIndex('user_1_isbn_1');
    console.log('Dropped the old sparse (broken) user_1_isbn_1 index.');
  }

  // Build the correct one directly rather than waiting for the app's own
  // startup autoIndex — this way the fix is verified done when this script exits.
  await books.createIndex(
    { user: 1, isbn: 1 },
    { unique: true, partialFilterExpression: { isbn: { $type: 'string' } } }
  );
  console.log('Rebuilt user_1_isbn_1 as a partial unique index (null ISBNs excluded).');

  await mongoose.disconnect();
  console.log('Done. Disconnected.');
}

fix().catch((err) => {
  console.error('Fix failed:', err);
  process.exit(1);
});
