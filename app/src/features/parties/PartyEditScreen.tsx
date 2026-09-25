import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { useNav } from '../../app/nav';
import { centsToInput, parseSolesToCents } from '../../domain/money';
import { createParty, updateParty, type PartyInput } from '../../db/parties';
import { setPartyPin } from '../../db/pins';
import { db } from '../../db/schema';
import type { Party, PartyRole } from '../../db/types';
import { t } from '../../i18n/es-PE';
import { Button } from '../../ui/Button';
import { PinCreate } from '../../ui/PinCreate';
import { ScreenHeader } from '../../ui/ScreenHeader';
import s from '../../ui/Screen.module.css';
import { toast, toastError } from '../../ui/toast';

export default function PartyEditScreen({ id }: { id: string | null }) {
  const party = useLiveQuery(() => (id ? db.parties.get(id) : undefined), [id]);
  if (id && !party) return null;
  return <PartyForm key={id ?? 'new'} party={party} />;
}

function PartyForm({ party }: { party: Party | undefined }) {
  const { back, replace } = useNav();
  const [name, setName] = useState(party?.name ?? '');
  const [phone, setPhone] = useState(party?.phone ?? '');
  const [roles, setRoles] = useState<PartyRole[]>(party?.roles ?? ['client']);
  const [limit, setLimit] = useState(party ? centsToInput(party.creditLimit) : '0');
  const [birthYear, setBirthYear] = useState(party?.birthYear ? String(party.birthYear) : '');
  const [createdId, setCreatedId] = useState<string | null>(null);

  const toggle = (r: PartyRole) => setRoles((cur) => (cur.includes(r) ? cur.filter((x) => x !== r) : [...cur, r]));

  const save = async () => {
    const creditLimit = parseSolesToCents(limit || '0');
    if (creditLimit === null) return toast(t.errors.invalidAmount, 'error');
    const year = birthYear ? Number(birthYear) : null;
    const input: PartyInput = { name, phone, roles, creditLimit, birthYear: year && year > 1900 && year < 2100 ? year : null };
    try {
      if (party) {
        await updateParty(party.id, input);
        toast(t.parties.saved, 'success');
        back();
      } else {
        // Después de crearla, la persona crea su código (SPEC §5).
        setCreatedId(await createParty(input));
      }
    } catch (err) {
      toastError(err);
    }
  };

  if (createdId) {
    return (
      <div className={s.screen}>
        <ScreenHeader title={name} />
        <div className={s.content}>
          <p className={s.muted}>{t.parties.handToCreate(name)}</p>
          <PinCreate
            title={t.pin.createTitle(name.split(' ')[0] ?? name)}
            hint={t.pin.handPhone}
            onCreate={async (pin) => {
              await setPartyPin(createdId, pin);
              toast(t.pin.created, 'success');
              back();
            }}
          />
          <Button block onClick={() => replace({ name: 'party', id: createdId })}>
            {t.parties.later}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={s.screen}>
      <ScreenHeader title={party ? t.parties.edit : t.parties.new} />
      <div className={s.content}>
        <label className={s.field}>
          {t.parties.fields.name}
          <input className={s.input} value={name} autoFocus={!party} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className={s.field}>
          {t.parties.fields.phone}
          <input className={s.input} inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </label>
        <label className={s.check}>
          <input type="checkbox" checked={roles.includes('client')} onChange={() => toggle('client')} />
          {t.parties.fields.client}
        </label>
        <label className={s.check}>
          <input type="checkbox" checked={roles.includes('seller')} onChange={() => toggle('seller')} />
          {t.parties.fields.seller}
        </label>
        <label className={s.field}>
          {t.parties.fields.creditLimit}
          <input className={`${s.input} mono`} inputMode="decimal" value={limit} onChange={(e) => setLimit(e.target.value)} />
          <span className={s.muted}>{t.parties.fields.creditLimitHint}</span>
        </label>
        <label className={s.field}>
          {t.parties.fields.birthYear}
          <input
            className={`${s.input} mono`}
            inputMode="numeric"
            maxLength={4}
            value={birthYear}
            onChange={(e) => setBirthYear(e.target.value.replace(/\D/g, ''))}
          />
        </label>
        <Button variant="primary" block disabled={!name.trim() || roles.length === 0} onClick={save}>
          {t.common.save}
        </Button>
      </div>
    </div>
  );
}
