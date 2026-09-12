export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="brand" aria-label="BatMail">
      <span className="brand-mark" aria-hidden="true">
        <svg viewBox="0 0 32 32" role="img">
          <path d="M4 9.5c2.4.1 4.8 1.3 6.5 3.2L16 7l5.5 5.7c1.7-1.9 4.1-3.1 6.5-3.2-.2 6.8-4.8 11.2-12 15.5C8.8 20.7 4.2 16.3 4 9.5Z" />
          <path className="brand-cut" d="M12.8 17.4 16 14l3.2 3.4L16 16l-3.2 1.4Z" />
        </svg>
      </span>
      {!compact && <span>BatMail</span>}
    </span>
  );
}
