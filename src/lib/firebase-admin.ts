import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import fs from 'fs';
import path from 'path';

let projectId = process.env.FIREBASE_PROJECT_ID;
if (!projectId) {
  try {
    const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      projectId = config.projectId;
    }
  } catch (e) {
    console.warn('Could not read firebase-applet-config.json:', e);
  }
}

if (!getApps().length) {
  initializeApp({
    projectId: projectId || 'gen-lang-client-0174045756',
  });
}

export const adminAuth = getAuth();
