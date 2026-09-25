import { useLiveQuery } from 'dexie-react-hooks';
import { useSettings } from '../../app/data';
import { useNav } from '../../app/nav';
import { whatsappNumber } from '../../domain/balances';
import { formatPEN } from '../../domain/money';
import { formatDateTime } from '../../domain/time';
import { stampFor } from '../../domain/voucher';
import { db } from '../../db/schema';
import { verifySignature } from '../../db/signatures';
import { t } from '../../i18n/es-PE';
import { usePrint } from '../../print/printStore';
import { Button } from '../../ui/Button';
import s from '../../ui/Screen.module.css';
import styles from './Voucher.module.css';

/** Comprobante sellado (SPEC §9.4). */
export default function VoucherScreen({ signatureId }: { signatureId: string }) {
  const home = useNav((st) => st.home);
  const settings = useSettings();
  const data = useLiveQuery(async () => {
    const sig = await db.signatures.get(signatureId);
    if (!sig) return null;
    const [party, intact] = await Promise.all([db.parties.get(sig.partyId), verifySignature(sig)]);
    return { sig, party, intact };
  }, [signatureId]);
  if (!data) return null;
  const { sig, party, intact } = data;
  const paid =
    sig.purpose === 'settlement'
      ? sig.previousBalance + sig.lines.reduce((a, l) => a + l.amount, 0) - sig.newBalance
      : sig.amount;
  const stamp = stampFor(sig.purpose, paid);
  const stampClass = stamp === 'PAGADO' ? styles.stampPaid : stamp === 'FIADO' ? styles.stampCredit : styles.stampReceived;
  const phone = whatsappNumber(party?.phone);
  const waText = t.voucher.waText(
    settings.shopName,
    sig.concept,
    formatPEN(sig.amount),
    formatPEN(sig.newBalance),
    sig.operationCode,
    formatDateTime(sig.createdAt),
  );
  const waUrl = `https://wa.me/${phone ?? ''}?text=${encodeURIComponent(waText)}`;
  const firstName = sig.partyName.split(' ')[0] ?? sig.partyName;

  return (
    <div className={s.screen}>
      <header className={styles.header}>
        <h1 className={styles.headerTitle}>{t.voucher.title}</h1>
        <button type="button" className={styles.done} onClick={home}>
          {t.voucher.done}
        </button>
      </header>
      <div className={s.content}>
        <div className={styles.paper} data-testid="voucher">
          <div className={styles.shop}>{settings.shopName}</div>
          <div className={styles.date}>{formatDateTime(sig.createdAt)}</div>
          <div className={styles.rows}>
            <Row label={t.voucher.party} value={sig.partyName} strong />
            <Row label={t.voucher.concept} value={sig.concept} />
            {sig.lines.map((l, i) => (
              <Row key={i} label={`${l.name} ×${l.qty}`} value={formatPEN(l.amount)} />
            ))}
            <Row label={t.voucher.before} value={formatPEN(sig.previousBalance)} />
            <Row label={t.voucher.amount} value={formatPEN(sig.amount)} big />
            <Row label={t.voucher.after} value={formatPEN(sig.newBalance)} strong />
          </div>
          <div className={`${styles.stamp} ${stampClass}`} aria-label={t.voucher.stamps[stamp]}>
            <span className={styles.stampWord}>{t.voucher.stamps[stamp]}</span>
            <span className={styles.stampSub}>{t.voucher.verified}</span>
          </div>
          <div className={styles.foot}>
            <Row label={t.voucher.signedBy} value={sig.partyName} strong />
            <Row label={t.voucher.op} value={sig.operationCode} strong />
            <Row label="" value={intact ? `✓ ${t.voucher.intact}` : `⚠ ${t.voucher.modified}`} strong />
          </div>
        </div>
        <div className={s.card} style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
          {t.voucher.note(firstName)}
        </div>
        <div className={styles.actions}>
          <Button variant="primary" onClick={() => usePrint.getState().printVoucher(sig)}>
            {t.voucher.print}
          </Button>
          <a className={styles.wa} href={waUrl} target="_blank" rel="noreferrer">
            {t.voucher.whatsapp}
          </a>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, strong, big }: { label: string; value: string; strong?: boolean; big?: boolean }) {
  return (
    <div className={`${styles.row} ${big ? styles.big : ''}`}>
      <span>{label}</span>
      <span style={{ fontWeight: strong || big ? 700 : 500 }}>{value}</span>
    </div>
  );
}
