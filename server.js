// ─────────────────────────────────────────────────────────────────────────────
// TaskFlow - Team Task Manager
// Backend: Node.js + Express + LowDB (JSON file database)
// Author : Divya Kamireddy
// ─────────────────────────────────────────────────────────────────────────────

const express  = require('express')
const bcrypt   = require('bcryptjs')
const jwt      = require('jsonwebtoken')
const cors     = require('cors')
const { v4: makeId } = require('uuid')
const low      = require('lowdb')
const FileSync = require('lowdb/adapters/FileSync')
const path     = require('path')

const app    = express()
const PORT   = process.env.PORT || 3000
const SECRET = process.env.JWT_SECRET || 'taskflow_secret_key'

// ── Database setup ────────────────────────────────────────────────────────────
// We use a simple JSON file as our database (LowDB)
// In production you can swap this with PostgreSQL or MongoDB
const db = low(new FileSync('db.json'))

// Define the shape of our database
db.defaults({
  users:    [],
  projects: [],
  tasks:    [],
  members:  []
}).write()

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors())
app.use(express.json())
app.use(express.static(path.join(__dirname, 'public')))

// ─────────────────────────────────────────────────────────────────────────────
// AUTH MIDDLEWARE
// These functions protect routes that require a logged-in user
// ─────────────────────────────────────────────────────────────────────────────

// Check if the request has a valid JWT token
function requireLogin(req, res, next) {
  const authHeader = req.headers.authorization
  const token = authHeader && authHeader.split(' ')[1]

  if (!token) {
    return res.status(401).json({ error: 'You must be logged in to do this.' })
  }

  try {
    // Decode the token to get the user's info
    req.user = jwt.verify(token, SECRET)
    next()
  } catch (e) {
    res.status(401).json({ error: 'Your session expired. Please log in again.' })
  }
}

// Only allow admin users through
function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Only admins are allowed to do this.' })
  }
  next()
}

// ─────────────────────────────────────────────────────────────────────────────
// AUTH ROUTES
// POST /api/signup  — create a new account
// POST /api/login   — log in and get a token
// GET  /api/me      — get the current user's profile
// ─────────────────────────────────────────────────────────────────────────────

app.post('/api/signup', async (req, res) => {
  const { name, email, password, role } = req.body

  // Basic validation
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required.' })
  }

  // Make sure the email isn't already registered
  const emailTaken = db.get('users').find({ email }).value()
  if (emailTaken) {
    return res.status(400).json({ error: 'An account with this email already exists.' })
  }

  // Hash the password before saving (never store plain text passwords)
  const hashedPassword = await bcrypt.hash(password, 10)

  const newUser = {
    id:        makeId(),
    name,
    email,
    password:  hashedPassword,
    role:      role === 'admin' ? 'admin' : 'member',
    createdAt: new Date().toISOString()
  }

  db.get('users').push(newUser).write()

  // Create a token so the user is logged in immediately after signing up
  const token = jwt.sign(
    { id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role },
    SECRET,
    { expiresIn: '7d' }
  )

  res.json({ token, user: { id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role } })
})


app.post('/api/login', async (req, res) => {
  const { email, password } = req.body

  const user = db.get('users').find({ email }).value()

  if (!user) {
    return res.status(400).json({ error: 'No account found with that email.' })
  }

  // Compare the entered password with the stored hash
  const passwordCorrect = await bcrypt.compare(password, user.password)
  if (!passwordCorrect) {
    return res.status(400).json({ error: 'Incorrect password. Please try again.' })
  }

  const token = jwt.sign(
    { id: user.id, name: user.name, email: user.email, role: user.role },
    SECRET,
    { expiresIn: '7d' }
  )

  res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } })
})


app.get('/api/me', requireLogin, (req, res) => {
  const user = db.get('users').find({ id: req.user.id }).value()
  if (!user) return res.status(404).json({ error: 'User not found.' })
  res.json({ id: user.id, name: user.name, email: user.email, role: user.role })
})


// ─────────────────────────────────────────────────────────────────────────────
// PROJECT ROUTES
// GET    /api/projects      — list projects (admins see all, members see theirs)
// POST   /api/projects      — create a project (admin only)
// PUT    /api/projects/:id  — edit a project (admin only)
// DELETE /api/projects/:id  — delete a project and all its tasks (admin only)
// ─────────────────────────────────────────────────────────────────────────────

app.get('/api/projects', requireLogin, (req, res) => {
  let projects

  if (req.user.role === 'admin') {
    // Admins can see every project
    projects = db.get('projects').value()
  } else {
    // Members only see projects they've been added to
    const myProjectIds = db.get('members')
      .filter({ userId: req.user.id })
      .map('projectId')
      .value()

    projects = db.get('projects')
      .filter(p => myProjectIds.includes(p.id))
      .value()
  }

  // Add live stats to each project (task counts, overdue count, etc.)
  const enriched = projects.map(project => {
    const allTasks    = db.get('tasks').filter({ projectId: project.id }).value()
    const memberCount = db.get('members').filter({ projectId: project.id }).value().length
    const now         = new Date()

    return {
      ...project,
      taskCount:      allTasks.length,
      memberCount,
      completedCount: allTasks.filter(t => t.status === 'done').length,
      overdueCount:   allTasks.filter(t => t.dueDate && new Date(t.dueDate) < now && t.status !== 'done').length
    }
  })

  res.json(enriched)
})


app.post('/api/projects', requireLogin, requireAdmin, (req, res) => {
  const { name, description } = req.body

  if (!name) {
    return res.status(400).json({ error: 'Project name is required.' })
  }

  const project = {
    id:          makeId(),
    name:        name.trim(),
    description: description || '',
    createdBy:   req.user.id,
    createdAt:   new Date().toISOString()
  }

  db.get('projects').push(project).write()
  res.json(project)
})


app.put('/api/projects/:id', requireLogin, requireAdmin, (req, res) => {
  const { name, description } = req.body

  const project = db.get('projects').find({ id: req.params.id }).value()
  if (!project) return res.status(404).json({ error: 'Project not found.' })

  db.get('projects').find({ id: req.params.id }).assign({ name, description }).write()
  res.json(db.get('projects').find({ id: req.params.id }).value())
})


app.delete('/api/projects/:id', requireLogin, requireAdmin, (req, res) => {
  // Delete the project along with all its tasks and member links
  db.get('projects').remove({ id: req.params.id }).write()
  db.get('tasks').remove({ projectId: req.params.id }).write()
  db.get('members').remove({ projectId: req.params.id }).write()

  res.json({ message: 'Project deleted successfully.' })
})


// ─────────────────────────────────────────────────────────────────────────────
// MEMBER ROUTES
// GET    /api/projects/:id/members           — list members of a project
// POST   /api/projects/:id/members           — add a member (admin only)
// DELETE /api/projects/:id/members/:userId   — remove a member (admin only)
// GET    /api/users                          — list all users (admin only)
// ─────────────────────────────────────────────────────────────────────────────

app.get('/api/projects/:id/members', requireLogin, (req, res) => {
  const memberships = db.get('members').filter({ projectId: req.params.id }).value()

  // Join each membership with the actual user details
  const result = memberships.map(m => {
    const user = db.get('users').find({ id: m.userId }).value()
    return { ...m, name: user?.name, email: user?.email, role: user?.role }
  })

  res.json(result)
})


app.post('/api/projects/:id/members', requireLogin, requireAdmin, (req, res) => {
  const { userId } = req.body

  if (!userId) {
    return res.status(400).json({ error: 'Please provide the userId of the person to add.' })
  }

  // Check if they're already a member
  const alreadyIn = db.get('members').find({ projectId: req.params.id, userId }).value()
  if (alreadyIn) {
    return res.status(400).json({ error: 'This user is already a member of the project.' })
  }

  const membership = {
    id:        makeId(),
    projectId: req.params.id,
    userId,
    addedAt:   new Date().toISOString()
  }

  db.get('members').push(membership).write()
  res.json(membership)
})


app.delete('/api/projects/:id/members/:userId', requireLogin, requireAdmin, (req, res) => {
  db.get('members')
    .remove({ projectId: req.params.id, userId: req.params.userId })
    .write()

  res.json({ message: 'Member removed from project.' })
})


app.get('/api/users', requireLogin, requireAdmin, (req, res) => {
  // Return all users without their passwords
  const users = db.get('users')
    .map(u => ({ id: u.id, name: u.name, email: u.email, role: u.role }))
    .value()

  res.json(users)
})


// ─────────────────────────────────────────────────────────────────────────────
// TASK ROUTES
// GET    /api/projects/:id/tasks  — list tasks for a project
// POST   /api/projects/:id/tasks  — create a task (admin only)
// PUT    /api/tasks/:id           — update a task (admin can update all, member updates status only)
// DELETE /api/tasks/:id           — delete a task (admin only)
// ─────────────────────────────────────────────────────────────────────────────

app.get('/api/projects/:id/tasks', requireLogin, (req, res) => {
  const tasks = db.get('tasks').filter({ projectId: req.params.id }).value()

  // Add the assignee's name to each task for display purposes
  const enriched = tasks.map(task => {
    const assignee = task.assignedTo
      ? db.get('users').find({ id: task.assignedTo }).value()
      : null

    return { ...task, assigneeName: assignee ? assignee.name : null }
  })

  res.json(enriched)
})


app.post('/api/projects/:id/tasks', requireLogin, requireAdmin, (req, res) => {
  const { title, description, assignedTo, dueDate, priority } = req.body

  if (!title) {
    return res.status(400).json({ error: 'Task title is required.' })
  }

  const task = {
    id:          makeId(),
    projectId:   req.params.id,
    title:       title.trim(),
    description: description || '',
    assignedTo:  assignedTo || null,
    dueDate:     dueDate || null,
    priority:    priority || 'medium',
    status:      'todo',
    createdBy:   req.user.id,
    createdAt:   new Date().toISOString()
  }

  db.get('tasks').push(task).write()
  res.json(task)
})


app.put('/api/tasks/:id', requireLogin, (req, res) => {
  const task = db.get('tasks').find({ id: req.params.id }).value()

  if (!task) {
    return res.status(404).json({ error: 'Task not found.' })
  }

  const userIsAdmin    = req.user.role === 'admin'
  const taskIsAssigned = task.assignedTo === req.user.id

  // Members can only update the status of tasks assigned to them
  if (!userIsAdmin && !taskIsAssigned) {
    return res.status(403).json({ error: 'You can only update tasks that are assigned to you.' })
  }

  // Admins can update everything, members can only update the status field
  const allowedUpdates = userIsAdmin
    ? req.body
    : { status: req.body.status }

  db.get('tasks').find({ id: req.params.id }).assign(allowedUpdates).write()
  res.json(db.get('tasks').find({ id: req.params.id }).value())
})


app.delete('/api/tasks/:id', requireLogin, requireAdmin, (req, res) => {
  db.get('tasks').remove({ id: req.params.id }).write()
  res.json({ message: 'Task deleted.' })
})


// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD ROUTE
// GET /api/dashboard — summary stats and recent tasks for the logged-in user
// ─────────────────────────────────────────────────────────────────────────────

app.get('/api/dashboard', requireLogin, (req, res) => {
  const now = new Date()

  // Admins see stats for all tasks, members see only their own
  const tasks = req.user.role === 'admin'
    ? db.get('tasks').value()
    : db.get('tasks').filter({ assignedTo: req.user.id }).value()

  const stats = {
    total:      tasks.length,
    todo:       tasks.filter(t => t.status === 'todo').length,
    inprogress: tasks.filter(t => t.status === 'inprogress').length,
    done:       tasks.filter(t => t.status === 'done').length,
    overdue:    tasks.filter(t => t.dueDate && new Date(t.dueDate) < now && t.status !== 'done').length
  }

  // Get the 5 most recently created tasks with project and assignee info
  const recentTasks = [...tasks]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 5)
    .map(task => {
      const project  = db.get('projects').find({ id: task.projectId }).value()
      const assignee = task.assignedTo ? db.get('users').find({ id: task.assignedTo }).value() : null
      return { ...task, projectName: project?.name, assigneeName: assignee?.name }
    })

  res.json({ stats, recentTasks })
})


// ─────────────────────────────────────────────────────────────────────────────
// CATCH-ALL ROUTE
// Send the frontend HTML for any URL not matched above (Single Page App)
// ─────────────────────────────────────────────────────────────────────────────

app.get('/{*splat}', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'))
})


// ── Start the server ──────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅ TaskFlow server is running at http://localhost:${PORT}`)
})
