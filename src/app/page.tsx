import Link from "next/link";
import { Logo } from "@/components/logo";
import { ArrowRightIcon, EyeOffIcon, LockIcon, RefreshIcon, ShieldIcon, SparkIcon } from "@/components/icons";
import { forwardingDomain } from "@/lib/config";
import styles from "./landing-pricing.module.css";

const plans = [
  {
    name: "Free",
    price: "$0",
    description: "For trying BatMail and protecting a few important accounts.",
    aliases: "3 aliases",
    features: ["3 private aliases", "Private email forwarding", "Turn aliases on or off", "Activity inbox"],
    cta: "Get started free",
    featured: false,
  },
  {
    name: "Starter",
    price: "$3",
    description: "For everyday personal use across shopping, apps, and newsletters.",
    aliases: "20 aliases",
    features: ["20 private aliases", "Everything in Free", "More room for accounts", "Priority product updates"],
    cta: "Choose Starter",
    featured: true,
  },
  {
    name: "Pro",
    price: "$7",
    description: "For power users who want a separate identity almost everywhere.",
    aliases: "100 aliases",
    features: ["100 private aliases", "Everything in Starter", "Higher usage capacity", "Built for heavy personal use"],
    cta: "Choose Pro",
    featured: false,
  },
  {
    name: "Business",
    price: "$15",
    description: "For teams, operations, and larger alias requirements.",
    aliases: "1,000 aliases",
    features: ["1,000 private aliases", "Everything in Pro", "Business-scale capacity", "Ready for team features"],
    cta: "Choose Business",
    featured: false,
  },
] as const;

const faqs = [
  ["What is an email alias?", "An alias is a separate email address you can use instead of exposing your personal inbox. Messages are forwarded to your verified destination."],
  ["Can I start without paying?", "Yes. Every new BatMail account starts on the Free plan with up to 3 aliases."],
  ["Can I disable an alias later?", "Yes. You can turn an alias off whenever you no longer want it to receive messages."],
  ["Can I upgrade later?", "Yes. Your account is designed to move between Free, Starter, Pro, and Business as your alias needs grow."],
] as const;

export default function Home() {
  return (
    <main className={styles.site}>
      <header className={styles.header}>
        <div className={styles.navInner}>
          <Link href="/" className={styles.brandLink}><Logo /></Link>
          <nav className={styles.desktopNav} aria-label="Main navigation">
            <a href="#features">Features</a>
            <a href="#how">How it works</a>
            <a href="#pricing">Pricing</a>
            <a href="#faq">FAQ</a>
          </nav>
          <div className={styles.navActions}>
            <Link className="button button-ghost" href="/login">Sign in</Link>
            <Link className="button button-primary" href="/login?mode=signup">Get started free <ArrowRightIcon /></Link>
          </div>
        </div>
      </header>

      <section className={styles.hero}>
        <div className={styles.heroGlow} />
        <div className={styles.heroInner}>
          <div className={styles.heroCopy}>
            <div className={styles.pill}><SparkIcon /> Private email aliases, made simple</div>
            <h1>Stop giving every website your <span>real email.</span></h1>
            <p className={styles.heroLead}>Create private email aliases that forward to your existing inbox. Keep your real address hidden, disable aliases anytime, and scale from free to business use.</p>
            <div className={styles.heroActions}>
              <Link className="button button-primary button-large" href="/login?mode=signup">Get started free <ArrowRightIcon /></Link>
              <a className="button button-ghost button-large" href="#pricing">See pricing</a>
            </div>
            <div className={styles.heroMeta}>
              <span><ShieldIcon /> No credit card for Free</span>
              <span>3 aliases included</span>
              <span>Upgrade anytime</span>
            </div>
          </div>

          <div className={styles.productMockup}>
            <div className={styles.mockupTopbar}>
              <span className={styles.mockDots}><i /><i /><i /></span>
              <span>BatMail Dashboard</span>
              <span className={styles.liveBadge}>Protected</span>
            </div>
            <div className={styles.mockupBody}>
              <div className={styles.mockSidebar}>
                <strong>Overview</strong><span>Inbox</span><span>Aliases</span><span>Activity</span><span>Subscription</span>
              </div>
              <div className={styles.mockContent}>
                <div className={styles.mockHeading}><div><small>YOUR PRIVACY</small><h3>Email aliases</h3></div><span className={styles.fakeButton}>+ New alias</span></div>
                <div className={styles.statRow}>
                  <div><small>Total aliases</small><strong>3</strong></div>
                  <div><small>Active</small><strong>3</strong></div>
                  <div><small>Plan</small><strong>Free</strong></div>
                </div>
                <div className={styles.aliasCard}>
                  <div className={styles.aliasIcon}><EyeOffIcon /></div>
                  <div><small>SHOPPING</small><strong>n7qx2k9m@{forwardingDomain}</strong><span>Forwards privately to your inbox</span></div>
                  <span className={styles.activePill}>Active</span>
                </div>
                <div className={styles.aliasCard}>
                  <div className={styles.aliasIcon}><LockIcon /></div>
                  <div><small>NEWSLETTER</small><strong>4m8k2p7q@{forwardingDomain}</strong><span>Your real email stays hidden</span></div>
                  <span className={styles.activePill}>Active</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.proofBar}>
        <span>PRIVATE FORWARDING</span><i /><span>RANDOM ALIASES</span><i /><span>REPLY PROTECTION</span><i /><span>SPF + DKIM READY</span>
      </section>

      <section className={styles.section} id="features">
        <div className={styles.sectionEyebrow}>Built for everyday privacy</div>
        <div className={styles.sectionIntro}>
          <h2>One inbox. Different identities everywhere else.</h2>
          <p>Use BatMail between your personal inbox and the services you sign up for. If one address becomes noisy or compromised, switch it off without changing your real email.</p>
        </div>
        <div className={styles.featureGrid}>
          <article><div className={styles.featureIcon}><EyeOffIcon /></div><h3>Hide your real inbox</h3><p>Share a generated BatMail address with websites instead of exposing your personal email address.</p></article>
          <article><div className={styles.featureIcon}><RefreshIcon /></div><h3>Forward automatically</h3><p>Messages sent to an active alias are delivered to your verified inbox while the alias stays in front.</p></article>
          <article><div className={styles.featureIcon}><ShieldIcon /></div><h3>Control every alias</h3><p>Create, label, disable, and remove aliases independently from your dashboard whenever you need.</p></article>
        </div>
      </section>

      <section className={`${styles.section} ${styles.howSection}`} id="how">
        <div className={styles.sectionEyebrow}>How it works</div>
        <div className={styles.sectionIntro}><h2>Protected in three simple steps.</h2><p>No new inbox to manage. BatMail works with the email address you already use.</p></div>
        <div className={styles.steps}>
          <article><span>01</span><div><h3>Create your account</h3><p>Register, verify your email, and your Free plan is created automatically.</p></div></article>
          <article><span>02</span><div><h3>Generate an alias</h3><p>Create a random address and use it for an app, store, newsletter, or online account.</p></div></article>
          <article><span>03</span><div><h3>Receive normally</h3><p>Mail reaches your existing inbox. Disable the alias later if you no longer want messages from that source.</p></div></article>
        </div>
      </section>

      <section className={`${styles.section} ${styles.pricingSection}`} id="pricing">
        <div className={styles.pricingHeader}>
          <div><div className={styles.sectionEyebrow}>Simple pricing</div><h2>Start free. Upgrade when you need more.</h2></div>
          <p>Every account starts on Free. Choose a higher plan when you need more aliases for more accounts, projects, or team workflows.</p>
        </div>
        <div className={styles.pricingGrid}>
          {plans.map((plan) => (
            <article key={plan.name} className={`${styles.planCard} ${plan.featured ? styles.featuredPlan : ""}`}>
              {plan.featured && <span className={styles.popular}>Most popular</span>}
              <div className={styles.planTop}><h3>{plan.name}</h3><p>{plan.description}</p></div>
              <div className={styles.price}><strong>{plan.price}</strong><span>/month</span></div>
              <div className={styles.aliasLimit}>{plan.aliases}</div>
              <ul>{plan.features.map((feature) => <li key={feature}><span>✓</span>{feature}</li>)}</ul>
              <Link className={`button ${plan.featured ? "button-primary" : "button-ghost"} ${styles.planButton}`} href={`/login?mode=signup&plan=${plan.name.toLowerCase()}`}>{plan.cta}</Link>
            </article>
          ))}
        </div>
        <div className={styles.billingNote}>Free registration is available now. Paid checkout buttons become chargeable once the payment gateway is connected.</div>
      </section>

      <section className={`${styles.section} ${styles.faqSection}`} id="faq">
        <div className={styles.sectionEyebrow}>FAQ</div>
        <div className={styles.faqLayout}>
          <div><h2>Questions before you get started?</h2><p>Here are the essentials about how BatMail accounts and aliases work.</p></div>
          <div className={styles.faqList}>{faqs.map(([q, a]) => <article key={q}><h3>{q}</h3><p>{a}</p></article>)}</div>
        </div>
      </section>

      <section className={styles.finalCta}>
        <div><span>START FOR FREE</span><h2>Give your real inbox a layer of privacy.</h2><p>Create your BatMail account and get your first 3 private aliases at no cost.</p></div>
        <Link className="button button-primary button-large" href="/login?mode=signup">Get started free <ArrowRightIcon /></Link>
      </section>

      <footer className={styles.footer}>
        <div><Logo /><p>Private email aliases for safer signups and cleaner inboxes.</p></div>
        <div className={styles.footerLinks}><a href="#features">Features</a><a href="#pricing">Pricing</a><a href="#faq">FAQ</a><Link href="/login">Sign in</Link></div>
        <span>© 2026 BatMail · batform.online</span>
      </footer>
    </main>
  );
}
