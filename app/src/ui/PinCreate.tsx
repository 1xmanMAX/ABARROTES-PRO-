import { useState } from 'react';
import { t } from '../i18n/es-PE';
import { PinPad } from './PinPad';

interface Props {
  title: string;
  hint?: string;
  /** Guarda el código (puede rechazarlo por trivial). */
  onCreate: (pin: string) => Promise<void>;
}

/** Crear código: se escribe dos veces. */
export function PinCreate({ title, hint, onCreate }: Props) {
  const [first, setFirst] = useState<string | null>(null);
  const [key, setKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const restart = (message: string) => {
    setFirst(null);
    setError(message);
    setKey((k) => k + 1);
  };
  if (first === null) {
    return (
      <PinPad
        key={`a${key}`}
        title={title}
        hint={hint}
        submitLabel={t.common.accept}
        initialError={error}
        onSubmit={async (pin) => {
          setError(null);
          setFirst(pin);
        }}
      />
    );
  }
  return (
    <PinPad
      key={`b${key}`}
      title={t.pin.confirmTitle}
      hint={hint}
      submitLabel={t.common.save}
      onSubmit={async (pin) => {
        if (pin !== first) return restart(t.pin.mismatch);
        try {
          await onCreate(pin);
        } catch (err) {
          restart(err instanceof Error && 'code' in err ? err.message : t.errors.generic);
        }
      }}
    />
  );
}
