/**
 * Finds (and optionally repairs) User accounts with an empty/whitespace-only
 * `name` — the root cause of the Friends-page crash reported in production
 * ("Cannot read properties of undefined (reading 'charAt')").
 *
 * How this happened: `authSchemas.js`'s Zod `registerSchema` has always
 * required a non-empty (post-trim) name on this project's current
 * registration route, and the Mongoose `User` schema's own `trim: true`
 * would collapse a whitespace-only name to `''` at set-time regardless — but
 * Mongoose's built-in `required` validator only rejects `null`/`undefined`,
 * NOT an empty string, so an account written before Phase 01 added that Zod
 * check (when registration used its own hand-rolled validation instead)
 * could have slipped through with `name: ''` and Mongoose's own schema
 * would never have caught it. The client-side crash (`f.name.charAt(0)`)
 * and a matching server-side one (`messageController.js`'s conversation
 * sort, now also fixed to tolerate this) are separately hardened against
 * this regardless of how many accounts turn out to be affected.
 *
 * Usage:
 *   node server/scripts/fixMissingNames.js            # dry run — lists affected accounts only
 *   node server/scripts/fixMissingNames.js --apply     # also backfills a placeholder name
 *
 * The backfilled name is the email's local-part (before the @), capitalized
 * — e.g. "jane.doe@example.com" -> "Jane.doe". Good enough to stop the crash
 * and give the account a readable display name; the user can rename
 * themselves properly from Profile afterward.
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import User from '../models/User.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../.env') });

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;
if (!MONGO_URI) {
  console.error('ERROR: MONGO_URI is not set in server/.env');
  process.exit(1);
}

const apply = process.argv.includes('--apply');

const placeholderName = (email) => {
  const localPart = (email || 'user').split('@')[0];
  return localPart.charAt(0).toUpperCase() + localPart.slice(1);
};

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB');

  // Matches '', whitespace-only, or a missing field entirely.
  const affected = await User.find({
    $or: [{ name: { $exists: false } }, { name: null }, { name: /^\s*$/ }],
  }).select('_id email name');

  if (affected.length === 0) {
    console.log('No accounts with an empty/missing name found — nothing to do.');
  } else {
    console.log(`Found ${affected.length} account(s) with an empty/missing name:`);
    for (const u of affected) {
      console.log(`  - ${u._id}  ${u.email}  name=${JSON.stringify(u.name)}`);
    }

    if (apply) {
      console.log('\nApplying placeholder names...');
      for (const u of affected) {
        const newName = placeholderName(u.email);
        await User.updateOne({ _id: u._id }, { $set: { name: newName } });
        console.log(`  - ${u.email} -> "${newName}"`);
      }
      console.log('\nDone — those accounts now have a readable name.');
    } else {
      console.log(
        '\nDry run only — nothing was changed. Re-run with --apply to backfill a placeholder name.'
      );
    }
  }

  await mongoose.disconnect();
  console.log('Disconnected.');
}

run().catch((err) => {
  console.error('Script failed:', err);
  process.exit(1);
});
