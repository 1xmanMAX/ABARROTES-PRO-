import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { SYNC_TABLES } from './local';
import { fingerprint } from './patch';

// El mismo vector se comprueba en pc/tests/servidor.rs: JS y Rust deben dar la misma huella, o
// cada sincronización tendría que enviar todos los datos.
it('la huella coincide con la del servidor de la PC (Rust)', async () => {
  const data = JSON.parse(readFileSync(resolve(process.cwd(), '../pc/tests/vector-huella.json'), 'utf8'));
  expect(await fingerprint(data, SYNC_TABLES)).toBe(HUELLA);
});

const HUELLA = 'aa6c45a8a5a3d33c735147c92528badc';
