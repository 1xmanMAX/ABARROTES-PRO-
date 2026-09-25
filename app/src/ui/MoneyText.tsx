import { formatPEN, type Cents } from '../domain/money';

interface Props {
  cents: Cents;
  sign?: boolean;
  className?: string;
}

/** Monto en tipografía mono; con `sign` muestra +/−. */
export function MoneyText({ cents, sign, className }: Props) {
  return <span className={['mono', className].filter(Boolean).join(' ')}>{formatPEN(cents, { sign })}</span>;
}
