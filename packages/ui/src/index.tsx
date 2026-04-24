import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  PropsWithChildren,
} from 'react';

function cx(...tokens: Array<string | false | null | undefined>): string {
  return tokens.filter(Boolean).join(' ');
}

type PanelProps = PropsWithChildren<HTMLAttributes<HTMLDivElement> & { accent?: boolean }>;

export function Panel({
  children,
  className,
  accent = false,
  ...props
}: PanelProps) {
  return (
    <div
      className={cx(
        'rounded-[28px] border border-white/8 bg-[rgba(17,20,26,0.88)] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.22)] backdrop-blur-xl',
        accent && 'border-slate-200/10 bg-[rgba(19,23,30,0.94)]',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: 'primary' | 'secondary' | 'ghost' | 'danger';
};

export function Button({
  tone = 'primary',
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cx(
        'inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-semibold tracking-[0.01em] transition duration-200',
        'focus:outline-none focus:ring-2 focus:ring-white/20 focus:ring-offset-2 focus:ring-offset-[#0e1116]',
        'disabled:cursor-not-allowed disabled:opacity-50',
        tone === 'primary' &&
          'bg-[#f4f6f9] text-[#0f1318] hover:bg-white',
        tone === 'secondary' &&
          'border border-white/10 bg-white/5 text-white hover:bg-white/9',
        tone === 'ghost' &&
          'bg-transparent text-slate-300 hover:bg-white/6 hover:text-white',
        tone === 'danger' &&
          'border border-rose-200/10 bg-rose-200/8 text-rose-50 hover:bg-rose-200/12',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

type StatusPillProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'accent';
};

export function StatusPill({
  children,
  className,
  tone = 'neutral',
  ...props
}: StatusPillProps) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.2em]',
        tone === 'neutral' && 'border-white/8 bg-white/4 text-slate-300',
        tone === 'success' && 'border-emerald-200/10 bg-emerald-200/7 text-emerald-50',
        tone === 'warning' && 'border-amber-100/10 bg-amber-100/7 text-amber-50',
        tone === 'danger' && 'border-rose-200/10 bg-rose-200/8 text-rose-50',
        tone === 'accent' && 'border-slate-200/10 bg-slate-100/6 text-slate-50',
        className,
      )}
      {...props}
    >
      <span
        className={cx(
          'h-1.5 w-1.5 rounded-full',
          tone === 'neutral' && 'bg-slate-500',
          tone === 'success' && 'bg-emerald-300',
          tone === 'warning' && 'bg-amber-300',
          tone === 'danger' && 'bg-rose-300',
          tone === 'accent' && 'bg-slate-200',
        )}
      />
      {children}
    </span>
  );
}
