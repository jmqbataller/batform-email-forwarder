import type { SVGProps } from "react";

type Props = SVGProps<SVGSVGElement>;

function IconBase({ children, ...props }: Props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      {children}
    </svg>
  );
}

export const ArrowRightIcon = (p: Props) => <IconBase {...p}><path d="M5 12h14M13 6l6 6-6 6" /></IconBase>;
export const CheckIcon = (p: Props) => <IconBase {...p}><path d="m5 12 4 4L19 6" /></IconBase>;
export const CopyIcon = (p: Props) => <IconBase {...p}><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M15 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h3" /></IconBase>;
export const EyeOffIcon = (p: Props) => <IconBase {...p}><path d="m3 3 18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 4.2A10.7 10.7 0 0 1 12 4c5 0 9 4.4 10 8a13.4 13.4 0 0 1-2 4M6.2 6.2C4.1 7.6 2.7 9.8 2 12c1 3.6 5 8 10 8 1.5 0 2.9-.4 4.1-1" /></IconBase>;
export const InboxIcon = (p: Props) => <IconBase {...p}><path d="M4 4h16v12a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V4Z" /><path d="M4 13h4l2 3h4l2-3h4" /></IconBase>;
export const KeyIcon = (p: Props) => <IconBase {...p}><circle cx="8" cy="15" r="4" /><path d="m11 12 8-8M16 7l2 2M14 9l2 2" /></IconBase>;
export const LockIcon = (p: Props) => <IconBase {...p}><rect x="4" y="10" width="16" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></IconBase>;
export const MailIcon = (p: Props) => <IconBase {...p}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></IconBase>;
export const PlusIcon = (p: Props) => <IconBase {...p}><path d="M12 5v14M5 12h14" /></IconBase>;
export const RefreshIcon = (p: Props) => <IconBase {...p}><path d="M20 7v5h-5M4 17v-5h5" /><path d="M6.1 9A7 7 0 0 1 18 7l2 5M4 12l2 5a7 7 0 0 0 11.9-2" /></IconBase>;
export const SendIcon = (p: Props) => <IconBase {...p}><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></IconBase>;
export const ShieldIcon = (p: Props) => <IconBase {...p}><path d="M12 3 4 6v5c0 5.2 3.3 8.6 8 10 4.7-1.4 8-4.8 8-10V6l-8-3Z" /><path d="m9 12 2 2 4-4" /></IconBase>;
export const SparkIcon = (p: Props) => <IconBase {...p}><path d="m12 3 1.3 4.2L17.5 9l-4.2 1.8L12 15l-1.3-4.2L6.5 9l4.2-1.8L12 3Z" /><path d="m19 15 .7 2.3L22 18l-2.3.7L19 21l-.7-2.3L16 18l2.3-.7L19 15Z" /></IconBase>;
export const TrashIcon = (p: Props) => <IconBase {...p}><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5" /></IconBase>;
