import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..'); // .../PersonalLibraryTracker-main
const SERVER_DIR = path.join(REPO_ROOT, 'server');
const CLIENT_DIR = path.join(REPO_ROOT, 'client');
const PID_FILE = path.join(__dirname, '.e2e-pids.json');

export const BACKEND_PORT = 5098;
export const FRONTEND_PORT = 3101;
export const BASE_URL = `http://localhost:${FRONTEND_PORT}`;

const waitForUrl = async (url, timeoutMs) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status < 500) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Timed out waiting for ${url}`);
};

// Phase 14: spins up a throwaway isolated backend + CRA dev server — same
// pattern used for every manual QA pass this project — pointed at real
// MongoDB but with disposable, uniquely-emailed test users cleaned up in
// global-teardown.js. NODE_ENV=test also disables express-rate-limit (see
// app.js/authRoutes.js's `skip`), so a multi-step e2e run never trips it.
export default async function globalSetup() {
  const serverProc = spawn('node', ['server.js'], {
    cwd: SERVER_DIR,
    env: {
      ...process.env,
      PORT: String(BACKEND_PORT),
      CLIENT_URL: BASE_URL,
      NODE_ENV: 'test',
    },
    shell: true,
    stdio: 'ignore',
    detached: false,
  });

  const clientProc = spawn('npx', ['react-scripts', 'start'], {
    cwd: CLIENT_DIR,
    env: {
      ...process.env,
      PORT: String(FRONTEND_PORT),
      REACT_APP_API_URL: `http://localhost:${BACKEND_PORT}/api`,
      BROWSER: 'none',
    },
    shell: true,
    stdio: 'ignore',
    detached: false,
  });

  fs.writeFileSync(PID_FILE, JSON.stringify({ serverPid: serverProc.pid, clientPid: clientProc.pid }));

  await waitForUrl(`http://localhost:${BACKEND_PORT}/`, 30000);
  await waitForUrl(BASE_URL, 60000); // CRA's first compile is slower than the API boot
}
