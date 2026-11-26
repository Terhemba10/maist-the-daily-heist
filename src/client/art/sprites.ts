/**
 * The 2D crew and guard art (built by scripts/build-sprites.py from assets/sprites/source).
 * Each name has front, side (facing right) and back views at 256 px, plus -sm 128 px copies for Smooth mode.
 */
import valeFront from './sprites/vale-front.webp';
import valeFrontSm from './sprites/vale-front-sm.webp';
import valeSide from './sprites/vale-side.webp';
import valeSideSm from './sprites/vale-side-sm.webp';
import valeBack from './sprites/vale-back.webp';
import valeBackSm from './sprites/vale-back-sm.webp';
import wrenFront from './sprites/wren-front.webp';
import wrenFrontSm from './sprites/wren-front-sm.webp';
import wrenSide from './sprites/wren-side.webp';
import wrenSideSm from './sprites/wren-side-sm.webp';
import wrenBack from './sprites/wren-back.webp';
import wrenBackSm from './sprites/wren-back-sm.webp';
import otoFront from './sprites/oto-front.webp';
import otoFrontSm from './sprites/oto-front-sm.webp';
import otoSide from './sprites/oto-side.webp';
import otoSideSm from './sprites/oto-side-sm.webp';
import otoBack from './sprites/oto-back.webp';
import otoBackSm from './sprites/oto-back-sm.webp';
import guardFront from './sprites/guard-front.webp';
import guardFrontSm from './sprites/guard-front-sm.webp';
import guardSide from './sprites/guard-side.webp';
import guardSideSm from './sprites/guard-side-sm.webp';
import guardBack from './sprites/guard-back.webp';
import guardBackSm from './sprites/guard-back-sm.webp';
import room from './sprites/room-office.webp';
import roomSm from './sprites/room-office-sm.webp';

export type FigureName = 'vale' | 'wren' | 'oto' | 'guard';
export type View = 'front' | 'side' | 'back';
export const VIEWS: readonly View[] = ['front', 'side', 'back'];

/** [full size, small] image URLs per figure and view. */
export const FIGURES: Record<FigureName, Record<View, readonly [string, string]>> = {
  vale: {
    front: [valeFront, valeFrontSm],
    side: [valeSide, valeSideSm],
    back: [valeBack, valeBackSm],
  },
  wren: {
    front: [wrenFront, wrenFrontSm],
    side: [wrenSide, wrenSideSm],
    back: [wrenBack, wrenBackSm],
  },
  oto: {
    front: [otoFront, otoFrontSm],
    side: [otoSide, otoSideSm],
    back: [otoBack, otoBackSm],
  },
  guard: {
    front: [guardFront, guardFrontSm],
    side: [guardSide, guardSideSm],
    back: [guardBack, guardBackSm],
  },
};

/** The office floor (layer 1 as drawn; Hard and Difficult are colour-graded in CSS). */
export const ROOM: readonly [string, string] = [room, roomSm];
