import {
  attemptsLeft,
  createPinRecord,
  DEFAULT_ITERATIONS,
  ownerUnlock,
  pinMatches,
  pinStatus,
  registerFailure,
  registerSuccess,
  validateNewPin,
  type PinRecord,
} from '../domain/pin';
import { BusinessError } from './errors';
import { newId } from './ids';
import { db } from './schema';
import { DEFAULT_SETTINGS } from './settings';

let iterations = DEFAULT_ITERATIONS;
/** Solo para tests: PBKDF2 más rápido. */
export function setPinIterationsForTests(n: number) {
  iterations = n;
}

/** Error de código: el mensaje está listo para mostrarse bajo el teclado PIN. */
export class PinError extends BusinessError {
  constructor(
    code: 'pin_wrong' | 'pin_locked' | 'pin_owner_reset' | 'pin_missing' | 'pin_invalid' | 'pin_mismatch',
    message: string,
    public readonly left: number | null = null,
  ) {
    super(code, message);
  }
}

const REJECTION_MSG = {
  length: 'El código debe tener 4 dígitos.',
  trivial: 'Ese código es muy fácil de adivinar. Elige otro.',
  birth_year: 'No uses tu año de nacimiento. Elige otro.',
} as const;

export async function buildPinRecord(pin: string, birthYear: number | null, now = Date.now()): Promise<PinRecord> {
  const rejection = validateNewPin(pin, birthYear);
  if (rejection) throw new PinError('pin_invalid', REJECTION_MSG[rejection]);
  return createPinRecord(pin, now, iterations);
}

function minutesLeft(until: number, now: number) {
  return Math.max(1, Math.ceil((until - now) / 60_000));
}

/**
 * Verifica un intento contra un registro. PBKDF2 corre FUERA de cualquier
 * transacción; luego `save` guarda los contadores en su propia transacción.
 */
async function verifyAgainst(
  record: PinRecord | null,
  attempt: string,
  now: number,
  save: (updated: PinRecord) => Promise<void>,
  who: 'party' | 'owner',
): Promise<void> {
  if (!record) {
    throw new PinError(
      'pin_missing',
      who === 'owner' ? 'Primero crea el código de dueño.' : 'Esta persona todavía no tiene código.',
    );
  }
  const status = pinStatus(record, now);
  if (status.kind === 'owner_reset') {
    throw new PinError('pin_owner_reset', 'Código bloqueado por muchos intentos. Solo el dueño puede desbloquearlo.');
  }
  if (status.kind === 'locked') {
    throw new PinError('pin_locked', `Código bloqueado. Espera ${minutesLeft(status.until, now)} min.`);
  }
  if (await pinMatches(record, attempt)) {
    if (record.failedCount > 0) await save(registerSuccess(record));
    return;
  }
  const failed = registerFailure(record, now);
  await save(failed);
  const after = pinStatus(failed, now);
  if (after.kind === 'owner_reset') throw new PinError('pin_owner_reset', 'Código bloqueado. Solo el dueño puede desbloquearlo.');
  if (after.kind === 'locked') throw new PinError('pin_locked', 'Código incorrecto. Bloqueado por 5 minutos.');
  const left = attemptsLeft(failed);
  throw new PinError('pin_wrong', `Código incorrecto (quedan ${left} intentos)`, left);
}

export async function verifyPartyPin(partyId: string, attempt: string, now = Date.now()): Promise<void> {
  const party = await db.parties.get(partyId);
  if (!party) throw new BusinessError('not_found', 'Persona no encontrada.');
  await verifyAgainst(
    party.pin,
    attempt,
    now,
    async (updated) => {
      await db.transaction('rw', db.parties, async () => {
        const p = await db.parties.get(partyId);
        // Solo si el código no cambió mientras tanto.
        if (p?.pin && p.pin.hash === updated.hash) await db.parties.update(partyId, { pin: updated });
      });
    },
    'party',
  );
}

export async function verifyOwnerPin(attempt: string, now = Date.now()): Promise<void> {
  const settings = { ...DEFAULT_SETTINGS, ...(await db.settings.get('main')) };
  await verifyAgainst(
    settings.ownerPin,
    attempt,
    now,
    async (updated) => {
      await db.transaction('rw', db.settings, async () => {
        const s = await db.settings.get('main');
        if (s?.ownerPin && s.ownerPin.hash === updated.hash) await db.settings.update('main', { ownerPin: updated });
      });
    },
    'owner',
  );
}

export async function hasOwnerPin(): Promise<boolean> {
  return !!(await db.settings.get('main'))?.ownerPin;
}

/** Crea el código de dueño (primer arranque) o lo cambia con el código actual. */
export async function setOwnerPin(newPin: string, currentPin?: string, now = Date.now()): Promise<void> {
  if (await hasOwnerPin()) {
    if (!currentPin) throw new PinError('pin_missing', 'Escribe el código de dueño actual.');
    await verifyOwnerPin(currentPin, now);
  }
  const record = await buildPinRecord(newPin, null, now);
  await db.transaction('rw', [db.settings, db.auditLog], async () => {
    const s = { ...DEFAULT_SETTINGS, ...(await db.settings.get('main')) };
    await db.settings.put({ ...s, ownerPin: record });
    await db.auditLog.add({
      id: newId(),
      action: 'owner_pin_set',
      entity: 'settings',
      entityId: 'main',
      detail: '',
      createdAt: now,
    });
  });
}

/**
 * Crea o cambia el código de una persona. Si ya tenía código, se exige el del
 * dueño (SPEC §9.3: solo en persona). Queda en el historial.
 */
export async function setPartyPin(partyId: string, newPin: string, ownerPin?: string, now = Date.now()): Promise<void> {
  const party = await db.parties.get(partyId);
  if (!party) throw new BusinessError('not_found', 'Persona no encontrada.');
  if (party.pin) {
    if (!ownerPin) throw new PinError('pin_missing', 'Para cambiar el código se necesita el código de dueño.');
    await verifyOwnerPin(ownerPin, now);
  }
  const record = await buildPinRecord(newPin, party.birthYear, now);
  await db.transaction('rw', [db.parties, db.auditLog], async () => {
    await db.parties.update(partyId, { pin: record, updatedAt: now });
    await db.auditLog.add({
      id: newId(),
      action: party.pin ? 'pin_changed' : 'pin_created',
      entity: 'party',
      entityId: partyId,
      detail: party.pin ? 'Código cambiado' : 'Código creado',
      createdAt: now,
    });
  });
}

/** El dueño desbloquea el código de una persona (después de muchos intentos). */
export async function unlockPartyPin(partyId: string, ownerPin: string, now = Date.now()): Promise<void> {
  await verifyOwnerPin(ownerPin, now);
  await db.transaction('rw', [db.parties, db.auditLog], async () => {
    const party = await db.parties.get(partyId);
    if (!party?.pin) throw new BusinessError('not_found', 'Esta persona no tiene código.');
    await db.parties.update(partyId, { pin: ownerUnlock(party.pin), updatedAt: now });
    await db.auditLog.add({
      id: newId(),
      action: 'pin_unlocked',
      entity: 'party',
      entityId: partyId,
      detail: 'Código desbloqueado',
      createdAt: now,
    });
  });
}
