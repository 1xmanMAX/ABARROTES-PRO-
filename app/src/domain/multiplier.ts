/** Multiplicador ×1/×5/×10: un toque aplica al siguiente; dos toques lo fijan (candado). */
export type MultiplierValue = 1 | 5 | 10;

export interface MultiplierState {
  value: MultiplierValue;
  locked: boolean;
}

export const MULTIPLIER_DEFAULT: MultiplierState = { value: 1, locked: false };

export function pressMultiplier(state: MultiplierState, value: MultiplierValue): MultiplierState {
  if (value === 1) return MULTIPLIER_DEFAULT;
  if (state.value === value) return state.locked ? MULTIPLIER_DEFAULT : { value, locked: true };
  return { value, locked: false };
}

/** Después de usar el multiplicador en un toque. */
export function consumeMultiplier(state: MultiplierState): MultiplierState {
  return state.locked ? state : MULTIPLIER_DEFAULT;
}
