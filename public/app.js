import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getDatabase, ref, onValue, set } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js';

const firebaseConfig = {
  apiKey: "SECRET",
  databaseURL: "SECRET"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

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
});

// Read Voltage
onValue(ref(db, 'Sensor/voltage'), (snap) => {
  const val = snap.val();
  if (val !== null) {
    voltageValueEl.textContent = typeof val === 'number' ? val.toFixed(2) : val;
  }
});

// Read switch
onValue(ref(db, 'Sensor/switch'), (snap) => {
  const val = snap.val();
  if (val !== null) {
    const isOn = Boolean(val);
    switchIndicator.className = 'switch-indicator ' + (isOn ? 'on' : 'off');
    switchLabel.textContent = isOn ? 'ON' : 'OFF';
  }
});

// Read servo angle
onValue(ref(db, 'Servo/angle'), (snap) => {
  const val = snap.val();
  if (val !== null) {
    servoCurrent.textContent = val;
  }
});

// Sync controls from RTDB
let suppressDigital = false;
let suppressAnalog = false;
let suppressServo = false;

onValue(ref(db, 'LED/digital'), (snap) => {
  const val = snap.val();
  if (val !== null && !suppressDigital) {
    ledDigitalToggle.checked = Boolean(val);
    ledDigitalLabel.textContent = val ? 'ON' : 'OFF';
  }
});

onValue(ref(db, 'LED/analog'), (snap) => {
  const val = snap.val();
  if (val !== null && !suppressAnalog) {
    ledAnalogSlider.value = val;
    ledAnalogValue.textContent = val;
  }
});

// Controls . write to RTDB
ledDigitalToggle.addEventListener('change', () => {
  const val = ledDigitalToggle.checked;
  ledDigitalLabel.textContent = val ? 'ON' : 'OFF';
  suppressDigital = true;
  set(ref(db, 'LED/digital'), val).then(() => { suppressDigital = false; });
});

ledAnalogSlider.addEventListener('input', () => {
  const val = parseInt(ledAnalogSlider.value, 10);
  ledAnalogValue.textContent = val;
  suppressAnalog = true;
  set(ref(db, 'LED/analog'), val).then(() => { suppressAnalog = false; });
});

servoSlider.addEventListener('input', () => {
  const val = parseInt(servoSlider.value, 10);
  servoValue.textContent = val + '°';
  suppressServo = true;
  set(ref(db, 'Servo/angle'), val).then(() => { suppressServo = false; });
});