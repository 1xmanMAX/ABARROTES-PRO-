import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useState } from 'react';
import { useNav } from '../../app/nav';
import { centsToInput, formatPEN, parseSolesToCents } from '../../domain/money';
import { formatQty, parseQty } from '../../domain/qty';
import { tileColorFor, tileGradient } from '../../domain/tileColor';
import { createProduct, updateProduct, type ProductInput } from '../../db/products';
import { db } from '../../db/schema';
import type { Product, ProductUnit } from '../../db/types';
import { t } from '../../i18n/es-PE';
import { Button } from '../../ui/Button';
import { ScreenHeader } from '../../ui/ScreenHeader';
import s from '../../ui/Screen.module.css';
import { toast, toastError } from '../../ui/toast';
import { AdjustStockSheet } from './AdjustStockSheet';
import { compressPhoto } from './photo';
import styles from './Inventory.module.css';

const UNITS: ProductUnit[] = ['saco', 'caja', 'bolsa', 'unidad', 'kg', 'litro', 'paquete'];

interface Form {
  name: string;
  baseName: string;
  unit: ProductUnit;
  category: string;
  salePrice: string;
  costPrice: string;
  sellerPrice: string;
  initialStock: string;
  minStock: string;
  allowsFraction: boolean;
  allowsHaggle: boolean;
  pinnedPosition: string;
  active: boolean;
  photo: Blob | null;
}

function toForm(p: Product | undefined): Form {
  return {
    name: p?.name ?? '',
    baseName: p?.baseName ?? '',
    unit: p?.unit ?? 'saco',
    category: p?.category ?? '',
    salePrice: p ? centsToInput(p.salePrice) : '',
    costPrice: p ? centsToInput(p.costPrice) : '',
    sellerPrice: p?.sellerPrice != null ? centsToInput(p.sellerPrice) : '',
    initialStock: '',
    minStock: p ? formatQty(p, p.minStock) : '0',
    allowsFraction: p?.allowsFraction ?? false,
    allowsHaggle: p?.allowsHaggle ?? false,
    pinnedPosition: p?.pinnedPosition != null ? String(p.pinnedPosition) : '',
    active: p?.active ?? true,
    photo: p?.photo ?? null,
  };
}

export default function ProductScreen({ id }: { id: string | null }) {
  const product = useLiveQuery(() => (id ? db.products.get(id) : undefined), [id]);
  const loading = id !== null && product === undefined;
  return loading ? null : <ProductForm key={id ?? 'new'} product={product} />;
}

function ProductForm({ product }: { product: Product | undefined }) {
  const back = useNav((st) => st.back);
  const [f, setF] = useState<Form>(() => toForm(product));
  const [adjusting, setAdjusting] = useState(false);
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((prev) => ({ ...prev, [k]: v }));

  const photoUrl = useMemo(() => (f.photo ? URL.createObjectURL(f.photo) : null), [f.photo]);
  useEffect(() => () => void (photoUrl && URL.revokeObjectURL(photoUrl)), [photoUrl]);

  const sale = parseSolesToCents(f.salePrice);
  const cost = parseSolesToCents(f.costPrice || '0');
  const marginText = useMemo(() => {
    if (sale === null || cost === null || sale <= 0) return null;
    const m = sale - cost;
    const pct = ((m * 1000) / sale / 10).toFixed(1);
    return { m, text: t.inventory.margin(formatPEN(m), pct) };
  }, [sale, cost]);

  const qtyInfo = { allowsFraction: f.allowsFraction };

  const save = async () => {
    const sellerPrice = f.sellerPrice.trim() ? parseSolesToCents(f.sellerPrice) : null;
    const minStock = parseQty(qtyInfo, f.minStock || '0');
    const initialStock = parseQty(qtyInfo, f.initialStock || '0');
    const pinned = f.pinnedPosition.trim() ? Number(f.pinnedPosition) : null;
    if (sale === null || cost === null || (f.sellerPrice.trim() && sellerPrice === null)) {
      return toast(t.errors.invalidAmount, 'error');
    }
    if (minStock === null || initialStock === null) return toast(t.errors.invalidQty, 'error');
    const input: ProductInput = {
      name: f.name,
      baseName: f.baseName,
      unit: f.unit,
      allowsFraction: f.allowsFraction,
      allowsHaggle: f.allowsHaggle,
      category: f.category.trim(),
      salePrice: sale,
      costPrice: cost,
      sellerPrice,
      minStock,
      photo: f.photo,
      pinnedPosition: pinned,
      active: f.active,
    };
    setSaving(true);
    try {
      if (product) await updateProduct(product.id, input);
      else await createProduct(input, initialStock);
      toast(t.inventory.saved, 'success');
      back();
    } catch (err) {
      setSaving(false);
      toastError(err);
    }
  };

  const onPhoto = async (file: File | undefined) => {
    if (!file) return;
    try {
      set('photo', await compressPhoto(file));
    } catch (err) {
      toastError(err);
    }
  };

  return (
    <div className={s.screen}>
      <ScreenHeader title={product ? t.inventory.editTitle : t.inventory.newProduct} />
      <div className={s.content}>
        {product && (
          <div className={`${s.card} ${styles.stockCard}`}>
            <div>
              <div className={s.label}>{t.inventory.inStore('').trim()}</div>
              <div className={styles.stockValue}>{formatQty(product, product.stock)}</div>
              {product.consignedQty > 0 && (
                <div className={s.muted}>{t.inventory.withSellers(formatQty(product, product.consignedQty))}</div>
              )}
            </div>
            <Button onClick={() => setAdjusting(true)}>{t.inventory.adjust}</Button>
          </div>
        )}

        <div className={styles.photoRow}>
          {photoUrl ? (
            <img className={styles.photo} src={photoUrl} alt="" />
          ) : (
            <div className={styles.photo} style={{ background: tileGradient(product?.tileColor ?? tileColorFor(f.name)) }}>
              {f.name.charAt(0).toUpperCase() || '?'}
            </div>
          )}
          <div className={styles.photoBtns}>
            <label className={`${s.input} ${s.check}`} style={{ justifyContent: 'center' }}>
              {t.inventory.fields.takePhoto}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="visually-hidden"
                onChange={(e) => onPhoto(e.target.files?.[0])}
              />
            </label>
            {f.photo && (
              <Button variant="danger" onClick={() => set('photo', null)}>
                {t.inventory.fields.removePhoto}
              </Button>
            )}
          </div>
        </div>

        <label className={s.field}>
          {t.inventory.fields.name}
          <input
            className={s.input}
            value={f.name}
            placeholder={t.inventory.fields.namePh}
            onChange={(e) => set('name', e.target.value)}
          />
        </label>
        <div className={s.row}>
          <label className={s.field}>
            {t.inventory.fields.baseName}
            <input
              className={s.input}
              value={f.baseName}
              placeholder={t.inventory.fields.baseNamePh}
              onChange={(e) => set('baseName', e.target.value)}
            />
          </label>
          <label className={s.field}>
            {t.inventory.fields.unit}
            <select className={s.input} value={f.unit} onChange={(e) => set('unit', e.target.value as ProductUnit)}>
              {UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className={s.field}>
          {t.inventory.fields.category}
          <input className={s.input} value={f.category} onChange={(e) => set('category', e.target.value)} />
        </label>
        <div className={s.row}>
          <label className={s.field}>
            {t.inventory.fields.salePrice}
            <input
              className={`${s.input} mono`}
              inputMode="decimal"
              value={f.salePrice}
              onChange={(e) => set('salePrice', e.target.value)}
            />
          </label>
          <label className={s.field}>
            {t.inventory.fields.costPrice}
            <input
              className={`${s.input} mono`}
              inputMode="decimal"
              value={f.costPrice}
              onChange={(e) => set('costPrice', e.target.value)}
            />
          </label>
        </div>
        {marginText && (
          <div className={`${styles.margin} ${marginText.m >= 0 ? styles.marginPos : styles.marginNeg}`}>{marginText.text}</div>
        )}
        <label className={s.field}>
          {t.inventory.fields.sellerPrice}
          <input
            className={`${s.input} mono`}
            inputMode="decimal"
            value={f.sellerPrice}
            onChange={(e) => set('sellerPrice', e.target.value)}
          />
        </label>
        <div className={s.row}>
          {!product && (
            <label className={s.field}>
              {t.inventory.fields.initialStock}
              <input
                className={`${s.input} mono`}
                inputMode="decimal"
                value={f.initialStock}
                onChange={(e) => set('initialStock', e.target.value)}
              />
            </label>
          )}
          <label className={s.field}>
            {t.inventory.fields.minStock}
            <input
              className={`${s.input} mono`}
              inputMode="decimal"
              value={f.minStock}
              onChange={(e) => set('minStock', e.target.value)}
            />
          </label>
          <label className={s.field}>
            {t.inventory.fields.pinned}
            <input
              className={`${s.input} mono`}
              inputMode="numeric"
              value={f.pinnedPosition}
              placeholder={t.inventory.fields.pinnedPh}
              onChange={(e) => set('pinnedPosition', e.target.value.replace(/\D/g, ''))}
            />
          </label>
        </div>
        <label className={s.check}>
          <input
            type="checkbox"
            checked={f.allowsFraction}
            disabled={!!product}
            onChange={(e) => set('allowsFraction', e.target.checked)}
          />
          {t.inventory.fields.allowsFraction}
        </label>
        <label className={s.check}>
          <input type="checkbox" checked={f.allowsHaggle} onChange={(e) => set('allowsHaggle', e.target.checked)} />
          {t.inventory.fields.allowsHaggle}
        </label>
        <label className={s.check}>
          <input type="checkbox" checked={f.active} onChange={(e) => set('active', e.target.checked)} />
          {t.inventory.fields.active}
        </label>
        <Button variant="primary" block disabled={saving || !f.name.trim()} onClick={save}>
          {t.common.save}
        </Button>
      </div>
      {adjusting && product && <AdjustStockSheet product={product} onClose={() => setAdjusting(false)} />}
    </div>
  );
}
