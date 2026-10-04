/**
 * La sincronización vista desde la app: estado para la pantalla, el grupo de aparatos (Nexo), el
 * vínculo con la PC por QR (respaldo) y la sincronización automática. Adaptado de Canvas de Citas
 * (app/src/lib/sincro-app.svelte.js).
 *
 * Cada aparato tiene su "copia local": en la PC, mi-bodega.exe (inyecta `window.miBodegaPc` =
 * { codigo, codigoLocal, qr }); en el APK, la copia nativa que arranca NodoPlugin.java. La app se
 * sincroniza con su copia local por /sync/v2 y Nexo, dentro de esa copia, la sincroniza con los
 * demás aparatos del grupo. El vínculo por QR con la PC sigue funcionando como respaldo.
 */
import { Capacitor, registerPlugin } from '@capacitor/core';
import { create } from 'zustand';
import { refreshStats } from '../app/stats';
import { rebuildStats } from '../db/stats';
import { synchronize, type LocalStore, type SyncSummary } from './client';
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
/** Plugin propio del APK (NodoPlugin.java): la copia local con Nexo. */
const Nodo = registerPlugin<{ iniciar(): Promise<{ codigo: string }> }>('Nodo');

export interface LastSync extends Omit<SyncSummary, 'group'> {
  at: number;
}

export interface NexoMember {
  id: string;
  nombre: string;
  yo: boolean;
  aLaVista: boolean;
}

/** Lo que responde la copia local en /sync/nexo/estado. */
export interface NexoStatus {
  activo: boolean;
  error?: string | null;
  enGrupo?: boolean;
  codigo?: string | null;
  yo?: string;
  miembros?: NexoMember[];
  direccion?: string | null;
  ultimaSincro?: number | null;
  ultimoError?: string | null;
  etiqueta: string;
}

interface SyncState {
  loaded: boolean;
  /** Vínculo con la PC por QR (respaldo). En la PC es su propia copia. */
  code: string;
  /** Copia local de este aparato (con Nexo), si la tiene. */
  node: string;
  nexo: NexoStatus | null;
  nexoBusy: boolean;
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
  node: '',
  nexo: null,
  nexoBusy: false,
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
    useSync.setState({
      loaded: true,
      code: pcInfo ? pcInfo.codigoLocal : (code ?? ''),
      node: pcInfo ? pcInfo.codigoLocal : '',
      last: last ?? null,
      group: group ?? [],
      device,
    });
  })();
  return loading;
}

/** Arranca la copia local del APK (una vez). Sin ella (versión web o APK viejo) no hay Nexo. */
let nodeStart: Promise<void> | null = null;
export function startNode(): Promise<void> {
  nodeStart ??= (async () => {
    if (!isAndroid) return;
    try {
      const { codigo } = await Nodo.iniciar();
      parseCode(codigo);
      useSync.setState({ node: codigo });
    } catch (e) {
      useSync.setState({ nexo: { activo: false, error: String((e as Error)?.message ?? e), etiqueta: '' } });
    }
  })();
  return nodeStart;
}

async function saveCode(code: string) {
  parseCode(code); // valida
  useSync.setState({ code: code.trim() });
  await setMeta('code', code.trim());
}

/** La base de cada destino va aparte: la de la copia local no se mezcla con la del vínculo. */
function storeFor(baseKey: string): LocalStore {
  return { ...localStore, readBase: async () => (await getMeta('base' + baseKey)) ?? null, saveBase: (d) => setMeta('base' + baseKey, d) };
}

async function syncWith(code: string, baseKey = '') {
  const { url, key } = parseCode(code);
  const connection = await connect({ url, key });
  return synchronize({
    connection,
    store: storeFor(baseKey),
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

/** Con la PC por QR: si no responde, quizá cambió de IP → se busca en la red y se reintenta. */
async function syncWithPc(code: string, silent: boolean): Promise<SyncSummary> {
  try {
    return await syncWith(code);
  } catch (e) {
    if (!(e instanceof SyncHttpError && e.network) || !canScan(silent)) throw e;
    useSync.setState({ progress: 'Buscando la PC en la red…' });
    const found = await findPc({ code, onProgress: (progress) => useSync.setState({ progress }) });
    if (!found) throw e;
    await saveCode(found);
    return syncWith(found);
  }
}

/** Etiqueta de la copia local tras la última sincronización: si cambia, Nexo trajo algo. */
let nodeSeen = '';

let again = false;
/**
 * Sincroniza: primero con la copia local (Nexo la lleva a los demás aparatos del grupo) y luego
 * con la PC vinculada por QR, si la hay. `silent`: automática, sin error visible si la PC no
 * está en la red.
 */
export async function syncNow({ silent = false } = {}): Promise<SyncSummary | null> {
  await loadSync();
  await startNode();
  const s = useSync.getState();
  const nodeOnly = s.node && s.node !== s.code ? s.node : '';
  if (!s.code && !nodeOnly) return null;
  if (s.busy) {
    again = true;
    return null;
  }
  useSync.setState({ busy: true, error: '' });
  let result: SyncSummary | null = null;
  const add = (r: SyncSummary) => {
    result = result ? { ...r, conflicts: result.conflicts + r.conflicts, sent: result.sent + r.sent, received: (result.received ?? 0) + (r.received ?? 0) } : r;
  };
  try {
    if (nodeOnly) {
      const r = await syncWith(nodeOnly, '-nodo');
      nodeSeen = r.etiqueta ?? '';
      add(r);
    }
    if (s.code) {
      try {
        const r = await syncWithPc(s.code, silent);
        if (s.code === s.node) nodeSeen = r.etiqueta ?? '';
        add(r);
      } catch (e) {
        // Con Nexo andando, que la PC del vínculo viejo no esté no es un error que mostrar.
        if (!nodeOnly) throw e;
        if (!(silent || (e instanceof SyncHttpError && e.network))) useSync.setState({ error: (e as Error).message });
      }
    }
    const r = result as SyncSummary | null;
    if (!r) return null;
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

// --- Grupo de aparatos (Nexo) ---

async function nodeConnection() {
  await loadSync();
  await startNode();
  const node = useSync.getState().node;
  if (!node) throw new Error(useSync.getState().nexo?.error ?? 'Este aparato no tiene sincronización entre aparatos.');
  const { url, key } = parseCode(node);
  return connect({ url, key });
}

/** Lee el estado del grupo; si la copia local cambió (Nexo trajo algo), sincroniza. */
export async function refreshNexo({ syncIfChanged = true } = {}): Promise<NexoStatus | null> {
  try {
    const c = await nodeConnection();
    const st = (await c.nexo!('estado', {})) as NexoStatus;
    useSync.setState({ nexo: st });
    if (syncIfChanged && nodeSeen && st.etiqueta && st.etiqueta !== nodeSeen && !useSync.getState().busy) void syncNow({ silent: true });
    return st;
  } catch {
    return null;
  }
}

/**
 * Una orden del grupo: `crear`, `unirse` ({codigo, ip?}), `expulsar` ({id}), `renovar`, `salir`,
 * `sincronizar`. Antes se guarda aquí lo último (así viaja al grupo) y después se trae lo nuevo.
 */
export async function nexoOrder(orden: string, datos: Record<string, string> = {}): Promise<Record<string, unknown>> {
  useSync.setState({ nexoBusy: true });
  try {
    await syncNow({ silent: true });
    const c = await nodeConnection();
    const r = (await c.nexo!('orden', { orden, ...datos })) as Record<string, unknown>;
    if (typeof r.error === 'string') throw new Error(r.error);
    await refreshNexo({ syncIfChanged: false });
    // Al entrar a un grupo, lo del grupo llega en unos segundos: se trae en cuanto llega.
    await syncNow({ silent: true });
    return r;
  } finally {
    useSync.setState({ nexoBusy: false });
  }
}

const EVERY = pcInfo ? 60_000 : 5 * 60_000;
const AFTER_CHANGE = pcInfo ? 3_000 : 10_000;
/** Con copia local, la sincronización es instantánea (no sale del aparato): más seguido. */
const AFTER_CHANGE_NODE = 2_000;
const WATCH_NODE = 4_000;
let started = false;

/** Sincroniza sola: al abrir, cada pocos minutos, al volver a la app y poco después de un cambio. */
export async function startAutoSync(): Promise<void> {
  if (started) return;
  started = true;
  await loadSync();
  await startNode();
  const auto = () => void syncNow({ silent: true });
  auto();
  let pending: ReturnType<typeof setTimeout> | undefined;
  onLocalChange(() => {
    const st = useSync.getState();
    if (!st.code && !st.node) return;
    clearTimeout(pending);
    pending = setTimeout(auto, st.node ? AFTER_CHANGE_NODE : AFTER_CHANGE);
  });
  setInterval(() => document.visibilityState === 'visible' && auto(), EVERY);
  // Lo que Nexo trae de otro aparato aparece aquí en segundos (solo mira una etiqueta local).
  setInterval(() => {
    if (document.visibilityState === 'visible' && useSync.getState().node) void refreshNexo();
  }, WATCH_NODE);
  let hiddenAt = 0;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') hiddenAt = Date.now();
    else if (hiddenAt && Date.now() - hiddenAt > 30_000) auto();
  });
}
