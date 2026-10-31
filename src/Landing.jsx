
import { useState } from 'react'
import './App.css'
import AuthModal from './components/AuthModal'
import Icon from './components/Icon'

const features = [
  {
    icon: 'subscriptions',
    title: 'Subscription lifecycle',
    description: 'Start, renew, pause, resume, and close subscriptions with clear status and billing dates.',
  },
  {
    icon: 'quotes',
    title: 'Quotations that convert',
    description: 'Build customer quotations from products and plans, set validity and payment terms, then follow each quote through its lifecycle.',
  },
  {
    icon: 'invoices',
    title: 'Invoices & tax rules',
    description: 'Generate invoices for billing periods, apply configured taxes, and keep every balance and due date visible.',
  },
  {
    icon: 'discounts',
    title: 'Payments & refunds',
    description: 'Record payments against invoices, review outstanding amounts, and track refund requests in one place.',
  },
  {
    icon: 'products',
    title: 'Flexible product catalog',
    description: 'Organize products, variants, categories, plans, pricing periods, taxes, and discounts for your business.',
  },
  {
    icon: 'browse',
    title: 'Customer self-service',
    description: 'Give customers a secure place to browse plans and manage subscriptions, quotations, invoices, payments, and profile details.',
  },
  {
    icon: 'notifications',
    title: 'Notifications & delivery log',
    description: 'Manage message templates and review delivery activity so your team can see what was sent and when.',
  },
  {
    icon: 'support',
    title: 'Support in context',
    description: 'Keep customer support requests alongside the account and billing information your team needs.',
  },
  {
    icon: 'automation',
    title: 'Billing automations',
    description: 'Configure business rules for recurring billing, overdue reminders, quote expiry, and plan closure.',
  },
  {
    icon: 'reports',
    title: 'Reports & audit trail',
    description: 'Review subscription activity, revenue, payments, balances, and the history of important record changes.',
  },
  {
    icon: 'users',
    title: 'Roles for every team',
    description: 'Give admins, staff, and customers purpose-built screens and access for the work they need to do.',
  },
  {
    icon: 'settings',
    title: 'Business settings',
    description: 'Bring business details, payment options, quote templates, and billing preferences into one workspace.',
  },
]

function Landing() {
  const [authMode, setAuthMode] = useState(null)

  const openAuth = (mode) => {
    setAuthMode(mode)
  }

  const closeAuth = () => {
    setAuthMode(null)
  }

  return (
    <div className="website" id="home">

      {/* NAVBAR */}
      <header className="navbar">
        <a className="logo" href="#home">
          <span className="logo-symbol">∞</span>
          Brightloop<span className="logo-dot">.</span>
        </a>

        <nav className="nav-links">
          <a href="#home">Home</a>
          <a href="#features">Features</a>
          <a href="#about">About</a>
        </nav>

        <div className="nav-actions">
          <button
            className="login-btn"
            onClick={() => openAuth('login')}
          >
            Log In
          </button>

          <button
            className="primary-btn nav-signup"
            onClick={() => openAuth('signup')}
          >
            Sign Up <span>↗</span>
          </button>
        </div>
      </header>

      <main>

        {/* HERO */}
        <section className="hero">
          <div className="hero-content">

            <span className="eyebrow">
              <span className="status-dot"></span>
              ALL-IN-ONE SUBSCRIPTION PLATFORM
            </span>

            <h1>
              Subscriptions made
              <span> simple.</span>
              <br />
              Business made
              <span> smarter.</span>
            </h1>

            <p>
              From the first quotation to recurring billing and customer support, Brightloop keeps your products, plans, subscriptions, invoices, and payments connected.
            </p>

            <div className="hero-buttons">
              <button
                className="primary-btn large"
                onClick={() => openAuth('signup')}
              >
                Get Started Free <span>→</span>
              </button>

              <button
                className="secondary-btn"
                onClick={() => document.getElementById('about')?.scrollIntoView({
                  behavior: 'smooth'
                })}
              >
                Learn More <span>↗</span>
              </button>
            </div>

            <div className="trust">
              <span>✓ Flexible billing</span>
              <span>✓ Clear invoices</span>
              <span>✓ Revenue insights</span>
            </div>
          </div>

          {/* HERO VISUAL */}
          <div className="hero-art">
            <div className="art-glow"></div>

            <div className="art-card app-illustration">
              <div className="mock-topbar">
                <span className="mock-brand"><i></i> brightloop</span>
                <span className="mock-search"><Icon name="search" size={12} /> Search anything</span>
                <span className="mock-avatar">A</span>
              </div>
              <div className="mock-layout">
                <div className="mock-rail"><b className="selected"><Icon name="dashboard" size={14} /></b><b><Icon name="subscriptions" size={14} /></b><b><Icon name="invoices" size={14} /></b><b><Icon name="users" size={14} /></b><b><Icon name="settings" size={14} /></b></div>
                <div className="mock-main">
                  <div className="mock-heading"><div><small>MONDAY, OCTOBER 26</small><h2>Good morning, Alex</h2></div><span className="mock-period">This month⌄</span></div>
                  <div className="mock-metrics">
                    <div><small>RECURRING REVENUE</small><strong>$24,680</strong><em>↗ 12.8%</em></div>
                    <div><small>ACTIVE PLANS</small><strong>184</strong><em>↗ 8.2%</em></div>
                    <div><small>TO COLLECT</small><strong>$3,240</strong><em className="mock-neutral">12 invoices</em></div>
                  </div>
                  <div className="mock-chart-card">
                    <div className="mock-card-title"><b>Revenue overview</b><span>Last 6 months</span></div>
                    <div className="mock-chart"><div className="mock-y"><i>$30k</i><i>$20k</i><i>$10k</i></div><svg viewBox="0 0 420 105" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="chartFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#7556ed" stopOpacity=".2"/><stop offset="1" stopColor="#7556ed" stopOpacity="0"/></linearGradient></defs><path d="M0 84 C28 77 33 65 65 69 S108 54 135 59 S181 42 210 48 S255 28 282 37 S324 18 350 25 S392 7 420 12 V105 H0Z" fill="url(#chartFill)"/><path d="M0 84 C28 77 33 65 65 69 S108 54 135 59 S181 42 210 48 S255 28 282 37 S324 18 350 25 S392 7 420 12" fill="none" stroke="#6941f2" strokeWidth="3" strokeLinecap="round"/></svg></div>
                    <div className="mock-months"><i>May</i><i>Jun</i><i>Jul</i><i>Aug</i><i>Sep</i><i>Oct</i></div>
                  </div>
                  <div className="mock-latest"><div><b>Recent activity</b><span>View all&nbsp; ↗</span></div><p><i className="mock-check"><Icon name="check" size={11} /></i><span><b>Payment received</b><small>Northstar Studio · Pro plan</small></span><strong>+$240</strong></p></div>
                </div>
              </div>
            </div>

            <div className="floating-icon floating-one">↗</div>
            <div className="floating-icon floating-two">✓</div>
          </div>
        </section>

        {/* FEATURES */}
        <section className="features" id="features">

          <div className="section-heading">
            <span className="eyebrow">WHAT WE OFFER</span>

            <h2>
              Everything you need.
              <span> One platform.</span>
            </h2>

            <p>
              From the first quotation to the final payment,
              keep your subscription business organized.
            </p>
          </div>

          <div className="feature-grid">
            {features.map((feature, index) => (
              <article className="feature-card" key={feature.title}>
                <div className="feature-card-top">
                  <div className="feature-icon">
                    <Icon name={feature.icon} size={23} strokeWidth={1.7} />
                  </div>
                  <span className="feature-number">
              {String(index + 1).padStart(2, '0')}
                  </span>
                </div>

                <h3>{feature.title}</h3>
                <p>{feature.description}</p>

                <div className="feature-arrow">↗</div>
              </article>
            ))}
          </div>

        </section>

        <section className="lifecycle">
          <div className="lifecycle-copy">
            <span className="eyebrow">ONE CONNECTED WORKSPACE</span>
            <h2>Every billing detail, in its <span>right place.</span></h2>
            <p>Give your team a clear view of the full customer journey, with the right tools for each role.</p>
            <ul>
              <li><i><Icon name="check" size={14} /></i><span><b>For administrators</b><small>Manage billing, catalog, staff access, settings, and reports.</small></span></li>
              <li><i><Icon name="check" size={14} /></i><span><b>For staff</b><small>Handle customer records, subscriptions, invoices, and payments.</small></span></li>
              <li><i><Icon name="check" size={14} /></i><span><b>For customers</b><small>Browse plans and keep track of subscriptions and billing.</small></span></li>
            </ul>
          </div>
          <div className="lifecycle-visual" aria-hidden="true">
            <div className="lifecycle-orbit orbit-one"></div><div className="lifecycle-orbit orbit-two"></div>
            <div className="lifecycle-center"><span>∞</span><b>One clear<br/>billing flow</b></div>
            <div className="life-node node-quote"><Icon name="quotes" size={19}/><span>Quotations</span></div>
            <div className="life-node node-plan"><Icon name="products" size={19}/><span>Plans</span></div>
            <div className="life-node node-invoice"><Icon name="invoices" size={19}/><span>Invoices</span></div>
            <div className="life-node node-customer"><Icon name="users" size={19}/><span>Customers</span></div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className="workflow">
          <div className="section-heading">
            <span className="eyebrow">SIMPLE WORKFLOW</span>
            <h2>From subscription to payment.</h2>
            <p>
              Every step of your billing process, connected.
            </p>
          </div>

          <div className="workflow-grid">
            <div className="workflow-step">
              <span>01</span>
              <div className="workflow-icon"><Icon name="products" size={27} strokeWidth={1.7} /></div>
              <h3>Create a plan</h3>
              <p>Set up products and subscription pricing.</p>
            </div>

            <div className="workflow-connector">→</div>

            <div className="workflow-step">
              <span>02</span>
              <div className="workflow-icon"><Icon name="users" size={27} strokeWidth={1.7} /></div>
              <h3>Add customers</h3>
              <p>Choose customers and assign their plans.</p>
            </div>

            <div className="workflow-connector">→</div>

            <div className="workflow-step">
              <span>03</span>
              <div className="workflow-icon"><Icon name="invoices" size={27} strokeWidth={1.7} /></div>
              <h3>Generate invoices</h3>
              <p>Prepare invoices for recurring billing.</p>
            </div>

            <div className="workflow-connector">→</div>

            <div className="workflow-step">
              <span>04</span>
              <div className="workflow-icon"><Icon name="payments" size={27} strokeWidth={1.7} /></div>
              <h3>Record payments</h3>
              <p>Track payments and outstanding balances.</p>
            </div>
          </div>
        </section>

        {/* ABOUT */}
        <section className="about" id="about">
          <div className="about-content">
            <span className="eyebrow">WHY BRIGHTLOOP?</span>

            <h2>
              Spend less time tracking bills.
              <span> More time growing.</span>
            </h2>

            <p>
              Replace disconnected spreadsheets, missed renewals,
              and manual invoicing with one clear workflow
              for your whole team and your customers.
            </p>

            <button
              className="primary-btn large"
              onClick={() => openAuth('signup')}
            >
              Start Your Journey <span>→</span>
            </button>
          </div>

          <div className="about-decoration">
            <span>∞</span>
            <p>One platform.</p>
            <p>Endless possibilities.</p>
          </div>
        </section>

      </main>

      {/* FOOTER */}
      <footer>
        <a className="logo" href="#home">
          <span className="logo-symbol">∞</span>
          Brightloop<span className="logo-dot">.</span>
        </a>

        <p>Making subscription management simple.</p>

        <div className="footer-actions">
          <button onClick={() => openAuth('login')}>Login</button>
          <button onClick={() => openAuth('signup')}>Create Account</button>
        </div>

        <p>© 2026 Brightloop Software. All rights reserved.</p>
      </footer>

      {authMode && (
        <AuthModal mode={authMode} setMode={setAuthMode} onClose={closeAuth} />
      )}

    </div>
  )
}

export default Landing
