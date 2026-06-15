// The campaign: ordered list of levels. main.ts walks this on level exits.

import type { GameMap } from '../engine/map';
import { level01 } from './level01';
import { level02 } from './level02';
import { level03 } from './level03';

export interface CampaignLevel {
  name: string;
  map: GameMap;
}

export const CAMPAIGN: CampaignLevel[] = [
  { name: '1 — The Midway', map: level01 },
  { name: '2 — The Big Top', map: level02 },
  { name: '3 — Hall of Mirrors', map: level03 },
];
