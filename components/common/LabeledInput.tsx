/** Props for the mono-labelled text input used in forms and modals. */
export interface LabeledInputProps {
  /** Uppercase mono label above the field. */
  label: string;
  /** Controlled value. */
  value: string;
  /** Called with the new value on every keystroke. */
  onChange: (value: string) => void;
  /** Native input type; use "password" for censored tokens. */
  type?: string;
  placeholder?: string;
  disabled?: boolean;
}

/** Dark labelled input matching the studio design system. */
export function LabeledInput({ label, value, onChange, type = "text", placeholder, disabled = false }: LabeledInputProps) {
  return (
    <label className="block">
      <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.2em] text-neutral-500">
        {label}
      </span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2.5 text-sm text-white placeholder:text-neutral-600 outline-none focus:border-neutral-600 disabled:opacity-50 disabled:cursor-not-allowed"
      />
    </label>
  );
}
