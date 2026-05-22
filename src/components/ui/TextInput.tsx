'use client' // onFocus/onBlur handlers require browser events

import { type ChangeEvent } from 'react'
import { BRAND, INPUT_BG, INPUT_BORDER, TEXT_PRIMARY } from '@/constants/theme'

interface TextInputProps {
  value: string
  onChange: (e: ChangeEvent<HTMLInputElement>) => void
  placeholder?: string
  type?: string
  className?: string
  required?: boolean
  disabled?: boolean
  id?: string
  name?: string
}

export default function TextInput({
  value,
  onChange,
  placeholder,
  type = 'text',
  className = '',
  required,
  disabled,
  id,
  name,
}: TextInputProps) {
  return (
    <input
      id={id}
      name={name}
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      required={required}
      disabled={disabled}
      className={`w-full rounded-lg px-4 py-2.5 text-sm outline-none transition-all ${className}`}
      style={{ backgroundColor: INPUT_BG, border: `1px solid ${INPUT_BORDER}`, color: TEXT_PRIMARY }}
      // Inline style mutation instead of a Tailwind class because BRAND and INPUT_BORDER aren't in the palette —
      // Tailwind can't dynamically switch between two arbitrary hex values without JS
      onFocus={e => (e.currentTarget.style.borderColor = BRAND)}
      onBlur={e => (e.currentTarget.style.borderColor = INPUT_BORDER)}
    />
  )
}
