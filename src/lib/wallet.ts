/**
 * Wallet Pass Generation Utilities
 * 
 * Generates Apple Wallet (.pkpass) and Google Wallet save-to-wallet URLs
 * for the JTAPS loyalty program.
 * 
 * Required environment variables:
 * 
 * Apple Wallet:
 *   APPLE_PASS_TYPE_ID        - e.g. "pass.com.jtapsbarandgrill.loyalty"
 *   APPLE_TEAM_ID             - Apple Developer Team ID
 *   APPLE_PASS_CERT_BASE64    - Base64-encoded .pem signing certificate
 *   APPLE_PASS_KEY_BASE64     - Base64-encoded .pem private key
 *   APPLE_WWDR_CERT_BASE64    - Base64-encoded Apple WWDR certificate
 *   APPLE_PASS_KEY_PASSPHRASE - (optional) passphrase for the private key
 * 
 * Google Wallet:
 *   GOOGLE_WALLET_ISSUER_ID       - Google Pay issuer ID
 *   GOOGLE_WALLET_CLASS_ID        - Loyalty class ID (e.g. "jtaps_loyalty")
 *   GOOGLE_SERVICE_ACCOUNT_EMAIL  - Service account email
 *   GOOGLE_SERVICE_ACCOUNT_KEY_BASE64 - Base64-encoded service account private key
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PKPass } from 'passkit-generator';
import { GoogleAuth } from 'google-auth-library';

const PASS_ASSET_FILES = ['icon.png', 'icon@2x.png', 'logo.png', 'logo@2x.png'] as const;
let passAssetBuffers: Record<(typeof PASS_ASSET_FILES)[number], Buffer> | null = null;

/** Apple requires icon (and logo for store cards) inside every .pkpass bundle. */
function getPassAssetBuffers(): Record<(typeof PASS_ASSET_FILES)[number], Buffer> {
  if (passAssetBuffers) return passAssetBuffers;

  const candidateDirs = [
    path.join(process.cwd(), 'wallet-pass-model'),
    path.join(path.dirname(fileURLToPath(import.meta.url)), '../../wallet-pass-model'),
  ];

  const modelDir = candidateDirs.find((dir) => fs.existsSync(path.join(dir, 'icon.png')));
  if (!modelDir) {
    throw new Error(
      'Wallet pass images not found. Expected wallet-pass-model/icon.png in the deployment bundle.'
    );
  }

  passAssetBuffers = Object.fromEntries(
    PASS_ASSET_FILES.map((file) => [file, fs.readFileSync(path.join(modelDir, file))])
  ) as Record<(typeof PASS_ASSET_FILES)[number], Buffer>;

  return passAssetBuffers;
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface LoyaltyMember {
  userId: string;
  name: string;
  email: string;
  points: number;
  tier: 'bronze' | 'silver' | 'gold';
  totalCheckins: number;
  currentStreak: number;
  memberSince: string; // ISO date
}

interface PassConfig {
  passTypeId: string;
  teamId: string;
  signerCert: string;
  signerKey: string;
  wwdr: string;
  signerKeyPassphrase?: string;
}

// ── Auth Token ───────────────────────────────────────────────────────────────

/**
 * Generate a cryptographically random authentication token for a wallet pass.
 * This token is embedded in the .pkpass and sent back by Apple in the
 * Authorization header of every web service call so we can verify the request.
 */
export function generatePassAuthToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// ── Tier Helpers ─────────────────────────────────────────────────────────────

export function getTierInfo(tier: string) {
  switch (tier) {
    case 'gold':
      return { label: 'Gold Member', color: '#FFD700', nextTier: null, pointsToNext: 0, icon: '🟡' };
    case 'silver':
      return { label: 'Silver Member', color: '#C0C0C0', nextTier: 'Gold', pointsToNext: 300, icon: '⚪' };
    default:
      return { label: 'Bronze Member', color: '#CD7F32', nextTier: 'Silver', pointsToNext: 100, icon: '🟤' };
  }
}

export function computeTier(points: number): 'bronze' | 'silver' | 'gold' {
  if (points >= 300) return 'gold';
  if (points >= 100) return 'silver';
  return 'bronze';
}

// ── Apple Wallet Pass ────────────────────────────────────────────────────────

function getApplePassConfig(): PassConfig | null {
  const passTypeId = import.meta.env.APPLE_PASS_TYPE_ID;
  const teamId = import.meta.env.APPLE_TEAM_ID;
  const certB64 = import.meta.env.APPLE_PASS_CERT_BASE64;
  const keyB64 = import.meta.env.APPLE_PASS_KEY_BASE64;
  const wwdrB64 = import.meta.env.APPLE_WWDR_CERT_BASE64;

  if (!passTypeId || !teamId || !certB64 || !keyB64 || !wwdrB64) {
    return null;
  }

  return {
    passTypeId,
    teamId,
    signerCert: Buffer.from(certB64, 'base64').toString('utf-8'),
    signerKey: Buffer.from(keyB64, 'base64').toString('utf-8'),
    wwdr: Buffer.from(wwdrB64, 'base64').toString('utf-8'),
    signerKeyPassphrase: import.meta.env.APPLE_PASS_KEY_PASSPHRASE || undefined,
  };
}

export function isAppleWalletConfigured(): boolean {
  return getApplePassConfig() !== null;
}

export async function generateApplePass(
  member: LoyaltyMember,
  authToken?: string
): Promise<Buffer> {
  const config = getApplePassConfig();
  if (!config) {
    throw new Error('Apple Wallet is not configured. Set the required environment variables.');
  }

  const tierInfo = getTierInfo(member.tier);
  const serial = `jtaps-loyalty-${member.userId}`;

  // Include web service fields only when an auth token is provided.
  // This enables push-notification updates after the pass is installed.
  const siteUrl = import.meta.env.PUBLIC_SITE_URL || 'https://jtapsbarandgrill.com';
  const webServiceFields = authToken
    ? {
        webServiceURL: `${siteUrl}/api/wallet/apple/v1/`,
        authenticationToken: authToken,
      }
    : {};

  const pass = new PKPass(
    getPassAssetBuffers(),
    {
      signerCert: config.signerCert,
      signerKey: config.signerKey,
      wwdr: config.wwdr,
      signerKeyPassphrase: config.signerKeyPassphrase,
    },
    {
      serialNumber: serial,
      passTypeIdentifier: config.passTypeId,
      teamIdentifier: config.teamId,
      organizationName: 'JTAPS Bar and Grill',
      description: 'JTAPS Loyalty Card',
      foregroundColor: 'rgb(255, 255, 255)',
      backgroundColor: 'rgb(26, 26, 26)',
      labelColor: 'rgb(200, 200, 200)',
      logoText: 'JTAPS',
      associatedStoreIdentifiers: [],
      ...webServiceFields,
    }
  );

  // Store card type for loyalty-style layout
  pass.type = 'storeCard';

  // Header fields (top right of pass)
  pass.headerFields.push({
    key: 'tier',
    label: 'TIER',
    value: tierInfo.label,
  });

  // Primary fields (large, prominent)
  pass.primaryFields.push({
    key: 'points',
    label: 'POINTS',
    value: member.points,
  });

  // Secondary fields
  pass.secondaryFields.push(
    {
      key: 'name',
      label: 'MEMBER',
      value: member.name,
    },
    {
      key: 'streak',
      label: 'STREAK',
      value: `${member.currentStreak} days`,
    }
  );

  // Auxiliary fields
  pass.auxiliaryFields.push(
    {
      key: 'checkins',
      label: 'TOTAL VISITS',
      value: member.totalCheckins,
    },
    {
      key: 'member_since',
      label: 'MEMBER SINCE',
      value: new Date(member.memberSince).toLocaleDateString('en-US', {
        month: 'short',
        year: 'numeric',
      }),
    }
  );

  // Back fields (info when pass is flipped)
  pass.backFields.push(
    {
      key: 'program_info',
      label: 'About JTAPS Rewards',
      value:
        'Earn points every time you visit JTAPS Bar and Grill! Check in to earn 10 points per visit, plus streak bonuses. Reach Silver at 100 points and Gold at 300 points for exclusive perks.',
    },
    {
      key: 'tiers',
      label: 'Tier Levels',
      value: '🟤 Bronze: 0-99 pts\n⚪ Silver: 100-299 pts\n🟡 Gold: 300+ pts',
    },
    {
      key: 'location',
      label: 'Visit Us',
      value: 'JTAPS Bar and Grill\nhttps://jtapsbarandgrill.com',
    }
  );

  // Barcode - QR code with user ID for scanning
  pass.setBarcodes({
    format: 'PKBarcodeFormatQR',
    message: `https://jtapsbarandgrill.com/dashboard?ref=${member.userId}`,
    messageEncoding: 'iso-8859-1',
    altText: `Member: ${member.name}`,
  });

  // Location trigger (JTAPS coordinates)
  pass.setLocations({
    latitude: 39.1455,
    longitude: -84.6175,
    relevantText: 'Welcome back to JTAPS! Check in to earn points!',
  });

  const buf = pass.getAsBuffer();
  return buf;
}

// ── Google Wallet Pass ───────────────────────────────────────────────────────

interface GoogleWalletConfig {
  issuerId: string;
  classId: string;
  serviceAccountEmail: string;
  privateKey: string;
}

function getGoogleWalletConfig(): GoogleWalletConfig | null {
  const issuerId = import.meta.env.GOOGLE_WALLET_ISSUER_ID;
  const classId = import.meta.env.GOOGLE_WALLET_CLASS_ID || 'jtaps_loyalty';
  const email = import.meta.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const keyB64 = import.meta.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64;

  if (!issuerId || !email || !keyB64) {
    return null;
  }

  return {
    issuerId,
    classId,
    serviceAccountEmail: email,
    privateKey: Buffer.from(keyB64, 'base64').toString('utf-8'),
  };
}

export function isGoogleWalletConfigured(): boolean {
  return getGoogleWalletConfig() !== null;
}

export async function generateGoogleWalletUrl(member: LoyaltyMember): Promise<string> {
  const config = getGoogleWalletConfig();
  if (!config) {
    throw new Error('Google Wallet is not configured. Set the required environment variables.');
  }

  const tierInfo = getTierInfo(member.tier);
  const objectId = `${config.issuerId}.jtaps_loyalty_${member.userId.replace(/-/g, '_')}`;
  const classId = `${config.issuerId}.${config.classId}`;

  // Build the loyalty object
  const loyaltyObject = {
    id: objectId,
    classId: classId,
    state: 'ACTIVE',
    accountId: member.email,
    accountName: member.name,
    loyaltyPoints: {
      label: 'Points',
      balance: {
        int: member.points,
      },
    },
    barcode: {
      type: 'QR_CODE',
      value: `https://jtapsbarandgrill.com/dashboard?ref=${member.userId}`,
      alternateText: `Member: ${member.name}`,
    },
    textModulesData: [
      {
        header: 'Tier',
        body: tierInfo.label,
        id: 'tier',
      },
      {
        header: 'Current Streak',
        body: `${member.currentStreak} days`,
        id: 'streak',
      },
      {
        header: 'Total Visits',
        body: `${member.totalCheckins}`,
        id: 'visits',
      },
    ],
    linksModuleData: {
      uris: [
        {
          uri: 'https://jtapsbarandgrill.com/dashboard',
          description: 'My Dashboard',
          id: 'dashboard',
        },
        {
          uri: 'https://jtapsbarandgrill.com',
          description: 'JTAPS Bar and Grill',
          id: 'website',
        },
      ],
    },
  };

  // Build the loyalty class (ensures it exists)
  const loyaltyClass = {
    id: classId,
    issuerName: 'JTAPS Bar and Grill',
    programName: 'JTAPS Rewards',
    programLogo: {
      sourceUri: {
        uri: 'https://jtapsbarandgrill.com/images/logo.png',
      },
    },
    reviewStatus: 'UNDER_REVIEW',
    hexBackgroundColor: '#1a1a1a',
    localizedIssuerName: {
      defaultValue: {
        language: 'en-US',
        value: 'JTAPS Bar and Grill',
      },
    },
  };

  // Create a JWT for the "Save to Google Wallet" button
  const claims = {
    iss: config.serviceAccountEmail,
    aud: 'google',
    origins: ['https://jtapsbarandgrill.com'],
    typ: 'savetowallet',
    payload: {
      loyaltyClasses: [loyaltyClass],
      loyaltyObjects: [loyaltyObject],
    },
  };

  const auth = new GoogleAuth({
    credentials: {
      client_email: config.serviceAccountEmail,
      private_key: config.privateKey,
    },
  });

  const client = await auth.getClient();
  // Sign the JWT
  const jwt = await (client as any).authorize();

  // For Google Wallet, we create the JWT manually using jsonwebtoken-style approach
  // via the crypto module since GoogleAuth doesn't directly sign wallet JWTs
  const crypto = await import('node:crypto');
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(
    JSON.stringify({
      ...claims,
      iat: now,
      exp: now + 3600,
    })
  ).toString('base64url');

  const signature = crypto
    .createSign('RSA-SHA256')
    .update(`${header}.${payload}`)
    .sign(config.privateKey, 'base64url');

  const token = `${header}.${payload}.${signature}`;

  return `https://pay.google.com/gp/v/save/${token}`;
}
