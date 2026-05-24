import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
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
    'flex min-h-[3.25rem] flex-row items-center gap-3 rounded-lg border-2 px-4 py-3 text-left transition-colors',
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
      <span className="w-7 shrink-0 text-base font-semibold">{opt.key}</span>
      <span className="min-w-0 flex-1 text-base leading-snug">{opt.text}</span>
    </>
  );
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
  examQuestionId,
  options,
  multiple,
  selectedKeys,
  readOnly,
  onSelect,
  onToggle,
}: ObjectiveOptionTilesProps) {
  if (multiple) {
    const selected = parseMultiKeys(selectedKeys);

    return (
      <div
        className="grid grid-cols-2 gap-3"
        role="group"
        aria-label="选项"
      >
        {options.map((opt) => {
          const checked = selected.includes(opt.key);
          const id = `${examQuestionId}-${opt.key}`;

          return (
            <label
              key={opt.key}
              htmlFor={id}
              className={optionTileClass(checked, readOnly)}
            >
              <Checkbox
                id={id}
                checked={checked}
                disabled={readOnly}
                className="sr-only"
                onCheckedChange={(value) =>
                  onToggle(opt.key, value === true)
                }
              />
              <OptionTileContent opt={opt} />
            </label>
          );
        })}
      </div>
    );
  }

  return (
    <RadioGroup
      value={selectedKeys}
      onValueChange={onSelect}
      disabled={readOnly}
      className="grid grid-cols-2 gap-3"
    >
      {options.map((opt) => {
        const selected = selectedKeys === opt.key;
        const id = `${examQuestionId}-${opt.key}`;

        return (
          <label
            key={opt.key}
            htmlFor={id}
            className={optionTileClass(selected, readOnly)}
          >
            <RadioGroupItem id={id} value={opt.key} className="sr-only" />
            <OptionTileContent opt={opt} />
          </label>
        );
      })}
    </RadioGroup>
  );
}
