#!/usr/bin/env bun

/**
 * 🔍 UPSTASH REDIS DIAGNOSTIC SCRIPT
 * Diagnostic complet des permissions token Upstash Redis
 * Résout les erreurs NOPERM en vérifiant type de token et permissions ACL
 */

import { Redis } from '@upstash/redis';

interface DiagnosticResult {
  success: boolean;
  tokenType: 'standard' | 'read-only' | 'unknown';
  permissions: {
    canRead: boolean;
    canWrite: boolean;
    canDelete: boolean;
    canIncrement: boolean;
  };
  errors: string[];
  recommendations: string[];
}

async function diagnoseUpstashToken(): Promise<DiagnosticResult> {
  const result: DiagnosticResult = {
    success: false,
    tokenType: 'unknown',
    permissions: {
      canRead: false,
      canWrite: false,
      canDelete: false,
      canIncrement: false,
    },
    errors: [],
    recommendations: [],
  };

  console.log('🔍 Upstash Redis Token Diagnostic Starting...\n');

  // Vérifier variables d'environnement
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    result.errors.push('Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN environment variables');
    result.recommendations.push('1. Set UPSTASH_REDIS_REST_URL in your .env file');
    result.recommendations.push('2. Set UPSTASH_REDIS_REST_TOKEN in your .env file');
    result.recommendations.push('3. Get these values from: https://console.upstash.com/redis');
    return result;
  }

  console.log('✅ Environment variables found');
  console.log(`📍 URL: ${url.substring(0, 40)}...`);
  console.log(`🔑 Token: ${token.substring(0, 20)}...***\n`);

  try {
    // Créer client Upstash
    const redis = new Redis({
      url,
      token,
      automaticDeserialization: true,
    });

    console.log('🔄 Testing Redis connection...');

    // Test 1: PING
    try {
      await redis.ping();
      console.log('✅ PING successful - Connection OK\n');
    } catch (error) {
      result.errors.push(`PING failed: ${error instanceof Error ? error.message : String(error)}`);
      result.recommendations.push('1. Verify your UPSTASH_REDIS_REST_URL is correct');
      result.recommendations.push('2. Verify your UPSTASH_REDIS_REST_TOKEN is correct');
      result.recommendations.push('3. Check network connectivity to Upstash');
      return result;
    }

    // Test 2: GET (Read permission)
    console.log('🔄 Testing READ permissions...');
    try {
      await redis.get('diagnostic:test:read');
      result.permissions.canRead = true;
      console.log('✅ GET command successful - READ permission OK\n');
    } catch (error) {
      result.errors.push(`GET failed: ${error instanceof Error ? error.message : String(error)}`);
      console.log('❌ GET command failed - READ permission denied\n');
    }

    // Test 3: SET (Write permission) - CRITICAL TEST
    console.log('🔄 Testing WRITE permissions (SET)...');
    try {
      await redis.set('diagnostic:test:write', 'test-value');
      result.permissions.canWrite = true;
      console.log('✅ SET command successful - WRITE permission OK\n');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      result.errors.push(`SET failed: ${errorMsg}`);
      console.log(`❌ SET command failed: ${errorMsg}`);

      // Détecter erreur NOPERM
      if (errorMsg.includes('NOPERM') || errorMsg.includes('no permission')) {
        result.tokenType = 'read-only';
        console.log('\n🚨 NOPERM ERROR DETECTED: You are using a READ-ONLY token!');
        result.recommendations.push('');
        result.recommendations.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        result.recommendations.push('🔧 SOLUTION: Replace with STANDARD token');
        result.recommendations.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        result.recommendations.push('');
        result.recommendations.push('1. Go to Upstash Console: https://console.upstash.com/redis');
        result.recommendations.push('2. Select your Redis database');
        result.recommendations.push('3. In the "REST API" section, you will see TWO tokens:');
        result.recommendations.push('   - ❌ "Read Only Token" (red) - LIMITED PERMISSIONS');
        result.recommendations.push('   - ✅ "Standard Token" (green) - FULL PERMISSIONS');
        result.recommendations.push('');
        result.recommendations.push('4. Copy the STANDARD TOKEN (green)');
        result.recommendations.push('5. Update your .env file:');
        result.recommendations.push('   UPSTASH_REDIS_REST_TOKEN=<your-standard-token-here>');
        result.recommendations.push('');
        result.recommendations.push('6. Restart your application: docker compose restart backend');
        result.recommendations.push('');
        result.recommendations.push('⚠️  IMPORTANT: The Standard token has full database privileges.');
        result.recommendations.push('   Never expose it publicly or commit it to version control.');
        result.recommendations.push('');
      } else {
        console.log('\n⚠️  Unexpected error - not a NOPERM issue\n');
      }
    }

    // Test 4: DEL (Delete permission)
    console.log('🔄 Testing DELETE permissions...');
    try {
      await redis.del('diagnostic:test:write');
      result.permissions.canDelete = true;
      console.log('✅ DEL command successful - DELETE permission OK\n');
    } catch (error) {
      result.errors.push(`DEL failed: ${error instanceof Error ? error.message : String(error)}`);
      console.log('❌ DEL command failed\n');
    }

    // Test 5: INCR (Increment permission)
    console.log('🔄 Testing INCREMENT permissions...');
    try {
      await redis.incr('diagnostic:test:counter');
      await redis.del('diagnostic:test:counter');
      result.permissions.canIncrement = true;
      console.log('✅ INCR command successful - INCREMENT permission OK\n');
    } catch (error) {
      result.errors.push(`INCR failed: ${error instanceof Error ? error.message : String(error)}`);
      console.log('❌ INCR command failed\n');
    }

    // Déterminer type de token final
    if (result.permissions.canWrite && result.permissions.canDelete && result.permissions.canIncrement) {
      result.tokenType = 'standard';
      result.success = true;
    } else if (result.permissions.canRead && !result.permissions.canWrite) {
      result.tokenType = 'read-only';
    }

  } catch (error) {
    result.errors.push(`Unexpected error: ${error instanceof Error ? error.message : String(error)}`);
  }

  return result;
}

// Afficher résultat diagnostic
async function main() {
  const result = await diagnoseUpstashToken();

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 DIAGNOSTIC RESULTS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log(`Status: ${result.success ? '✅ SUCCESS' : '❌ FAILED'}`);
  console.log(`Token Type: ${result.tokenType.toUpperCase()}\n`);

  console.log('Permissions:');
  console.log(`  - READ:      ${result.permissions.canRead ? '✅' : '❌'}`);
  console.log(`  - WRITE:     ${result.permissions.canWrite ? '✅' : '❌'}`);
  console.log(`  - DELETE:    ${result.permissions.canDelete ? '✅' : '❌'}`);
  console.log(`  - INCREMENT: ${result.permissions.canIncrement ? '✅' : '❌'}\n`);

  if (result.errors.length > 0) {
    console.log('Errors:');
    result.errors.forEach((error, i) => {
      console.log(`  ${i + 1}. ${error}`);
    });
    console.log('');
  }

  if (result.recommendations.length > 0) {
    console.log('Recommendations:');
    result.recommendations.forEach((rec) => {
      console.log(rec);
    });
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  process.exit(result.success ? 0 : 1);
}

main();
