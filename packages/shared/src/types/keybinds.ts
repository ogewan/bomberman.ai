/** Configurable keybind mapping for player input. */
export type KeybindConfig = {
  moveUp: string[];
  moveDown: string[];
  moveLeft: string[];
  moveRight: string[];
  placeBomb: string[];
  pickupPump: string[];
  throw: string[];
  kick: string[];
};

export const DEFAULT_KEYBINDS: KeybindConfig = {
  moveUp: ['w', 'ArrowUp'],
  moveDown: ['s', 'ArrowDown'],
  moveLeft: ['a', 'ArrowLeft'],
  moveRight: ['d', 'ArrowRight'],
  placeBomb: [' '],
  pickupPump: ['e'],
  throw: ['q'],
  kick: ['f'],
};
