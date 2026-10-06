import Link from 'next/link'
import { Children, cloneElement, isValidElement, useId, type ComponentProps, type ReactNode } from 'react'
import { dealStage, type StageTone } from '@/lib/deal-stage'
import type { DealStatus } from '@/lib/supabase/types'
import { AlertIcon, InfoIcon } from './icons'

// Shared building blocks. Rules they encode:
// - Bronco Red (`primary`, `outline`) means "act here". One primary per view.
// - Every interactive target is at least 44px tall.
// - Errors are Terracotta + an icon, never red, so they can't read as a button.

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost'
type ButtonSize = 'sm' | 'md' | 'lg'

const BUTTON_BASE =
  'inline-flex items-center justify-center gap-2 whitespace-nowrap border font-semibold transition-colors disabled:cursor-not-allowed'

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: 'h-9 rounded-lg px-3 text-sm',
  md: 'h-11 rounded-[10px] px-[18px] text-[15px]',
  lg: 'h-14 rounded-xl px-7 text-[17px]',
}

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'border-transparent bg-accent text-accent-ink hover:bg-accent-hover disabled:bg-surface-2 disabled:text-subtle',
  secondary: 'border-line bg-surface text-ink hover:bg-surface-2 disabled:opacity-60',
  outline:
    'border-accent-text bg-transparent text-accent-text hover:bg-accent-soft disabled:opacity-50',
  ghost:
    'border-transparent bg-transparent text-muted hover:bg-surface-2 hover:text-ink disabled:opacity-50',
}

export function buttonClass({
  variant = 'primary',
  size = 'md',
  className = '',
}: { variant?: ButtonVariant; size?: ButtonSize; className?: string } = {}) {
  return `${BUTTON_BASE} ${BUTTON_SIZES[size]} ${BUTTON_VARIANTS[variant]} ${className}`
}

type ButtonStyle = { variant?: ButtonVariant; size?: ButtonSize }

export function Button({
  variant,
  size,
  className,
  type = 'button',
  ...props
}: ComponentProps<'button'> & ButtonStyle) {
  return <button type={type} className={buttonClass({ variant, size, className })} {...props} />
}

export function ButtonLink({
  variant,
  size,
  className,
  ...props
}: ComponentProps<typeof Link> & ButtonStyle) {
  return <Link className={buttonClass({ variant, size, className })} {...props} />
}

export const cardClass = 'rounded-[14px] border border-line-soft bg-surface'

export const inputClass =
  'w-full min-h-11 rounded-[10px] border border-line bg-surface px-3 text-[15px] font-normal text-ink placeholder:text-subtle disabled:opacity-60'

export const textareaClass = `${inputClass} py-3 leading-relaxed`

// Label, hint, control, error. The hint and error sit outside the <label> and
// are linked with aria-describedby, so the control's accessible name stays
// just its label (screen readers hear "Sport", then the hint or error).
export function Field({
  label,
  hint,
  error,
  children,
  className = '',
}: {
  label: ReactNode
  hint?: ReactNode
  error?: ReactNode
  children: ReactNode
  className?: string
}) {
  const id = useId()
  const only = Children.count(children) === 1 ? Children.toArray(children)[0] : null
  const control = isValidElement<{ id?: string }>(only) ? only : null
  const controlId = control?.props.id ?? `${id}-control`
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined

  return (
    <div className={`flex flex-col gap-1.5 text-sm font-semibold text-ink ${className}`}>
      <label htmlFor={control ? controlId : undefined}>{label}</label>
      {hint && (
        <span id={hintId} className="text-[13px] leading-snug font-normal text-muted">
          {hint}
        </span>
      )}
      {control
        ? cloneElement(control as React.ReactElement<Record<string, unknown>>, {
            id: controlId,
            'aria-describedby': describedBy,
            'aria-invalid': error ? true : undefined,
          })
        : children}
      {error && <FieldError id={errorId}>{error}</FieldError>}
    </div>
  )
}

export function FieldError({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <p id={id} role="alert" className="flex items-start gap-1.5 text-[13px] font-medium text-warn">
      <AlertIcon size={16} className="mt-px shrink-0" />
      <span>{children}</span>
    </p>
  )
}

// Info: neutral slate with an icon (guidance, reminders). Error: Terracotta.
export function Notice({
  tone = 'info',
  title,
  children,
  className = '',
}: {
  tone?: 'info' | 'error'
  title?: ReactNode
  children?: ReactNode
  className?: string
}) {
  const error = tone === 'error'
  const Icon = error ? AlertIcon : InfoIcon
  return (
    <div
      role={error ? 'alert' : 'note'}
      className={`flex gap-3 rounded-xl p-4 text-sm leading-relaxed text-ink ${
        error ? 'bg-warn-soft' : 'bg-wait-soft'
      } ${className}`}
    >
      <Icon className={`mt-0.5 shrink-0 ${error ? 'text-warn' : 'text-wait'}`} />
      <div className="flex min-w-0 flex-col gap-2">
        {title && <p className="font-semibold">{title}</p>}
        {children}
      </div>
    </div>
  )
}

const CHIP_TONES: Record<StageTone, string> = {
  move: 'bg-accent-soft text-accent-text',
  draft: 'text-muted ring-1 ring-inset ring-line',
  wait: 'bg-wait-soft text-wait',
  nego: 'bg-nego-soft text-nego',
  agreed: 'bg-agreed-soft text-agreed',
  closed: 'bg-surface-2 text-muted',
  warn: 'bg-warn-soft text-warn',
}

export function Chip({ tone, children }: { tone: StageTone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex h-[26px] shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[13px] font-semibold whitespace-nowrap ${CHIP_TONES[tone]}`}
    >
      {tone === 'warn' ? (
        <AlertIcon size={14} strokeWidth={2.2} />
      ) : (
        <span aria-hidden="true" className="size-[7px] rounded-full bg-current" />
      )}
      {children}
    </span>
  )
}

export function StageChip({ status }: { status: DealStatus }) {
  const stage = dealStage(status)
  return <Chip tone={stage.tone}>{stage.label}</Chip>
}

export function Monogram({ name, size = 'md' }: { name: string; size?: 'md' | 'lg' }) {
  const letters = name
    .split(/\s+/)
    .filter((w) => /^[a-z0-9]/i.test(w))
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('')
  return (
    <span
      aria-hidden="true"
      className={`grid shrink-0 place-items-center bg-surface-2 font-display font-bold text-ink ${
        size === 'lg' ? 'size-12 rounded-xl text-xl' : 'size-10 rounded-[10px] text-[17px]'
      }`}
    >
      {letters || '?'}
    </span>
  )
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-5">
      <div className="flex max-w-2xl flex-col gap-2.5">
        <h1 className="display text-[44px] sm:text-[52px]">{title}</h1>
        {description && <p className="text-[17px] leading-relaxed text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2.5">{actions}</div>}
    </header>
  )
}

export function Logo({ href = '/', compact = false }: { href?: string; compact?: boolean }) {
  return (
    <Link href={href} className="-my-[7px] flex items-center gap-2.5 py-[7px] text-ink no-underline">
      <span
        aria-hidden="true"
        className="grid size-[30px] place-items-center rounded-lg bg-accent font-display text-base font-bold text-white"
      >
        NC
      </span>
      <span className={`display text-[22px] whitespace-nowrap ${compact ? 'sr-only sm:not-sr-only' : ''}`}>NIL Copilot</span>
    </Link>
  )
}
