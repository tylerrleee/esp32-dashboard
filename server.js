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

// Delete a recording document from Firestore
app.delete('/api/recordings/:docId', async (req, res) => {
  const projectId = process.env.PROJECT_ID;
  if (!projectId) return res.status(500).json({ error: 'PROJECT_ID not configured' });

  const { docId } = req.params;
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/recordings/${docId}`;

  try {
    const response = await fetch(url, { method: 'DELETE' });
    if (!response.ok) {
      return res.status(response.status).json({ error: `Firestore returned ${response.status}` });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('Firestore delete error:', err);
    res.status(500).json({ error: 'Failed to delete recording' });
  }
});

// Firestore proxy — fetch a recording document and return simplified JSON
app.get('/api/recordings/:docId', async (req, res) => {
  const projectId = process.env.PROJECT_ID;
  if (!projectId) return res.status(500).json({ error: 'PROJECT_ID not configured' });

  const { docId } = req.params;
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/recordings/${docId}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      return res.status(response.status).json({ error: `Firestore returned ${response.status}` });
    }

    const doc = await response.json();
    const fields = doc.fields || {};

    // Convert Firestore typed value to plain JS value
    function unwrap(val) {
      if (val == null) return null;
      if ('doubleValue' in val) return val.doubleValue;
      if ('integerValue' in val) return Number(val.integerValue);
      if ('stringValue' in val) return val.stringValue;
      if ('booleanValue' in val) return val.booleanValue;
      if ('arrayValue' in val) return (val.arrayValue.values || []).map(unwrap);
      if ('mapValue' in val) {
        const obj = {};
        for (const [k, v] of Object.entries(val.mapValue.fields || {})) {
          obj[k] = unwrap(v);
        }
        return obj;
      }
      return null;
    }

    const result = {
      label: unwrap(fields.label),
      label_name: unwrap(fields.label_name),
      sample_rate_hz: unwrap(fields.sample_rate_hz),
      num_samples: unwrap(fields.num_samples),
      data: unwrap(fields.data),
      calibration: unwrap(fields.calibration),
    };

    res.json(result);
  } catch (err) {
    console.error('Firestore proxy error:', err);
    res.status(500).json({ error: 'Failed to fetch recording' });
  }
});

// List all recordings (id, label, label_name only)
app.get('/api/recordings', async (req, res) => {
  const projectId = process.env.PROJECT_ID;
  if (!projectId) return res.status(500).json({ error: 'PROJECT_ID not configured' });

  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/recordings`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      return res.status(response.status).json({ error: `Firestore returned ${response.status}` });
    }

    const body = await response.json();
    const docs = body.documents || [];

    const recordings = docs.map((doc) => {
      const fields = doc.fields || {};
      const id = doc.name.split('/').pop();
      const label = fields.label
        ? (fields.label.integerValue != null ? Number(fields.label.integerValue) : fields.label.doubleValue)
        : null;
      const label_name = fields.label_name ? fields.label_name.stringValue : '';
      return { id, label, label_name };
    });

    res.json(recordings);
  } catch (err) {
    console.error('Firestore list error:', err);
    res.status(500).json({ error: 'Failed to list recordings' });
  }
});

app.listen(PORT, () => {
  console.log(`Dashboard running at http://localhost:${PORT}`);
});
