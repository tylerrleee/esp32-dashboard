import { ref, onValue, set } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js';
import { initFirebase } from './config/firebase-config.js';

async function init() {
  const { db } = await initFirebase();

  // Get DOM elements
  const ldrValueEl = document.getElementById('ldr-value');
  const voltageValueEl = document.getElementById('voltage-value');
  const gaugeFill = document.getElementById('gauge-fill');
  const switchIndicator = document.getElementById('switch-indicator');
  const switchLabel = document.getElementById('switch-label');
  const ledDigitalToggle = document.getElementById('led-digital-toggle');
  const ledDigitalLabel = document.getElementById('led-digital-label');
  const ledAnalogSlider = document.getElementById('led-analog-slider');
  const ledAnalogValue = document.getElementById('led-analog-value');
  const servoSlider = document.getElementById('servo-slider');
  const servoValue = document.getElementById('servo-value');
  const servoCurrent = document.getElementById('servo-current');
  const connectionStatus = document.getElementById('connection-status');

  // Connection status
  onValue(ref(db, '.info/connected'), (snap) => {
    if (snap.val() === true) {
      connectionStatus.textContent = 'Connected';
      connectionStatus.className = 'connected';
    } else {
      connectionStatus.textContent = 'Disconnected';
      connectionStatus.className = 'disconnected';
    }
  }, (err) => {
    console.error('Connection listener error:', err);
  });

  // Gauge helper
  function updateGauge(value) {
    const pct = Math.min(value / 4095, 1);
    const arcLength = 251;
    const offset = arcLength * (1 - pct);
    gaugeFill.style.strokeDasharray = arcLength;
    gaugeFill.style.strokeDashoffset = offset;
  }

  // Read LDR
  onValue(ref(db, 'Sensor/ldr_data'), (snap) => {
    const val = snap.val();
    if (val !== null) {
      ldrValueEl.textContent = val;
      updateGauge(val);
    }
  }, (err) => {
    console.error('LDR listener error:', err);
  });

  // Read Voltage
  onValue(ref(db, 'Sensor/voltage'), (snap) => {
    const val = snap.val();
    if (val !== null) {
      voltageValueEl.textContent = typeof val === 'number' ? val.toFixed(2) : val;
    }
  }, (err) => {
    console.error('Voltage listener error:', err);
  });

  // Read switch
  onValue(ref(db, 'Sensor/switch'), (snap) => {
    const val = snap.val();
    if (val !== null) {
      const isOn = Boolean(val);
      switchIndicator.className = 'switch-indicator ' + (isOn ? 'on' : 'off');
      switchLabel.textContent = isOn ? 'ON' : 'OFF';
    }
  }, (err) => {
    console.error('Switch listener error:', err);
  });

  // Read servo angle
  onValue(ref(db, 'Servo/angle'), (snap) => {
    const val = snap.val();
    if (val !== null) {
      servoCurrent.textContent = val;
    }
  }, (err) => {
    console.error('Servo listener error:', err);
  });

  // Sync controls from RTDB
  let suppressDigital = false;
  let suppressAnalog = false;

  onValue(ref(db, 'LED/digital'), (snap) => {
    const val = snap.val();
    if (val !== null && !suppressDigital) {
      ledDigitalToggle.checked = Boolean(val);
      ledDigitalLabel.textContent = val ? 'ON' : 'OFF';
    }
  }, (err) => {
    console.error('LED digital listener error:', err);
  });

  onValue(ref(db, 'LED/analog'), (snap) => {
    const val = snap.val();
    if (val !== null && !suppressAnalog) {
      ledAnalogSlider.value = val;
      ledAnalogValue.textContent = val;
    }
  }, (err) => {
    console.error('LED analog listener error:', err);
  });

  // Controls — write to RTDB
  ledDigitalToggle.addEventListener('change', () => {
    const val = ledDigitalToggle.checked;
    ledDigitalLabel.textContent = val ? 'ON' : 'OFF';
    suppressDigital = true;
    set(ref(db, 'LED/digital'), val)
      .then(() => { suppressDigital = false; })
      .catch((err) => { suppressDigital = false; console.error('LED digital set error:', err); });
  });

  ledAnalogSlider.addEventListener('input', () => {
    const val = parseInt(ledAnalogSlider.value, 10);
    ledAnalogValue.textContent = val;
    suppressAnalog = true;
    set(ref(db, 'LED/analog'), val)
      .then(() => { suppressAnalog = false; })
      .catch((err) => { suppressAnalog = false; console.error('LED analog set error:', err); });
  });

  servoSlider.addEventListener('input', () => {
    const val = parseInt(servoSlider.value, 10);
    servoValue.textContent = val + '°';
    set(ref(db, 'Servo/angle'), val)
      .catch((err) => { console.error('Servo set error:', err); });
  });
}

init().catch((err) => {
  console.error('Failed to initialize app:', err);
});
