import { ref, onValue, set } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js';
import { initFirebase } from './config/firebase-config.js';

async function init() {
  const { db } = await initFirebase();

  // Get DOM elements
  const countdownValue = document.getElementById('countdown-value');
  const progressBar = document.getElementById('progress-bar');
  const progressValue = document.getElementById('progress-value');
  const errorValue = document.getElementById('error-value');
  const connectionStatus = document.getElementById('connection-status');

  // Connection status
  onValue(ref(db, '.info/connected'), (snap) => {
    if (snap.val() === true) {
      connectionStatus.textContent = 'Connected';
      connectionStatus.className = 'connected';
      loadRecordingsList();
    } else {
      connectionStatus.textContent = 'Disconnected';
      connectionStatus.className = 'disconnected';
    }
  }, (err) => {
    console.error('Connection listener error:', err);
  });

  // Helper to format numbers
  function fmt(val) {
    return typeof val === 'number' ? val.toFixed(2) : val;
  }

  // Calibration bias display
  const calFields = ['bias_ax', 'bias_ay', 'bias_az', 'bias_gx', 'bias_gy', 'bias_gz'];
  const calEls = Object.fromEntries(
    calFields.map((f) => [f, document.getElementById(`cal-${f.replace('_', '-')}`)])
  );

  function updateBiases(data) {
    const cal = data.calibration || {};
    calFields.forEach((f) => {
      if (calEls[f]) calEls[f].textContent = cal[f] != null ? fmt(cal[f]) : '--';
    });
  }

  // Recordings list
  const recordingsList = document.getElementById('recordings-list');
  const graphCard = document.getElementById('graph-card');
  const graphMeta = document.getElementById('graph-meta');
  const chartCanvas = document.getElementById('recording-chart');
  let recordingChart = null;
  let lastRecordingId = null;

  async function loadRecordingsList() {
    try {
      const res = await fetch('/api/recordings');
      const recordings = await res.json();
      recordingsList.innerHTML = '';
      recordings.forEach((rec) => {
        const row = document.createElement('div');
        row.className = 'recording-row';
        row.dataset.id = rec.id;

        const label = document.createElement('span');
        label.textContent = `${rec.label_name} (${rec.label})`;
        row.appendChild(label);

        const menuBtn = document.createElement('button');
        menuBtn.className = 'menu-btn';
        menuBtn.textContent = '\u22EE';
        menuBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          document.querySelectorAll('.menu-dropdown.open').forEach((d) => {
            if (d !== dropdown) d.classList.remove('open');
          });
          dropdown.classList.toggle('open');
        });
        row.appendChild(menuBtn);

        const dropdown = document.createElement('div');
        dropdown.className = 'menu-dropdown';
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Delete';
        deleteBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          try {
            await fetch(`/api/recordings/${rec.id}`, { method: 'DELETE' });
            const wasActive = row.classList.contains('active');
            await loadRecordingsList();
            if (wasActive) {
              graphCard.style.display = 'none';
              if (recordingChart) { recordingChart.destroy(); recordingChart = null; }
            }
          } catch (err) {
            console.error('Delete failed:', err);
          }
        });
        dropdown.appendChild(deleteBtn);
        row.appendChild(dropdown);

        recordingsList.appendChild(row);
      });

      // Update calibration biases from the latest recording
      if (recordings.length > 0) {
        const latest = recordings[recordings.length - 1];
        const recRes = await fetch(`/api/recordings/${latest.id}`);
        const recData = await recRes.json();
        updateBiases(recData);
      }
    } catch (err) {
      console.error('Failed to load recordings list:', err);
    }
  }

  recordingsList.addEventListener('click', async (e) => {
    const row = e.target.closest('.recording-row');
    if (!row) return;
    recordingsList.querySelectorAll('.recording-row').forEach((r) => r.classList.remove('active'));
    row.classList.add('active');
    try {
      const res = await fetch(`/api/recordings/${row.dataset.id}`);
      const data = await res.json();
      if (data && data.data) renderRecordingChart(data);
    } catch (err) {
      console.error('Recording fetch error:', err);
    }
  });

  // Close any open menu dropdown when clicking outside
  document.addEventListener('click', () => {
    document.querySelectorAll('.menu-dropdown.open').forEach((d) => d.classList.remove('open'));
  });

  function renderRecordingChart(data) {
    graphCard.style.display = '';
    graphMeta.textContent = `Label: ${data.label_name} (${data.label})`;

    if (recordingChart) {
      recordingChart.destroy();
    }

    const numSamples = data.num_samples || 560;
    const sampleRate = data.sample_rate_hz || 56;
    const labels = Array.from({ length: numSamples }, (_, i) => (i / sampleRate).toFixed(3));

    const channels = [
      { key: 'accel_x', label: 'Accel X', color: '#e74c3c', yAxis: 'yAccel' },
      { key: 'accel_y', label: 'Accel Y', color: '#3498db', yAxis: 'yAccel' },
      { key: 'accel_z', label: 'Accel Z', color: '#2ecc71', yAxis: 'yAccel' },
      { key: 'gyro_x', label: 'Gyro X', color: '#e67e22', yAxis: 'yGyro' },
      { key: 'gyro_y', label: 'Gyro Y', color: '#9b59b6', yAxis: 'yGyro' },
      { key: 'gyro_z', label: 'Gyro Z', color: '#1abc9c', yAxis: 'yGyro' },
    ];

    const datasets = channels.map((ch) => ({
      label: ch.label,
      data: data.data[ch.key] || [],
      borderColor: ch.color,
      borderWidth: 1.5,
      pointRadius: 0,
      yAxisID: ch.yAxis,
    }));

    recordingChart = new Chart(chartCanvas, {
      type: 'line',
      data: { labels, datasets },
      options: {
        animation: false,
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        scales: {
          x: {
            title: { display: true, text: 'Time (s)' },
            ticks: { maxTicksLimit: 20 },
          },
          yAccel: {
            type: 'linear',
            position: 'left',
            title: { display: true, text: 'm/s\u00B2' },
          },
          yGyro: {
            type: 'linear',
            position: 'right',
            title: { display: true, text: 'rad/s' },
            grid: { drawOnChartArea: false },
          },
        },
      },
    });
  }

  // Data collection
  const DEVICE_ID = 'kateye-collector-01';
  const deviceRef = `datacollect/devices/${DEVICE_ID}`;
  const collectStatus = document.getElementById('collect-status');
  const btnGrid = document.querySelector('.btn-grid');

  // Listen for device status changes
  onValue(ref(db, deviceRef), (snap) => {
    const val = snap.val();
    if (!val) return;

    const status = val.status || 'idle';
    const countdown = val.countdown_remaining || 0;
    const progress = val.progress || 0;
    const error = val.last_error || '';

    // Update collect-status banner
    if (status === 'countdown') {
      collectStatus.textContent = `Countdown: ${countdown}`;
      collectStatus.className = 'collect-status countdown';
    } else if (status === 'recording') {
      collectStatus.textContent = `Recording: ${progress}/560`;
      collectStatus.className = 'collect-status recording';
    } else if (status === 'uploading') {
      collectStatus.textContent = 'Uploading...';
      collectStatus.className = 'collect-status uploading';
    } else if (status === 'done') {
      collectStatus.textContent = 'Done!';
      collectStatus.className = 'collect-status done';

      // Fetch and display the recording graph
      const recId = val.last_recording_id;
      if (recId && recId !== lastRecordingId) {
        lastRecordingId = recId;
        fetch(`/api/recordings/${recId}`)
          .then((r) => r.json())
          .then((data) => {
            if (data && data.data) renderRecordingChart(data);
            updateBiases(data);
          })
          .catch((err) => console.error('Recording fetch error:', err));
      }
    } else if (status === 'error') {
      collectStatus.textContent = `Error: ${error}`;
      collectStatus.className = 'collect-status error';
    } else {
      collectStatus.textContent = 'Idle';
      collectStatus.className = 'collect-status';
    }

    // Update Device Status card
    countdownValue.textContent = countdown > 0 ? countdown : '--';
    progressValue.textContent = `${progress} / 560`;
    const pct = Math.min(progress / 560 * 100, 100);
    progressBar.style.width = `${pct}%`;
    errorValue.textContent = error || '--';

    // Disable buttons when not idle
    const busy = status !== 'idle' && status !== 'done' && status !== 'error';
    btnGrid.querySelectorAll('button').forEach((btn) => {
      btn.disabled = busy;
    });
  }, (err) => {
    console.error('Device status listener error:', err);
  });

  // Button click ; send command to RTDB
  btnGrid.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn || btn.disabled) return;

    const label = parseInt(btn.dataset.label, 10);
    const labelName = btn.dataset.name;

    set(ref(db, `${deviceRef}/command`), {
      trigger: true,
      label: label,
      label_name: labelName,
    }).catch((err) => {
      console.error('Command set error:', err);
    });
  });

}

init().catch((err) => {
  console.error('Failed to initialize app:', err);
});
