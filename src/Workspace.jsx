import { useEffect, useState } from 'react'
import { useAuth } from './context/AuthContext'
import { supabase } from './lib/supabase'
import Dashboard from './pages/Dashboard'
import Subscriptions from './pages/Subscriptions'
import Invoices from './pages/Invoices'
import Payments from './pages/Payments'
import Users from './pages/Users'
import Templates from './pages/Templates'
import { Products, Plans, Taxes, Discounts } from './pages/Catalog'
import { MySubscriptions, BrowsePlans, MyInvoices, MyQuotations, MyProfile, MyPayments, MyNotifications, MyPaymentMethods } from './pages/Portal'
import SupportTickets from './pages/SupportTickets'
import AdminModules from './pages/AdminModules'
import Reports from './pages/Reports'
import Icon from './components/Icon'

const NAV = {
  admin: [
    ['Overview', [['dashboard', 'dashboard', 'Dashboard']]],
    ['Billing', [['subscriptions', 'subscriptions', 'Subscriptions'], ['invoices', 'invoices', 'Invoices'], ['payments', 'payments', 'Payments'], ['refunds', 'refunds', 'Refunds'], ['quotes', 'quotes', 'Quotations'], ['reports', 'reports', 'Reports']]],
    ['Catalog', [['products', 'products', 'Products'], ['categories', 'categories', 'Categories'], ['plans', 'plans', 'Plans'], ['templates', 'templates', 'Quote templates'], ['taxes', 'taxes', 'Taxes'], ['taxRules', 'taxes', 'Tax rules'], ['discounts', 'discounts', 'Discounts']]],
    ['Operations', [['support', 'support', 'Support tickets'], ['notifications', 'notifications', 'Notification templates'], ['notificationLog', 'delivery', 'Delivery log'], ['paymentMethods', 'paymentMethods', 'Payment methods']]],
    ['Admin', [['users', 'users', 'Users & staff'], ['automation', 'automation', 'Automation'], ['audit', 'audit', 'Audit log'], ['settings', 'settings', 'Business settings']]],
  ],
  staff: [
    ['Overview', [['dashboard', 'dashboard', 'Dashboard']]],
    ['Billing', [['subscriptions', 'subscriptions', 'Subscriptions'], ['invoices', 'invoices', 'Invoices'], ['payments', 'payments', 'Payments'], ['reports', 'reports', 'Reports']]],
    ['More', [['templates', 'templates', 'Quote templates'], ['users', 'users', 'Customers']]],
  ],
  customer: [
    ['My account', [['subscriptions', 'subscriptions', 'My subscriptions'], ['quotes', 'quotes', 'My quotations'], ['invoices', 'invoices', 'My invoices'], ['payments', 'payments', 'Payments'], ['paymentMethods', 'paymentMethods', 'Payment methods'], ['notifications', 'notifications', 'Notifications'], ['support', 'support', 'Support'], ['profile', 'profile', 'My profile'], ['plans', 'browse', 'Browse plans']]],
  ],
}

export default function Workspace() {
  const { profile, role, signOut } = useAuth()
  const first = role === 'customer' ? 'subscriptions' : 'dashboard'
  const [view, setView] = useState({ page: first, params: {} })
  const [menu, setMenu] = useState(false)
  const [search, setSearch] = useState('')
  const [results, setResults] = useState([])
  const go = (page, params = {}) => { setView({ page, params }); setMenu(false); window.scrollTo(0, 0) }

  useEffect(() => {
    document.body.classList.add('app-mode')
    return () => document.body.classList.remove('app-mode')
  }, [])

  useEffect(() => {
    if (role === 'customer' || search.trim().length < 2) { setResults([]); return }
    const timer = setTimeout(async () => {
      const { data } = await supabase.rpc('global_search', { p_query: search.trim(), p_limit: 5 })
      setResults(data || [])
    }, 250)
    return () => clearTimeout(timer)
  }, [search, role])

  const { page, params } = view
  const pages = role === 'customer'
    ? { subscriptions: <MySubscriptions />, quotes: <MyQuotations />, invoices: <MyInvoices />, payments: <MyPayments />, paymentMethods: <MyPaymentMethods />, notifications: <MyNotifications />, support: <SupportTickets customerOnly />, profile: <MyProfile />, plans: <BrowsePlans go={go} /> }
    : {
        dashboard: <Dashboard go={go} />, subscriptions: <Subscriptions />,
        invoices: <Invoices key={JSON.stringify(params)} initial={params} />, payments: <Payments />,
        users: <Users />, templates: <Templates />, reports: <Reports />,
        ...(role === 'admin' && { refunds: <AdminModules module="refunds" />, quotes: <AdminModules module="quotes" />, categories: <AdminModules module="categories" />, taxRules: <AdminModules module="taxRules" />, support: <AdminModules module="support" />, notifications: <AdminModules module="notifications" />, notificationLog: <AdminModules module="notificationLog" />, paymentMethods: <AdminModules module="paymentMethods" />, automation: <AdminModules module="automation" />, audit: <AdminModules module="audit" />, settings: <AdminModules module="settings" /> }),
        ...(role === 'admin' && { products: <Products />, plans: <Plans />, taxes: <Taxes />, discounts: <Discounts /> }),
      }

  return (
    <div className="shell">
      <aside className={'side' + (menu ? ' open' : '')}>
        <a className="logo side-logo" href="#home"><span className="logo-symbol">∞</span>Brightloop<span className="logo-dot">.</span></a>
        {NAV[role]?.map(([group, items]) => (
          <div key={group}>
            <div className="nav-group">{group}</div>
            {items.map(([key, icon, label]) => (
              <button key={key} className={'nav-item' + (page === key ? ' on' : '')} onClick={() => go(key)}>
              <Icon name={icon} size={17} strokeWidth={1.8} />{label}
              </button>
            ))}
          </div>
        ))}
        <div className="side-foot">
          <div className="me"><b>{profile.full_name || profile.email}</b><small>{profile.email}</small><span className={'badge ' + (role === 'admin' ? 'active' : 'blue')}>{role}</span></div>
          <button className="btn ghost" onClick={signOut}>Log out</button>
        </div>
      </aside>
      <main className="content">
        <button className="burger" onClick={() => setMenu(!menu)} aria-label="Menu"><Icon name="menu" size={19} /></button>
        {role !== 'customer' && <div className="global-search"><input aria-label="Search records" placeholder="Search customers, products, plans, invoices…" value={search} onChange={(e) => setSearch(e.target.value)} />
          {results.length > 0 && <div className="global-search-results">{results.map((r) => <button key={`${r.kind}-${r.id}`} onClick={() => { go(r.path.slice(1)); setSearch(''); setResults([]) }}><b>{r.label}</b><small>{r.kind} · {r.detail}</small></button>)}</div>}
        </div>}
        {pages[page] || <p className="muted">You don't have access to this page.</p>}
      </main>
    </div>
  )
}
