const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const axios = require('axios');

const app = express();
app.use(bodyParser.json());

const db = new sqlite3.Database('./cardio.db');

// init tables
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    phone TEXT,
    emergency_contact TEXT
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS readings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    heart_rate INTEGER,
    accel_x REAL,
    accel_y REAL,
    accel_z REAL
  )`);
});

// register user (simple)
app.post('/api/register', (req, res) => {
  const { name, phone, emergency_contact } = req.body;
  db.run(`INSERT INTO users (name, phone, emergency_contact) VALUES (?, ?, ?)`,
    [name, phone, emergency_contact],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ user_id: this.lastID });
    });
});

// receive reading
app.post('/api/readings', (req, res) => {
  const { user_id, heart_rate, accel } = req.body; // accel: {x,y,z}
  db.run(`INSERT INTO readings (user_id, heart_rate, accel_x, accel_y, accel_z) VALUES (?, ?, ?, ?, ?)`,
    [user_id, heart_rate, accel.x, accel.y, accel.z],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      // after storing, run simple rule-based check
      checkForEmergency(user_id, heart_rate, accel).then(triggered => {
        res.json({ inserted: this.lastID, emergency: triggered });
      });
    });
});

// simple emergency logic
async function checkForEmergency(user_id, heart_rate, accel) {
  // RULE 1: bradycardia (very low heart rate)
  if (heart_rate !== null && heart_rate <= 40) {
    // confirm: look at last N readings? for MVP we trigger if single reading <=40
    await triggerEmergency(user_id, 'Low heart rate detected: ' + heart_rate);
    return true;
  }
  // RULE 2: fall detection simple (large sudden acceleration + low activity)
  const mag = Math.sqrt(accel.x*accel.x + accel.y*accel.y + accel.z*accel.z);
  // threshold example: sudden spike > 18 m/s^2 (tweak in real tests)
  if (mag > 18) {
    await triggerEmergency(user_id, 'Possible fall detected. Accel magnitude: ' + mag.toFixed(2));
    return true;
  }
  return false;
}

// trigger emergency: for prototype we just log + placeholder to call external service
async function triggerEmergency(user_id, message) {
  console.log('*** TRIGGER EMERGENCY for user', user_id, message);
  // get user contact
  db.get(`SELECT * FROM users WHERE id = ?`, [user_id], (err, row) => {
    if (err || !row) {
      console.error('No user found or db error', err);
      return;
    }
    // Example actions:
    // 1) Send SMS/Call to emergency contact (use Twilio or local provider) - placeholder
    // 2) Send location request to app (if app supports location push)
    // For prototype we just print
    console.log(`Notify emergency contact ${row.emergency_contact} about user ${row.name}. Message: ${message}`);
    // If you want, integrate Twilio here (need account + credentials)
    // Example (pseudo):
    // await axios.post('https://api.twilio.com/...', {...})
  });
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Backend running on', PORT));


// === Twilio integration (optional) ===
// To enable Twilio SMS/Call, set the following environment variables:
// TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER

const TWILIO_ENABLED = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER;
let twilioClient = null;
if (TWILIO_ENABLED) {
  const Twilio = require('twilio');
  twilioClient = new Twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
}

async function sendSms(to, body) {
  if (!TWILIO_ENABLED) {
    console.log('Twilio not enabled. SMS to', to, 'body:', body);
    return;
  }
  try {
    await twilioClient.messages.create({
      body: body,
      from: process.env.TWILIO_FROM_NUMBER,
      to: to
    });
    console.log('Sent SMS to', to);
  } catch (e) {
    console.error('Twilio SMS error', e.message);
  }
}

// modify triggerEmergency to use sendSms
const fs = require('fs');
// override existing triggerEmergency by redefining (simple approach for MVP)
async function triggerEmergency(user_id, message) {
  console.log('*** TRIGGER EMERGENCY for user', user_id, message);
  db.get(`SELECT * FROM users WHERE id = ?`, [user_id], (err, row) => {
    if (err || !row) {
      console.error('No user found or db error', err);
      return;
    }
    console.log(`Notify emergency contact ${row.emergency_contact} about user ${row.name}. Message: ${message}`);
    // Send SMS to emergency contact (if configured)
    if (row.emergency_contact) {
      sendSms(row.emergency_contact, `Emergency for ${row.name}: ${message}`);
    }
    // Save a log file for audit
    try {
      const logLine = `${new Date().toISOString()} | EMERGENCY | user:${row.name} | contact:${row.emergency_contact} | msg:${message}\n`;
      fs.appendFileSync('./emergency.log', logLine);
    } catch (e) { console.error('Log write error', e.message); }
  });
}

// End of Twilio integration
