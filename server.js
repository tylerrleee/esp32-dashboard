require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(__dirname));

app.get('/api/config', (req, res) => {
  res.json({
    apiKey: process.env.FIREBASE_API_KEY || 'MISSING API KEY',
    authDomain: process.env.AUTH_DOMAIN || 'MISSING AUTH DOMAIN',
    databaseURL: process.env.DATABASE_URL || 'MISSING DATABASE URL',
    projectId: process.env.PROJECT_ID || 'MISSING PROJECT ID',
    storageBucket: process.env.STORAGE_BUCKET || 'MISSING STORAGE BUCKET',
    messagingSenderId: process.env.MESSAGE_SENDER_ID || 'MISSING MESSAGING ID',
    appId: process.env.APP_ID || 'MISSING APP ID',
  });
});

app.listen(PORT, () => {
  console.log(`Dashboard running at http://localhost:${PORT}`);
});
