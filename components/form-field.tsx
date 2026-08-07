import { cn } from '@/lib/utils'

interface FieldProps {
  label: string
  value: string
  onChange?: (v: string) => void
  readOnly?: boolean
  placeholder?: string
  className?: string
  type?: string
  small?: boolean
}

export function FormField({
  label,
  value,
  onChange,
  readOnly = false,
  placeholder,
  className,
  type = 'text',
  small = false,
}: FieldProps) {
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider truncate">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        readOnly={readOnly}
        placeholder={placeholder ?? '—'}
        className={cn(
          'rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-800 placeholder:text-slate-300',
          'focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-[#1e3a8a] transition',
          readOnly && 'bg-slate-50 text-slate-500 cursor-default',
          small ? 'text-xs py-1' : 'text-sm'
        )}
      />
    </div>
  )
}

interface SelectFieldProps {
  label: string
  value: string
  onChange?: (v: string) => void
  options: { value: string; label: string }[]
  className?: string
  disabled?: boolean
}

export function SelectField({ label, value, onChange, options, className, disabled = false }: SelectFieldProps) {
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider truncate">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        disabled={disabled}
        className={cn(
          'rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-[#1e3a8a] transition cursor-pointer',
          disabled && 'bg-slate-50 text-slate-500 cursor-default'
        )}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  )
}

interface BadgeFieldProps {
  label: string
  value: string
  color?: 'blue' | 'amber' | 'green' | 'red' | 'slate'
  className?: string
}

export function BadgeField({ label, value, color = 'blue', className }: BadgeFieldProps) {
  const colorMap = {
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    red: 'bg-red-50 text-red-700 border-red-200',
    slate: 'bg-slate-50 text-slate-600 border-slate-200',
  }
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider truncate">
        {label}
      </label>
      <div
        className={cn(
          'rounded-md border px-2.5 py-1.5 text-sm font-semibold text-center',
          colorMap[color]
        )}
      >
        {value || '—'}
      </div>
    </div>
  )
}

interface CardProps {
  title: string
  children: React.ReactNode
  className?: string
  headerClassName?: string
}

export function SectionCard({ title, children, className, headerClassName }: CardProps) {
  return (
    <div className={cn('bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm', className)}>
      <div className={cn('px-4 py-2.5 bg-slate-50 border-b border-slate-200', headerClassName)}>
        <h3 className="text-xs font-bold text-[#1e3a8a] uppercase tracking-widest">{title}</h3>
      </div>
      <div className="p-4">{children}</div>
    </div>
  )
}
