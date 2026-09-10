interface Option<T extends string> {
  value: T;
  label: string;
  disabled?: boolean;
}

interface Props<T extends string> {
  value: T;
  options: Array<Option<T>>;
  onChange: (v: T) => void;
}

/**
 * Переключатель вида `Graph│Chat`, `Interact│Trace`: контейнер с рамкой и
 * подложкой, активная кнопка выделена заливкой bg-quaternary. Размеры сняты с эталона.
 */
export function SegmentedControl<T extends string>({ value, options, onChange }: Props<T>) {
  return (
    <div className="relative flex w-fit gap-0.5 rounded-sm border border-border-outline bg-bg-primary p-0.5">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            disabled={o.disabled}
            onClick={() => onChange(o.value)}
            className={`relative flex items-center gap-1 rounded-sm px-2 py-1 text-[13px] font-medium leading-4 tracking-[-0.26px] transition-colors duration-100 ${
              active
                ? "bg-bg-quaternary text-text-primary"
                : o.disabled
                  ? "cursor-default text-text-disabled"
                  : "text-text-secondary hover:bg-bg-secondary"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
