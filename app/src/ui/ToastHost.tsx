import { useEffect } from 'react';
import { useToast } from './toast';
import styles from './Toast.module.css';

export function ToastHost() {
  const { toast, dismiss } = useToast();
  useEffect(() => {
    if (!toast) return;
    const id = toast.id;
    const timer = setTimeout(() => dismiss(id), toast.durationMs);
    return () => clearTimeout(timer);
  }, [toast, dismiss]);

  if (!toast) return null;
  return (
    <div className={`${styles.toast} ${styles[toast.tone]}`} role="status" aria-live="polite">
      <span className={styles.msg}>{toast.message}</span>
      {toast.actionLabel && toast.onAction && (
        <button
          type="button"
          className={styles.action}
          onClick={() => {
            dismiss(toast.id);
            toast.onAction!();
          }}
        >
          {toast.actionLabel}
        </button>
      )}
    </div>
  );
}
