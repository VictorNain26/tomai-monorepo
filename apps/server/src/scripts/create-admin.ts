/**
 * Script de création du premier compte administrateur
 * Usage: bun run src/scripts/create-admin.ts
 */

import { createUser } from '../services/admin.service';
import { logger } from '../lib/observability';
import { db } from '../db/connection';
import { user } from '../db/schema';
import { eq } from 'drizzle-orm';

const ADMIN_EMAIL = 'admin@tomia.fr';
const ADMIN_NAME = 'Administrateur Tom';

async function createAdminAccount() {
  try {
    logger.info('Creating admin account...', {
      operation: 'create-admin:start',
      email: ADMIN_EMAIL
    });

    // Vérifier si un admin existe déjà
    const existing = await db
      .select()
      .from(user)
      .where(eq(user.email, ADMIN_EMAIL))
      .limit(1);

    if (existing.length > 0) {
      logger.warn('Admin account already exists', {
        operation: 'create-admin:exists',
        email: ADMIN_EMAIL,
        userId: existing[0].id
      });
      console.log('\n✅ Admin account already exists');
      console.log(`   Email: ${ADMIN_EMAIL}`);
      console.log(`   User ID: ${existing[0].id}`);
      return;
    }

    // Créer le compte admin
    const admin = await createUser({
      email: ADMIN_EMAIL,
      name: ADMIN_NAME,
      role: 'admin',
      firstName: 'Admin',
      lastName: 'Tom'
    });

    logger.info('Admin account created successfully', {
      operation: 'create-admin:success',
      userId: admin.id,
      email: admin.email
    });

    console.log('\n✅ Admin account created successfully!');
    console.log(`   Email: ${admin.email}`);
    console.log(`   User ID: ${admin.id}`);
    console.log(`   Role: ${admin.role}`);
    console.log('\n⚠️  Note: The temporary password was auto-generated.');
    console.log('   Use Better Auth password reset to set a new password.');

  } catch (error) {
    logger.error('Failed to create admin account', {
      operation: 'create-admin:error',
      _error: error instanceof Error ? error.message : String(error),
      severity: 'high' as const
    });

    console.error('\n❌ Failed to create admin account:');
    console.error(error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

// Run the script
createAdminAccount();
