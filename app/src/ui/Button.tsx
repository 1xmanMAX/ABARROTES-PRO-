import type { ButtonHTMLAttributes } from 'react';
import styles from './Button.module.css';

type Variant = 'primary' | 'outline' | 'danger' | 'plain';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  block?: boolean;
}

export function Button({ variant = 'outline', block, className, type = 'button', ...rest }: Props) {
  const cls = [styles.btn, variant !== 'outline' && styles[variant], block && styles.block, className].filter(Boolean).join(' ');
  return <button type={type} className={cls} {...rest} />;
}
