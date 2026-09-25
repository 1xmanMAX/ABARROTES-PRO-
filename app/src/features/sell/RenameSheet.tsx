import { useState } from 'react';
import { t } from '../../i18n/es-PE';
import { Button } from '../../ui/Button';
import { Sheet } from '../../ui/Sheet';
import s from '../../ui/Screen.module.css';

interface Props {
  label: string;
  canClose: boolean;
  onSave: (label: string) => void;
  onCloseTab: () => void;
  onClose: () => void;
}

export function RenameSheet({ label, canClose, onSave, onCloseTab, onClose }: Props) {
  const [value, setValue] = useState(label);
  return (
    <Sheet
      title={t.sell.rename}
      onClose={onClose}
      footer={
        <>
          <Button variant="primary" block disabled={!value.trim()} onClick={() => onSave(value)}>
            {t.common.save}
          </Button>
          {canClose && (
            <Button variant="danger" block onClick={onCloseTab}>
              {t.sell.closeTab}
            </Button>
          )}
        </>
      }
    >
      <input
        className={s.input}
        autoFocus
        maxLength={40}
        value={value}
        placeholder={t.sell.renameHint}
        aria-label={t.sell.rename}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && value.trim() && onSave(value)}
      />
    </Sheet>
  );
}
