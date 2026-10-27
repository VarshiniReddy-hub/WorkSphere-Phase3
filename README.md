# WorkSphere – HR Management System (HRMS) | Phase 3

**People First. Work Better.**

WorkSphere is a full-stack Human Resource Management System designed to simplify employee management, attendance tracking, leave management, payroll operations, performance reviews, and HR analytics.

Phase 3 extends the HRMS with advanced workforce management features, document management, analytics, notifications, and employee search capabilities.

## Features

### Module 14: Shift Scheduling & Attendance Automation
- Manage employee shift schedules.
- Track employee attendance.
- Support attendance automation and shift-related operations.

### Module 15: Team Leave Calendar & Conflict Detection
- View team leave schedules on a calendar.
- Track approved employee leaves.
- Help identify overlapping leave schedules.

### Module 16: Employee Document Management
- Upload and manage employee documents.
- View available employee documents.
- Support document access and download functionality.

### Module 17: Performance Reviews & Feedback History
- Manage employee performance reviews.
- Record ratings and feedback.
- Maintain performance review history.

### Module 18: Advanced Analytics Dashboard
- View workforce analytics and HR statistics.
- Monitor employee and operational data.
- Present HR information through dashboard visualizations.

### Module 19: Notifications & Alerts
- Display employee and HR notifications.
- Track unread notifications.
- Support notification status updates.

### Module 20: Advanced Employee Search & Filtering
- Search employees by name.
- Filter employees using available criteria, such as department, role, employment status, and attendance.
- Find employee records more efficiently.

## Technology Stack

**Frontend**
- React
- Vite
- JavaScript
- CSS
- React Router
- Axios
- Recharts
- Lucide React

**Backend**
- Python
- FastAPI
- REST APIs
- JWT-based authentication
- Role-Based Access Control (RBAC)

**Database**
- SQLite (if configured in the current project)

## User Roles

| Role | Access |
|---|---|
| EMPLOYEE | Own profile, attendance, leave requests, and permitted personal records |
| HR | Employee management, attendance records, leave decisions, and payroll operations |
| ADMIN | User and role administration, system-wide analytics, and administrative operations |

Access to restricted operations should be enforced by the backend, not only by hiding frontend menu items.

## Project Structure

```text
WorkSphere/
├── backend/
│   ├── app/
│   ├── .venv/
│   └── requirements.txt
└── frontend/
    ├── src/
    ├── public/
    ├── package.json
    └── vite.config.js
```

*The exact file structure may vary depending on the current project implementation.*

## Prerequisites

Install the following before running the project:

- Python 3.10 or a compatible version
- Node.js and npm
- Git

## Installation and Setup

### 1. Clone the repository

```bash
git clone YOUR_GITHUB_REPOSITORY_URL
cd WorkSphere
```

Replace `YOUR_GITHUB_REPOSITORY_URL` with the actual URL of your Phase 3 repository.

### 2. Set up the backend

Open PowerShell in the backend directory:

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

If PowerShell blocks virtual environment activation, use the appropriate execution policy for your environment or activate the environment using Command Prompt.

### 3. Start the backend

```powershell
uvicorn app.main:app --reload --port 8000
```

Backend API:

http://127.0.0.1:8000

Interactive API documentation:

http://127.0.0.1:8000/docs

### 4. Set up the frontend

Open a second terminal:

```powershell
cd frontend
npm install
npm run dev
```

Open the frontend in your browser:

http://127.0.0.1:5173

Keep both backend and frontend terminals running while using the application.

## Authentication and Authorization

- Users authenticate using their credentials.
- JWT tokens are used for authenticated API requests.
- The application supports EMPLOYEE, HR, and ADMIN roles.
- Role-based permissions restrict access to authorized operations.
- Use an account with the appropriate assigned role to test restricted features.

Newly registered accounts may receive the EMPLOYEE role by default, depending on the implementation.

## Testing

The following Phase 3 modules have been tested through the application:

- [x] Module 14 – Shift Scheduling & Attendance Automation
- [x] Module 15 – Team Leave Calendar & Conflict Detection
- [x] Module 16 – Employee Document Management
- [x] Module 17 – Performance Reviews & Feedback History
- [x] Module 18 – Advanced Analytics Dashboard
- [x] Module 19 – Notifications & Alerts
- [x] Module 20 – Advanced Employee Search & Filtering

**Recommended final verification:** Test backend authorization using Employee, HR, and Admin accounts to confirm that restricted API endpoints reject unauthorized requests.

## Future Enhancements

- More detailed HR analytics and reports.
- Improved document security and audit trails.
- Additional notification rules and automation.
- Expanded employee self-service capabilities.
- Further automated backend and frontend testing.

## Project Objective

The objective of WorkSphere is to provide a centralized HR platform that improves employee data management, automates routine HR operations, supports informed decision-making, and simplifies workforce administration.

---

**Project:** WorkSphere – HR Management System  
**Phase:** 3  
**Status:** Phase 3 module testing completed; final role-based security verification recommended.
