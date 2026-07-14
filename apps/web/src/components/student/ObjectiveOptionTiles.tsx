import { cn } from '@/lib/utils';

type ObjectiveOption = {
  key: string;
  text: string;
};

function parseMultiKeys(raw: string): string[] {
  return raw
    .split(/[,\uFF0C\u3001\s]+/)
    .map((k) => k.trim().toUpperCase())
    .filter((k) => /^[A-Z]$/.test(k));
}

function optionTileClass(selected: boolean, readOnly: boolean): string {
  return cn(
    'flex min-h-[4.875rem] flex-row items-center gap-4 rounded-lg border-2 px-5 py-4 text-left transition-colors',
    selected
      ? 'border-primary bg-primary/10 text-foreground shadow-sm'
      : 'border-border bg-card text-foreground',
    readOnly
      ? 'cursor-default opacity-90'
      : 'cursor-pointer hover:border-primary/60 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:bg-primary/15',
  );
}

function OptionTileContent({ opt }: { opt: ObjectiveOption }) {
  return (
    <>
      <span className="w-10 shrink-0 text-2xl font-semibold">{opt.key}</span>
      <span className="min-w-0 flex-1 text-2xl leading-snug">{opt.text}</span>
    </>
  );
}

function activateWithKeyboard(
  event: React.KeyboardEvent,
  readOnly: boolean,
  action: () => void,
): void {
  if (readOnly) return;
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    action();
  }
}

function moveSingleSelection(
  event: React.KeyboardEvent,
  options: ObjectiveOption[],
  currentKey: string,
  readOnly: boolean,
  onSelect: (key: string) => void,
): void {
  if (readOnly) return;
  const deltas: Record<string, number> = {
    ArrowLeft: -1,
    ArrowUp: -1,
    ArrowRight: 1,
    ArrowDown: 1,
  };
  const delta = deltas[event.key];
  if (delta === undefined) return;
  event.preventDefault();
  const index = options.findIndex((opt) => opt.key === currentKey);
  if (index < 0) return;
  const next = options[(index + delta + options.length) % options.length];
  if (next) onSelect(next.key);
}

type ObjectiveOptionTilesProps = {
  examQuestionId: string;
  options: ObjectiveOption[];
  multiple: boolean;
  selectedKeys: string;
  readOnly: boolean;
  onSelect: (key: string) => void;
  onToggle: (key: string, checked: boolean) => void;
};

export function ObjectiveOptionTiles({
  examQuestionId: _examQuestionId,
  options,
  multiple,
  selectedKeys,
  readOnly,
  onSelect,
  onToggle,
}: ObjectiveOptionTilesProps) {
  const safeOptions = options ?? [];

  if (multiple) {
    const selected = parseMultiKeys(selectedKeys);

    return (
      <div className="grid grid-cols-2 gap-4" role="group" aria-label="选项">
        {safeOptions.map((opt) => {
          const checked = selected.includes(opt.key.toUpperCase());

          return (
            <div
              key={opt.key}
              role="checkbox"
              aria-checked={checked}
              tabIndex={readOnly ? -1 : 0}
              className={optionTileClass(checked, readOnly)}
              onClick={() => {
                if (readOnly) return;
                onToggle(opt.key, !checked);
              }}
              onKeyDown={(event) =>
                activateWithKeyboard(event, readOnly, () =>
                  onToggle(opt.key, !checked),
                )
              }
            >
              <OptionTileContent opt={opt} />
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div
      className="grid grid-cols-2 gap-4"
      role="radiogroup"
      aria-label="选项"
    >
      {safeOptions.map((opt, index) => {
        const selected = selectedKeys === opt.key;
        const focusIndex = selectedKeys
          ? safeOptions.findIndex((row) => row.key === selectedKeys)
          : 0;

        return (
          <div
            key={opt.key}
            role="radio"
            aria-checked={selected}
            tabIndex={readOnly ? -1 : index === focusIndex ? 0 : -1}
            className={optionTileClass(selected, readOnly)}
            onClick={() => {
              if (readOnly) return;
              onSelect(opt.key);
            }}
            onKeyDown={(event) => {
              moveSingleSelection(event, safeOptions, opt.key, readOnly, onSelect);
              activateWithKeyboard(event, readOnly, () => onSelect(opt.key));
            }}
          >
            <OptionTileContent opt={opt} />
          </div>
        );
      })}
    </div>
  );
}
