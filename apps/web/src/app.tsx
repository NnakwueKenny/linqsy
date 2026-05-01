import {
  useId,
  useRef,
  useState,
  useEffect,
  type DragEvent,
  type ReactNode,
  startTransition,
} from 'react';
import {
  motion,
  LayoutGroup,
  AnimatePresence,
} from 'framer-motion';
import {
  type Session,
  type Transfer,
  type WebPageBootstrap,
  webPageBootstrapSchema,
} from '@linqsy/shared';
import QRCode from 'qrcode';
import logoIcon from '../assets/images/logo_icon.jpeg';



type AppTheme = 'light' | 'dark';

type PendingAction = 'restart' | 'shutdown' | null;

type SelectedFile = {
  file: File;
  relativePath: string;
};

const UPLOAD_CONCURRENCY = 3;
const DOWNLOAD_RETRY_DELAY_MS = 30_000;

function encodeTransferHeader(value: string) {
  return encodeURIComponent(value);
}

function getUploadErrorMessage(xhr: XMLHttpRequest) {
  const fallback = xhr.status
    ? `Upload failed with HTTP ${xhr.status}.`
    : 'Upload failed before the server responded.';

  if (!xhr.responseText) {
    return fallback;
  }

  try {
    const payload = JSON.parse(xhr.responseText) as { message?: unknown };
    return typeof payload.message === 'string' && payload.message.trim()
      ? payload.message
      : fallback;
  } catch {
    return fallback;
  }
}

type BrowserNavigator = Navigator & {
  userAgentData?: {
    platform?: string;
    getHighEntropyValues?: (
      hints: string[],
    ) => Promise<{ model?: string; platform?: string }>;
  };
};

type DirectoryReader = {
  readEntries: (
    success: (entries: FileEntry[]) => void,
    error?: (error: Error) => void,
  ) => void;
};

type FileEntry = {
  isDirectory: boolean;
  isFile: boolean;
  name: string;
  createReader?: () => DirectoryReader;
  file?: (success: (file: File) => void, error?: (error: Error) => void) => void;
};

type EntryItem = DataTransferItem & {
  webkitGetAsEntry?: () => FileEntry | null;
};

type DirectoryInput = HTMLInputElement & {
  directory?: boolean;
  webkitdirectory?: boolean;
};

const PREVIEW_BOOTSTRAP: WebPageBootstrap = webPageBootstrapSchema.parse({
  mode: 'host',
  joinUrl: 'http://192.168.0.2:4173/join/KENEX4',
  lanJoinUrl: 'http://192.168.0.2:4173/join/KENEX4',
  localHostUrl: 'http://127.0.0.1:4173',
  localJoinUrl: 'http://127.0.0.1:4173/join/KENEX4',
  session: {
    id: 'preview-session',
    code: 'KENEX4',
    createdAt: Date.now(),
    hostDeviceId: 'preview-host',
    status: 'waiting',
    devices: [
      {
        connectedAt: Date.now(),
        id: 'preview-host',
        isOnline: true,
        name: 'Kene MacBook Pro',
        role: 'host',
      },
    ],
    transfers: [],
  },
});

function readBootstrap(): { bootstrap: WebPageBootstrap; preview: boolean } {
  const source = window.__LINQSY_BOOTSTRAP__;

  if (!source) {
    return {
      bootstrap: PREVIEW_BOOTSTRAP,
      preview: true,
    };
  }

  const parsed = webPageBootstrapSchema.safeParse(source);

  if (!parsed.success) {
    return {
      bootstrap: PREVIEW_BOOTSTRAP,
      preview: true,
    };
  }

  return {
    bootstrap: parsed.data,
    preview: false,
  };
}

function getHostDevice(session: Session) {
  return session.devices.find((device) => device.id === session.hostDeviceId) ?? session.devices[0] ?? null;
}

function getReceiverDevice(session: Session) {
  return session.devices.find((device) => device.role === 'client' && device.isOnline) ?? null;
}

function formatBytes(size: number) {
  if (!Number.isFinite(size) || size <= 0) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB'];
  const unitIndex = Math.min(Math.floor(Math.log(size) / Math.log(1024)), units.length - 1);
  const value = size / Math.pow(1024, unitIndex);
  const digits = value >= 10 || unitIndex === 0 ? 0 : 1;
  return `${value.toFixed(digits)} ${units[unitIndex]}`;
}

function formatSpeed(speed: number) {
  if (!Number.isFinite(speed) || speed <= 0) {
    return '';
  }

  return `${formatBytes(speed)}/s`;
}

function describeTransfer(transfer: Transfer, ownTransfer: boolean) {
  if (transfer.status === 'uploading') {
    return ownTransfer ? 'Sending' : 'Incoming';
  }

  if (transfer.status === 'downloading') {
    return ownTransfer ? 'Saving remotely' : 'Downloading';
  }

  if (transfer.status === 'ready') {
    return ownTransfer ? 'Ready' : 'Starting';
  }

  if (transfer.status === 'completed') {
    return ownTransfer ? 'Sent' : 'Saved';
  }

  if (transfer.status === 'failed') {
    return 'Failed';
  }

  if (transfer.status === 'cancelled') {
    return 'Cancelled';
  }

  return 'Queued';
}

function fallbackDeviceName() {
  const ua = navigator.userAgent || '';
  const navigatorData = navigator as BrowserNavigator;
  const platform = navigatorData.userAgentData?.platform || navigator.platform || '';

  if (/iPhone/i.test(ua)) {
    return 'iPhone';
  }

  if (/iPad/i.test(ua)) {
    return 'iPad';
  }

  if (/Android/i.test(ua)) {
    return /Mobile/i.test(ua) ? 'Android phone' : 'Android device';
  }

  if (/Mac/i.test(platform)) {
    return 'Mac';
  }

  if (/Win/i.test(platform)) {
    return 'Windows PC';
  }

  if (/Linux/i.test(platform)) {
    return 'Linux device';
  }

  return 'This device';
}

async function resolveClientDeviceName() {
  const navigatorData = navigator as BrowserNavigator;
  let label = fallbackDeviceName();

  if (
    navigatorData.userAgentData &&
    typeof navigatorData.userAgentData.getHighEntropyValues === 'function'
  ) {
    try {
      const details = await navigatorData.userAgentData.getHighEntropyValues(['model', 'platform']);
      const model = String(details.model || '').trim();
      const platform = String(details.platform || '').trim();

      if (model && model.toLowerCase() !== 'unknown') {
        label = model;
      } else if (platform) {
        label = platform;
      }
    } catch (_error) {
      label = fallbackDeviceName();
    }
  }

  return label;
}

function isTransferActive(transfer: Transfer) {
  return ['uploading', 'downloading', 'queued', 'ready'].includes(transfer.status);
}

function ThemeToggle({
  theme,
  onToggle,
}: {
  theme: AppTheme;
  onToggle: () => void;
}) {
  const checked = theme === 'dark';

  return (
    <button
      className='group inline-flex h-11 w-[68px] items-center rounded-full border border-black/10 bg-white/90 px-1.5 shadow-[0_12px_32px_rgba(19,24,31,0.08)] transition hover:border-black/15 hover:bg-white dark:border-white/10 dark:bg-white/5 dark:hover:border-white/15 dark:hover:bg-white/10'
      onClick={onToggle}
      type='button'
      aria-label='Toggle theme'
    >
      <span className='relative h-8 w-full overflow-hidden rounded-full bg-black/[0.04] dark:bg-white/[0.06]'>
        <motion.span
          className='absolute top-1 grid h-6 w-6 place-items-center rounded-full bg-white text-slate-900 shadow-[0_8px_20px_rgba(15,23,42,0.18)] dark:bg-slate-950 dark:text-white'
          animate={{ x: checked ? 28 : 0 }}
          transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
          style={{ left: 4 }}
        >
          {checked ? <MoonIcon className='h-3.5 w-3.5' /> : <SunIcon className='h-3.5 w-3.5' />}
        </motion.span>
      </span>
    </button>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  danger = false,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      aria-label={label}
      className={[
        'inline-flex h-11 w-11 items-center justify-center rounded-full border transition',
        danger
          ? 'border-rose-200/40 bg-rose-50 text-rose-600 hover:bg-rose-100 dark:border-rose-300/15 dark:bg-rose-500/10 dark:text-rose-200 dark:hover:bg-rose-500/16'
          : 'border-black/10 bg-white/90 text-slate-900 shadow-[0_12px_32px_rgba(19,24,31,0.08)] hover:border-black/15 hover:bg-white dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:border-white/15 dark:hover:bg-white/10',
        disabled ? 'cursor-not-allowed opacity-50' : '',
      ].join(' ')}
      disabled={disabled}
      onClick={onClick}
      type='button'
    >
      {children}
    </button>
  );
}

function DeviceChip({
  tone = 'neutral',
  children,
}: {
  tone?: 'neutral' | 'active';
  children: ReactNode;
}) {
  return (
    <div
      className={[
        'inline-flex max-w-[16rem] items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium shadow-[0_10px_26px_rgba(20,24,32,0.06)] backdrop-blur',
        tone === 'active'
          ? 'border-[#5b72ee]/20 bg-white/92 text-slate-900 dark:border-[#5b72ee]/25 dark:bg-[#11171d]/88 dark:text-white'
          : 'border-black/8 bg-white/84 text-slate-600 dark:border-white/10 dark:bg-[#11171d]/76 dark:text-slate-300',
      ].join(' ')}
    >
      <span
        className={[
          'h-2 w-2 rounded-full',
          tone === 'active' ? 'bg-[#5b72ee]' : 'bg-slate-300 dark:bg-slate-500',
        ].join(' ')}
      />
      <span className='truncate'>{children}</span>
    </div>
  );
}

function BrandLockup() {
  return (
    <div className='flex items-center gap-3'>
      <span className='grid h-10 w-10 shrink-0 place-items-center rounded-[16px] border border-black/8 bg-white shadow-[0_8px_20px_rgba(18,24,32,0.05)] dark:border-white/8 dark:bg-white/[0.04]'>
        <img
          alt='Linqsy'
          className='h-8 w-8 rounded-[12px] object-cover'
          src={logoIcon}
        />
      </span>
      <span className='font-display text-[clamp(1.15rem,1.2vw,1.55rem)] font-semibold tracking-[-0.06em] text-slate-950 dark:text-white'>
        Linqsy
      </span>
    </div>
  );
}

function RippleField({
  waiting,
  children,
  variant,
}: {
  waiting: boolean;
  variant: 'waiting' | 'connected';
  children: ReactNode;
}) {
  if (variant === 'connected') {
    return (
      <div className='pointer-events-none absolute inset-0'>
        <div className='absolute inset-0 flex items-center justify-center'>
          <div className='relative aspect-square w-[min(96vw,32rem)] sm:w-[min(78vw,46rem)]'>
            {[0.36, 0.62, 0.88].map((scale, index) => (
              <span
                key={scale}
                className='absolute left-1/2 top-1/2 rounded-full border border-black/[0.06] dark:border-white/[0.07]'
                style={{
                  height: `${scale * 100}%`,
                  width: `${scale * 100}%`,
                  transform: 'translate(-50%, -50%)',
                  opacity: index === 2 ? 0.82 : 1,
                }}
              />
            ))}
          </div>
        </div>

        <div className='pointer-events-auto absolute inset-0 flex items-center justify-center'>
          {children}
        </div>
      </div>
    );
  }

  return (
    <div
      className='pointer-events-none absolute inset-0 flex items-center justify-center'
    >
      <div
        className='relative aspect-square w-[min(96vw,34rem)] sm:w-[min(72vw,40rem)]'
      >
        {[0.28, 0.48, 0.7, 0.92].map((scale, index) => (
          <span
            key={scale}
            className='absolute left-1/2 top-1/2 rounded-full border border-black/[0.08] dark:border-white/[0.08]'
            style={{
              height: `${scale * 100}%`,
              width: `${scale * 100}%`,
              transform: 'translate(-50%, -50%)',
              opacity: index === 3 ? 0.55 : 1,
            }}
          />
        ))}

        <AnimatePresence>
          {waiting ? (
            <>
              {[0, 1].map((index) => (
                <motion.span
                  key={index}
                  className='absolute left-1/2 top-1/2 h-[18%] w-[18%] rounded-full border border-[#5b72ee]/28'
                  style={{ transform: 'translate(-50%, -50%)' }}
                  initial={{ opacity: 0, scale: 0.72 }}
                  animate={{ opacity: [0, 0.42, 0], scale: [0.72, 2.25, 2.9] }}
                  exit={{ opacity: 0 }}
                  transition={{
                    duration: 3.4,
                    ease: [0.19, 1, 0.22, 1],
                    repeat: Number.POSITIVE_INFINITY,
                    delay: index * 1.35,
                  }}
                />
              ))}
            </>
          ) : null}
        </AnimatePresence>

        <div
          className='pointer-events-auto absolute inset-0 flex items-center justify-center'
        >
          {children}
        </div>
      </div>
    </div>
  );
}

function QrPanel({
  qrSvg,
  copied,
  onCopy,
  compact,
  joinUrl,
}: {
  joinUrl: string;
  qrSvg: string;
  compact: boolean;
  copied: boolean;
  onCopy: () => void;
}) {
  if (compact) {
    return (
      <motion.button
        layoutId='qr-panel'
        className='flex items-center gap-3 rounded-[20px] border border-black/10 bg-white/92 px-4 py-3 text-left shadow-[0_24px_60px_rgba(18,24,32,0.12)] backdrop-blur dark:border-white/10 dark:bg-[#121920]/88'
        onClick={onCopy}
        type='button'
      >
        <span className='grid h-10 w-10 place-items-center rounded-[14px] border border-black/8 bg-white text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-white'>
          <QrIcon className='h-4.5 w-4.5' />
        </span>
        <span className='grid gap-0.5'>
          <span className='text-sm font-semibold text-slate-900 dark:text-white'>Show link</span>
          <span className='text-xs text-slate-500 dark:text-slate-400'>{copied ? 'Copied' : 'Open or scan'}</span>
        </span>
      </motion.button>
    );
  }

  return (
    <motion.div
      layoutId='qr-panel'
      className='flex w-[min(100%,18.75rem)] flex-col items-center gap-3.5 text-center sm:w-[min(100%,20rem)] sm:gap-4'
    >
      <div className='rounded-[24px] border border-black/8 bg-white p-3.5 shadow-[0_18px_52px_rgba(16,21,28,0.08)] dark:border-white/10 dark:bg-white sm:p-4'>
        <div
          className='mx-auto w-full max-w-[16rem] [&_svg]:block [&_svg]:h-auto [&_svg]:w-full'
          dangerouslySetInnerHTML={{ __html: qrSvg }}
        />
      </div>

      <div className='space-y-3'>
        <p className='break-words text-[0.82rem] font-medium leading-6 text-slate-500 dark:text-slate-300 sm:text-[0.86rem]'>
          {joinUrl}
        </p>

        <button
          className='inline-flex items-center gap-2 rounded-full border border-black/10 bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-900 dark:border-white/10 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100'
          onClick={onCopy}
          type='button'
        >
          <LinkIcon className='h-4 w-4' />
          {copied ? 'Copied' : 'Copy link'}
        </button>
      </div>
    </motion.div>
  );
}

function DropDisc({
  busy,
  title,
  onTap,
  onDrop,
  active,
  dragging,
  progress,
  subtitle,
  onDragOver,
  onDragEnter,
  onDragLeave,
  onChooseFiles,
  onChooseFolders,
}: {
  busy: boolean;
  title: string;
  active: boolean;
  progress: number;
  subtitle: string;
  dragging: boolean;
  onTap: () => void;
  onChooseFiles: () => void;
  onChooseFolders: () => void;
  onDrop: (event: DragEvent<HTMLButtonElement>) => void;
  onDragEnter: (event: DragEvent<HTMLButtonElement>) => void;
  onDragLeave: (event: DragEvent<HTMLButtonElement>) => void;
  onDragOver: (event: DragEvent<HTMLButtonElement>) => void;
}) {

  const circleRadius = 166;
  const progressValue = Math.max(0, Math.min(100, progress));
  const strokeOffset = circleRadius * 2 * Math.PI * (1 - progressValue / 100);

  return (
    <div className='flex flex-col items-center gap-4 sm:gap-5'>
      <motion.button
        className={[
          'relative grid h-[clamp(14rem,66vw,19rem)] w-[clamp(14rem,66vw,19rem)] place-items-center rounded-full border border-black/[0.08] bg-white/80 px-5 text-center shadow-[0_30px_84px_rgba(19,24,31,0.08)] backdrop-blur-xl transition dark:border-white/[0.08] dark:bg-[#11171d]/78 sm:h-[clamp(18rem,40vw,26rem)] sm:w-[clamp(18rem,40vw,26rem)] sm:px-8',
          active ? 'cursor-pointer' : 'cursor-default opacity-92',
          dragging ? 'scale-[1.01] border-emerald-400/35' : '',
        ].join(' ')}
        disabled={!active}
        onClick={onTap}
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        onDragOver={onDragOver}
        onDrop={onDrop}
        type='button'
      >
        <svg
          aria-hidden='true'
          className='pointer-events-none absolute inset-[-10px] h-[calc(100%+20px)] w-[calc(100%+20px)] -rotate-90 sm:inset-[-14px] sm:h-[calc(100%+28px)] sm:w-[calc(100%+28px)]'
          viewBox='0 0 372 372'
        >
          <circle
            cx='186'
            cy='186'
            fill='none'
            r={circleRadius}
            stroke='currentColor'
            strokeOpacity='0.08'
            strokeWidth='2'
            className='text-slate-900 dark:text-white'
          />
          <motion.circle
            animate={{ strokeDashoffset: strokeOffset }}
            className='text-emerald-500'
            cx='186'
            cy='186'
            fill='none'
            r={circleRadius}
            stroke='currentColor'
            strokeDasharray={circleRadius * 2 * Math.PI}
            strokeLinecap='round'
            strokeWidth='6'
            transition={{ duration: busy ? 0.18 : 0.26, ease: 'easeOut' }}
          />
        </svg>

        <div className='pointer-events-none relative z-10 flex max-w-[11rem] flex-col items-center gap-2.5 sm:max-w-[16rem] sm:gap-4'>
          <span className='grid h-10 w-10 place-items-center rounded-full border border-black/8 bg-white text-[#5b72ee] shadow-[0_12px_28px_rgba(16,21,28,0.08)] dark:border-white/10 dark:bg-white/5 sm:h-14 sm:w-14'>
            <SignalIcon className='h-4.5 w-4.5 sm:h-6 sm:w-6' />
          </span>

          <div className='space-y-2'>
            <h2 className='text-balance font-display text-[clamp(1.35rem,6vw,2.85rem)] font-semibold tracking-[-0.05em] text-slate-950 dark:text-white'>
              {title}
            </h2>
            <p className='text-balance text-[0.84rem] leading-5 text-slate-500 dark:text-slate-400 sm:text-[0.92rem] sm:leading-6'>
              {subtitle}
            </p>
          </div>
        </div>
      </motion.button>

      <div className='flex flex-wrap items-center justify-center gap-2'>
        <button
            className={[
              'inline-flex h-10 items-center gap-2 rounded-full border px-3.5 text-sm font-semibold transition sm:h-11 sm:px-4',
              active
                ? 'border-black/10 bg-white/92 text-slate-900 shadow-[0_12px_30px_rgba(18,24,32,0.06)] hover:border-black/15 hover:bg-white dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:border-white/15 dark:hover:bg-white/10'
              : 'cursor-not-allowed border-black/8 bg-white/60 text-slate-400 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-500',
          ].join(' ')}
          disabled={!active}
          onClick={onChooseFiles}
          type='button'
        >
          <FileIcon className='h-4 w-4' />
          Files
        </button>
        <button
            className={[
              'inline-flex h-10 items-center gap-2 rounded-full border px-3.5 text-sm font-semibold transition sm:h-11 sm:px-4',
              active
                ? 'border-black/10 bg-white/92 text-slate-900 shadow-[0_12px_30px_rgba(18,24,32,0.06)] hover:border-black/15 hover:bg-white dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:border-white/15 dark:hover:bg-white/10'
              : 'cursor-not-allowed border-black/8 bg-white/60 text-slate-400 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-500',
          ].join(' ')}
          disabled={!active}
          onClick={onChooseFolders}
          type='button'
        >
          <FolderIcon className='h-4 w-4' />
          Folder
        </button>
      </div>
    </div>
  );
}

function TransferSheet({
  active,
  open,
  transfers,
  deviceId,
  onToggle,
}: {
  active: boolean;
  open: boolean;
  transfers: Transfer[];
  deviceId: string;
  onToggle: () => void;
}) {
  if (!transfers.length) {
    return null;
  }

  const activeTransfers = transfers.filter((transfer) => isTransferActive(transfer));
  const copy =
    activeTransfers.length > 0
      ? `${activeTransfers.length} moving`
      : `${transfers.length} recent`;

  return (
    <motion.section
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      className='absolute inset-x-3 bottom-3 z-30 w-auto sm:inset-x-auto sm:right-5 sm:w-[22rem]'
    >
      <div className='overflow-hidden rounded-[26px] border border-black/10 bg-white/92 shadow-[0_26px_80px_rgba(19,24,31,0.14)] backdrop-blur dark:border-white/10 dark:bg-[#11171d]/88'>
        <button
          className='flex w-full items-center justify-between gap-4 px-4 py-3.5 text-left'
          onClick={onToggle}
          type='button'
        >
          <div className='flex items-center gap-3'>
            <span className='grid h-10 w-10 place-items-center rounded-2xl border border-black/8 bg-white text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-white'>
              <StackIcon className='h-4.5 w-4.5' />
            </span>
            <div>
              <div className='text-sm font-semibold text-slate-950 dark:text-white'>Transfers</div>
              <div className='text-xs text-slate-500 dark:text-slate-400'>{copy}</div>
            </div>
          </div>

          <div className='flex items-center gap-3'>
            <span className='inline-flex min-w-6 items-center justify-center rounded-full bg-[#5b72ee]/12 px-2 py-1 text-xs font-semibold text-[#445ad9] dark:text-[#a8b3ff]'>
              {activeTransfers.length}
            </span>
            <motion.span animate={{ rotate: open ? 180 : 0 }}>
              <ChevronIcon className='h-4 w-4 text-slate-500 dark:text-slate-400' />
            </motion.span>
          </div>
        </button>

        <AnimatePresence initial={false}>
          {open ? (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className='overflow-hidden border-t border-black/6 dark:border-white/8'
            >
              <div className='max-h-[46vh] space-y-3 overflow-auto px-4 py-4'>
                {transfers
                  .slice()
                  .sort((left, right) => right.createdAt - left.createdAt)
                  .map((transfer) => {
                    const ownTransfer = transfer.senderDeviceId === deviceId;
                    const progress =
                      transfer.status === 'completed'
                        ? 100
                        : Math.max(0, Math.min(100, Number(transfer.progressPercent || 0)));
                    const speed = formatSpeed(Number(transfer.speedBytesPerSecond || 0));
                    const meta = [describeTransfer(transfer, ownTransfer)];

                    if (progress > 0 && transfer.status !== 'failed' && transfer.status !== 'cancelled') {
                      meta.push(`${progress}%`);
                    }

                    if (speed) {
                      meta.push(speed);
                    }

                    meta.push(formatBytes(transfer.size));

                    return (
                      <article
                        key={transfer.id}
                        className='rounded-[20px] border border-black/[0.06] bg-white/86 p-3.5 dark:border-white/[0.06] dark:bg-white/[0.04]'
                      >
                        <div className='flex items-start justify-between gap-3'>
                          <div className='min-w-0'>
                            <p className='truncate text-sm font-semibold text-slate-950 dark:text-white'>
                              {transfer.relativePath || transfer.filename}
                            </p>
                            <p className='mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400'>
                              {meta.join('   ')}
                            </p>
                          </div>
                        </div>

                        <div className='mt-3 h-1.5 overflow-hidden rounded-full bg-black/[0.05] dark:bg-white/[0.08]'>
                          <motion.div
                            animate={{
                              width: `${transfer.status === 'queued' || transfer.status === 'ready' ? 36 : progress}%`,
                              x: transfer.status === 'queued' || transfer.status === 'ready' ? ['-40%', '220%'] : '0%',
                            }}
                            transition={
                              transfer.status === 'queued' || transfer.status === 'ready'
                                ? {
                                    duration: 0.92,
                                    ease: 'linear',
                                    repeat: Number.POSITIVE_INFINITY,
                                  }
                                : { duration: 0.18, ease: 'linear' }
                            }
                            className='h-full rounded-full bg-gradient-to-r from-[#5b72ee] via-[#6a7dff] to-[#445ad9]'
                          />
                        </div>
                      </article>
                    );
                  })}
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </motion.section>
  );
}

export function App() {
  const bootstrapState = readBootstrap();
  const [bootstrap, setBootstrap] = useState(bootstrapState.bootstrap);
  const [preview] = useState(bootstrapState.preview);
  const [session, setSession] = useState(bootstrapState.bootstrap.session);
  const [deviceId, setDeviceId] = useState(
    bootstrapState.bootstrap.mode === 'host'
      ? bootstrapState.bootstrap.session.hostDeviceId
      : '',
  );
  const [joined, setJoined] = useState(bootstrapState.bootstrap.mode === 'host');
  const [manualDisconnect, setManualDisconnect] = useState(false);
  const [queueOpen, setQueueOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [theme, setTheme] = useState<AppTheme>(() => {
    const storedTheme = window.localStorage.getItem('linqsy:theme');

    if (storedTheme === 'dark' || storedTheme === 'light') {
      return storedTheme;
    }

    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });
  const [joinDeviceName, setJoinDeviceName] = useState('');
  const [qrSvg, setQrSvg] = useState('');
  const [qrExpanded, setQrExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [closed, setClosed] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const autoReceivedRef = useRef<Set<string>>(new Set());
  const inFlightDownloadsRef = useRef<Set<string>>(new Set());
  const lastActiveTransferRef = useRef('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const copyTimerRef = useRef<number | null>(null);
  const joinInFlightRef = useRef(false);
  const joinRetryTimerRef = useRef<number | null>(null);
  const leaveStateRef = useRef<{
    closed: boolean;
    deviceId: string;
    isReceiver: boolean;
    manualDisconnect: boolean;
    preview: boolean;
    sessionCode: string;
    sessionStatus: Session['status'];
  }>({
    closed: false,
    deviceId: '',
    isReceiver: false,
    manualDisconnect: false,
    preview: false,
    sessionCode: bootstrapState.bootstrap.session.code,
    sessionStatus: bootstrapState.bootstrap.session.status,
  });
  const sceneId = useId();

  const mode = bootstrap.mode;
  const isHost = mode === 'host';
  const isReceiver = mode === 'receiver';
  const currentDeviceKey = `linqsy:${session.code}:device-id`;
  const hostDevice = getHostDevice(session);
  const receiverDevice = getReceiverDevice(session);
  const selfDevice =
    session.devices.find((item) => item.id === deviceId) ??
    (isHost ? hostDevice : null);
  const peerDevice = session.devices.find((item) => item.id !== deviceId && item.isOnline) ?? null;
  const receiverOwnDeviceOnline = Boolean(
    !isHost &&
    deviceId &&
    session.devices.some((item) => item.id === deviceId && item.isOnline),
  );
  const receiverReady = joined || receiverOwnDeviceOnline;
  const connected = isHost ? Boolean(receiverDevice) : receiverReady;
  const waiting = !connected;
  const activeTransfer = session.transfers
    .slice()
    .sort((left, right) => right.createdAt - left.createdAt)
    .find((transfer) => isTransferActive(transfer)) ?? null;
  const showTransferSheet = session.transfers.length > 0;
  const canUseDropSurface =
    session.status !== 'ended' && !closed && (isHost ? Boolean(receiverDevice) : receiverReady);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    window.localStorage.setItem('linqsy:theme', theme);
  }, [theme]);

  useEffect(() => {
    setUploadError('');
  }, [session.code]);

  useEffect(() => {
    let cancelled = false;

    void QRCode.toString(bootstrap.lanJoinUrl ?? bootstrap.joinUrl, {
      type: 'svg',
      margin: 4,
      width: 320,
      color: {
        dark: '#101418',
        light: '#ffffff',
      },
    }).then((nextSvg) => {
      if (!cancelled) {
        setQrSvg(nextSvg);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [bootstrap.joinUrl]);

  useEffect(() => {
    if (folderInputRef.current) {
      const directoryInput = folderInputRef.current as DirectoryInput;
      directoryInput.webkitdirectory = true;
      directoryInput.directory = true;
    }
  }, []);

  useEffect(() => {
    if (!isHost) {
      const storedDeviceId = window.localStorage.getItem(currentDeviceKey);

      if (storedDeviceId) {
        setDeviceId(storedDeviceId);
      }
    }
  }, [currentDeviceKey, isHost]);

  useEffect(() => {
    if (!isReceiver || preview) {
      return;
    }

    let cancelled = false;

    void resolveClientDeviceName().then((nextName) => {
      if (!cancelled) {
        setJoinDeviceName(nextName);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [isReceiver, preview]);

  useEffect(() => {
    const currentActiveId = activeTransfer?.id ?? '';

    if (currentActiveId && currentActiveId !== lastActiveTransferRef.current) {
      setQueueOpen(true);
    }

    lastActiveTransferRef.current = currentActiveId;
  }, [activeTransfer?.id]);

  useEffect(() => {
    return () => {
      if (joinRetryTimerRef.current) {
        window.clearTimeout(joinRetryTimerRef.current);
      }
    };
  }, []);

  async function copyJoinLink() {
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(bootstrap.joinUrl);
      }
    } catch (_error) {
      const input = document.createElement('input');
      input.value = bootstrap.joinUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      input.remove();
    }

    setCopied(true);

    if (copyTimerRef.current) {
      window.clearTimeout(copyTimerRef.current);
    }

    copyTimerRef.current = window.setTimeout(() => {
      setCopied(false);
    }, 1600);
  }

  async function parseResponse(response: Response) {
    try {
      return await response.json();
    } catch (_error) {
      return null;
    }
  }

  function resetSocket() {
    if (reconnectTimerRef.current) {
      window.clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }

    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }
  }

  useEffect(() => {
    if (closed || preview) {
      return;
    }

    if (session.status === 'ended') {
      return;
    }

    if (isReceiver && !receiverReady) {
      return;
    }

    let disposed = false;

    function connect() {
      if (disposed) {
        return;
      }

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const query = new URLSearchParams({
        code: session.code,
      });

      if (deviceId) {
        query.set('deviceId', deviceId);
      }

      const socket = new WebSocket(
        `${protocol}//${window.location.host}/ws?${query.toString()}`,
      );

      socketRef.current = socket;

      socket.addEventListener('message', (event) => {
        try {
          const message = JSON.parse(event.data) as { payload?: Session };

          if (message.payload) {
            setSession(message.payload);
          }
        } catch (_error) {
          return;
        }
      });

      socket.addEventListener('close', () => {
        if (socketRef.current === socket) {
          socketRef.current = null;
        }

        if (
          disposed ||
          closed ||
          preview ||
          session.status === 'ended' ||
          (isReceiver && (!receiverReady || manualDisconnect))
        ) {
          return;
        }

        reconnectTimerRef.current = window.setTimeout(() => {
          connect();
        }, 1200);
      });
    }

    connect();

    return () => {
      disposed = true;
      resetSocket();
    };
  }, [closed, deviceId, isReceiver, manualDisconnect, preview, receiverReady, session.code, session.status]);

  function startNativeDownload(url: string, filename: string) {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.rel = 'noopener';
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  async function downloadTransfer(transfer: Transfer) {
    if (preview || inFlightDownloadsRef.current.has(transfer.id)) {
      return;
    }

    inFlightDownloadsRef.current.add(transfer.id);
    let keepInFlightUntilStatusChanges = false;
    setUploadError('');

    try {
      const downloadUrl = `/api/transfers/${encodeURIComponent(transfer.id)}/download`;
      startNativeDownload(downloadUrl, transfer.filename);
      keepInFlightUntilStatusChanges = true;
      window.setTimeout(() => {
        inFlightDownloadsRef.current.delete(transfer.id);
      }, DOWNLOAD_RETRY_DELAY_MS);
    } catch (_error) {
      autoReceivedRef.current.delete(transfer.id);
      setUploadError('Download failed before the file could be saved.');
    } finally {
      if (!keepInFlightUntilStatusChanges) {
        inFlightDownloadsRef.current.delete(transfer.id);
      }
    }
  }

  useEffect(() => {
    const transferStatuses = new Map(
      session.transfers.map((transfer) => [transfer.id, transfer.status]),
    );

    for (const transferId of inFlightDownloadsRef.current) {
      const status = transferStatuses.get(transferId);

      if (status && status !== 'queued' && status !== 'ready' && status !== 'downloading') {
        inFlightDownloadsRef.current.delete(transferId);
      }
    }
  }, [session.transfers]);

  useEffect(() => {
    if (preview || !deviceId || closed || session.status === 'ended') {
      return;
    }

    if (isReceiver && !receiverReady) {
      return;
    }

    if (isHost && !connected) {
      return;
    }

    const transfers = session.transfers
      .slice()
      .sort((left, right) => left.createdAt - right.createdAt);

    for (const transfer of transfers) {
      const canStartDownload =
        transfer.status === 'queued' ||
        transfer.status === 'ready' ||
        (
          transfer.status === 'downloading' &&
          Number(transfer.bytesTransferred || 0) === 0
        );

      if (transfer.senderDeviceId === deviceId || !canStartDownload) {
        continue;
      }

      if (
        autoReceivedRef.current.has(transfer.id) ||
        inFlightDownloadsRef.current.has(transfer.id)
      ) {
        continue;
      }

      autoReceivedRef.current.add(transfer.id);
      void downloadTransfer(transfer);
    }
  }, [closed, connected, deviceId, isHost, isReceiver, preview, receiverReady, session.status, session.transfers]);

  async function postJson<T>(url: string, payload?: unknown) {
    const init: RequestInit = {
      method: 'POST',
      keepalive: true,
    };

    if (payload !== undefined) {
      init.body = JSON.stringify(payload);
      init.headers = {
        'content-type': 'application/json',
      };
    }

    const response = await fetch(url, init);

    return {
      payload: (await parseResponse(response)) as T | null,
      response,
    };
  }

  async function joinReceiver(allowRetry: boolean) {
    if (!isReceiver || preview || session.status === 'ended' || closed || joinInFlightRef.current) {
      return;
    }

    joinInFlightRef.current = true;
    const persistedDeviceId = window.localStorage.getItem(currentDeviceKey);
    const nextDeviceName = joinDeviceName || (await resolveClientDeviceName());
    try {
      const result = await postJson<{ device: { id: string }; session: Session }>(
        `/api/session/${encodeURIComponent(session.code)}/join`,
        {
          deviceName: nextDeviceName,
        },
      );

      if (result.response.ok && result.payload) {
        if (joinRetryTimerRef.current) {
          window.clearTimeout(joinRetryTimerRef.current);
          joinRetryTimerRef.current = null;
        }

        setDeviceId(result.payload.device.id);
        setJoined(true);
        setManualDisconnect(false);
        setSession(result.payload.session);
        window.localStorage.setItem(currentDeviceKey, result.payload.device.id);
        return;
      }

      if (
        allowRetry &&
        result.response.status === 409 &&
        persistedDeviceId
      ) {
        await postJson(
          `/api/session/${encodeURIComponent(session.code)}/leave`,
          { deviceId: persistedDeviceId },
        );
        window.localStorage.removeItem(currentDeviceKey);
        joinRetryTimerRef.current = window.setTimeout(() => {
          void joinReceiver(false);
        }, 80);
        return;
      }

      setJoined(false);
      setManualDisconnect(false);

      if (
        allowRetry &&
        result.response.status !== 404 &&
        !preview &&
        !closed
      ) {
        if (joinRetryTimerRef.current) {
          window.clearTimeout(joinRetryTimerRef.current);
        }

        joinRetryTimerRef.current = window.setTimeout(() => {
          void joinReceiver(true);
        }, 1400);
      }
    } finally {
      joinInFlightRef.current = false;
    }
  }

  useEffect(() => {
    if (isReceiver && !receiverReady && !manualDisconnect && !preview && !closed && session.status !== 'ended') {
      void joinReceiver(true);
    }
  }, [closed, isReceiver, joinDeviceName, manualDisconnect, preview, receiverReady, session.code, session.status]);

  useEffect(() => {
    if (!isReceiver || !receiverOwnDeviceOnline || joined) {
      return;
    }

    setJoined(true);
    setManualDisconnect(false);
  }, [isReceiver, joined, receiverOwnDeviceOnline]);

  useEffect(() => {
    if (preview || closed || session.status === 'ended') {
      return;
    }

    let cancelled = false;

    async function syncSession() {
      try {
        const response = await fetch(`/api/session/${encodeURIComponent(session.code)}`);

        if (!response.ok) {
          return;
        }

        const payload = await parseResponse(response);

        if (!cancelled && payload) {
          setSession(payload as Session);
        }
      } catch (_error) {
        return;
      }
    }

    const intervalId = window.setInterval(() => {
      void syncSession();
    }, 1800);
    void syncSession();

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [closed, preview, session.code, session.status]);

  useEffect(() => {
    leaveStateRef.current = {
      closed,
      deviceId,
      isReceiver,
      manualDisconnect,
      preview,
      sessionCode: session.code,
      sessionStatus: session.status,
    };
  }, [closed, deviceId, isReceiver, manualDisconnect, preview, session.code, session.status]);

  useEffect(() => {
    function notifyLeave() {
      const currentState = leaveStateRef.current;

      if (
        !currentState.isReceiver ||
        !currentState.deviceId ||
        currentState.manualDisconnect ||
        currentState.preview ||
        currentState.closed
      ) {
        return;
      }

      const payload = new Blob([JSON.stringify({ deviceId: currentState.deviceId })], {
        type: 'application/json',
      });

      navigator.sendBeacon(
        `/api/session/${encodeURIComponent(currentState.sessionCode)}/leave`,
        payload,
      );
    }

    window.addEventListener('pagehide', notifyLeave);
    window.addEventListener('beforeunload', notifyLeave);

    return () => {
      window.removeEventListener('pagehide', notifyLeave);
      window.removeEventListener('beforeunload', notifyLeave);
    };
  }, []);

  async function uploadFile(selected: SelectedFile) {
    if (preview || !deviceId) {
      return;
    }

    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `/api/session/${encodeURIComponent(session.code)}/transfers/upload`);
      xhr.setRequestHeader('Content-Type', 'application/octet-stream');
      xhr.setRequestHeader('X-Linqsy-Device-Id', deviceId);
      xhr.setRequestHeader('X-Linqsy-Filename', encodeTransferHeader(selected.file.name));
      xhr.setRequestHeader('X-Linqsy-Mime-Type', selected.file.type || 'application/octet-stream');
      xhr.setRequestHeader('X-Linqsy-Size', String(selected.file.size));

      if (selected.relativePath) {
        xhr.setRequestHeader('X-Linqsy-Relative-Path', encodeTransferHeader(selected.relativePath));
      }

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
          return;
        }

        reject(new Error(getUploadErrorMessage(xhr)));
      });
      xhr.addEventListener('error', () => reject(new Error('The connection dropped while sending.')));
      xhr.addEventListener('abort', () => reject(new Error('The upload was cancelled.')));
      xhr.send(selected.file);
    });
  }

  async function uploadFiles(files: SelectedFile[]) {
    if (!files.length || !canUseDropSurface) {
      return;
    }

    setUploadError('');

    let nextFileIndex = 0;
    const workerCount = Math.min(UPLOAD_CONCURRENCY, files.length);

    try {
      await Promise.all(
        Array.from({ length: workerCount }, async () => {
          while (nextFileIndex < files.length) {
            const selected = files[nextFileIndex];
            nextFileIndex += 1;

            if (selected) {
              await uploadFile(selected);
            }
          }
        }),
      );
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Upload failed.');
      setQueueOpen(true);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    if (folderInputRef.current) {
      folderInputRef.current.value = '';
    }
  }

  function selectedFromInput(fileList: FileList | null) {
    return Array.from(fileList || []).map((file) => ({
      file,
      relativePath: file.webkitRelativePath || '',
    }));
  }

  async function readDirectoryEntries(reader: DirectoryReader) {
    const entries: FileEntry[] = [];

    return await new Promise<FileEntry[]>((resolve, reject) => {
      function step() {
        reader.readEntries(
          (batch) => {
            if (!batch.length) {
              resolve(entries);
              return;
            }

            entries.push(...batch);
            step();
          },
          reject,
        );
      }

      step();
    });
  }

  async function walkEntry(entry: FileEntry, prefix: string): Promise<SelectedFile[]> {
    if (entry.isFile && entry.file) {
      const file = await new Promise<File>((resolve, reject) => {
        entry.file?.(resolve, reject);
      });

      return [
        {
          file,
          relativePath: prefix ? `${prefix}${file.name}` : '',
        },
      ];
    }

    if (!entry.isDirectory || !entry.createReader) {
      return [];
    }

    const reader = entry.createReader();
    const entries = await readDirectoryEntries(reader);
    let files: SelectedFile[] = [];

    for (const nextEntry of entries) {
      const nestedPrefix = prefix ? `${prefix}${entry.name}/` : `${entry.name}/`;
      files = files.concat(await walkEntry(nextEntry, nestedPrefix));
    }

    return files;
  }

  async function collectDroppedFiles(dataTransfer: DataTransfer) {
    const items = Array.from(dataTransfer.items || []) as EntryItem[];

    if (items.length && items.some((item) => typeof item.webkitGetAsEntry === 'function')) {
      let files: SelectedFile[] = [];

      for (const item of items) {
        const entry = item.webkitGetAsEntry?.();

        if (!entry) {
          continue;
        }

        files = files.concat(await walkEntry(entry, ''));
      }

      if (files.length) {
        return files;
      }
    }

    return selectedFromInput(dataTransfer.files);
  }

  async function restartSharing() {
    if (!isHost || pendingAction || preview) {
      return;
    }

    setPendingAction('restart');

    try {
      const result = await postJson<WebPageBootstrap>('/api/host/restart');

      if (!result.response.ok || !result.payload) {
        return;
      }

      const parsed = webPageBootstrapSchema.parse(result.payload);

      startTransition(() => {
        setBootstrap(parsed);
        setSession(parsed.session);
        setDeviceId(parsed.session.hostDeviceId);
        setJoined(true);
        setManualDisconnect(false);
        setQrExpanded(false);
        setQueueOpen(false);
        setClosed(false);
        autoReceivedRef.current.clear();
        inFlightDownloadsRef.current.clear();
        window.history.replaceState({}, '', '/');
      });
    } finally {
      setPendingAction(null);
    }
  }

  async function shutdownSharing() {
    if (!isHost || pendingAction || preview) {
      return;
    }

    setPendingAction('shutdown');

    try {
      await fetch('/api/host/shutdown', {
        method: 'POST',
        keepalive: true,
      });
    } catch (_error) {
      // The server may close before the browser finishes reading the response.
    } finally {
      setClosed(true);
      setQrExpanded(false);
      setSession((currentSession) => ({
        ...currentSession,
        status: 'ended',
      }));
      setPendingAction(null);
      resetSocket();
    }
  }

  const selfLabel = selfDevice?.name || joinDeviceName || fallbackDeviceName();
  const peerLabel = peerDevice?.name || '';
  const activeTransferSpeed = activeTransfer
    ? formatSpeed(Number(activeTransfer.speedBytesPerSecond || 0))
    : '';
  const transferTitle =
    session.status === 'ended'
      ? isHost && closed
        ? 'Linqsy is off'
        : 'Sharing stopped'
      : activeTransfer
        ? describeTransfer(activeTransfer, activeTransfer.senderDeviceId === deviceId)
        : waiting
          ? 'Waiting'
          : 'Drop files';
  const transferSubtitle =
    uploadError
      ? uploadError
      : session.status === 'ended'
      ? isHost && closed
        ? 'This tab can close now.'
        : 'You can start again any time.'
      : activeTransfer && ['uploading', 'downloading'].includes(activeTransfer.status)
        ? `${formatBytes(Number(activeTransfer.bytesTransferred || 0))} of ${formatBytes(activeTransfer.size)}${activeTransferSpeed ? `  •  ${activeTransferSpeed}` : ''}`
        : waiting
          ? isHost
            ? 'Scan or open the link.'
            : 'You will join automatically.'
          : isHost
            ? peerDevice
              ? `Files save automatically on ${peerDevice.name}.`
              : 'Drop to send.'
            : 'Incoming files save automatically.';
  const progressPercent =
    activeTransfer?.status === 'completed'
      ? 100
      : Math.max(0, Math.min(100, Number(activeTransfer?.progressPercent || 0)));
  const showHostWaitingScene = isHost && waiting && session.status !== 'ended' && !closed;
  const showReceiverWaitingScene = isReceiver && waiting && session.status !== 'ended' && !closed;
  const showQrDock = isHost && connected && session.status !== 'ended' && !closed && !qrExpanded;
  const showDropDisc = connected || session.status === 'ended' || closed;
  const showIdleSignal = !showDropDisc && isReceiver && session.status !== 'ended' && !closed;
  const showPeerChip = Boolean(peerLabel) && connected;
  const showSelfChip =
    Boolean(selfLabel) &&
    (connected || isReceiver || session.status === 'ended' || closed);
  const showSceneForeground = showDropDisc || showIdleSignal || showPeerChip || showSelfChip;
  const showWaitingScene = showHostWaitingScene || showReceiverWaitingScene;
  const stageMinHeightClass = showWaitingScene
    ? 'min-h-[clamp(28rem,62svh,35rem)] sm:min-h-[clamp(30rem,64vh,37rem)]'
    : 'min-h-[clamp(30rem,72svh,40rem)] sm:min-h-[clamp(32rem,74vh,46rem)]';

  return (
    <div className='min-h-screen bg-[rgb(var(--app-bg))] text-[rgb(var(--app-fg))] transition-colors duration-300'>
      <div className='pointer-events-none fixed inset-0 overflow-hidden'>
        <div className='absolute inset-x-0 top-0 h-[20rem] bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.78),rgba(255,255,255,0))] dark:bg-[radial-gradient(circle_at_top,rgba(40,51,66,0.22),rgba(12,16,22,0))]' />
        <div className='absolute bottom-[-12rem] left-1/2 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-[#5b72ee]/8 blur-[150px] dark:bg-[#5b72ee]/8' />
      </div>

      <main className='relative mx-auto flex min-h-screen max-w-[1160px] flex-col px-4 pb-10 pt-4 sm:px-6 lg:px-8'>
        <header className='flex items-center justify-between gap-3 rounded-[24px] border border-black/8 bg-white/72 px-4 py-3 shadow-[0_10px_30px_rgba(18,24,32,0.05)] backdrop-blur-xl dark:border-white/8 dark:bg-white/[0.04]'>
          <BrandLockup />

          <div className='flex items-center gap-2'>
            {isHost ? (
              <>
                <IconButton
                  disabled={pendingAction !== null}
                  label='Start a new session'
                  onClick={restartSharing}
                >
                  <RefreshIcon className='h-4.5 w-4.5' />
                </IconButton>
                <IconButton
                  danger
                  disabled={pendingAction !== null}
                  label='Stop sharing'
                  onClick={shutdownSharing}
                >
                  <PowerIcon className='h-4.5 w-4.5' />
                </IconButton>
              </>
            ) : null}

            <ThemeToggle
              onToggle={() => {
                setTheme((currentTheme) => (currentTheme === 'light' ? 'dark' : 'light'));
              }}
              theme={theme}
            />
          </div>
        </header>

        <LayoutGroup id='linqsy-ui'>
          <div className='relative mt-4 flex flex-1 overflow-hidden rounded-[24px] bg-transparent px-0 py-0 shadow-none sm:rounded-[30px] sm:border sm:border-black/8 sm:bg-white/40 sm:px-4 sm:py-4 sm:shadow-[0_22px_70px_rgba(18,24,32,0.06)] sm:backdrop-blur dark:sm:border-white/8 dark:sm:bg-white/[0.025]'>
            <div className='absolute inset-0 hidden bg-[linear-gradient(180deg,rgba(255,255,255,0.14),rgba(255,255,255,0.02))] sm:block dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.015),rgba(255,255,255,0))]' />
            <div className={['relative z-10 flex w-full flex-col overflow-hidden rounded-[24px] border border-black/[0.06] bg-white/24 dark:border-white/6 dark:bg-[#141a21]/70 sm:rounded-[26px]', stageMinHeightClass].join(' ')}>
              <div className='relative flex flex-1 overflow-hidden'>
                <RippleField
                  variant={showHostWaitingScene || showReceiverWaitingScene ? 'waiting' : 'connected'}
                  waiting={waiting}
                >
                  {showHostWaitingScene ? (
                    <motion.div
                      className='relative flex w-full items-center justify-center px-4 py-6 sm:px-8 sm:py-8'
                      initial={{ opacity: 0, y: 18 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -12 }}
                      transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
                    >
                      <div className='flex w-full max-w-[18.5rem] flex-col items-center gap-4 sm:max-w-[19.5rem] sm:gap-5'>
                        <QrPanel
                          compact={false}
                          copied={copied}
                          joinUrl={bootstrap.joinUrl}
                          onCopy={() => {
                            void copyJoinLink();
                          }}
                          qrSvg={qrSvg}
                        />
                        <DeviceChip tone='neutral'>Waiting for another device</DeviceChip>
                      </div>
                    </motion.div>
                  ) : showReceiverWaitingScene ? (
                    <motion.div
                      className='relative flex w-full items-center justify-center px-4 py-6 sm:py-8'
                      initial={{ opacity: 0, y: 18 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -12 }}
                      transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
                    >
                      <div className='flex max-w-[18rem] flex-col items-center gap-4 text-center'>
                        <div className='grid h-16 w-16 place-items-center rounded-full border border-black/8 bg-white/88 text-[#5b72ee] shadow-[0_18px_44px_rgba(18,24,32,0.08)] dark:border-white/10 dark:bg-white/[0.05]'>
                          <SignalIcon className='h-7 w-7' />
                        </div>
                        <div className='space-y-2'>
                          <h2 className='font-display text-2xl font-semibold tracking-[-0.05em] text-slate-950 dark:text-white'>
                            Connecting
                          </h2>
                          <p className='text-sm leading-6 text-slate-500 dark:text-slate-400'>
                            Joining automatically from this device.
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  ) : showSceneForeground ? (
                    <motion.div
                      className='relative flex min-h-full w-full flex-col items-center justify-center px-4 py-6 sm:px-8 sm:py-10'
                      layout
                      transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
                    >
                      <div className='mb-4 min-h-[38px] sm:mb-6'>
                        {showPeerChip ? <DeviceChip tone='active'>{peerLabel}</DeviceChip> : null}
                      </div>

                      <AnimatePresence mode='wait'>
                        {showDropDisc ? (
                          <motion.div
                            key={`disc-${sceneId}-${connected}-${session.status}`}
                            initial={{ opacity: 0, y: 24, scale: 0.96 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 18, scale: 0.96 }}
                            transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
                          >
                            <DropDisc
                              active={canUseDropSurface}
                              busy={Boolean(activeTransfer && isTransferActive(activeTransfer))}
                              dragging={dragging}
                              onChooseFiles={() => {
                                if (canUseDropSurface) {
                                  fileInputRef.current?.click();
                                }
                              }}
                              onChooseFolders={() => {
                                if (canUseDropSurface) {
                                  folderInputRef.current?.click();
                                }
                              }}
                              onDragEnter={(event) => {
                                event.preventDefault();
                                if (canUseDropSurface) {
                                  setDragging(true);
                                }
                              }}
                              onDragLeave={(event) => {
                                event.preventDefault();
                                const currentTarget = event.currentTarget.getBoundingClientRect();
                                const withinBounds =
                                  event.clientX >= currentTarget.left &&
                                  event.clientX <= currentTarget.right &&
                                  event.clientY >= currentTarget.top &&
                                  event.clientY <= currentTarget.bottom;

                                if (!withinBounds) {
                                  setDragging(false);
                                }
                              }}
                              onDragOver={(event) => {
                                event.preventDefault();
                                if (canUseDropSurface) {
                                  event.dataTransfer.dropEffect = 'copy';
                                  setDragging(true);
                                }
                              }}
                              onDrop={(event) => {
                                event.preventDefault();
                                setDragging(false);

                                if (!canUseDropSurface) {
                                  return;
                                }

                                void collectDroppedFiles(event.dataTransfer).then((files) => {
                                  void uploadFiles(files);
                                });
                              }}
                              onTap={() => {
                                if (canUseDropSurface) {
                                  fileInputRef.current?.click();
                                }
                              }}
                              progress={progressPercent}
                              subtitle={transferSubtitle}
                              title={transferTitle}
                            />
                          </motion.div>
                        ) : showIdleSignal ? (
                          <motion.div
                            key='signal-idle'
                            className='grid place-items-center pt-24'
                            initial={{ opacity: 0, y: 18 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 18 }}
                            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                          >
                            <div className='grid h-24 w-24 place-items-center rounded-full border border-black/8 bg-white/84 text-[#5b72ee] shadow-[0_20px_54px_rgba(18,24,32,0.08)] dark:border-white/10 dark:bg-[#11171d]/86'>
                              <SignalIcon className='h-8 w-8' />
                            </div>
                          </motion.div>
                        ) : null}
                      </AnimatePresence>

                      <div className={showDropDisc ? 'mt-4 min-h-[38px] sm:mt-6 sm:min-h-[42px]' : 'mt-0 min-h-[38px] sm:min-h-[42px]'}>
                        {showSelfChip ? <DeviceChip tone='neutral'>{selfLabel}</DeviceChip> : null}
                      </div>
                    </motion.div>
                  ) : null}
                </RippleField>

                <AnimatePresence>
                  {showQrDock ? (
                    <motion.div
                      key='qr-dock'
                      className='absolute inset-x-4 top-4 z-20 flex justify-end sm:inset-x-auto sm:right-5 sm:top-5'
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                    >
                      <QrPanel
                        compact
                        copied={copied}
                        joinUrl={bootstrap.joinUrl}
                        onCopy={() => {
                          setQrExpanded(true);
                        }}
                        qrSvg={qrSvg}
                      />
                    </motion.div>
                  ) : null}
                </AnimatePresence>

                <TransferSheet
                  active={Boolean(activeTransfer)}
                  deviceId={deviceId}
                  onToggle={() => {
                    setQueueOpen((currentValue) => !currentValue);
                  }}
                  open={queueOpen}
                  transfers={session.transfers}
                />
              </div>
            </div>
          </div>

          <AnimatePresence>
            {qrExpanded ? (
              <motion.div
                key='qr-overlay'
                className='fixed inset-0 z-50 flex items-center justify-center bg-[rgba(11,14,18,0.32)] px-4 backdrop-blur-md'
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => {
                  setQrExpanded(false);
                }}
              >
                <motion.div
                  onClick={(event) => {
                    event.stopPropagation();
                  }}
                >
                  <QrPanel
                    compact={false}
                    copied={copied}
                    joinUrl={bootstrap.joinUrl}
                    onCopy={() => {
                      void copyJoinLink();
                    }}
                    qrSvg={qrSvg}
                  />
                </motion.div>
              </motion.div>
            ) : null}
          </AnimatePresence>

        </LayoutGroup>

        <input
          className='hidden'
          multiple
          onChange={() => {
            void uploadFiles(selectedFromInput(fileInputRef.current?.files ?? null));
          }}
          ref={fileInputRef}
          type='file'
        />
        <input
          className='hidden'
          multiple
          onChange={() => {
            void uploadFiles(selectedFromInput(folderInputRef.current?.files ?? null));
          }}
          ref={folderInputRef}
          type='file'
        />
      </main>
    </div>
  );
}

function SunIcon({ className }: { className?: string }) {
  return (
    <svg viewBox='0 0 20 20' fill='none' className={className}>
      <circle cx='10' cy='10' r='3.2' stroke='currentColor' strokeWidth='1.5' />
      <path
        d='M10 2.2v2M10 15.8v2M2.2 10h2M15.8 10h2M4.8 4.8l1.4 1.4M13.8 13.8l1.4 1.4M15.2 4.8l-1.4 1.4M6.2 13.8l-1.4 1.4'
        stroke='currentColor'
        strokeLinecap='round'
        strokeWidth='1.5'
      />
    </svg>
  );
}

function MoonIcon({ className }: { className?: string }) {
  return (
    <svg viewBox='0 0 20 20' fill='none' className={className}>
      <path
        d='M13.2 2.8a7.1 7.1 0 1 0 4 12.6A8 8 0 1 1 13.2 2.8Z'
        stroke='currentColor'
        strokeLinejoin='round'
        strokeWidth='1.5'
      />
    </svg>
  );
}

function RefreshIcon({ className }: { className?: string }) {
  return (
    <svg viewBox='0 0 20 20' fill='none' className={className}>
      <path
        d='M15.6 8.2A6.1 6.1 0 0 0 4.8 6.7M4.4 11.8A6.1 6.1 0 0 0 15.2 13.3'
        stroke='currentColor'
        strokeLinecap='round'
        strokeWidth='1.6'
      />
      <path d='M15.2 4.7v3.7h-3.7M4.8 15.3v-3.7h3.7' stroke='currentColor' strokeLinecap='round' strokeWidth='1.6' />
    </svg>
  );
}

function PowerIcon({ className }: { className?: string }) {
  return (
    <svg viewBox='0 0 20 20' fill='none' className={className}>
      <path d='M10 2.7v6.1' stroke='currentColor' strokeLinecap='round' strokeWidth='1.7' />
      <path
        d='M14.6 5.1a6.4 6.4 0 1 1-9.2 0'
        stroke='currentColor'
        strokeLinecap='round'
        strokeWidth='1.7'
      />
    </svg>
  );
}

function QrIcon({ className }: { className?: string }) {
  return (
    <svg viewBox='0 0 20 20' fill='currentColor' className={className}>
      <path d='M3 3h5v5H3V3Zm1.5 1.5v2h2v-2h-2Zm5.5-1.5h5v5h-5V3Zm1.5 1.5v2h2v-2h-2ZM3 12h5v5H3v-5Zm1.5 1.5v2h2v-2h-2ZM11 11h1.7v1.7H11V11Zm2.3 0H17v2.3h-1.4V15H14v-4Zm-2.3 2.3h1.7V17H11v-3.7Zm2.3 1.3H17V17h-3.7v-2.4Z' />
    </svg>
  );
}

function LinkIcon({ className }: { className?: string }) {
  return (
    <svg viewBox='0 0 20 20' fill='none' className={className}>
      <path d='M8 12.2 12 8.1' stroke='currentColor' strokeLinecap='round' strokeWidth='1.6' />
      <path d='M7 6.7H6a3.3 3.3 0 1 0 0 6.6h1' stroke='currentColor' strokeLinecap='round' strokeWidth='1.6' />
      <path d='M13 6.7h1a3.3 3.3 0 1 1 0 6.6h-1' stroke='currentColor' strokeLinecap='round' strokeWidth='1.6' />
    </svg>
  );
}

function FileIcon({ className }: { className?: string }) {
  return (
    <svg viewBox='0 0 20 20' fill='none' className={className}>
      <path d='M5.1 2.8h6.3L14.8 6v9.1a1.6 1.6 0 0 1-1.6 1.6H5.1a1.6 1.6 0 0 1-1.6-1.6V4.4a1.6 1.6 0 0 1 1.6-1.6Z' stroke='currentColor' strokeLinejoin='round' strokeWidth='1.5' />
      <path d='M11.3 2.9v3.2h3.2' stroke='currentColor' strokeLinejoin='round' strokeWidth='1.5' />
    </svg>
  );
}

function FolderIcon({ className }: { className?: string }) {
  return (
    <svg viewBox='0 0 20 20' fill='none' className={className}>
      <path d='M2.8 6.2A1.6 1.6 0 0 1 4.4 4.6h3.7l1.6 1.5h6.4a1.6 1.6 0 0 1 1.6 1.6v5.6a1.6 1.6 0 0 1-1.6 1.6H4.4a1.6 1.6 0 0 1-1.6-1.6V6.2Z' stroke='currentColor' strokeLinejoin='round' strokeWidth='1.5' />
    </svg>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg viewBox='0 0 20 20' fill='none' className={className}>
      <path d='m5.6 8 4.4 4.5L14.4 8' stroke='currentColor' strokeLinecap='round' strokeLinejoin='round' strokeWidth='1.6' />
    </svg>
  );
}

function StackIcon({ className }: { className?: string }) {
  return (
    <svg viewBox='0 0 20 20' fill='none' className={className}>
      <path d='M4 5.6 10 3.1l6 2.5L10 8.1 4 5.6ZM4 10.2 10 7.8l6 2.4M4 14.8 10 12.3l6 2.5' stroke='currentColor' strokeLinecap='round' strokeLinejoin='round' strokeWidth='1.5' />
    </svg>
  );
}

function SignalIcon({ className }: { className?: string }) {
  return (
    <svg viewBox='0 0 24 24' fill='none' className={className}>
      <path d='M12 17.4a1.25 1.25 0 1 0 0 2.5a1.25 1.25 0 0 0 0-2.5Z' fill='currentColor' />
      <path d='M12 8a4 4 0 0 0-2.86 6.82l1.42-1.42a2 2 0 1 1 2.88 0l1.4 1.42A4 4 0 0 0 12 8Z' stroke='currentColor' strokeLinecap='round' strokeLinejoin='round' strokeWidth='1.7' />
      <path d='M12 4.55a7.45 7.45 0 0 0-5.27 12.72l1.39-1.4a5.45 5.45 0 1 1 7.75 0l1.4 1.4A7.45 7.45 0 0 0 12 4.55Z' stroke='currentColor' strokeLinecap='round' strokeLinejoin='round' strokeWidth='1.7' />
    </svg>
  );
}
