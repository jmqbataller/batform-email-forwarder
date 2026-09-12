import Link from "next/link";
import { Logo } from "@/components/logo";
import { ArrowRightIcon, EyeOffIcon, LockIcon, RefreshIcon, ShieldIcon, SparkIcon } from "@/components/icons";
import { forwardingDomain } from "@/lib/config";

export default function Home() {
  return (
    <main className="landing-shell">
      <nav className="landing-nav">
        <Logo />
        <div className="nav-actions">
          <a href="#how">How it works</a>
          <Link className="button button-ghost" href="/login">Sign in</Link>
          <Link className="button button-primary nav-cta" href="/login">Open dashboard <ArrowRightIcon /></Link>
        </div>
      </nav>

      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow"><SparkIcon /> A quieter, safer inbox</div>
          <h1>Your real email<br /><span>stays yours.</span></h1>
          <p>Generate a private address for every account. Messages reach your usual inbox while your personal email remains hidden.</p>
          <div className="hero-actions">
            <Link className="button button-primary button-large" href="/login">Create an alias <ArrowRightIcon /></Link>
            <span className="microcopy"><ShieldIcon /> Authenticated forwarding</span>
          </div>
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
        <span>Random addresses</span><i /><span>Reply protection</span><i /><span>SPF + DKIM ready</span><i /><span>Built for privacy</span>
      </section>

      <section className="how-section" id="how">
        <div className="section-heading">
          <div className="eyebrow">Simple by design</div>
          <h2>One inbox. A different identity everywhere.</h2>
        </div>
        <div className="steps-grid">
          <article><span>01</span><h3>Create a random alias</h3><p>Use it for one website, app, or newsletter instead of giving away your personal address.</p></article>
          <article><span>02</span><h3>Receive as usual</h3><p>BatMail forwards the original message to your verified inbox through a masked sender.</p></article>
          <article><span>03</span><h3>Reply privately</h3><p>Replies travel back through the alias so your personal address stays out of the conversation.</p></article>
        </div>
      </section>

      <footer className="landing-footer"><Logo /><span>Private email aliases for batform.online</span></footer>
    </main>
  );
}
