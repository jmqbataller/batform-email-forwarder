import Link from "next/link";
import { Logo } from "@/components/logo";
import { ArrowRightIcon, EyeOffIcon, LockIcon, RefreshIcon, ShieldIcon, SparkIcon } from "@/components/icons";
import { forwardingDomain } from "@/lib/config";
import styles from "./landing-pricing.module.css";

const plans = [
  { name: "Free", price: "$0", note: "Try BatMail with the essentials.", aliases: "3 aliases", features: ["Private forwarding", "Alias on/off controls", "Inbox activity"], featured: false },
  { name: "Starter", price: "$3", note: "For regular personal use.", aliases: "20 aliases", features: ["Everything in Free", "20 private aliases", "More room for accounts"], featured: true },
  { name: "Pro", price: "$7", note: "For power users with many accounts.", aliases: "100 aliases", features: ["Everything in Starter", "100 private aliases", "Higher usage capacity"], featured: false },
  { name: "Business", price: "$15", note: "For teams and heavier usage.", aliases: "1,000 aliases", features: ["Everything in Pro", "1,000 private aliases", "Business-scale capacity"], featured: false },
] as const;

export default function Home() {
  return (
    <main className="landing-shell">
      <nav className="landing-nav">
        <Logo />
        <div className="nav-actions">
          <a href="#how">How it works</a>
          <a href="#pricing">Pricing</a>
          <Link className="button button-ghost" href="/login">Sign in</Link>
          <Link className="button button-primary nav-cta" href="/login?mode=signup">Create free account <ArrowRightIcon /></Link>
        </div>
      </nav>

      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow"><SparkIcon /> A quieter, safer inbox</div>
          <h1>Your real email<br /><span>stays yours.</span></h1>
          <p>Create a free BatMail account and generate a private address for every website, app, or newsletter. Upgrade anytime when you need more aliases.</p>
          <div className="hero-actions">
            <Link className="button button-primary button-large" href="/login?mode=signup">Create free account <ArrowRightIcon /></Link>
            <a className="button button-ghost button-large" href="#pricing">View plans</a>
          </div>
          <div style={{ marginTop: 16 }} className="microcopy"><ShieldIcon /> Free plan includes 3 private aliases</div>
        </div>

        <div className="hero-visual" aria-label="Example of a protected email alias">
          <div className="visual-glow" />
          <div className="mail-card mail-card-back">
            <span className="mail-card-icon"><LockIcon /></span>
            <div><small>YOUR PRIVATE INBOX</small><strong>you@gmail.com</strong></div>
            <span className="status-pill">Hidden</span>
          </div>
          <div className="route-line"><span /></div>
          <div className="mail-card mail-card-front">
            <span className="mail-card-icon accent"><EyeOffIcon /></span>
            <div><small>YOUR PUBLIC ALIAS</small><strong>n7qx2k9m@{forwardingDomain}</strong></div>
            <span className="status-dot" />
          </div>
          <div className="floating-note"><RefreshIcon /> Sender automatically masked</div>
        </div>
      </section>

      <section className="trust-strip">
        <span>Free registration</span><i /><span>Random addresses</span><i /><span>Reply protection</span><i /><span>Upgrade anytime</span>
      </section>

      <section className={styles.pricingSection} id="pricing">
        <div className={styles.pricingIntro}>
          <div className="eyebrow">Simple plans</div>
          <h2>Start free. Add more aliases when you need them.</h2>
          <p>Every account starts on the Free plan. Paid plans increase your alias limit while keeping the same privacy-first workflow.</p>
        </div>
        <div className={styles.pricingGrid}>
          {plans.map((plan) => (
            <article key={plan.name} className={`${styles.planCard} ${plan.featured ? styles.featured : ""}`}>
              {plan.featured && <span className={styles.badge}>Popular</span>}
              <h3 className={styles.planName}>{plan.name}</h3>
              <div className={styles.price}><strong>{plan.price}</strong><span>/ month</span></div>
              <p className={styles.planNote}>{plan.note}</p>
              <strong>{plan.aliases}</strong>
              <ul className={styles.features}>{plan.features.map((feature) => <li key={feature}>✓ {feature}</li>)}</ul>
              <Link className={`button ${plan.name === "Free" ? "button-ghost" : "button-primary"} ${styles.fullButton}`} href={`/login?mode=signup&plan=${plan.name.toLowerCase()}`}>
                {plan.name === "Free" ? "Start free" : `Choose ${plan.name}`}
              </Link>
            </article>
          ))}
        </div>
        <p className={styles.pricingFoot}>Paid checkout will activate once the payment gateway is connected. You can already register for the Free plan today.</p>
      </section>

      <section className="how-section" id="how">
        <div className="section-heading">
          <div className="eyebrow">Simple by design</div>
          <h2>One inbox. A different identity everywhere.</h2>
        </div>
        <div className="steps-grid">
          <article><span>01</span><h3>Create your account</h3><p>Register with your email, confirm it, and start on the Free plan automatically.</p></article>
          <article><span>02</span><h3>Create a random alias</h3><p>Use the generated address instead of exposing your personal inbox to every service.</p></article>
          <article><span>03</span><h3>Upgrade when needed</h3><p>Move to Starter, Pro, or Business when you need a higher alias limit.</p></article>
        </div>
      </section>

      <section className={styles.ctaBand}>
        <div><h2>Ready to protect your real inbox?</h2><p>Create your account now and get your first 3 aliases free.</p></div>
        <Link className="button button-primary button-large" href="/login?mode=signup">Register free <ArrowRightIcon /></Link>
      </section>

      <footer className="landing-footer"><Logo /><span>Private email aliases for batform.online</span></footer>
    </main>
  );
}
