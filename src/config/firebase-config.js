import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getDatabase } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js';

// Get keys, parse into json format & initialize 
export async function initFirebase() {
  const res     = await fetch('/api/config');
  const config  = await res.json();
  const app     = initializeApp(config);
  const db      = getDatabase(app);
  return { app, db };
}
