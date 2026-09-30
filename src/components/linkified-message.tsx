import styles from "./linkified-message.module.css";

const TOKEN_PATTERN = /(https?:\/\/[^\s<>"']+|www\.[^\s<>"']+|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/gi;

function splitTrailingPunctuation(value: string) {
  let token = value;
  let suffix = "";

  while (/[.,;:!?]$/.test(token)) {
    suffix = token.slice(-1) + suffix;
    token = token.slice(0, -1);
  }

  const pairs: Array<[string, string]> = [["(", ")"], ["[", "]"], ["{", "}"]];
  for (const [open, close] of pairs) {
    const openCount = token.split(open).length - 1;
    const closeCount = token.split(close).length - 1;
    if (token.endsWith(close) && closeCount > openCount) {
      suffix = close + suffix;
      token = token.slice(0, -1);
    }
  }

  return { token, suffix };
}

export function LinkifiedMessage({ text }: { text: string }) {
  const parts = text.split(TOKEN_PATTERN);

  return (
    <div className={styles.body}>
      {parts.map((part, index) => {
        if (!part) return null;
        const isMatch = new RegExp(`^${TOKEN_PATTERN.source}$`, "i").test(part);
        if (!isMatch) return <span key={index}>{part}</span>;

        const { token, suffix } = splitTrailingPunctuation(part);
        const isEmail = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(token);
        const href = isEmail ? `mailto:${token}` : token.startsWith("www.") ? `https://${token}` : token;

        return (
          <span key={index}>
            <a
              className={styles.link}
              href={href}
              {...(!isEmail ? { target: "_blank", rel: "noopener noreferrer nofollow" } : {})}
            >
              {token}
            </a>
            {suffix}
          </span>
        );
      })}
    </div>
  );
}
