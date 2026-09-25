import { useState, type ReactNode } from 'react';
import { verifyOwnerPin } from '../../db/pins';
import { t } from '../../i18n/es-PE';
import { PinPad } from '../../ui/PinPad';
import { Sheet } from '../../ui/Sheet';

/**
 * Pide el código de dueño en una hoja y ejecuta `action` con el código ya
 * verificado. Devuelve [abrir, hoja].
 */
export function useOwnerPin(): [(title: string, action: (pin: string) => Promise<void>) => void, ReactNode] {
  const [req, setReq] = useState<{ title: string; action: (pin: string) => Promise<void> } | null>(null);
  const sheet = req ? (
    <Sheet title={t.pin.ownerTitle} onClose={() => setReq(null)}>
      <PinPad
        title={req.title}
        hint={t.pin.ownerHint}
        submitLabel={t.common.accept}
        onSubmit={async (pin) => {
          await verifyOwnerPin(pin);
          await req.action(pin);
          setReq(null);
        }}
      />
    </Sheet>
  ) : null;
  return [(title, action) => setReq({ title, action }), sheet];
}
