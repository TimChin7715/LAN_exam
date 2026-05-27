import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { RosterEntryInput, RosterListItem } from '@/lib/roster';

export type RosterEntryFormMode = 'create' | 'edit';

type RosterEntryFormDialogProps = {
  open: boolean;
  mode: RosterEntryFormMode;
  initial?: RosterListItem | null;
  saving?: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: RosterEntryInput) => void | Promise<void>;
};

const emptyForm: RosterEntryInput = {
  fullName: '',
  organization: '',
  nationalId: '',
};

export function RosterEntryFormDialog({
  open,
  mode,
  initial,
  saving,
  onOpenChange,
  onSubmit,
}: RosterEntryFormDialogProps) {
  const [form, setForm] = useState<RosterEntryInput>(emptyForm);

  useEffect(() => {
    if (!open) return;
    if (mode === 'edit' && initial) {
      setForm({
        fullName: initial.fullName,
        organization: initial.organization,
        nationalId: initial.nationalId,
      });
    } else {
      setForm(emptyForm);
    }
  }, [open, mode, initial]);

  function updateField<K extends keyof RosterEntryInput>(
    key: K,
    value: RosterEntryInput[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await onSubmit({
      fullName: form.fullName.trim(),
      organization: form.organization.trim(),
      nationalId: form.nationalId.trim(),
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={(e) => void handleSubmit(e)}>
          <DialogHeader>
            <DialogTitle>
              {mode === 'create' ? '添加考生' : '编辑考生'}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="roster-fullName">姓名</Label>
              <Input
                id="roster-fullName"
                value={form.fullName}
                onChange={(e) => updateField('fullName', e.target.value)}
                className="min-h-11"
                autoComplete="name"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="roster-organization">单位</Label>
              <Input
                id="roster-organization"
                value={form.organization}
                onChange={(e) => updateField('organization', e.target.value)}
                className="min-h-11"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="roster-nationalId">身份证号</Label>
              <Input
                id="roster-nationalId"
                value={form.nationalId}
                onChange={(e) => updateField('nationalId', e.target.value)}
                className="min-h-11 font-mono"
                maxLength={18}
                autoComplete="off"
                required
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              disabled={saving}
              onClick={() => onOpenChange(false)}
            >
              取消
            </Button>
            <Button type="submit" className="min-h-11" disabled={saving}>
              {saving ? '保存中…' : '保存'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
