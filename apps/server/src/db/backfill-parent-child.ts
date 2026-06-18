import { isNotNull } from 'drizzle-orm';
import { db, closeConnection } from './connection';
import { user, parentChild } from './schema/auth.schema';

async function backfill(): Promise<void> {
  const linked = await db.select({ id: user.id, parentId: user.parentId })
    .from(user)
    .where(isNotNull(user.parentId));

  let inserted = 0;
  for (const row of linked) {
    if (!row.parentId) continue;
    await db.insert(parentChild)
      .values({ parentUserId: row.parentId, childUserId: row.id })
      .onConflictDoNothing();
    inserted += 1;
  }

  console.log(`Backfill parent_child: ${inserted} liens traités`);
}

backfill()
  .then(() => closeConnection())
  .catch((err) => {
    console.error('Backfill failed:', err);
    process.exit(1);
  });
