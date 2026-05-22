interface FormAlertProps {
  variant: 'error' | 'success' | 'info'
  message: string
  className?: string
  // centered: OTP verify page centers its status messages; sign-in/sign-up left-align theirs
  centered?: boolean
}

// Three auth pages had identical error/success divs with hardcoded hex values — centralizing here prevents color drift
const VARIANT_STYLES: Record<FormAlertProps['variant'], { bg: string; border: string; color: string }> = {
  error: {
    bg:     'rgba(255,55,95,0.08)',
    border: 'rgba(255,55,95,0.25)',
    color:  '#ff6b8a',
  },
  success: {
    bg:     'rgba(0,184,163,0.08)',
    border: 'rgba(0,184,163,0.25)',
    color:  '#00B8A3',
  },
  info: {
    bg:     'rgba(255,161,22,0.08)',
    border: 'rgba(255,161,22,0.25)',
    color:  '#FFA116',
  },
}

export default function FormAlert({ variant, message, className = '', centered = false }: FormAlertProps) {
  const styles = VARIANT_STYLES[variant]
  return (
    <div
      className={`text-sm rounded-xl px-4 py-3 ${centered ? 'text-center' : ''} ${className}`}
      style={{
        backgroundColor: styles.bg,
        border: `1px solid ${styles.border}`,
        color: styles.color,
      }}
    >
      {message}
    </div>
  )
}
