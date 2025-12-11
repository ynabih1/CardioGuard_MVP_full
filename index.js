/**
 * CardioGuard - Improved Node.js backend (index.js)
 * - Express + SQLite3
 * - Input validation and normalization
 * - Single async triggerEmergency implementation
 * - Optional Twilio SMS integration via environment variables
 *
 * Environment variables:
 *   PORT (default 3000)
 *   TWILIO_ACCOUNT_SID
 *   TWILIO_AUTH_TOKEN
 *   TWILIO_FROM_NUMBER
 *
 * To run:
 *   npm install
 *   node index.js
 */

require('dotenv').config(); // optional: create a .env file for local development

const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const util = require('util');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json()); // modern express body parser

// Database
const DB_FILE = process.env.DB_FILE || path.join(__dirname, 'cardio.db');
const db = new sqlite3.Database(DB_FILE);

// Promisified helpers
const dbRun = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });

const dbGet = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });

const appendFile = util.promisify(fs.appendFile);

// Initialize tables
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

// Twilio optional
const TWILIO_ENABLED =
  process.env.TWILIO_ACCOUNT_SID &&
  process.env.TWILIO_AUTH_TOKEN &&
  process.env.TWILIO_FROM_NUMBER;

let twilioClient = null;
if (TWILIO_ENABLED) {
  const Twilio = require('twilio');
  twilioClient = new Twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
}

/**
 * sendSms: sends SMS via Twilio if configured, otherwise logs
 */
async function sendSms(to, body) {
  if (!TWILIO_ENABLED) {
    console.log('[SMS stub] To:', to, 'Body:', body);
    return;
  }
  try {
    await twilioClient.messages.create({
      body,
      from: process.env.TWILIO_FROM_NUMBER,
      to,
    });
    console.log('Sent SMS to', to);
  } catch (e) {
    console.error('Twilio SMS error', e && e.message ? e.message : e);
    throw e;
  }
}

/**
 * triggerEmergency: unified emergency handler
 * - Looks up user
 * - Sends SMS to emergency contact if present
 * - Writes audit log to emergency.log
 */
async function triggerEmergency(user_id, message) {
  console.log('*** TRIGGER EMERGENCY for user', user_id, message);
  try {
    const row = await dbGet(`SELECT * FROM users WHERE id = ?`, [user_id]);
    if (!row) {
      console.error('No user found for id', user_id);
      return;
    }

    const contact = row.emergency_contact || null;
    const userName = row.name || `user#${user_id}`;

    console.log(`Notify emergency contact ${contact} about user ${userName}. Message: ${message}`);

    if (contact) {
      try {
        await sendSms(contact, `Emergency for ${userName}: ${message}`);
      } catch (smsErr) {
        console.error('Failed to send SMS to emergency contact:', smsErr && smsErr.message ? smsErr.message : smsErr);
      }
    }

    const logLine = `${new Date().toISOString()} | EMERGENCY | user:${userName} | contact:${contact} | msg:${message}\n`;
    try {
      await appendFile(path.join(__dirname, 'emergency.log'), logLine);
    } catch (logErr) {
      console.error('Failed to write emergency log:', logErr && logErr.message ? logErr.message : logErr);
    }
  } catch (err) {
    console.error('triggerEmergency error', err && err.message ? err.message : err);
  }
}

/**
 * checkForEmergency: returns true if emergency triggered
 * - Robust numeric checks
 * - Accepts accel object where values may be null
 */
async function checkForEmergency(user_id, heart_rate, accel = {}) {
  // Normalize heart rate
  const hrNum = heart_rate === undefined || heart_rate === null ? null : Number(heart_rate);
  if (hrNum !== null && !Number.isNaN(hrNum)) {
    // RULE: bradycardia
    if (hrNum <= 40) {
      await triggerEmergency(user_id, `Low heart rate detected: ${hrNum}`);
      return true;
    }
    // Example additional rule: very high heart rate
    if (hrNum >= 180) {
      await triggerEmergency(user_id, `Very high heart rate detected: ${hrNum}`);
      return true;
    }
  }

  // Normalize accel components
  const ax = accel && typeof accel.x === 'number' ? accel.x : null;
  const ay = accel && typeof accel.y === 'number' ? accel.y : null;
  const az = accel && typeof accel.z === 'number' ? accel.z : null;

  // If we have all components, compute magnitude
  if (ax !== null && ay !== null && az !== null) {
    const mag = Math.sqrt(ax * ax + ay * ay + az * az);
    // Threshold for possible fall — tune as needed
    if (mag > 18) {
      await triggerEmergency(user_id, `Possible fall detected. Accel magnitude: ${mag.toFixed(2)}`);
      return true;
    }
  }

  return false;
}

// Routes

// Health
app.get('/health', (req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

// Register user
app.post('/api/register', async (req, res) => {
  try {
    const { name, phone, emergency_contact } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });

    const result = await dbRun(
      `INSERT INTO users (name, phone, emergency_contact) VALUES (?, ?, ?)`,
      [name, phone || null, emergency_contact || null]
    );
    res.json({ user_id: result.lastID });
  } catch (err) {
    console.error('Register error', err && err.message ? err.message : err);
    res.status(500).json({ error: 'internal_server_error' });
  }
});

// Receive reading
app.post('/api/readings', async (req, res) => {
  try {
    const { user_id, heart_rate, accel } = req.body;

    if (!user_id) return res.status(400).json({ error: 'user_id is required' });

    // Normalize accel values to numbers or null
    const ax = accel && typeof accel.x === 'number' ? accel.x : null;
    const ay = accel && typeof accel.y === 'number' ? accel.y : null;
    const az = accel && typeof accel.z === 'number' ? accel.z : null;

    // Insert reading -- allow nulls
    const insertResult = await dbRun(
      `INSERT INTO readings (user_id, heart_rate, accel_x, accel_y, accel_z) VALUES (?, ?, ?, ?, ?)`,
      [user_id, heart_rate === undefined ? null : heart_rate, ax, ay, az]
    );

    const insertedId = insertResult.lastID;

    // Run emergency check (do not block DB response for long-running tasks too much)
    // We'll await here to return emergency status; in production you may offload to a job queue.
    try {
      const emergency = await checkForEmergency(user_id, heart_rate, { x: ax, y: ay, z: az });
      return res.json({ inserted: insertedId, emergency });
    } catch (checkErr) {
      console.error('Emergency check failed', checkErr && checkErr.message ? checkErr.message : checkErr);
      return res.json({ inserted: insertedId, emergency: false, warning: 'emergency check failed' });
    }
  } catch (err) {
    console.error('Readings error', err && err.message ? err.message : err);
    res.status(500).json({ error: 'internal_server_error' });
  }
});

// Simple endpoint to fetch last N readings for a user (admin/debug)
app.get('/api/users/:id/readings', async (req, res) => {
  try {
    const uid = Number(req.params.id);
    if (Number.isNaN(uid)) return res.status(400).json({ error: 'invalid user id' });

    const rows = await new Promise((resolve, reject) => {
      db.all(
        `SELECT id, user_id, timestamp, heart_rate, accel_x, accel_y, accel_z FROM readings WHERE user_id = ? ORDER BY timestamp DESC LIMIT 100`,
        [uid],
        (err, results) => {
          if (err) return reject(err);
          resolve(results);
        }
      );
    });

    res.json({ readings: rows });
  } catch (err) {
    console.error('Fetch readings error', err && err.message ? err.message : err);
    res.status(500).json({ error: 'internal_server_error' });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`CardioGuard backend running on port ${PORT}`));
