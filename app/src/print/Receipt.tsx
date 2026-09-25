import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useSettings } from '../app/data';
import { formatPEN } from '../domain/money';
import { formatQty } from '../domain/qty';
import { stampFor } from '../domain/voucher';
import type { Signature } from '../db/types';
import { formatDateTime } from '../domain/time';
import { t } from '../i18n/es-PE';
import { usePrint } from './printStore';
import styles from './Receipt.module.css';

/** Recibo de 58/80 mm renderizado solo para impresión (@media print). */
export function ReceiptPrinter() {
  const job = usePrint((s) => s.job);
  const settings = useSettings();

  useEffect(() => {
    if (!job) return;
    // Dejar que React pinte el recibo antes de abrir el diálogo.
    const id = requestAnimationFrame(() => setTimeout(() => window.print(), 30));
    return () => cancelAnimationFrame(id);
  }, [job]);

  const root = document.getElementById('print-root');
  if (!job || !root) return null;
  const width = settings.paperWidth;
  if (job.kind === 'voucher') {
    return createPortal(
      <>
        <style>{`@page { size: ${width}mm auto; margin: 0; }`}</style>
        <VoucherPrint signature={job.signature} width={width} shopName={settings.shopName} />
      </>,
      root,
    );
  }
  const { ticket, lines } = job;

  return createPortal(
    <>
      <style>{`@page { size: ${width}mm auto; margin: 0; }`}</style>
      <div className={styles.receipt} style={{ width: `${width}mm` }} data-testid="receipt">
        <div className={styles.center}>
          <div className={styles.shop}>{settings.shopName}</div>
          <div>{formatDateTime(ticket.closedAt ?? ticket.createdAt)}</div>
          <div>
            {t.receipt.ticket} #{String(ticket.number).padStart(4, '0')}
          </div>
          {ticket.status === 'void' && <div className={styles.void}>*** {t.receipt.voided} ***</div>}
        </div>
        <div className={styles.rule} />
        {lines.map((l) => (
          <div key={l.id} className={styles.line}>
            <div>{l.productName}</div>
            <div className={styles.split}>
              <span>
                {formatQty({ allowsFraction: l.fractional }, l.qty)} × {formatPEN(l.unitPrice)}
              </span>
              <span>{formatPEN(l.lineTotal + (l.lineDiscount ?? 0))}</span>
            </div>
          </div>
        ))}
        <div className={styles.rule} />
        {(ticket.haggle ?? 0) > 0 && (
          <div className={styles.split}>
            <span>{t.receipt.haggle}</span>
            <span>−{formatPEN(ticket.haggle!)}</span>
          </div>
        )}
        <div className={`${styles.split} ${styles.total}`}>
          <span>{t.receipt.total}</span>
          <span>{formatPEN(ticket.total)}</span>
        </div>
        <div className={styles.split}>
          <span>{t.receipt.method}</span>
          <span>
            {t.receipt.methods[ticket.paymentMethod ?? 'cash']}
            {ticket.digitalRef ? ` · ${t.receipt.op} ${ticket.digitalRef}` : ''}
          </span>
        </div>
        {ticket.cashReceived != null && (
          <>
            <div className={styles.split}>
              <span>{t.receipt.received}</span>
              <span>{formatPEN(ticket.cashReceived)}</span>
            </div>
            <div className={styles.split}>
              <span>{t.receipt.change}</span>
              <span>{formatPEN(ticket.change ?? 0)}</span>
            </div>
          </>
        )}
        {ticket.status === 'credit' && ticket.partyName && (
          <div className={`${styles.center} ${styles.void}`}>{t.receipt.creditSigned(ticket.partyName)}</div>
        )}
        <div className={styles.rule} />
        <div className={styles.center}>{settings.receiptFooter}</div>
      </div>
    </>,
    root,
  );
}

function VoucherPrint({ signature: sig, width, shopName }: { signature: Signature; width: number; shopName: string }) {
  const stamp = stampFor(sig.purpose, sig.amount);
  return (
    <div className={styles.receipt} style={{ width: `${width}mm` }} data-testid="voucher-print">
      <div className={styles.center}>
        <div className={styles.shop}>{shopName}</div>
        <div>{formatDateTime(sig.createdAt)}</div>
        <div className={styles.total}>*** {t.voucher.stamps[stamp]} ***</div>
      </div>
      <div className={styles.rule} />
      <div className={styles.split}>
        <span>{t.voucher.party}</span>
        <span>{sig.partyName}</span>
      </div>
      <div className={styles.split}>
        <span>{t.voucher.concept}</span>
        <span>{sig.concept}</span>
      </div>
      {sig.lines.map((l, i) => (
        <div key={i} className={styles.split}>
          <span>
            {l.name} ×{l.qty}
          </span>
          <span>{formatPEN(l.amount)}</span>
        </div>
      ))}
      {sig.purpose !== 'consignment_receipt' && (
        <div className={styles.split}>
          <span>{t.voucher.before}</span>
          <span>{formatPEN(sig.previousBalance)}</span>
        </div>
      )}
      <div className={`${styles.split} ${styles.total}`}>
        <span>{t.voucher.amount}</span>
        <span>{formatPEN(sig.amount)}</span>
      </div>
      {sig.purpose !== 'consignment_receipt' && (
        <div className={styles.split}>
          <span>{t.voucher.after}</span>
          <span>{formatPEN(sig.newBalance)}</span>
        </div>
      )}
      <div className={styles.rule} />
      <div className={styles.split}>
        <span>{t.voucher.signedBy}</span>
        <span>{sig.partyName}</span>
      </div>
      <div className={styles.split}>
        <span>{t.voucher.op}</span>
        <span>{sig.operationCode}</span>
      </div>
    </div>
  );
}
