// Tuning constants. Distances are world pixels, speeds px/s, the clock is minutes after 11:00 PM.
export const LANES = 3;
export const JEEP_LEN = 150;
export const STOP_LEN = 140;
export const STOP_SPEED = 45;
export const CLOCK_END = 360; // 5:00 AM
export const NIGHT_SECONDS = 190; // real seconds from 11 PM to sunrise
export const CLOCK_RATE = CLOCK_END / NIGHT_SECONDS;
export const ROUTE_SECONDS = 120; // route length = cruise × this
export const ACCEL = 220;
export const COAST_DECEL = 600;
export const BRAKE_DECEL = 520;
export const BRAKE_PER_LEVEL = 0.3;
export const LANE_TIME = 0.16;
export const INVULN = 1.5;
export const BASE_HITS = 3;
export const HORN_CD = 3;
export const HORN_CD_PER_LEVEL = 0.8;
export const HORN_RANGE = 650;
export const CHECKPOINT_SPEED = 120;
export const FLOOD_FACTOR = 0.45;
export const TRICYCLE_FACTOR = 0.45;
export const DOG_LANES_PER_SEC = 1.2;
export const DOG_TRIGGER = 750; // the dog starts crossing when you are this close
export const MAX_CHECKPOINTS = 3;
export const MAX_FLOODS = 5;
export const BOARD_TIME = 1.2;
export const FARE = 12;
export const CLEAN_BONUS = 5;
export const NIGHT_BONUS = 10;
// The arcade layer
export const GAS_FACTOR = 1.4; // holding gas raises the target speed to this × cruise
export const NEAR_DIST = 200; // a hazard this close ahead in your lane, then dodged, is a near miss
export const COMBO_TIME = 6; // seconds a combo lasts without another near miss
export const COMBO_MAX = 5; // highest barya multiplier
export const SAKTO_WINDOW = 30; // a stop with the bumper this close to the sign is sakto
export const SAKTO_BONUS = 3;
export const DOG_SCARE = 2.5; // a honked dog crosses this much faster
export const BARYA_GAP = 60; // spacing of coins in a trail

export const NIGHT_CONFIG = {
  1: { cruise: 300, gapMin: 540, gapMax: 900, types: { tricycle: 3, manhole: 2 }, rain: false, fog: false },
  2: { cruise: 315, gapMin: 500, gapMax: 840, types: { tricycle: 3, manhole: 2, flood: 2 }, rain: true, fog: false },
  3: { cruise: 330, gapMin: 470, gapMax: 800, types: { tricycle: 3, manhole: 2, flood: 1, checkpoint: 1 }, rain: false, fog: false },
  4: { cruise: 340, gapMin: 440, gapMax: 760, types: { tricycle: 3, manhole: 2, flood: 1, checkpoint: 1, dog: 2 }, rain: false, fog: true },
  5: { cruise: 350, gapMin: 420, gapMax: 720, types: { tricycle: 3, manhole: 2, flood: 2, checkpoint: 1, dog: 1 }, rain: true, fog: false },
  6: { cruise: 360, gapMin: 400, gapMax: 690, types: { tricycle: 3, manhole: 3, flood: 1, checkpoint: 1, dog: 2 }, rain: false, fog: true },
  7: { cruise: 370, gapMin: 380, gapMax: 660, types: { tricycle: 3, manhole: 3, flood: 2, checkpoint: 1, dog: 1 }, rain: true, fog: true },
};

export const UPGRADES = {
  brakes: { name: 'Preno', label: 'Brakes', costs: [60, 120] },
  bumper: { name: 'Bumper', label: 'Extra hit', costs: [80, 160] },
  horn: { name: 'Busina', label: 'Horn cooldown', costs: [50, 100] },
};
