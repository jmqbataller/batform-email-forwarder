import { EyeOffIcon, KeyIcon, ShieldIcon } from "@/components/icons";
import { forwardingDomain } from "@/lib/config";

export const metadata = { title: "Security" };

const protections = [
  { icon: ShieldIcon, title: "Your real address stays private", text: "Websites only receive your random BatMail alias, never your destination inbox." },
  { icon: EyeOffIcon, title: "Private forwarding", text: `Mail sent to ${forwardingDomain} is routed to your verified account without revealing the forwarding website in the visible sender name.` },
  { icon: KeyIcon, title: "Account-scoped controls", text: "Only your signed-in account can view, pause, or delete its aliases and activity." },
];

export default function SecurityPage() {
  return (
    <div className="dashboard">
      <div className="page-head"><div><h1>Security</h1><p>How BatMail protects your inbox and alias controls.</p></div></div>
      <section className="security-grid" aria-label="Security protections">
        {protections.map(({ icon: Icon, title, text }) => (
          <article className="security-card" key={title}><span className="stat-icon"><Icon /></span><h2>{title}</h2><p>{text}</p></article>
        ))}
      </section>
    </div>
  );
}
