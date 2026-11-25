# StudyRooms authentication setup

The account system uses email and password sign-in, HTTP-only session cookies, and MongoDB. Each user's tasks and notes are stored on that user's MongoDB record. Existing room history remains in the browser.

## Local development

1. Start MongoDB locally, or set `MONGO_URI` to a MongoDB connection string.
2. Copy `Backend/.env.example` to `Backend/.env` and adjust the values if needed.
3. Start the backend from `Backend` with `npm install` followed by `npm start`.
4. Start the frontend from `Frontend` with `npm install` followed by `npm run dev`.

Vite proxies `/api` and Socket.IO to `http://127.0.0.1:5000` by default. Set `VITE_SERVER_LOCAL` in the frontend environment to use another local backend address.

## Production

Set `NODE_ENV=production`, `MONGO_URI`, and `FRONTEND_ORIGIN` on the backend. `FRONTEND_ORIGIN` must contain the exact frontend origin; separate multiple origins with commas. Set `VITE_SERVER_URL` during the frontend build to the backend origin. The session cookie requires HTTPS in production, and the API rejects browser origins that are not listed in `FRONTEND_ORIGIN`.

This college project prototype does not include email verification or password recovery. Older browser-only workspace data is not imported into accounts.
