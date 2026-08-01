/** Props for the "continue as" role picker. */
export interface RoleSelectorProps {
  /** Called with the picked role. */
  onSelect: (role: "user" | "admin") => void;
}

const ROLES: ReadonlyArray<{ id: "user" | "admin"; hint: string }> = [
  { id: "user", hint: "Email and password" },
  { id: "admin", hint: "Telegram user ID and password" },
];

/** Two large cards letting the visitor continue as user or admin. */
export function RoleSelector({ onSelect }: RoleSelectorProps) {
  return (
    <div className="mt-8 grid gap-3">
      {ROLES.map((role) => (
        <button
          key={role.id}
          onClick={() => onSelect(role.id)}
          className="group flex items-center justify-between rounded-xl border border-neutral-800 bg-neutral-900/50 px-5 py-5 text-left transition-colors hover:border-neutral-600"
        >
          <span>
            <span className="block text-base font-semibold capitalize">{role.id}</span>
            <span className="block text-xs text-neutral-500">{role.hint}</span>
          </span>
          <span className="text-neutral-600 transition-transform group-hover:translate-x-1">→</span>
        </button>
      ))}
    </div>
  );
}
