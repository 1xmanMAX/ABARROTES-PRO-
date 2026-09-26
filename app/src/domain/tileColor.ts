/** Degradados para tiles sin foto (DESIGN.md / prototipo v1). */
export const TILE_GRADIENTS: ReadonlyArray<readonly [string, string]> = [
  ['#E8C77E', '#A67C2B'],
  ['#8FB39B', '#2B4636'],
  ['#E3AFA0', '#A24632'],
  ['#B7CFC0', '#4C7A5D'],
  ['#D9C79A', '#8A6A22'],
  ['#9FB8AE', '#1D3226'],
];

export function tileColorFor(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return hash % TILE_GRADIENTS.length;
}

export function tileGradient(index: number): string {
  const pair = TILE_GRADIENTS[((index % TILE_GRADIENTS.length) + TILE_GRADIENTS.length) % TILE_GRADIENTS.length]!;
  return `linear-gradient(135deg, ${pair[0]}, ${pair[1]})`;
}
