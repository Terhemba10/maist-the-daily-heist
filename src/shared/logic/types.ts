export type Dir = 'up' | 'down' | 'left' | 'right';

export type Vec = { x: number; y: number };

/** Tile kinds. Out-of-bounds always counts as `wall`. */
export type Cell =
  | 'wall'
  | 'floor'
  | 'doorA'
  | 'doorB'
  | 'hidden'
  | 'start'
  | 'drop'
  | 'vault'
  | 'key'
  | 'note';

export type AbilityId = 'still' | 'blink' | 'lantern';

export type TwistId = 'tide-doors' | 'mirror' | 'echoes' | 'gravity-flip' | 'loop';

export type LayerDef = {
  /** Map rows, top to bottom. Legend: # wall, . floor, S start, F drop, V vault, K key, N note, D/d tide doors, H hidden door. */
  rows: readonly string[];
  twist: TwistId;
  /** How long the Pull takes to close on this layer. */
  pullMs: number;
  /** Moves for a tidy run, used for the moon awarded for moves. */
  par: number;
  /** Tide doors: door group A and B swap every `tidePeriodMs`. Omit for doors that stay open. */
  tidePeriodMs?: number;
  /** Mirror twist: left and right controls are swapped. */
  mirrorControls?: boolean;
  /** Gravity flip: up and down controls are swapped. */
  flipControls?: boolean;
  /** Loop rooms: walking off one edge brings you back on the opposite edge. */
  wrap?: boolean;
  /** Echoes: one echo per delay, replaying your steps that many ms behind you. */
  echoDelaysMs?: readonly number[];
};

export type DreamDef = {
  id: string;
  night: number;
  /** i18n key prefix for the dreamer, e.g. `dreamer.ines`. */
  dreamer: string;
  favours: AbilityId;
  layers: readonly LayerDef[];
};

export type PlayStyle = 'fast' | 'slow' | 'caught' | 'perfect';
