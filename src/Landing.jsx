
import { useState } from 'react'
import './App.css'
import AuthModal from './components/AuthModal'
import Icon from './components/Icon'

const features = [
  {
    icon: 'products',
    title: 'Products & Plans',
    description: 'Create products, variants, pricing tiers, and flexible daily, weekly, monthly, or yearly plans.',
  },
  {
    icon: 'subscriptions',
    title: 'Recurring Billing',
    description: 'Prepare renewals and generate subscription invoices automatically on the right billing date.',
  },
  {
    icon: 'invoices',
    title: 'Invoices & Taxes',
    description: 'Keep invoice details accurate with configured tax rules and clear payment statuses.',
  },
  {
    icon: 'discounts',
    title: 'Smart Discounts',
    description: 'Set eligibility rules, validity dates, usage limits, and product or subscription discounts.',
  },
  {
    icon: 'reports',
    title: 'Revenue Reporting',
    description: 'View active subscriptions, received payments, outstanding balances, and overdue invoices.',
  },
  {
    icon: 'settings',
    title: 'Role-Based Access',
    description: 'Give admins, staff, and customers the right tools and permissions for their accounts.',
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
              Manage your plans, automate recurring invoices,
              track payments, and understand your revenue.
              Everything your subscription business needs,
              all in one place.
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

            <div className="art-card">

              <div className="art-top">
                <div className="art-icon">◈</div>
                <span className="live-badge">
                  <span></span> LIVE PREVIEW
                </span>
              </div>

              <h2>Subscription overview</h2>
              <p className="art-subtitle">
                Everything in one dashboard
              </p>

              <div className="art-line"></div>

              <div className="art-row">
                <span>Active subscriptions</span>
                <strong>128</strong>
              </div>

              <div className="art-row">
                <span>Upcoming renewals</span>
                <strong>24</strong>
              </div>

              <div className="art-row">
                <span>Invoices issued</span>
                <strong>96</strong>
              </div>

              <div className="art-row">
                <span>Billing status</span>
                <strong className="success-text">On track ✓</strong>
              </div>

              <div className="art-footer">
                <span>BRIGHTLOOP SOFTWARE</span>
                <span>2026</span>
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
                    0{index + 1}
                  </span>
                </div>

                <h3>{feature.title}</h3>
                <p>{feature.description}</p>

                <div className="feature-arrow">↗</div>
              </article>
            ))}
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
