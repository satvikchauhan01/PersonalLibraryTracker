import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const SERVER_DIR = path.join(REPO_ROOT, 'server');
const PID_FILE = path.join(__dirname, '.e2e-pids.json');

const killTree = (pid) => {
  if (!pid) return;
  try {
    // /T kills the whole process tree — `npx react-scripts start` (and npm
    // itself) spawn child processes that a plain kill of the parent PID
    // would leave orphaned and still bound to the port.
    execSync(`taskkill /F /T /PID ${pid}`, { stdio: 'ignore' });
  } catch {
    // already exited — fine
  }
};

// Phase 14: mirrors this project's manual QA cleanup convention — delete the
// e2e run's disposable test users (and their books/etc.) from the real dev
// MongoDB cluster so nothing lingers there between runs. Deliberately uses
// raw collections (not the server's Mongoose model files) — importing those
// here would load a second, separate `mongoose` module instance from
// server/node_modules with its own disconnected connection state; a plain
// collection query needs no schema and sidesteps that entirely.
const cleanupTestData = async () => {
  dotenv.config({ path: path.join(SERVER_DIR, '.env') });
  if (!process.env.MONGO_URI) return; // no real DB configured — nothing to clean

  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection;

  const testUsers = await db.collection('users').find({ email: /^e2e-/ }).project({ _id: 1 }).toArray();
  const ids = testUsers.map((u) => u._id);

  if (ids.length > 0) {
    await Promise.all([
      db.collection('books').deleteMany({ user: { $in: ids } }),
      db.collection('refreshtokens').deleteMany({ user: { $in: ids } }),
      db.collection('friendrequests').deleteMany({ $or: [{ from: { $in: ids } }, { to: { $in: ids } }] }),
      db.collection('users').deleteMany({ _id: { $in: ids } }),
    ]);
  }

  await mongoose.disconnect();
};

export default async function globalTeardown() {
  try {
    await cleanupTestData();
  } catch (error) {
    console.error('[e2e teardown] cleanup failed (non-fatal):', error.message);
  }

  if (fs.existsSync(PID_FILE)) {
    const { serverPid, clientPid } = JSON.parse(fs.readFileSync(PID_FILE, 'utf8'));
    killTree(serverPid);
    killTree(clientPid);
    fs.unlinkSync(PID_FILE);
  }
}
