import type { Db } from '../db/client';
import { aiCost } from './schema';

export function insertCost(db: Db, cost: typeof aiCost.$inferInsert): Promise<unknown> {
  return db.insert(aiCost).values(cost);
}
