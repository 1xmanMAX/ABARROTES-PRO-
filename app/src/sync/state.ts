/**
 * La sincronización con la PC vista desde la app: estado para la pantalla, el código de
 * vinculación, este aparato dentro del grupo y la sincronización automática. Adaptado de
 * Canvas de Citas (app/src/lib/sincro-app.svelte.js).
 *
 * En la PC, mi-bodega.exe inyecta `window.miBodegaPc` = { codigo, codigoLocal, qr }: la app de la
 * PC se sincroniza con su propio servidor (127.0.0.1) y muestra el QR para el celular.
 */
import { Capacitor, registerPlugin } from '@capacitor/core';
import { create } from 'zustand';
import { refreshStats } from '../app/stats';
import { rebuildStats } from '../db/stats';
import { synchronize, type SyncSummary } from './client';
import { connect, findPc, parseCode, SyncHttpError, type Device, type GroupMember } from './http';
import { getMeta, localStore, onLocalChange, setMeta } from './local';

export interface PcInfo {
  codigo: string;
  codigoLocal: string;
  qr: string;
}
export const pcInfo: PcInfo | null = (window as { miBodegaPc?: PcInfo }).miBodegaPc ?? null;
export const isAndroid = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';

/** Plugin propio del APK (VinculoPlugin.java): escanea el QR de la PC. */
const Vinculo = registerPlugin<{ escanear(): Promise<{ codigo: string }> }>('Vinculo');

export interface LastSync extends Omit<SyncSummary, 'group'> {
  at: number;
}

interface SyncState {
  loaded: boolean;
  code: string;
  device: Device | null;
  last: LastSync | null;
  group: GroupMember[];
  busy: boolean;
  progress: string;
  error: string;
}

export const useSync = create<SyncState>(() => ({
  loaded: false,
  code: '',
  device: null,
  last: null,
  group: [],
  busy: false,
  progress: '',
  error: '',
}));

function defaultName(): string {
  if (pcInfo) return 'PC';
  if (isAndroid) return 'Celular';
  return /Windows/.test(navigator.userAgent) ? 'PC con Windows' : 'Navegador';
}

let loading: Promise<void> | null = null;
export function loadSync(): Promise<void> {
  loading ??= (async () => {
    const [code, last, group, saved] = await Promise.all([
      getMeta<string>('code'),
      getMeta<LastSync>('last'),
      getMeta<GroupMember[]>('group'),
      getMeta<Device>('device'),
    ]);
    let device = saved;
    if (!device?.id) {
      const rnd = crypto.getRandomValues(new Uint32Array(2)).reduce((s, n) => s + n.toString(36), '');
      device = { id: `ap_${rnd}`, name: defaultName() };
      await setMeta('device', device);
    }
    useSync.setState({ loaded: true, code: pcInfo ? pcInfo.codigoLocal : (code ?? ''), last: last ?? null, group: group ?? [], device });
  })();
  return loading;
}

async function saveCode(code: string) {
  parseCode(code); // valida
  useSync.setState({ code: code.trim() });
  await setMeta('code', code.trim());
}

async function syncWith(code: string) {
  const { url, key } = parseCode(code);
  const connection = await connect({ url, key });
  return synchronize({
    connection,
    store: localStore,
    device: useSync.getState().device!,
    onProgress: (progress) => useSync.setState({ progress }),
  });
}

// En automático no se barre la red cada vez: fuera del Wi-Fi de la PC gastaría batería.
let lastScan = 0;
function canScan(silent: boolean) {
  if (pcInfo) return false;
  if (!silent) return true;
  if (Date.now() - lastScan < 30 * 60_000) return false;
  lastScan = Date.now();
  return true;
}

let again = false;
/** Sincroniza con la PC. `silent`: automática, sin error visible si la PC no está en la red. */
export async function syncNow({ silent = false } = {}): Promise<SyncSummary | null> {
  await loadSync();
  const s = useSync.getState();
  if (!s.code) return null;
  if (s.busy) {
    again = true;
    return null;
  }
  useSync.setState({ busy: true, error: '' });
  try {
    let r: SyncSummary;
    try {
      r = await syncWith(s.code);
    } catch (e) {
      // Sin respuesta: quizá la PC cambió de IP → se busca en la red y se reintenta.
      if (!(e instanceof SyncHttpError && e.network) || !canScan(silent)) throw e;
      useSync.setState({ progress: 'Buscando la PC en la red…' });
      const found = await findPc({ code: s.code, onProgress: (progress) => useSync.setState({ progress }) });
      if (!found) throw e;
      await saveCode(found);
      r = await syncWith(found);
    }
    const { group, ...summary } = r;
    const last = { at: Date.now(), ...summary };
    useSync.setState({ last, group });
    await setMeta('last', last);
    await setMeta('group', group);
    // Llegaron ventas de otro aparato: la predicción las tiene en cuenta.
    if (r.received !== 0) {
      await rebuildStats();
      await refreshStats();
    }
    return r;
  } catch (e) {
    // En automático, que la PC no esté (otra red, apagada) no es un error que mostrar.
    if (!(silent && e instanceof SyncHttpError && e.network)) useSync.setState({ error: (e as Error).message });
    return null;
  } finally {
    useSync.setState({ busy: false, progress: '' });
    if (again) {
      again = false;
      setTimeout(() => void syncNow({ silent: true }), 0);
    }
  }
}

/** Vincula este aparato con el código de la PC y sincroniza. */
export async function link(code: string): Promise<SyncSummary | null> {
  await loadSync();
  try {
    await saveCode(code);
  } catch (e) {
    useSync.setState({ error: (e as Error).message });
    return null;
  }
  return syncNow();
}

/** Escanea el QR de la PC (APK: escáner de Google Play Services, sin permiso de cámara). */
export async function scanAndLink(): Promise<SyncSummary | null> {
  try {
    const { codigo } = await Vinculo.escanear();
    return link(codigo);
  } catch (e) {
    const msg = String((e as Error)?.message ?? e);
    if (msg !== 'cancelado') useSync.setState({ error: msg });
    return null;
  }
}

export async function unlink(): Promise<void> {
  useSync.setState({ code: '', last: null, error: '' });
  await Promise.all([setMeta('code', ''), setMeta('last', null), setMeta('base', null)]);
}

const EVERY = pcInfo ? 60_000 : 5 * 60_000;
const AFTER_CHANGE = pcInfo ? 3_000 : 10_000;
let started = false;

/** Sincroniza sola: al abrir, cada pocos minutos, al volver a la app y poco después de un cambio. */
export async function startAutoSync(): Promise<void> {
  if (started) return;
  started = true;
  await loadSync();
  const auto = () => void syncNow({ silent: true });
  auto();
  let pending: ReturnType<typeof setTimeout> | undefined;
  onLocalChange(() => {
    if (!useSync.getState().code) return;
    clearTimeout(pending);
    pending = setTimeout(auto, AFTER_CHANGE);
  });
  setInterval(() => document.visibilityState === 'visible' && auto(), EVERY);
  let hiddenAt = 0;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') hiddenAt = Date.now();
    else if (hiddenAt && Date.now() - hiddenAt > 30_000) auto();
  });
}
