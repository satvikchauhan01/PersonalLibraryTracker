# Personal Library Tracker
Smart MERN application that helps users track their books.

## Running locally with Docker

```bash
docker compose up --build
```

Then open **http://localhost:3000**. This starts MongoDB, the API (port 5001), and the client (nginx, port 3000) with working local-dev defaults — no `.env` file required. Payments/uploads/email/error-reporting integrations (Razorpay, Cloudinary, Resend, Sentry) are optional; the app runs fully without them, those specific features just stay inactive until real keys are added (see `server/.env.example` / `client/.env.example`).

## API docs

With the server running: **http://localhost:5001/api/docs** (Swagger UI).

## Health check

`GET /health` — `200` when Mongo is connected, `503` when it isn't. Used by uptime monitors / container orchestrators, not by the app itself.
