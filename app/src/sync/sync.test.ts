import { beforeAll, beforeEach, expect, it } from 'vitest';
import { createParty } from '../db/parties';
import { setOwnerPin, setPartyPin, setPinIterationsForTests } from '../db/pins';
import { createProduct, type ProductInput } from '../db/products';
import { db, resetDbForTests } from '../db/schema';
import { getSettings, updateSettings } from '../db/settings';
import { checkoutOnCredit, checkoutTicket, openTicket, saveOpenTicketLines } from '../db/tickets';
import { synchronize, type LocalStore } from './client';
import type { Connection, GroupMember, ReadResponse } from './http';
import { localStore, SYNC_TABLES } from './local';
import type { SyncData } from './merge';
import { apply, diff, fingerprint } from './patch';

const base: ProductInput = {
  name: 'Arroz saco 50kg',
  baseName: 'Arroz',
  unit: 'saco',
  allowsFraction: false,
  category: '',
  salePrice: 18500,
  costPrice: 16500,
  sellerPrice: null,
  minStock: 0,
  photo: null,
  pinnedPosition: null,
  active: true,
};

/** La PC, en memoria: misma lógica que pc/src/servidor.rs (base por aparato, parches, etiqueta). */
function fakePc() {
  let data: SyncData = Object.fromEntries(SYNC_TABLES.map((t) => [t, []]));
  let tag = 0;
  const bases = new Map<string, SyncData>();
  const group: GroupMember[] = [];
  const pc = {
    get data() {
      return data;
    },
    connection: {
      hello: async () => ({ app: 'mibodega-sincro' }),
      async read(req): Promise<ReadResponse> {
        const b = bases.get(req.dispositivo);
        const r = { etiqueta: String(tag), huella: await fingerprint(data, SYNC_TABLES), grupo: group };
        if (b && req.base === (await fingerprint(b, SYNC_TABLES))) return { ...r, modo: 'parche', parche: diff(b, data) };
        return { ...r, modo: 'completo', datos: structuredClone(data) };
      },
      async write(req) {
        if (req.etiqueta !== String(tag)) throw Object.assign(new Error('cambio'), { status: 409 });
        const next = req.datos ?? apply(data, req.parche ?? []);
        if (req.huella && req.huella !== (await fingerprint(next, SYNC_TABLES))) throw Object.assign(new Error('huella'), { status: 422 });
        data = structuredClone(next);
        tag++;
        bases.set(req.dispositivo, structuredClone(next));
        return { grupo: group };
      },
    } satisfies Connection,
  };
  return pc;
}

/** Cada aparato: su propia BD y su propia base de sincronización. */
function device(name: string) {
  let savedBase: SyncData | null = null;
  const store: LocalStore = {
    ...localStore,
    readBase: async () => savedBase,
    saveBase: async (d) => {
      savedBase = structuredClone(d);
    },
  };
  return {
    use: () => resetDbForTests(name),
    sync: (pc: ReturnType<typeof fakePc>) => synchronize({ connection: pc.connection, store, device: { id: `ap_${name}`, name } }),
  };
}

async function sell(productId: string, qty: number) {
  const t = await openTicket();
  await saveOpenTicketLines(t.id, [{ productId, qty, priceOverride: null, priceOverrideReason: null }]);
  return t.id;
}

beforeAll(() => setPinIterationsForTests(1000));
let n = 0;
let pc: ReturnType<typeof fakePc>, A: ReturnType<typeof device>, B: ReturnType<typeof device>;
beforeEach(() => {
  n++;
  pc = fakePc();
  A = device(`pc-${n}`);
  B = device(`cel-${n}`);
});

it('ventas a la vez en la PC y en el celular: se juntan y el stock descuenta ambas', async () => {
  A.use();
  await setOwnerPin('9753');
  const arroz = await createProduct(base, 20);
  const rosa = await createParty({ name: 'Rosa', phone: '', roles: ['client'], creditLimit: 500000, birthYear: null });
  await setPartyPin(rosa, '2580');
  await A.sync(pc);

  // Celular nuevo: recibe todo, incluido el código de dueño.
  B.use();
  await B.sync(pc);
  expect((await db.products.get(arroz))!.stock).toBe(20);
  expect((await getSettings()).ownerPin).not.toBeNull();

  // Venta en el celular (efectivo) y en la PC (fiado a Rosa) sin sincronizar entre medio.
  await checkoutTicket(await sell(arroz, 2), { method: 'cash', cashReceived: 37000 });
  const pestaña = await sell(arroz, 1); // queda abierta en el celular: no viaja
  A.use();
  await checkoutOnCredit(await sell(arroz, 3), rosa, '2580');

  B.use();
  await B.sync(pc);
  A.use();
  const r = await A.sync(pc);
  expect(r.conflicts).toBe(0);
  expect((await db.products.get(arroz))!.stock).toBe(15);
  expect(await db.tickets.where('status').anyOf('paid', 'credit').count()).toBe(2);
  expect((await db.parties.get(rosa))!.balance).toBe(3 * 18500);
  expect(await db.tickets.get(pestaña)).toBeUndefined();

  B.use();
  await B.sync(pc);
  expect((await db.products.get(arroz))!.stock).toBe(15);
  expect((await db.parties.get(rosa))!.balance).toBe(3 * 18500);
  expect((await db.tickets.get(pestaña))!.status).toBe('open');
  // La PC guarda lo mismo.
  expect(pc.data.products!.find((p) => p.id === arroz)!.stock).toBe(15);
});

it('el tema y el orden de la cuadrícula son de cada aparato; el código de dueño de la PC gana la primera vez', async () => {
  A.use();
  await setOwnerPin('9753');
  await updateSettings({ theme: 'dark', shopName: 'Bodega Rosita' });
  await A.sync(pc);
  B.use();
  await setOwnerPin('4826'); // el celular creó otro código antes de vincularse
  await updateSettings({ theme: 'light' });
  await B.sync(pc);
  const s = await getSettings();
  expect(s.theme).toBe('light');
  expect(s.shopName).toBe('Bodega Rosita');
  A.use();
  const ownerPc = (await getSettings()).ownerPin;
  B.use();
  expect((await getSettings()).ownerPin).toEqual(ownerPc);
});

it('un aparato que perdió su base no borra nada de la PC', async () => {
  A.use();
  const arroz = await createProduct(base, 5);
  await A.sync(pc);
  B.use();
  await B.sync(pc);
  // El celular se reinstala: BD vacía y sin base.
  const C = device(`cel-nuevo-${n}`);
  C.use();
  await C.sync(pc);
  expect(pc.data.products!.map((p) => p.id)).toEqual([arroz]);
  expect((await db.products.get(arroz))!.stock).toBe(5);
});

it('una venta hecha mientras se sincroniza no se pierde', async () => {
  A.use();
  const arroz = await createProduct(base, 10);
  await A.sync(pc);
  B.use();
  await B.sync(pc);
  const write = pc.connection.write;
  let once = false;
  pc.connection.write = async (req) => {
    const r = await write(req);
    if (!once) {
      once = true;
      await checkoutTicket(await sell(arroz, 4), { method: 'cash', cashReceived: 74000 }); // justo en medio
    }
    return r;
  };
  await B.sync(pc);
  pc.connection.write = write;
  expect((await db.products.get(arroz))!.stock).toBe(6);
  await B.sync(pc);
  expect(pc.data.products!.find((p) => p.id === arroz)!.stock).toBe(6);
  expect(pc.data.tickets!.filter((t) => t.status === 'paid')).toHaveLength(1);
});
