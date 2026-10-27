import { useEffect, useState } from 'react'
import {
  Routes, Route, Navigate, NavLink, useNavigate
} from 'react-router-dom'
import {
  Users, LayoutDashboard, Clock3, CalendarDays, Wallet, Bell,
  LogOut, BriefcaseBusiness, Menu, X, CheckCircle2,
  CircleUserRound, Search, RefreshCw, FileText, Star, BarChart3, SlidersHorizontal, Clock4
} from 'lucide-react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  Tooltip, CartesianGrid
} from 'recharts'
import api from './api'

const money = n =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(Number(n || 0))

function getStoredUser() {
  const token = localStorage.getItem('worksphere_token')

  if (!token) {
    localStorage.removeItem('worksphere_user')
    return null
  }

  try {
    const user = JSON.parse(localStorage.getItem('worksphere_user'))

    if (user && typeof user === 'object' && user.id && user.role) {
      return user
    }

    localStorage.removeItem('worksphere_token')
    localStorage.removeItem('worksphere_user')
    return null
  } catch {
    localStorage.removeItem('worksphere_token')
    localStorage.removeItem('worksphere_user')
    return null
  }
}

function App() {
  const [user, setUser] = useState(getStoredUser)
  const [menu, setMenu] = useState(false)
  const [toast, setToast] = useState('')
  const navigate = useNavigate()

  function logout() {
    localStorage.removeItem('worksphere_token')
    localStorage.removeItem('worksphere_user')
    setUser(null)
    setMenu(false)
    navigate('/login')
  }

  function loginSuccess(data) {
    if (!data?.access_token || !data?.user) {
      console.error('Login response is missing access_token or user.')
      return
    }

    localStorage.setItem('worksphere_token', data.access_token)
    localStorage.setItem('worksphere_user', JSON.stringify(data.user))
    setUser(data.user)
    navigate('/dashboard')
  }

  const notify = message => {
    setToast(message)
    setTimeout(() => setToast(''), 3500)
  }

  // FIX: Optional chaining prevents an error when user is null.
  const items = [
    ['/dashboard', 'Overview', LayoutDashboard],
    ['/profile', 'My profile', CircleUserRound],
    ['/employees', 'Employees', Users],
    ['/attendance', 'Attendance', Clock3],
    ['/leaves', 'Leave management', CalendarDays],
    ['/payroll', 'Payroll', Wallet],
    ['/notifications', 'Notifications', Bell],
    ['/shifts', 'Shift schedule', Clock4],
    ['/leave-calendar', 'Leave calendar', CalendarDays],
    ['/documents', 'Documents', FileText],
    ['/performance', 'Performance', Star],
    ...(user?.role === 'HR' || user?.role === 'ADMIN'
      ? [['/analytics', 'Advanced analytics', BarChart3], ['/employee-search', 'Employee search', SlidersHorizontal]]
      : []),
    ...(user?.role === 'ADMIN'
      ? [['/admin/users', 'User management', Users]]
      : [])
  ]

  return (
    <Routes>
      <Route
        path="/login"
        element={
          user
            ? <Navigate to="/dashboard" replace />
            : <AuthPage onSuccess={loginSuccess} notify={notify} />
        }
      />

      <Route
        path="/register"
        element={
          user
            ? <Navigate to="/dashboard" replace />
            : <AuthPage register onSuccess={loginSuccess} notify={notify} />
        }
      />

      <Route
        path="/*"
        element={
          user ? (
            <div className="app-shell">
              <aside className={`sidebar ${menu ? 'show' : ''}`}>
                <div className="brand">
                  <div className="brand-mark">
                    <BriefcaseBusiness size={22} />
                  </div>

                  <div>
                    <b>WorkSphere</b>
                    <small>PEOPLE & CULTURE</small>
                  </div>

                  <button
                    className="mobile-close"
                    onClick={() => setMenu(false)}
                  >
                    <X />
                  </button>
                </div>

                <div className="nav-caption">WORKSPACE</div>

                <nav>
                  {items.map(([path, label, Icon]) => (
                    <NavLink
                      key={path}
                      to={path}
                      onClick={() => setMenu(false)}
                      className={({ isActive }) =>
                        isActive ? 'nav-item active' : 'nav-item'
                      }
                    >
                      <Icon size={18} />
                      <span>{label}</span>
                    </NavLink>
                  ))}
                </nav>

                <div className="sidebar-bottom">
                  <div className="avatar">
                    {user.username?.slice(0, 1).toUpperCase()}
                  </div>

                  <div className="user-meta">
                    <b>{user.username}</b>
                    <small>{user.role}</small>
                  </div>

                  <button
                    className="icon-btn"
                    title="Log out"
                    onClick={logout}
                  >
                    <LogOut size={18} />
                  </button>
                </div>
              </aside>

              <main className="main">
                <header className="topbar">
                  <button
                    className="mobile-menu icon-btn"
                    onClick={() => setMenu(true)}
                  >
                    <Menu />
                  </button>

                  <div className="crumb">
                    Workspace <span>/</span> <b>HR Management</b>
                  </div>

                  <div className="top-actions">
                    <span className="today">
                      {new Date().toLocaleDateString('en-IN', {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </span>

                    <button
                      className="icon-btn"
                      onClick={() => navigate('/notifications')}
                    >
                      <Bell size={19} />
                    </button>

                    <div className="top-avatar">
                      {user.username?.slice(0, 1).toUpperCase()}
                    </div>
                  </div>
                </header>

                <div className="content">
                  <Routes>
                    <Route
                      path="/"
                      element={<Navigate to="/dashboard" replace />}
                    />

                    <Route
                      path="/dashboard"
                      element={<Dashboard user={user} notify={notify} />}
                    />

                    <Route
                      path="/profile"
                      element={<Profile user={user} />}
                    />

                    <Route
                      path="/employees"
                      element={<Employees user={user} notify={notify} />}
                    />

                    <Route
                      path="/attendance"
                      element={<Attendance notify={notify} />}
                    />

                    <Route
                      path="/leaves"
                      element={<Leaves user={user} notify={notify} />}
                    />

                    <Route
                      path="/payroll"
                      element={<Payroll user={user} notify={notify} />}
                    />

                    <Route
                      path="/notifications"
                      element={<Notifications notify={notify} />}
                    />
                    <Route path="/shifts" element={<ShiftManagement notify={notify} user={user} />} />
                    <Route path="/leave-calendar" element={<LeaveCalendar />} />
                    <Route path="/documents" element={<Documents user={user} notify={notify} />} />
                    <Route path="/performance" element={<Performance user={user} notify={notify} />} />
                    <Route path="/analytics" element={user?.role === 'HR' || user?.role === 'ADMIN' ? <AdvancedAnalytics /> : <Navigate to="/dashboard" replace />} />
                    <Route path="/employee-search" element={user?.role === 'HR' || user?.role === 'ADMIN' ? <EmployeeSearch /> : <Navigate to="/dashboard" replace />} />

                    {/* FIX: Safely check the role for the Admin route. */}
                    <Route
                      path="/admin/users"
                      element={
                        user?.role === 'ADMIN'
                          ? <AdminUsers notify={notify} />
                          : <Navigate to="/dashboard" replace />
                      }
                    />

                    <Route
                      path="*"
                      element={<Navigate to="/dashboard" replace />}
                    />
                  </Routes>
                </div>
              </main>

              {toast && (
                <div className="toast">
                  <CheckCircle2 size={18} />
                  {toast}
                </div>
              )}
            </div>
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
    </Routes>
  )
}

function AuthPage({ register = false, onSuccess, notify }) {
  const [form, setForm] = useState({
    username: '',
    email: '',
    password: '',
    full_name: '',
    role: 'EMPLOYEE'
  })

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')

    try {
      if (register) {
        await api.post('/auth/register', form)
        notify('Account created. Please sign in.')
        navigate('/login')
      } else {
        const { data } = await api.post('/auth/login', {
          username: form.username,
          password: form.password,
          role: form.role
        })

        onSuccess(data)
      }
    } catch (err) {
      setError(
        err.response?.data?.detail ||
        'Could not connect to the server. Is the backend running?'
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-art">
        <div className="auth-brand">
          <div className="brand-mark">
            <BriefcaseBusiness />
          </div>
          <b>WorkSphere</b>
        </div>

        <div className="art-copy">
          <span className="eyebrow">PEOPLE FIRST. WORK BETTER.</span>
          <h1>Great teams<br />build great things.</h1>
          <p>
            Your people, operations and insights — all in one
            thoughtful workspace.
          </p>

          <div className="art-stats">
            <div><b>01</b><span>People</span></div>
            <div><b>02</b><span>Operations</span></div>
            <div><b>03</b><span>Growth</span></div>
          </div>
        </div>

        <div className="art-footer">
          A simpler way to manage work.
        </div>
      </div>

      <div className="auth-panel">
        <form className="auth-form" onSubmit={submit}>
          <div className="mobile-brand">
            <div className="brand-mark">
              <BriefcaseBusiness />
            </div>
            <b>WorkSphere</b>
          </div>

          <span className="eyebrow">WELCOME TO WORKSPHERE</span>

          <h2>{register ? 'Create your account' : 'Welcome back'}</h2>

          <p className="muted">
            {register
              ? 'Set up your employee account to get started.'
              : 'Sign in to access your HR workspace.'}
          </p>

          {register && (
            <label>
              Full name
              <input
                required
                minLength="2"
                value={form.full_name}
                onChange={e =>
                  setForm({ ...form, full_name: e.target.value })
                }
                placeholder="e.g. Alex Morgan"
              />
            </label>
          )}

          <label>
            Username
            <input
              required
              minLength="3"
              value={form.username}
              onChange={e =>
                setForm({ ...form, username: e.target.value })
              }
              placeholder="Your username"
            />
          </label>

          {register && (
            <label>
              Email address
              <input
                required
                type="email"
                value={form.email}
                onChange={e =>
                  setForm({ ...form, email: e.target.value })
                }
                placeholder="you@company.com"
              />
            </label>
          )}

          {!register && (
            <label>
              Sign in as
              <select
                required
                value={form.role}
                onChange={e =>
                  setForm({ ...form, role: e.target.value })
                }
              >
                <option value="EMPLOYEE">1. Employee</option>
                <option value="HR">2. HR</option>
                <option value="ADMIN">3. Admin</option>
              </select>
            </label>
          )}

          <label>
            Password
            <input
              required
              minLength="8"
              type="password"
              value={form.password}
              onChange={e =>
                setForm({ ...form, password: e.target.value })
              }
              placeholder="At least 8 characters"
            />
          </label>

          {error && <div className="error">{String(error)}</div>}

          <button className="primary full" disabled={busy}>
            {busy
              ? 'Please wait…'
              : register
                ? 'Create account'
                : 'Sign in'}
            <span>→</span>
          </button>

          <p className="auth-switch">
            {register
              ? 'Already have an account?'
              : 'New to WorkSphere?'}

            {' '}

            <button
              type="button"
              onClick={() =>
                navigate(register ? '/login' : '/register')
              }
            >
              {register ? 'Sign in' : 'Create account'}
            </button>
          </p>

          <p className="auth-note">
            {register
              ? 'New registrations are created as Employee accounts. HR/Admin roles must be assigned by an administrator.'
              : 'Your selected role must match the role assigned to your account.'}
          </p>
        </form>
      </div>
    </div>
  )
}

function PageHeader({ eyebrow, title, subtitle, action }) {
  return (
    <div className="page-header">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      {action}
    </div>
  )
}

function Stat({ label, value, detail, Icon, tint = 'blue' }) {
  return (
    <div className="stat-card">
      <div className="stat-top">
        <span>{label}</span>
        <div className={`stat-icon ${tint}`}>
          <Icon size={19} />
        </div>
      </div>
      <div className="stat-value">{value}</div>
      <div className="stat-detail">{detail}</div>
    </div>
  )
}

function Panel({ title, sub, children, action }) {
  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h3>{title}</h3>
          {sub && <p>{sub}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

function Empty({ text = 'No records found' }) {
  return (
    <div className="empty">
      <CircleUserRound size={28} />
      <span>{text}</span>
    </div>
  )
}

function Profile({ user }) {
  const [employee, setEmployee] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get('/employees')
      .then(({ data }) => {
        setEmployee(
          data.find(e => e.user_id === user.id) || data[0] || null
        )
      })
      .catch(e => {
        setError(
          e.response?.data?.detail || 'Unable to load profile'
        )
      })
  }, [user.id])

  return (
    <>
      <PageHeader
        eyebrow="EMPLOYEE SELF-SERVICE"
        title="My profile"
        subtitle="Your account and employment information."
      />

      {error && <div className="error">{error}</div>}

      <Panel
        title="Account details"
        sub="Authenticated user information"
      >
        <div className="profile-details">
          <div className="person-avatar">
            {user.username?.slice(0, 1).toUpperCase()}
          </div>
          <div>
            <h3>{employee?.full_name || user.username}</h3>
            <p>{user.email}</p>
            <Status value={user.role} />
          </div>
        </div>

        <div className="table-scroll">
          <table>
            <tbody>
              <tr><th>Username</th><td>{user.username}</td></tr>
              <tr><th>Role</th><td>{user.role}</td></tr>
              <tr>
                <th>Employee ID</th>
                <td>{employee?.id ?? 'Not assigned'}</td>
              </tr>
              <tr>
                <th>Designation</th>
                <td>{employee?.designation || '—'}</td>
              </tr>
              <tr>
                <th>Department</th>
                <td>{employee?.department || '—'}</td>
              </tr>
              <tr>
                <th>Joining date</th>
                <td>{employee?.joining_date || '—'}</td>
              </tr>
              <tr>
                <th>Employment status</th>
                <td>{employee?.status || '—'}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  )
}

function Dashboard({ user }) {
  const [data, setData] = useState(null)
  const [attendance, setAttendance] = useState([])
  const [leaves, setLeaves] = useState([])
  const [error, setError] = useState('')

  async function load() {
    try {
      const [a, l] = await Promise.all([
        api.get('/attendance'),
        api.get('/leaves')
      ])

      setAttendance(a.data)
      setLeaves(l.data)

      if (user.role !== 'EMPLOYEE') {
        const d = await api.get('/dashboard')
        setData(d.data)
      } else {
        setData({
          total_employees: 1,
          active_employees: 1,
          present_today: a.data.filter(
            x => x.date === new Date().toISOString().slice(0, 10)
          ).length,
          pending_leaves: l.data.filter(
            x => x.status === 'PENDING'
          ).length,
          approved_leaves: l.data.filter(
            x => x.status === 'APPROVED'
          ).length,
          payroll_this_month: 0
        })
      }

      setError('')
    } catch (e) {
      setError(
        e.response?.data?.detail || 'Could not load dashboard'
      )
    }
  }

  useEffect(() => {
    load()
  }, [])

  const stats = [
    ['Total employees', data?.total_employees ?? '—', 'Employee records', Users, 'blue'],
    ['Present today', data?.present_today ?? '—', 'Attendance records', Clock3, 'green'],
    ['Pending leaves', data?.pending_leaves ?? '—', 'Awaiting decision', CalendarDays, 'amber'],
    ['Payroll this month', money(data?.payroll_this_month), 'Net payroll total', Wallet, 'purple']
  ]

  return (
    <>
      <PageHeader
        eyebrow="YOUR WORKSPACE"
        title={`Good ${
          new Date().getHours() < 12
            ? 'morning'
            : new Date().getHours() < 18
              ? 'afternoon'
              : 'evening'
        }, ${user.username}`}
        subtitle="Here’s what’s happening across your workspace today."
        action={
          <button className="secondary" onClick={load}>
            <RefreshCw size={16} /> Refresh
          </button>
        }
      />

      {error && <div className="error">{error}</div>}

      <div className="stats-grid">
        {stats.map(([label, value, detail, Icon, tint]) => (
          <Stat
            key={label}
            label={label}
            value={value}
            detail={detail}
            Icon={Icon}
            tint={tint}
          />
        ))}
      </div>

      <div className="dashboard-grid">
        <Panel
          title="Attendance overview"
          sub="Recent attendance records"
        >
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={[
                  { name: 'Present', count: data?.present_today || 0 },
                  { name: 'Pending leaves', count: data?.pending_leaves || 0 },
                  { name: 'Approved leaves', count: data?.approved_leaves || 0 }
                ]}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#e9edf4"
                />
                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} axisLine={false} tickLine={false} />
                <Tooltip />
                <Bar
                  dataKey="count"
                  fill="#5965d8"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={46}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel
          title="Recent leave requests"
          sub="Your latest leave activity"
          action={<span className="small-link">{leaves.length} total</span>}
        >
          {leaves.slice(0, 5).length
            ? leaves.slice(0, 5).map(l => (
                <div className="activity-row" key={l.id}>
                  <div className="activity-icon">
                    <CalendarDays size={17} />
                  </div>
                  <div className="activity-copy">
                    <b>{l.leave_type} leave</b>
                    <small>{l.start_date} – {l.end_date}</small>
                  </div>
                  <Status value={l.status} />
                </div>
              ))
            : <Empty text="No leave requests yet" />}
        </Panel>
      </div>

      <Panel
        title="Quick actions"
        sub="Common tasks for your workday"
      >
        <div className="quick-grid">
          <a href="/attendance" className="quick-action">
            <Clock3 />
            <b>Record attendance</b>
            <span>Check in or check out</span>
          </a>
          <a href="/leaves" className="quick-action">
            <CalendarDays />
            <b>Request leave</b>
            <span>Submit a new request</span>
          </a>
          <a href="/employees" className="quick-action">
            <Users />
            <b>Employee directory</b>
            <span>View employee details</span>
          </a>
        </div>
      </Panel>
    </>
  )
}

function Status({ value }) {
  return (
    <span className={`status ${String(value).toLowerCase()}`}>
      {String(value).replace('_', ' ')}
    </span>
  )
}

function Employees({ user }) {
  const [rows, setRows] = useState([])
  const [search, setSearch] = useState('')
  const [department, setDepartment] = useState('')
  const [error, setError] = useState('')

  async function load() {
    try {
      const { data } = await api.get('/employees', {
        params: { search, department }
      })
      setRows(data)
      setError('')
    } catch (e) {
      setError(
        e.response?.data?.detail || 'Unable to load employees'
      )
    }
  }

  useEffect(() => {
    load()
  }, [])

  const canManage = ['HR', 'ADMIN'].includes(user.role)

  return (
    <>
      <PageHeader
        eyebrow="PEOPLE DIRECTORY"
        title="Employees"
        subtitle="Find team members and review employee information."
        action={
          <button className="secondary" onClick={load}>
            <RefreshCw size={16} /> Refresh
          </button>
        }
      />

      <Panel
        title="Employee directory"
        sub={`${rows.length} records visible`}
      >
        <div className="filters">
          <div className="searchbox">
            <Search size={17} />
            <input
              placeholder="Search employee name…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && load()}
            />
          </div>

          <input
            className="filter-input"
            placeholder="Department"
            value={department}
            onChange={e => setDepartment(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && load()}
          />

          <button className="primary" onClick={load}>Search</button>
        </div>

        {error && <div className="error">{error}</div>}

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>EMPLOYEE</th>
                <th>DESIGNATION</th>
                <th>DEPARTMENT</th>
                <th>JOINED</th>
                <th>STATUS</th>
                {canManage && <th>SALARY</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id}>
                  <td>
                    <div className="person-cell">
                      <div className="person-avatar">
                        {r.full_name?.slice(0, 1)}
                      </div>
                      <div>
                        <b>{r.full_name}</b>
                        <small>Employee #{r.id}</small>
                      </div>
                    </div>
                  </td>
                  <td>{r.designation}</td>
                  <td>{r.department}</td>
                  <td>{r.joining_date}</td>
                  <td><Status value={r.status} /></td>
                  {canManage && <td>{money(r.salary)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!rows.length && !error && (
          <Empty text="No employee records found" />
        )}
      </Panel>

      <p className="hint">
        Employee creation and editing are available through the protected API.
        See the README for Swagger examples.
      </p>
    </>
  )
}

function Attendance({ notify }) {
  const user = getStoredUser() || {}
  const [rows, setRows] = useState([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function load() {
    try {
      const { data } = await api.get('/attendance')
      setRows(data)
      setError('')
    } catch (e) {
      setError(
        e.response?.data?.detail || 'Unable to load attendance'
      )
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function mark(action) {
    setBusy(true)

    try {
      const { data } = await api.post(`/attendance/${action}`)
      notify(
        data.message +
        (data.working_hours !== undefined
          ? ` · ${data.working_hours} hours`
          : '')
      )
      await load()
    } catch (e) {
      setError(
        e.response?.data?.detail || 'Attendance action failed'
      )
    } finally {
      setBusy(false)
    }
  }

  async function markAbsent() {
    try {
      const { data } = await api.post('/attendance/mark-absent')
      notify(`${data.message}: ${data.new_absent_records} records`)
      await load()
    } catch (e) {
      setError(
        e.response?.data?.detail || 'Unable to mark absent'
      )
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="TIME & ATTENDANCE"
        title="Attendance"
        subtitle="Record your workday and review attendance history."
        action={
          ['HR', 'ADMIN'].includes(user.role)
            ? <button className="secondary" onClick={markAbsent}>Mark absentees</button>
            : null
        }
      />

      <div className="attendance-banner">
        <div className="attendance-banner-icon">
          <Clock3 size={25} />
        </div>
        <div>
          <h3>Ready to start your day?</h3>
          <p>Check in when you begin work and check out when you finish.</p>
        </div>
        <div className="banner-actions">
          <button
            className="primary"
            disabled={busy}
            onClick={() => mark('check-in')}
          >
            Check in
          </button>
          <button
            className="secondary light"
            disabled={busy}
            onClick={() => mark('check-out')}
          >
            Check out
          </button>
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      <Panel
        title="Attendance history"
        sub="Most recent records first"
      >
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>DATE</th>
                <th>CHECK IN</th>
                <th>CHECK OUT</th>
                <th>WORKING HOURS</th>
                <th>STATUS</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id}>
                  <td>{r.date}</td>
                  <td>{r.check_in ? new Date(r.check_in).toLocaleTimeString() : '—'}</td>
                  <td>{r.check_out ? new Date(r.check_out).toLocaleTimeString() : '—'}</td>
                  <td>
                    {r.working_hours === null
                      ? 'In progress'
                      : `${r.working_hours} hrs`}
                  </td>
                  <td><Status value={r.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!rows.length && <Empty text="No attendance records yet" />}
      </Panel>
    </>
  )
}

function Leaves({ user, notify }) {
  const [rows, setRows] = useState([])
  const [balances, setBalances] = useState([])
  const [form, setForm] = useState({
    leave_type: 'CASUAL',
    start_date: '',
    end_date: '',
    reason: ''
  })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const canApprove = ['HR', 'ADMIN'].includes(user.role)

  async function load() {
    try {
      const { data } = await api.get('/leaves')
      setRows(data)

      if (user.role === 'EMPLOYEE') {
        const b = await api.get('/leave-balances')
        setBalances(b.data)
      }

      setError('')
    } catch (e) {
      setError(e.response?.data?.detail || 'Unable to load leaves')
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function submit(e) {
    e.preventDefault()
    setBusy(true)

    try {
      await api.post('/leaves', form)
      notify('Leave request submitted')
      setForm({
        leave_type: 'CASUAL',
        start_date: '',
        end_date: '',
        reason: ''
      })
      await load()
    } catch (e) {
      setError(e.response?.data?.detail || 'Unable to submit leave')
    } finally {
      setBusy(false)
    }
  }

  async function decide(id, status) {
    try {
      await api.patch(`/leaves/${id}/decision`, { status })
      notify(`Leave ${status.toLowerCase()}`)
      await load()
    } catch (e) {
      setError(e.response?.data?.detail || 'Unable to update request')
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="TIME OFF"
        title="Leave management"
        subtitle="Submit leave requests and track decisions."
      />

      {balances.length > 0 && (
        <Panel
          title="Your leave balance"
          sub="Available working days by policy"
        >
          <div className="stats-grid">
            {balances.map(b => (
              <Stat
                key={b.leave_type}
                label={`${b.leave_type} leave`}
                value={`${b.remaining_days} days`}
                detail={`${b.total_days_allowed} days allowed`}
                Icon={CalendarDays}
                tint="green"
              />
            ))}
          </div>
        </Panel>
      )}

      <div className="two-col">
        <Panel
          title="Request time off"
          sub="Share your dates and reason"
        >
          <form className="stack-form" onSubmit={submit}>
            <label>
              Leave type
              <select
                value={form.leave_type}
                onChange={e => setForm({ ...form, leave_type: e.target.value })}
              >
                <option>CASUAL</option>
                <option>SICK</option>
                <option>PAID</option>
              </select>
            </label>

            <div className="form-row">
              <label>
                Start date
                <input
                  type="date"
                  required
                  value={form.start_date}
                  onChange={e => setForm({ ...form, start_date: e.target.value })}
                />
              </label>

              <label>
                End date
                <input
                  type="date"
                  required
                  min={form.start_date || undefined}
                  value={form.end_date}
                  onChange={e => setForm({ ...form, end_date: e.target.value })}
                />
              </label>
            </div>

            <label>
              Reason
              <textarea
                required
                minLength="3"
                rows="3"
                placeholder="Briefly explain your request…"
                value={form.reason}
                onChange={e => setForm({ ...form, reason: e.target.value })}
              />
            </label>

            <button className="primary" disabled={busy}>
              {busy ? 'Submitting…' : 'Submit request →'}
            </button>
          </form>
        </Panel>

        <Panel title="Leave requests" sub={`${rows.length} requests`}>
          {rows.length
            ? rows.map(l => (
                <div className="leave-card" key={l.id}>
                  <div className="leave-card-top">
                    <b>{l.leave_type} leave · #{l.id}</b>
                    <Status value={l.status} />
                  </div>

                  <div className="leave-dates">
                    {l.start_date} — {l.end_date}
                  </div>

                  <p>{l.reason}</p>

                  {canApprove && l.status === 'PENDING' && (
                    <div className="decision-actions">
                      <button
                        className="approve"
                        onClick={() => decide(l.id, 'APPROVED')}
                      >
                        Approve
                      </button>
                      <button
                        className="reject"
                        onClick={() => decide(l.id, 'REJECTED')}
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              ))
            : <Empty text="No leave requests yet" />}
        </Panel>
      </div>

      {error && <div className="error">{error}</div>}
    </>
  )
}

function Payroll({ user, notify }) {
  const [rows, setRows] = useState([])
  const [employees, setEmployees] = useState([])
  const [form, setForm] = useState({
    employee_id: '',
    basic_salary: '',
    allowances: '0',
    deductions: '0',
    bonus: '0',
    month: new Date().toISOString().slice(0, 7)
  })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const canManage = ['HR', 'ADMIN'].includes(user.role)
  
  async function downloadPayslip(payrollId) {
    try {
      const response = await api.get(
        `/payroll/${payrollId}/payslip`,
        { responseType: 'blob' }
      )

      const pdfUrl = window.URL.createObjectURL(
        new Blob([response.data], { type: 'application/pdf' })
      )

      const link = document.createElement('a')
      link.href = pdfUrl
      link.download = `payslip_${payrollId}.pdf`

      document.body.appendChild(link)
      link.click()
      link.remove()

      window.URL.revokeObjectURL(pdfUrl)
      notify('Payslip downloaded successfully')
    } catch (e) {
      console.error('Payslip download failed:', e)
      setError('Unable to download payslip. Please try again.')
    }
  }


  async function load() {
    try {
      const { data } = await api.get('/payroll')
      setRows(data)

      if (canManage) {
        const e = await api.get('/employees')
        setEmployees(e.data)
      }

      setError('')
    } catch (e) {
      setError(e.response?.data?.detail || 'Unable to load payroll')
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function submit(e) {
    e.preventDefault()
    setBusy(true)

    try {
      await api.post('/payroll', {
        ...form,
        employee_id: Number(form.employee_id),
        basic_salary: Number(form.basic_salary),
        allowances: Number(form.allowances),
        deductions: Number(form.deductions),
        bonus: Number(form.bonus)
      })

      notify('Payroll generated successfully')
      await load()
    } catch (e) {
      setError(e.response?.data?.detail || 'Unable to generate payroll')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="COMPENSATION"
        title="Payroll"
        subtitle="Review salary records and monthly payroll calculations."
      />

      <div className="stats-grid two-stats">
        <Stat
          label="Payroll records"
          value={rows.length}
          detail="Accessible records"
          Icon={Wallet}
        />
        <Stat
          label="Net salary total"
          value={money(rows.reduce((a, r) => a + Number(r.net_salary), 0))}
          detail="Across listed records"
          Icon={CheckCircle2}
          tint="green"
        />
      </div>

      {canManage && (
        <Panel
          title="Generate payroll"
          sub="Create one payroll record per employee per month"
        >
          <form className="payroll-form" onSubmit={submit}>
            <label>
              Employee
              <select
                required
                value={form.employee_id}
                onChange={e => {
                  const emp = employees.find(
                    x => x.id === Number(e.target.value)
                  )

                  setForm({
                    ...form,
                    employee_id: e.target.value,
                    basic_salary: emp ? String(emp.salary) : form.basic_salary
                  })
                }}
              >
                <option value="">Select employee</option>
                {employees.map(e => (
                  <option key={e.id} value={e.id}>
                    {e.full_name} · #{e.id}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Month
              <input
                required
                type="month"
                value={form.month}
                onChange={e => setForm({ ...form, month: e.target.value })}
              />
            </label>

            <label>
              Basic salary
              <input
                required
                type="number"
                min="0"
                step=".01"
                value={form.basic_salary}
                onChange={e => setForm({ ...form, basic_salary: e.target.value })}
              />
            </label>

            <label>
              Allowances
              <input
                type="number"
                min="0"
                step=".01"
                value={form.allowances}
                onChange={e => setForm({ ...form, allowances: e.target.value })}
              />
            </label>

            <label>
              Deductions
              <input
                type="number"
                min="0"
                step=".01"
                value={form.deductions}
                onChange={e => setForm({ ...form, deductions: e.target.value })}
              />
            </label>

            <label>
              Bonus
              <input
                type="number"
                min="0"
                step=".01"
                value={form.bonus}
                onChange={e => setForm({ ...form, bonus: e.target.value })}
              />
            </label>

            <button
              className="primary"
              disabled={busy || !form.employee_id}
            >
              {busy ? 'Generating…' : 'Generate payroll'}
            </button>
          </form>
        </Panel>
      )}

      {error && <div className="error">{error}</div>}

      <Panel title="Salary records" sub="Monthly payroll details">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>EMPLOYEE ID</th>
                <th>MONTH</th>
                <th>BASIC</th>
                <th>ALLOWANCES</th>
                <th>DEDUCTIONS</th>
                <th>BONUS</th>
                <th>NET SALARY</th>
                <th>PAYSLIP</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id}>
                  <td>#{r.employee_id}</td>
                  <td>{r.month}</td>
                  <td>{money(r.basic_salary)}</td>
                  <td>{money(r.allowances)}</td>
                  <td>{money(r.deductions)}</td>
                  <td>{money(r.bonus)}</td>
                  <td>{money(r.net_salary)}</td>
                  <td>
                    <button
                      className="secondary compact"
                      onClick={() => downloadPayslip(r.id)}
                    >
                      Download
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!rows.length && <Empty text="No payroll records yet" />}
      </Panel>
    </>
  )
}

function Notifications() {
  const [data, setData] = useState({
    items: [],
    unread_count: 0
  })
  const [error, setError] = useState('')

  async function load() {
    try {
      const { data } = await api.get('/notifications')
      setData(data)
      setError('')
    } catch (e) {
      setError(
        e.response?.data?.detail || 'Unable to load notifications'
      )
    }
  }

  useEffect(() => {
    load()
    const timer = window.setInterval(load, 30000)
    return () => window.clearInterval(timer)
  }, [])

  async function read(id) {
    try {
      await api.patch(`/notifications/${id}/read`)
      await load()
    } catch (e) {
      setError(
        e.response?.data?.detail || 'Unable to update notification'
      )
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="UPDATES"
        title="Notifications"
        subtitle="Keep track of important activity in your workspace."
        action={<span className="unread-pill">{data.unread_count} unread</span>}
      />

      {error && <div className="error">{error}</div>}

      <Panel title="Your notifications" sub="Latest updates first">
        {data.items.length
          ? data.items.map(n => (
              <div
                className={`notification-row ${n.is_read ? 'read' : ''}`}
                key={n.id}
              >
                <div className="notification-symbol">
                  <Bell size={18} />
                </div>

                <div className="notification-body">
                  <b>{n.title}</b>
                  <p>{n.message}</p>
                  <small>{new Date(n.created_at + 'Z').toLocaleString()}</small>
                </div>

                {!n.is_read && (
                  <button
                    className="secondary compact"
                    onClick={() => read(n.id)}
                  >
                    Mark read
                  </button>
                )}
              </div>
            ))
          : <Empty text="You're all caught up" />}
      </Panel>
    </>
  )
}

function AdminUsers({ notify }) {
  const [rows, setRows] = useState([])
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    username: '',
    email: '',
    password: '',
    full_name: '',
    role: 'EMPLOYEE'
  })
  const [busy, setBusy] = useState(false)

  async function load() {
    try {
      const { data } = await api.get('/admin/users')
      setRows(data)
      setError('')
    } catch (e) {
      setError(e.response?.data?.detail || 'Unable to load users')
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function create(e) {
    e.preventDefault()
    setBusy(true)
    setError('')

    try {
      await api.post('/admin/users', form)

      setForm({
        username: '',
        email: '',
        password: '',
        full_name: '',
        role: 'EMPLOYEE'
      })

      notify('User created')
      await load()
    } catch (e) {
      setError(e.response?.data?.detail || 'Unable to create user')
    } finally {
      setBusy(false)
    }
  }

  async function update(id, patch) {
    try {
      await api.patch(`/admin/users/${id}`, patch)
      notify('User updated')
      await load()
    } catch (e) {
      setError(e.response?.data?.detail || 'Unable to update user')
    }
  }

  async function deleteUser(row) {
    if (!window.confirm(
      `Delete ${row.username}? Users with HR history must be deactivated instead.`
    )) {
      return
    }

    try {
      await api.delete(`/admin/users/${row.id}`)
      notify('User deleted')
      await load()
    } catch (e) {
      setError(e.response?.data?.detail || 'Unable to delete user')
    }
  }

  const currentUser = getStoredUser()

  return (
    <>
      <PageHeader
        eyebrow="ADMINISTRATION"
        title="User management"
        subtitle="Create accounts, assign roles and control account access."
      />

      <Panel
        title="Create user"
        sub="New accounts can be assigned an authorized role by an administrator"
      >
        <form className="payroll-form" onSubmit={create}>
          <label>
            Full name
            <input
              required
              minLength="2"
              value={form.full_name}
              onChange={e => setForm({ ...form, full_name: e.target.value })}
            />
          </label>

          <label>
            Username
            <input
              required
              minLength="3"
              value={form.username}
              onChange={e => setForm({ ...form, username: e.target.value })}
            />
          </label>

          <label>
            Email
            <input
              required
              type="email"
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
            />
          </label>

          <label>
            Temporary password
            <input
              required
              minLength="8"
              type="password"
              value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
            />
          </label>

          <label>
            Role
            <select
              value={form.role}
              onChange={e => setForm({ ...form, role: e.target.value })}
            >
              <option value="EMPLOYEE">EMPLOYEE</option>
              <option value="HR">HR</option>
              <option value="ADMIN">ADMIN</option>
            </select>
          </label>

          <button className="primary" disabled={busy}>
            {busy ? 'Creating…' : 'Create user'}
          </button>
        </form>
      </Panel>

      {error && <div className="error">{error}</div>}

      <Panel title="System users" sub={`${rows.length} accounts`}>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>USER</th>
                <th>EMAIL</th>
                <th>ROLE</th>
                <th>ACCOUNT</th>
                <th>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id}>
                  <td>
                    <b>{r.full_name || r.username}</b>
                    <small>@{r.username} · #{r.id}</small>
                  </td>

                  <td>{r.email}</td>

                  <td>
                    <select
                      value={r.role}
                      onChange={e => update(r.id, { role: e.target.value })}
                    >
                      <option value="EMPLOYEE">EMPLOYEE</option>
                      <option value="HR">HR</option>
                      <option value="ADMIN">ADMIN</option>
                    </select>
                  </td>

                  <td>
                    <Status value={r.is_active ? 'ACTIVE' : 'INACTIVE'} />
                  </td>

                  <td>
                    <div className="decision-actions">
                      <button
                        className="secondary compact"
                        disabled={currentUser?.id === r.id}
                        onClick={() => update(r.id, {
                          is_active: !r.is_active
                        })}
                      >
                        {r.is_active ? 'Deactivate' : 'Activate'}
                      </button>

                      <button
                        className="reject"
                        disabled={currentUser?.id === r.id}
                        onClick={() => deleteUser(r)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!rows.length && !error && <Empty text="No users found" />}
      </Panel>

      <p className="hint">
        For auditability, users with employee history cannot be permanently
        deleted. Deactivate them to prevent login while preserving HR records.
      </p>
    </>
  )
}


function PhaseError({ error }) { return error ? <div className="error">{error}</div> : null }

function ShiftManagement({ notify, user }) {
  const canManage = user?.role === 'HR' || user?.role === 'ADMIN'
  const [shifts, setShifts] = useState([]), [employees, setEmployees] = useState([]), [assignments, setAssignments] = useState([])
  const [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const [shiftForm, setShiftForm] = useState({ name: 'Morning', start_time: '09:00', end_time: '17:00' })
  const [assignForm, setAssignForm] = useState({ employee_id: '', shift_id: '' })
  async function load() { try { const [s,e,a] = await Promise.all([api.get('/shifts'), api.get('/employees'), api.get('/shifts/assignments')]); setShifts(s.data); setEmployees(e.data); setAssignments(a.data); if (!assignForm.shift_id && s.data[0]) setAssignForm(v=>({...v,shift_id:String(s.data[0].id)})); if (!assignForm.employee_id && e.data[0]) setAssignForm(v=>({...v,employee_id:String(e.data[0].id)})); setError('') } catch(e) { setError(e.response?.data?.detail || 'Unable to load shifts') } }
  useEffect(()=>{load()}, [])
  async function create(e) { e.preventDefault(); setBusy(true); try { await api.post('/shifts', shiftForm); notify('Shift created'); await load() } catch(e) { setError(e.response?.data?.detail || 'Unable to create shift') } finally { setBusy(false) } }
  async function assign(e) { e.preventDefault(); setBusy(true); try { await api.post('/shifts/assignments', { employee_id:Number(assignForm.employee_id), shift_id:Number(assignForm.shift_id) }); notify('Shift assigned'); await load() } catch(e) { setError(e.response?.data?.detail || 'Unable to assign shift') } finally { setBusy(false) } }
  return <><PageHeader eyebrow="MODULE 14" title={canManage ? 'Shift management' : 'My shift schedule'} subtitle={canManage ? 'Create shift templates and assign employees to a daily schedule.' : 'View your assigned working hours.'}/><PhaseError error={error}/>{canManage && <div className="two-col"><Panel title="Create shift" sub="Use 24-hour HH:MM time"><form className="stack-form" onSubmit={create}><label>Shift name<input required value={shiftForm.name} onChange={e=>setShiftForm({...shiftForm,name:e.target.value})}/></label><div className="form-row"><label>Start time<input required type="time" value={shiftForm.start_time} onChange={e=>setShiftForm({...shiftForm,start_time:e.target.value})}/></label><label>End time<input required type="time" value={shiftForm.end_time} onChange={e=>setShiftForm({...shiftForm,end_time:e.target.value})}/></label></div><button className="primary" disabled={busy}>Create shift</button></form></Panel><Panel title="Assign shift" sub="An employee has one current shift"><form className="stack-form" onSubmit={assign}><label>Employee<select required value={assignForm.employee_id} onChange={e=>setAssignForm({...assignForm,employee_id:e.target.value})}><option value="">Select employee</option>{employees.map(e=><option key={e.id} value={e.id}>{e.full_name} · #{e.id}</option>)}</select></label><label>Shift<select required value={assignForm.shift_id} onChange={e=>setAssignForm({...assignForm,shift_id:e.target.value})}>{shifts.map(s=><option key={s.id} value={s.id}>{s.name} ({s.start_time}–{s.end_time})</option>)}</select></label><button className="primary" disabled={busy || !employees.length || !shifts.length}>Save assignment</button></form></Panel></div>}<Panel title={canManage ? 'Shift schedule' : 'Your assigned shift'} sub={`${assignments.length} assignments`}><div className="table-scroll"><table><thead><tr><th>EMPLOYEE</th><th>DEPARTMENT</th><th>SHIFT</th><th>START</th><th>END</th></tr></thead><tbody>{assignments.map(a=><tr key={a.id}><td>{a.full_name} · #{a.employee_id}</td><td>{a.department}</td><td>{a.shift_name}</td><td>{a.start_time}</td><td>{a.end_time}</td></tr>)}</tbody></table></div>{!assignments.length&&<Empty text="No shift assignments yet"/>}</Panel></>
}

function LeaveCalendar() {
  const [rows,setRows] = useState([]), [start,setStart] = useState(new Date().toISOString().slice(0,10)), [end,setEnd] = useState(''), [department,setDepartment] = useState(''), [error,setError] = useState('')
  async function load(){try{const params={start}; if(end)params.end=end;if(department)params.department=department;const {data}=await api.get('/leave-calendar',{params});setRows(data);setError('')}catch(e){setError(e.response?.data?.detail||'Unable to load leave calendar')}}
  useEffect(()=>{load()},[])
  return <><PageHeader eyebrow="MODULE 15" title="Team leave calendar" subtitle="Approved absences and team availability." action={<button className="secondary" onClick={load}><RefreshCw size={15}/> Refresh</button>}/><div className="panel"><div className="filters"><label className="filter-input">From<input type="date" value={start} onChange={e=>setStart(e.target.value)}/></label><label className="filter-input">To<input type="date" value={end} onChange={e=>setEnd(e.target.value)}/></label><input className="filter-input" placeholder="Department" value={department} onChange={e=>setDepartment(e.target.value)}/><button className="primary" onClick={load}>Apply filters</button></div></div><PhaseError error={error}/><Panel title="Approved leave" sub="Only approved requests are shown"><div className="table-scroll"><table><thead><tr><th>EMPLOYEE</th><th>DEPARTMENT</th><th>TYPE</th><th>START</th><th>END</th><th>STATUS</th></tr></thead><tbody>{rows.map(r=><tr key={r.id}><td>{r.employee_name}</td><td>{r.department}</td><td>{r.leave_type}</td><td>{r.start_date}</td><td>{r.end_date}</td><td><Status value={r.status}/></td></tr>)}</tbody></table></div>{!rows.length&&<Empty text="No approved leave in this date range"/>}</Panel></>
}

function Documents({ user, notify }) {
  const [rows,setRows] = useState([]), [employees,setEmployees] = useState([]), [employeeId,setEmployeeId] = useState(''), [file,setFile] = useState(null), [error,setError] = useState(''), [busy,setBusy] = useState(false)
  const canUpload = user?.role === 'HR' || user?.role === 'ADMIN'
  async function load(){try{const [docs,emps]=await Promise.all([api.get('/documents'),canUpload?api.get('/employees'):Promise.resolve({data:[]})]);setRows(docs.data);setEmployees(emps.data);if(!employeeId&&emps.data[0])setEmployeeId(String(emps.data[0].id));setError('')}catch(e){setError(e.response?.data?.detail||'Unable to load documents')}}
  useEffect(()=>{load()},[])
  async function upload(e){e.preventDefault();if(!file||!employeeId)return;setBusy(true);setError('');try{const form=new FormData();form.append('file',file);await api.post(`/documents?employee_id=${employeeId}`,form,{headers:{'Content-Type':'multipart/form-data'}});setFile(null);e.target.reset();notify('Document uploaded securely');await load()}catch(e){setError(e.response?.data?.detail||'Upload failed')}finally{setBusy(false)}}
  async function download(row){try{const {data}=await api.get(`/documents/${row.id}/download`,{responseType:'blob'});const url=URL.createObjectURL(data);const a=document.createElement('a');a.href=url;a.download=row.file_name;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url)}catch(e){setError(e.response?.data?.detail||'Unable to download document')}}
  return <><PageHeader eyebrow="MODULE 16" title="Employee documents" subtitle="Securely store and retrieve HR documents."/>{canUpload&&<Panel title="Upload a document" sub="PDF, JPG, PNG or DOCX · maximum 5 MB"><form className="payroll-form" onSubmit={upload}><label>Employee<select required value={employeeId} onChange={e=>setEmployeeId(e.target.value)}><option value="">Select employee</option>{employees.map(e=><option key={e.id} value={e.id}>{e.full_name} · #{e.id}</option>)}</select></label><label>Document file<input required type="file" accept=".pdf,.jpg,.jpeg,.png,.docx" onChange={e=>setFile(e.target.files?.[0]||null)}/></label><button className="primary" disabled={busy||!file||!employeeId}>{busy?'Uploading…':'Upload document'}</button></form></Panel>}<PhaseError error={error}/><Panel title="Document library" sub="Files are available only to authorized accounts"><div className="table-scroll"><table><thead><tr><th>DOCUMENT</th><th>EMPLOYEE ID</th><th>UPLOADED</th><th>ACTION</th></tr></thead><tbody>{rows.map(r=><tr key={r.id}><td>{r.file_name}</td><td>#{r.employee_id}</td><td>{new Date(r.uploaded_at).toLocaleString()}</td><td><button className="secondary compact" onClick={()=>download(r)}>Download</button></td></tr>)}</tbody></table></div>{!rows.length&&<Empty text="No documents uploaded yet"/>}</Panel></>
}

function Performance({ user, notify }) {
  const [rows,setRows] = useState([]), [employees,setEmployees] = useState([]), [error,setError] = useState(''), [busy,setBusy] = useState(false)
  const [form,setForm] = useState({employee_id:'',review_period:'',rating:'4',feedback:''})
  const canReview = user?.role === 'HR' || user?.role === 'ADMIN'
  async function load(){try{const [reviews,emps]=await Promise.all([api.get('/performance'),canReview?api.get('/employees'):Promise.resolve({data:[]})]);setRows(reviews.data);setEmployees(emps.data);if(!form.employee_id&&emps.data[0])setForm(v=>({...v,employee_id:String(emps.data[0].id)}));setError('')}catch(e){setError(e.response?.data?.detail||'Unable to load performance reviews')}}
  useEffect(()=>{load()},[])
  async function submit(e){e.preventDefault();setBusy(true);try{await api.post('/performance',{...form,employee_id:Number(form.employee_id),rating:Number(form.rating)});notify('Performance review saved');setForm(v=>({...v,review_period:'',feedback:''}));await load()}catch(e){setError(e.response?.data?.detail||'Unable to save review')}finally{setBusy(false)}}
  return <><PageHeader eyebrow="MODULE 17" title="Performance reviews" subtitle="Review ratings, feedback and employee development history."/>{canReview&&<Panel title="Add performance review" sub="Ratings range from 1 (needs improvement) to 5 (excellent)"><form className="payroll-form" onSubmit={submit}><label>Employee<select required value={form.employee_id} onChange={e=>setForm({...form,employee_id:e.target.value})}><option value="">Select employee</option>{employees.map(e=><option key={e.id} value={e.id}>{e.full_name} · #{e.id}</option>)}</select></label><label>Review period<input required placeholder="e.g. Q3 2026" value={form.review_period} onChange={e=>setForm({...form,review_period:e.target.value})}/></label><label>Rating<select value={form.rating} onChange={e=>setForm({...form,rating:e.target.value})}>{[1,2,3,4,5].map(n=><option key={n} value={n}>{n} / 5</option>)}</select></label><label style={{gridColumn:'1 / -1'}}>Feedback<textarea required minLength="3" rows="3" value={form.feedback} onChange={e=>setForm({...form,feedback:e.target.value})}/></label><button className="primary" disabled={busy||!form.employee_id}>{busy?'Saving…':'Save review'}</button></form></Panel>}<PhaseError error={error}/><Panel title="Review history" sub={`${rows.length} reviews`}><div className="table-scroll"><table><thead><tr><th>EMPLOYEE</th><th>PERIOD</th><th>RATING</th><th>FEEDBACK</th><th>CREATED</th></tr></thead><tbody>{rows.map(r=><tr key={r.id}><td>{r.employee_name||`#${r.employee_id}`}</td><td>{r.review_period}</td><td>{'★'.repeat(r.rating)}{'☆'.repeat(5-r.rating)} ({r.rating}/5)</td><td style={{whiteSpace:'normal',minWidth:220}}>{r.feedback}</td><td>{new Date(r.created_at).toLocaleDateString()}</td></tr>)}</tbody></table></div>{!rows.length&&<Empty text="No performance reviews yet"/>}</Panel></>
}

function AdvancedAnalytics() {
  const [data,setData] = useState(null), [start,setStart] = useState(new Date(Date.now()-29*86400000).toISOString().slice(0,10)), [end,setEnd] = useState(new Date().toISOString().slice(0,10)), [department,setDepartment] = useState(''), [error,setError] = useState('')
  async function load(){try{const {data}=await api.get('/analytics/advanced',{params:{start,end,department}});setData(data);setError('')}catch(e){setError(e.response?.data?.detail||'Unable to load analytics')}}
  useEffect(()=>{load()},[])
  return <><PageHeader eyebrow="MODULE 18" title="Advanced analytics" subtitle="Explore attendance, leave, performance and department-level trends." action={<button className="secondary" onClick={load}><RefreshCw size={15}/> Refresh</button>}/><div className="panel"><div className="filters"><label className="filter-input">From<input type="date" value={start} onChange={e=>setStart(e.target.value)}/></label><label className="filter-input">To<input type="date" value={end} onChange={e=>setEnd(e.target.value)}/></label><input className="filter-input" placeholder="Department contains…" value={department} onChange={e=>setDepartment(e.target.value)}/><button className="primary" onClick={load}>Apply filters</button></div></div><PhaseError error={error}/>{data&&<><div className="stats-grid two-stats"><Stat label="PERFORMANCE AVG" value={data.performance.average_rating??'—'} detail={`${data.performance.reviews} reviews`} Icon={Star}/><Stat label="DEPARTMENTS" value={data.departments.length} detail="Active employee groups" Icon={Users} tint="green"/></div><div className="dashboard-grid"><Panel title="Attendance by status" sub={`${data.start} to ${data.end}`}><div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><BarChart data={data.attendance}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="status"/><YAxis allowDecimals={false}/><Tooltip/><Bar dataKey="count" fill="#6870d7" radius={[5,5,0,0]}/></BarChart></ResponsiveContainer></div></Panel><Panel title="Leave requests by status"><div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><BarChart data={data.leaves}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="status"/><YAxis allowDecimals={false}/><Tooltip/><Bar dataKey="count" fill="#23a879" radius={[5,5,0,0]}/></BarChart></ResponsiveContainer></div></Panel></div><div className="dashboard-grid"><Panel title="Attendance trend" sub="Daily attendance records"><div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><BarChart data={data.attendance_trend}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="date"/><YAxis allowDecimals={false}/><Tooltip/><Bar dataKey="count" fill="#6870d7" radius={[5,5,0,0]}/></BarChart></ResponsiveContainer></div></Panel><Panel title="Leave trend" sub="Leave requests by start date"><div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><BarChart data={data.leave_trend}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="date"/><YAxis allowDecimals={false}/><Tooltip/><Bar dataKey="count" fill="#23a879" radius={[5,5,0,0]}/></BarChart></ResponsiveContainer></div></Panel></div><Panel title="Department headcount"><div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><BarChart data={data.departments}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="department"/><YAxis allowDecimals={false}/><Tooltip/><Bar dataKey="employees" fill="#a17ad8" radius={[5,5,0,0]}/></BarChart></ResponsiveContainer></div></Panel></>}</>
}

function EmployeeSearch() {
  const [filters,setFilters] = useState({q:'',department:'',role:'',status:'',attendance_status:'',performance_rating:''}), [rows,setRows] = useState([]), [error,setError] = useState('')
  async function search(e){e?.preventDefault();try{const params={...filters};Object.keys(params).forEach(k=>{if(!params[k])delete params[k]});const {data}=await api.get('/employees/search',{params});setRows(data);setError('')}catch(e){setError(e.response?.data?.detail||'Unable to search employees')}}
  useEffect(()=>{search()},[])
  function update(k,v){setFilters({...filters,[k]:v})}
  return <><PageHeader eyebrow="MODULE 20" title="Advanced employee search" subtitle="Combine name, department, role, status, attendance and performance filters."/><Panel title="Search filters"><form onSubmit={search} className="stack-form"><div className="form-row"><label>Name<input placeholder="Search employee name" value={filters.q} onChange={e=>update('q',e.target.value)}/></label><label>Department<input placeholder="Department" value={filters.department} onChange={e=>update('department',e.target.value)}/></label></div><div className="form-row"><label>Role<select value={filters.role} onChange={e=>update('role',e.target.value)}><option value="">All roles</option><option>EMPLOYEE</option><option>HR</option><option>ADMIN</option></select></label><label>Employment status<select value={filters.status} onChange={e=>update('status',e.target.value)}><option value="">All statuses</option><option>ACTIVE</option><option>INACTIVE</option></select></label></div><div className="form-row"><label>Today's attendance<select value={filters.attendance_status} onChange={e=>update('attendance_status',e.target.value)}><option value="">Any</option><option>PRESENT</option><option>LATE</option><option>EARLY_LEAVE</option><option>ABSENT</option><option>NOT_MARKED</option></select></label><label>Average performance rating<select value={filters.performance_rating} onChange={e=>update('performance_rating',e.target.value)}><option value="">Any rating</option>{[1,2,3,4,5].map(n=><option key={n} value={n}>{n} / 5</option>)}</select></label></div><button className="primary"><Search size={15}/> Search employees</button></form></Panel><PhaseError error={error}/><Panel title="Results" sub={`${rows.length} employees match these filters`}><div className="table-scroll"><table><thead><tr><th>EMPLOYEE</th><th>ROLE</th><th>DEPARTMENT</th><th>STATUS</th><th>ATTENDANCE</th><th>DESIGNATION</th></tr></thead><tbody>{rows.map(r=><tr key={r.id}><td><b>{r.full_name}</b><small> @{r.username}</small></td><td>{r.role}</td><td>{r.department}</td><td><Status value={r.status}/></td><td><Status value={r.attendance_status}/></td><td>{r.designation}</td></tr>)}</tbody></table></div>{!rows.length&&<Empty text="No matching employees"/>}</Panel></>
}

export default App