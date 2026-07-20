# Family Document Vault

A secure web app for families to store, organize, and share important documents with expiry reminders and role-based access.

## Quick Start

### Prerequisites
- Node.js 18+ installed

### Running the App

1. **Start the Backend:**
```bash
cd backend
npm start
```
The API runs on http://localhost:3001

2. **Start the Frontend:**
```bash
cd frontend
npm run dev
```
The app runs on http://localhost:5173

### Features
- Email/password authentication with JWT
- Create and manage multiple families
- Invite members via email link
- Upload documents with categories and document types
- Set expiry dates with automatic reminders (30, 7, 1 day)
- Share documents within family or keep private
- External sharing via expiring links
- Role-based access: Admin and Member
- In-app and email notifications
- Responsive modern UI

### Project Structure
```
FamilyHQ/
├── backend/
│   ├── src/
│   │   ├── index.js          # Express server entry
│   │   ├── database.js       # SQLite schema & connection
│   │   ├── middleware/auth.js # JWT auth middleware
│   │   ├── routes/
│   │   │   ├── auth.js       # Signup, login, profile
│   │   │   ├── families.js   # Family CRUD, invites, join
│   │   │   ├── documents.js  # Upload, manage, share, dashboard
│   │   │   └── notifications.js
│   │   └── services/
│   │       ├── email.js      # Nodemailer (Ethereal for dev)
│   │       └── scheduler.js  # Cron job for expiry reminders
│   ├── data/                  # SQLite database (auto-created)
│   └── uploads/               # Document file storage
└── frontend/
    ├── src/
    │   ├── main.jsx
    │   ├── App.jsx
    │   ├── api.js            # API client
    │   ├── context/          # Auth & Family context
    │   ├── components/       # Layout
    │   └── pages/            # All page components
    └── index.html
```

### Tech Stack
- **Backend:** Express.js, SQLite (better-sqlite3), JWT, bcrypt, Multer, node-cron, Nodemailer
- **Frontend:** React 19, Vite, Tailwind CSS 4, React Router, Lucide icons
- **Email:** Ethereal (free test SMTP - emails viewable at https://ethereal.email)
- **Storage:** Local filesystem
- **Database:** SQLite (zero config, no external services)

### Email Configuration
By default, the app uses Ethereal for email testing. Emails are captured and can be viewed at https://ethereal.email using the credentials printed in the server console on startup.

For production, set these in `backend/.env`:
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@gmail.com
SMTP_PASS=app-password
```
