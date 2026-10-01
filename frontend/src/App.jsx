import { useEffect, useState } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ArrowRight, CalendarDays, ChevronDown, Compass, GraduationCap, LayoutDashboard, LogOut, Menu, Plus, ShieldCheck, Sparkles, Sun, TrendingUp, Wallet, X } from 'lucide-react';

const money = value => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
const nav = [{ id: 'overview', label: 'Overview', icon: LayoutDashboard }, { id: 'goals', label: 'Goals', icon: Compass }, { id: 'activity', label: 'Activity', icon: CalendarDays }];
const icons = { sun: Sun, shield: ShieldCheck, book: GraduationCap };

let authToken = '';
async function api(path, options = {}) {
  const headers = { ...options.headers, ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}) };
  const response = await fetch(`${apiBaseUrl}/api${path}`, { ...options, headers });
  if (!response.ok) {
    let detail = 'Something went wrong. Please try again.';
    try { const body = await response.json(); if (typeof body.detail === 'string') detail = body.detail; } catch { /* keep default */ }
    throw new Error(detail);
  }
  return response.json();
}

function GoalCard({ goal, onEdit }) {
  const Icon = icons[goal.icon] || Compass;
  const percent = Math.min(100, Math.round(goal.current / goal.target * 100));
  return <article className="goal-card" data-testid={`goal-${goal.id}`}>
    <div className="goal-card-head"><span className={`goal-icon ${goal.icon}`}><Icon size={22} strokeWidth={1.8}/></span><button className="quiet-link" onClick={() => onEdit(goal)}>Manage <ArrowRight size={16}/></button></div>
    <h3>{goal.title}</h3><div className="goal-amount">{money(goal.current)} <span>of {money(goal.target)}</span></div>
    <div className="progress" role="progressbar" aria-label={`${goal.title} progress`} aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${percent}%` }}/></div>
    <div className="goal-foot"><span>{percent}% complete</span><span>{money(goal.monthlyContribution)}/mo</span></div>
  </article>;
}

function GoalDialog({ goal, onClose, onSaved }) {
  const [monthlyContribution, setContribution] = useState(goal.monthlyContribution);
  const [targetDate, setTargetDate] = useState(goal.targetDate);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { const handler = e => { if (e.key === 'Escape') onClose(); }; window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler); }, [onClose]);
  async function submit(event) {
    event.preventDefault(); setSaving(true); setError('');
    try {
      const saved = await api(`/goals/${goal.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ monthlyContribution: Number(monthlyContribution), targetDate }) });
      onSaved(saved);
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  }
  return <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
    <section className="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
      <div className="dialog-head"><span className="eyebrow">EDIT GOAL</span><button className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={20}/></button></div>
      <h2 id="dialog-title">{goal.title}</h2><p>Adjust your plan as life changes. Your saved updates will appear on the dashboard.</p>
      <form onSubmit={submit}>
        <label htmlFor="contribution">Monthly contribution</label><div className="input-prefix"><span>$</span><input id="contribution" type="number" min="0" max="100000" required value={monthlyContribution} onChange={e => setContribution(e.target.value)}/></div>
        <label htmlFor="target-date">Target date</label><input id="target-date" type="date" required value={targetDate} onChange={e => setTargetDate(e.target.value)}/>
        {error && <p className="error" role="alert">{error}</p>}
        <div className="dialog-actions"><button type="button" className="button secondary" onClick={onClose}>Cancel</button><button className="button primary" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button></div>
      </form>
    </section>
  </div>;
}

function Dashboard({ session, onLogout }) {
  const [openTabs, setOpenTabs] = useState([{ id: 1, view: 'overview' }]);
  const [activeTabId, setActiveTabId] = useState(1);
  const [nextTabId, setNextTabId] = useState(2);
  const tab = openTabs.find(item => item.id === activeTabId)?.view || null;
  const [period, setPeriod] = useState('12m');
  const [category, setCategory] = useState('all');
  const [priority, setPriority] = useState('all');
  const [start, setStart] = useState('2026-09-01');
  const [end, setEnd] = useState('2026-09-30');
  const [profile, setProfile] = useState(null);
  const [overview, setOverview] = useState(null);
  const [goals, setGoals] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [activity, setActivity] = useState([]);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [mobileNav, setMobileNav] = useState(false);

  useEffect(() => { api('/profile').then(setProfile).catch(e => setError(e.message)); }, []);
  useEffect(() => {
    if (!tab) return;
    let active = true; setLoading(true); setError('');
    const requests = tab === 'overview' ? Promise.all([api(`/overview?period=${period}`), api('/goals'), api(`/recommendations?priority=${priority}`)])
      : tab === 'goals' ? Promise.all([api(`/goals?category=${category}`)])
      : Promise.all([api(`/activity?start=${start}&end=${end}`)]);
    requests.then(results => { if (!active) return; if (tab === 'overview') { setOverview(results[0]); setGoals(results[1]); setRecommendations(results[2]); } else if (tab === 'goals') setGoals(results[0]); else setActivity(results[0]); })
      .catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [tab, period, category, priority, start, end]);

  function goTo(next) {
    const id = nextTabId;
    setNextTabId(id + 1);
    setOpenTabs(current => [...current, { id, view: next }]);
    setActiveTabId(id); setMobileNav(false); setNotice('');
  }
  function closeTab(id) {
    const index = openTabs.findIndex(item => item.id === id);
    const remaining = openTabs.filter(item => item.id !== id);
    setOpenTabs(remaining);
    if (activeTabId === id) setActiveTabId(remaining[Math.min(index, remaining.length - 1)]?.id ?? null);
  }
  async function savedGoal(saved) {
    setEditing(null); setNotice(`${saved.title} updated successfully.`);
    try {
      const [freshGoals, freshOverview, freshRecommendations] = await Promise.all([api(`/goals?category=${tab === 'goals' ? category : 'all'}`), api(`/overview?period=${period}`), api(`/recommendations?priority=${priority}`)]);
      setGoals(freshGoals); setOverview(freshOverview); setRecommendations(freshRecommendations);
    } catch (e) { setError(e.message); }
  }
  return <div className="app-shell">
    <aside className={`sidebar ${mobileNav ? 'open' : ''}`}>
      <div className="brand"><span className="brand-mark"><span/></span><div>harbor<span>FINANCIAL WELLNESS</span></div></div>
      <div className="sidebar-label">YOUR SPACE</div>
      <nav aria-label="Main navigation">{nav.map(item => <button key={item.id} className={`nav-item ${tab === item.id ? 'selected' : ''}`} onClick={() => goTo(item.id)} aria-current={tab === item.id ? 'page' : undefined}><item.icon size={20} strokeWidth={1.8}/>{item.label}</button>)}</nav>
      <div className="sidebar-bottom"><span className="avatar">{session.user.firstName[0]}</span><div><strong>{session.user.displayName}</strong><small>{session.user.id}</small></div><button className="icon-button logout-button" aria-label="Sign out" title="Sign out" onClick={onLogout}><LogOut size={17}/></button></div>
    </aside>
    {mobileNav && <button className="nav-scrim" aria-label="Close navigation" onClick={() => setMobileNav(false)}/>}
    <div className="main-wrap">
      <header className="topbar"><button className="icon-button menu-button" aria-label="Open navigation" onClick={() => setMobileNav(true)}><Menu size={23}/></button><div className="breadcrumb">MY PLAN <span>/</span> {tab ? nav.find(item => item.id === tab).label.toUpperCase() : "WORKSPACE"}</div><div className="topbar-right"><span className="demo-pill">DEMO DATA</span><span className="top-avatar">{session.user.firstName[0]}</span></div></header>
      <main id="main" className="content">
        <div className="page-heading"><div><p className="eyebrow">YOUR FINANCIAL PICTURE</p><h1>{tab === 'overview' ? `Good morning, ${profile?.firstName || session.user.firstName}.` : tab === 'goals' ? 'Your goals' : tab === 'activity' ? 'Recent activity' : 'Your workspace'}</h1><p className="subheading">{tab === 'overview' ? 'A clear view of where you are and where you’re headed.' : tab === 'goals' ? 'Keep track of the milestones that matter to you.' : tab === 'activity' ? 'Review contributions and transfers across your plan.' : 'Open a section from the navigation.'}</p></div><span className="as-of"><CalendarDays size={17}/> September 2026</span></div>
        <div className="tab-strip" aria-label="Open workspace tabs">{openTabs.map(item => <div key={item.id} className={`workspace-tab ${activeTabId === item.id ? "active" : ""}`}><button role="tab" aria-selected={activeTabId === item.id} aria-label={`${nav.find(view => view.id === item.view).label} tab ${item.id}`} onClick={() => { setActiveTabId(item.id); setNotice(""); }}>{nav.find(view => view.id === item.view).label}</button><button className="tab-close" aria-label={`Close ${nav.find(view => view.id === item.view).label} tab ${item.id}`} onClick={() => closeTab(item.id)}><X size={15}/></button></div>)}<label className="new-tab"><Plus size={17}/><span className="sr-only">Open new tab</span><select aria-label="Open new tab" value="" onChange={e => { if (e.target.value) goTo(e.target.value); }}><option value="">New tab</option>{nav.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label></div>
        {notice && <div className="notice" role="status">{notice}<button aria-label="Dismiss notification" onClick={() => setNotice('')}><X size={16}/></button></div>}
        {error && <div className="error-banner" role="alert">{error} <button onClick={() => window.location.reload()}>Retry</button></div>}
        {!tab ? <div className="empty-workspace"><h2>No open tabs</h2><p>Select Overview, Goals, or Activity from the navigation to open a tab.</p></div> : loading ? <div className="loading" role="status">Loading your plan…</div> : <>
          {tab === 'overview' && overview && <>
            <div className="summary-grid"><article className="net-worth summary-card"><div className="card-top"><span>NET WORTH</span><Wallet size={20}/></div><strong>{money(overview.netWorth)}</strong><div className="change"><TrendingUp size={16}/> {overview.netWorthChangePercent}% <span>from last year</span></div></article><article className="summary-card"><div className="card-top"><span>MONTHLY INCOME</span><span className="small-badge income">↗</span></div><strong>{money(overview.monthlyIncome)}</strong><p>Money coming in</p></article><article className="summary-card"><div className="card-top"><span>MONTHLY EXPENSES</span><span className="small-badge expense">↗</span></div><strong>{money(overview.monthlyExpenses)}</strong><p>Money going out</p></article></div>
            <div className="overview-grid"><section className="panel chart-panel"><div className="section-head"><div><p className="eyebrow">CASH FLOW</p><h2>Income & expenses</h2></div><label className="select-wrap"><span className="sr-only">Chart period</span><select value={period} onChange={e => setPeriod(e.target.value)}><option value="12m">Last 12 months</option><option value="6m">Last 6 months</option></select><ChevronDown size={16}/></label></div><div className="chart-legend"><span><i className="income-dot"/>Income</span><span><i className="expense-dot"/>Expenses</span></div><div className="chart" role="img" aria-label={`Income and expenses over the last ${period === '12m' ? '12' : '6'} months`}><ResponsiveContainer width="100%" height="100%"><AreaChart data={overview.monthly} margin={{ top: 12, right: 10, left: -14, bottom: 0 }}><defs><linearGradient id="incomeFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#16a89d" stopOpacity={0.2}/><stop offset="100%" stopColor="#16a89d" stopOpacity={0}/></linearGradient></defs><CartesianGrid stroke="#e8edf0" vertical={false}/><XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fill: '#7a8894', fontSize: 12 }} dy={10}/><YAxis tickFormatter={v => `$${v / 1000}k`} tickLine={false} axisLine={false} tick={{ fill: '#7a8894', fontSize: 12 }}/><Tooltip formatter={value => money(value)} contentStyle={{ borderRadius: 10, border: '1px solid #dbe4e8' }}/><Area type="monotone" dataKey="income" name="Income" stroke="#119e97" strokeWidth={3} fill="url(#incomeFill)"/><Area type="monotone" dataKey="expenses" name="Expenses" stroke="#b6a286" strokeWidth={2.5} fill="transparent"/></AreaChart></ResponsiveContainer></div></section>
              <section className="panel recommendation-panel"><div className="section-head"><div><p className="eyebrow">NEXT BEST ACTION</p><h2>Ways to move forward</h2></div><span className="spark-icon"><Sparkles size={19}/></span></div><label className="inline-filter">Show <select value={priority} onChange={e => setPriority(e.target.value)} aria-label="Recommendation priority"><option value="all">All priorities</option><option value="high">High priority</option><option value="medium">Medium priority</option></select></label>{recommendations.length ? recommendations.map((item, index) => <div className="recommendation" key={item.id}><span className="recommendation-number">0{index + 1}</span><div><span className="recommendation-eyebrow">{item.eyebrow}</span><h3>{item.title}</h3><p>{item.description}</p><button className="text-action" onClick={() => { goTo('goals'); setCategory('all'); setNotice(`Find ${item.actionGoalId} below and select Manage to update it.`); }}>View goal <ArrowRight size={16}/></button></div></div>) : <p>No recommendations match this filter.</p>}</section></div>
            <div className="section-title-row"><div><p className="eyebrow">LOOKING AHEAD</p><h2>Your goals</h2></div><button className="quiet-link" onClick={() => goTo('goals')}>View all goals <ArrowRight size={17}/></button></div><div className="goals-grid">{goals.map(goal => <GoalCard key={goal.id} goal={goal} onEdit={setEditing}/>)}</div>
          </>}
          {tab === 'goals' && <><div className="toolbar"><div><h2>Plan for what matters</h2><p>Choose a goal to change its monthly contribution or target date.</p></div><label className="select-wrap"><span className="sr-only">Goal category</span><select value={category} onChange={e => setCategory(e.target.value)}><option value="all">All goals</option><option value="retirement">Retirement</option><option value="savings">Savings</option><option value="education">Education</option></select><ChevronDown size={16}/></label></div><div className="goals-grid">{goals.map(goal => <GoalCard key={goal.id} goal={goal} onEdit={setEditing}/>)}</div>{!goals.length && <div className="empty">No goals in this category.</div>}</>}
          {tab === 'activity' && <><div className="toolbar activity-toolbar"><div><h2>Contributions & transfers</h2><p>Choose a date range to review your plan activity.</p></div><div className="date-range"><label>From <input aria-label="From date" type="date" value={start} onChange={e => setStart(e.target.value)}/></label><label>To <input aria-label="To date" type="date" value={end} onChange={e => setEnd(e.target.value)}/></label></div></div><section className="panel activity-panel"><div className="activity-head"><span>ACTIVITY</span><span>AMOUNT</span></div>{activity.map(item => <div className="activity-row" key={item.id}><span className="activity-icon"><ArrowRight size={18}/></span><div><strong>{item.title}</strong><span>{new Date(`${item.date}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} · {item.category}</span></div><strong className="activity-amount">+{money(item.amount)}</strong></div>)}{!activity.length && <div className="empty">No activity in this date range. Try different dates.</div>}</section></>}
        </>}
        <section className="panel" aria-labelledby="embedded-guide-title">
          <div className="section-head"><div><p className="eyebrow">EMBEDDED RESOURCE</p><h2 id="embedded-guide-title">Financial wellness note</h2></div></div>
          <iframe
            title="Financial wellness note"
            sandbox=""
            style={{ width: '100%', height: 150, border: 0, borderRadius: 6, background: '#f5f8f9' }}
            srcDoc={`<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{margin:0;padding:18px;font:15px/1.5 Arial,sans-serif;color:#183043}h1{font-size:18px;margin:0 0 8px}p{margin:0}</style></head><body><h1>A small step counts</h1><p>Review one recent expense and decide whether it still supports a goal that matters to you.</p></body></html>`}
          />
        </section>
        <footer>Harbor is a fictional portfolio project. All people and figures are sample data. <a href="https://www.consumerfinance.gov/consumer-tools/financial-well-being/" target="_blank" rel="noopener noreferrer" aria-label="Financial well-being resources (opens in a new tab)" style={{ color: 'inherit' }}>Financial well-being resources</a> <button type="button" className="text-action" onClick={() => window.alert('This is a sample browser alert.')}>Show alert</button></footer>
      </main>
    </div>
    {editing && <GoalDialog key={editing.id} goal={editing} onClose={() => setEditing(null)} onSaved={savedGoal}/>} 
  </div>;
}

function Login({ onLogin }) {
  const [username, setUsername] = useState('user001');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  async function submit(event) {
    event.preventDefault(); setError(''); setSubmitting(true);
    try {
      const session = await api('/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
      onLogin(session);
    } catch (e) { setError(e.message); } finally { setSubmitting(false); }
  }
  return <div className="login-page"><div className="login-card"><div className="login-brand"><span className="brand-mark"><span/></span><strong>harbor</strong></div><p className="eyebrow">FINANCIAL WELLNESS DEMO</p><h1>Welcome back</h1><p className="login-intro">Sign in to explore your sample plan.</p><form onSubmit={submit}><label htmlFor="username">Demo account</label><select id="username" value={username} onChange={e => setUsername(e.target.value)}>{Array.from({ length: 120 }, (_, index) => { const id = `user${String(index + 1).padStart(3, '0')}`; return <option key={id} value={id}>{id}</option>; })}</select><label htmlFor="password">Password</label><input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" required placeholder="Enter demo password"/><p className="credential-hint">For user001, use <code>DemoPass!001</code>. Each account uses its three-digit suffix.</p>{error && <p className="error" role="alert">{error}</p>}<button className="button primary login-submit" disabled={submitting}>{submitting ? 'Signing in…' : 'Sign in'}</button></form><p className="login-foot">120 fictional accounts for independent parallel test scenarios.</p></div></div>;
}

export default function App() {
  const [session, setSession] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('harborSession') || 'null'); } catch { return null; }
  });
  authToken = session?.accessToken || '';
  function login(value) { authToken = value.accessToken; sessionStorage.setItem('harborSession', JSON.stringify(value)); setSession(value); }
  async function logout() { try { await api('/auth/logout', { method: 'POST' }); } catch { /* still clear local session */ } authToken = ''; sessionStorage.removeItem('harborSession'); setSession(null); }
  return session ? <Dashboard key={session.user.id} session={session} onLogout={logout}/> : <Login onLogin={login}/>;
}
