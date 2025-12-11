# CardioGuard Backend (Node.js + SQLite)

This is an improved Node.js backend for the CardioGuard MVP.

Features:
- Express API for registering users and ingesting readings
- SQLite persistence (file-based DB)
- Input validation and normalization (prevents crashes on missing accel)
- Single, async triggerEmergency flow with optional Twilio SMS support
- Basic health and debugging endpoints

## Quick start

1. Clone or copy files into a project directory.

2. Install dependencies:
```
npm install
```

3. (Optional) Create a `.env` file in the project root to set environment variables:
```
PORT=3000
TWILIO_ACCOUNT_SID=your_sid_here
TWILIO_AUTH_TOKEN=your_token_here
TWILIO_FROM_NUMBER=+1555...
DB_FILE=./cardio.db
```

4. Start the server:
```
npm start
```

During development you may want to use:
```
npm run dev
```

## API

- GET /health
  - Returns { status: 'ok', ts: '...' }

- POST /api/register
  - Body: { name: string, phone?: string, emergency_contact?: string }
  - Response: { user_id: <id> }

- POST /api/readings
  - Body: { user_id: number, heart_rate?: number|string, accel?: { x?: number, y?: number, z?: number } }
  - Response: { inserted: <readingId>, emergency: boolean, ... }

- GET /api/users/:id/readings
  - Returns last 100 readings for user (debug)

## Notes and recommendations

- The emergency detection logic is simple and intended for MVP / prototyping:
  - Triggers on heart_rate <= 40 (bradycardia) or accel magnitude > 18 m/s^2 (possible fall).
  - Tweak thresholds and add smoothing or ML models before production use.
- In production:
  - Move to a robust DB (Postgres, cloud DB) and add migrations.
  - Offload long-running tasks (notifications, heavy analytics) to a job queue.
  - Add authentication (API keys / JWT) and limit endpoints.
  - Harden logging and error monitoring (Sentry, Datadog).
  - Perform security & privacy reviews (HIPAA/GDPR compliance as needed).

## Logs

- Emergency events are appended to `emergency.log` in the project directory.

## License

MIT
