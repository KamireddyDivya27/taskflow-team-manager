
# TaskFlow – Team Task Manager
### Built by Divya Kamireddy | Ethara AI Assessment

---

## What is this?

TaskFlow is a full-stack team task management web application where:
- **Admins** can create projects, add members, create tasks, and assign them
- **Members** can view their assigned tasks and update the status

Think of it like a simplified version of Trello or Asana.

---

## Tech Stack

| Layer    | Technology                         |
|----------|------------------------------------|
| Frontend | HTML, CSS, Vanilla JavaScript (SPA)|
| Backend  | Node.js + Express.js               |
| Database | LowDB (JSON file — zero config)    |
| Auth     | JWT (JSON Web Tokens) + bcryptjs   |
| Deploy   | Railway                            |

---

## Features

- Signup / Login with JWT authentication
- Role-based access: Admin vs Member
- Create, edit, delete projects (Admin)
- Add / remove team members (Admin)
- Create tasks with title, description, priority, due date, assignee (Admin)
- Update task status: To Do → In Progress → Done
- Dashboard with task counts, overdue alerts, recent tasks
- Filter tasks by status and priority
- Overdue task highlighting

---

## How to Run Locally in VS Code

### Step 1 — Make sure Node.js is installed
Open a terminal and type:
```
node --version
```
If you see a version number like v18.x.x, you're good.
If not, download Node.js from https://nodejs.org (choose LTS version)

---

### Step 2 — Open the project in VS Code
1. Unzip the downloaded folder
2. Open VS Code
3. Click File → Open Folder
4. Select the `taskmanager` folder
5. You should see server.js, package.json, and the public folder

---

### Step 3 — Install dependencies
Open the VS Code terminal (press Ctrl + ` or go to Terminal → New Terminal)

Type this command and press Enter:
```
npm install
```
This downloads all the packages the app needs (Express, JWT, bcrypt, etc.)
Wait for it to finish — you'll see "found 0 vulnerabilities"

---

### Step 4 — Start the server
In the same terminal, type:
```
node server.js
```
You should see:
```
✅ TaskFlow server is running at http://localhost:3000
```

---

### Step 5 — Open the app
Open your browser and go to:
```
http://localhost:3000
```
The app will open. You can now sign up and start using it!

---

### Step 6 — Try it out (suggested flow)
1. Click "Sign up" → create an Admin account
2. Go to Projects → click "New project" → create a project
3. Create a second account (Member role) in a new browser tab or incognito window
4. Back in Admin account → go to the project → click "Add member" → add the Member
5. Create a task and assign it to the Member
6. Log in as the Member — you'll see the task in "My tasks"
7. The Member can update the task status to "In progress" or "Done"

---

## How to Deploy on Railway

1. Push your code to a GitHub repository
   - Go to github.com → New repository → upload the project files

2. Go to https://railway.app and sign up (free)

3. Click "New Project" → "Deploy from GitHub repo"

4. Select your repository — Railway auto-detects it's a Node.js app

5. Click "Variables" and add:
   ```
   JWT_SECRET = any_random_strong_string_here
   ```

6. Railway will build and deploy automatically
   You'll get a live URL like: https://taskflow-xxxx.up.railway.app

7. Paste that URL as your live application link in the submission form

---

## API Endpoints

### Auth
```
POST /api/signup    Create a new account
POST /api/login     Log in and get a token
GET  /api/me        Get current user info
```

### Projects
```
GET    /api/projects       List all projects
POST   /api/projects       Create a project (admin only)
PUT    /api/projects/:id   Update a project (admin only)
DELETE /api/projects/:id   Delete a project (admin only)
```

### Members
```
GET    /api/projects/:id/members           List members
POST   /api/projects/:id/members           Add a member (admin only)
DELETE /api/projects/:id/members/:userId   Remove a member (admin only)
GET    /api/users                          List all users (admin only)
```

### Tasks
```
GET    /api/projects/:id/tasks   List tasks in a project
POST   /api/projects/:id/tasks   Create a task (admin only)
PUT    /api/tasks/:id            Update a task (status only for members)
DELETE /api/tasks/:id            Delete a task (admin only)
```

### Dashboard
```
GET /api/dashboard   Stats + recent tasks for the logged-in user
```

---

## Project Structure

```
taskmanager/
├── server.js          ← All backend code (routes, auth, database)
├── public/
│   └── index.html     ← All frontend code (HTML + CSS + JavaScript)
├── package.json       ← Project info and dependencies
├── db.json            ← Auto-created when you first run the app
└── README.md          ← This file
```

---

## Environment Variables

| Variable    | Default                | Description                        |
|-------------|------------------------|------------------------------------|
| PORT        | 3000                   | Port the server runs on            |
| JWT_SECRET  | taskflow_secret_key    | Secret key for signing JWT tokens  |

Always set a strong JWT_SECRET in production.

---

## Interview Talking Points

**Q: How does authentication work?**
When a user signs up or logs in, the server creates a JWT token signed with a secret key. The frontend saves this token in localStorage and sends it with every API request in the Authorization header. The server verifies the token on every protected route.

**Q: How does role-based access work?**
The user's role (admin or member) is stored in the database and also encoded inside the JWT token. On the backend, middleware functions `requireLogin` and `requireAdmin` check the role before allowing access to certain routes.

**Q: Why LowDB instead of SQL/MongoDB?**
LowDB is a simple JSON file database that requires zero setup — perfect for a demo/assignment. The same logic would work with PostgreSQL or MongoDB by just changing the database calls. The API structure remains identical.

**Q: How are overdue tasks detected?**
Each task has an optional `dueDate` field. On the server, we compare `new Date(task.dueDate) < new Date()` and also check that the status isn't 'done'. If both are true, it's overdue.

---

Built for Ethara AI Software Engineer Assessment — 2026
