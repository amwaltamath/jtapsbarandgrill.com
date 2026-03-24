# Wallet Pass Setup Guide

This guide walks through setting up Apple Wallet and Google Wallet pass generation for the JTAPS loyalty card.

## Overview

The loyalty card system has three layers:

1. **Digital Card UI** — Always available at `/loyalty-card` and in the Customer Dashboard under the "Loyalty Card" tab. Shows points, tier, streak, QR code, and a flippable card design.
2. **Apple Wallet Pass** — Generates a `.pkpass` file customers can add to Apple Wallet on iPhone. Shows on the lock screen near JTAPS.
3. **Google Wallet Pass** — Creates a "Save to Google Wallet" link that adds the loyalty card to Google Wallet on Android.

Wallet passes are **optional** — the digital card works without any wallet configuration and customers can bookmark/add the page to their home screen as a fallback.

---

## Database Migration

Run the `wallet-pass-migration.sql` file against your Supabase database:

```bash
# Via Supabase CLI
supabase db push < wallet-pass-migration.sql

# Or paste contents into the Supabase SQL Editor in the dashboard
```

This creates:
- `wallet_passes` table (tracks issued passes)
- `loyalty_tier` and `member_since` columns on `customer_profiles`
- `compute_loyalty_tier()` function and auto-update trigger

---

## Apple Wallet Setup

### Prerequisites
- [Apple Developer Account](https://developer.apple.com) ($99/year)
- A Pass Type ID registered in Apple Developer portal

### Step 1: Create a Pass Type ID
1. Go to [Apple Developer → Certificates, IDs & Profiles](https://developer.apple.com/account/resources/identifiers/list/passTypeId)
2. Click **+** → **Pass Type IDs**
3. Description: `JTAPS Loyalty Card`
4. Identifier: `pass.com.jtapsbarandgrill.loyalty`
5. Click Register

### Step 2: Create a Pass Signing Certificate
1. On the Pass Type ID detail page, click **Create Certificate**
2. Upload a Certificate Signing Request (CSR) from Keychain Access
3. Download the resulting `.cer` file
4. Double-click to install in Keychain Access
5. Export as `.p12` (with password) from Keychain Access
6. Convert to PEM:
   ```bash
   # Extract certificate
   openssl pkcs12 -in pass.p12 -clcerts -nokeys -out pass-cert.pem
   
   # Extract private key
   openssl pkcs12 -in pass.p12 -nocerts -out pass-key.pem
   ```

### Step 3: Download the Apple WWDR Certificate
```bash
# Download the Apple Worldwide Developer Relations G4 certificate
curl -O https://www.apple.com/certificateauthority/AppleWWDRCAG4.cer

# Convert to PEM
openssl x509 -inform DER -in AppleWWDRCAG4.cer -out wwdr.pem
```

### Step 4: Base64-Encode and Set Environment Variables
```bash
# Encode certificates to base64 (one line each)
base64 -i pass-cert.pem -o pass-cert.b64
base64 -i pass-key.pem -o pass-key.b64
base64 -i wwdr.pem -o wwdr.b64
```

Add to your `.env` or Vercel environment variables:
```env
APPLE_PASS_TYPE_ID=pass.com.jtapsbarandgrill.loyalty
APPLE_TEAM_ID=YOUR_TEAM_ID
APPLE_PASS_CERT_BASE64=<contents of pass-cert.b64>
APPLE_PASS_KEY_BASE64=<contents of pass-key.b64>
APPLE_WWDR_CERT_BASE64=<contents of wwdr.b64>
APPLE_PASS_KEY_PASSPHRASE=<your .p12 export password, if set>
```

### Step 5: Add Pass Images (Optional)
For custom Apple Wallet pass branding, add these images to `public/images/`:
- `logo.png` — 160×50 (displayed on the pass)
- `icon.png` — 29×29 (app icon)
- `strip.png` — 375×123 (background strip image)

The pass will work without images but will look more professional with them.

---

## Google Wallet Setup

### Prerequisites
- [Google Cloud Console](https://console.cloud.google.com) project
- Google Wallet API enabled

### Step 1: Enable the Google Wallet API
1. Go to [Google Cloud Console → APIs & Services](https://console.cloud.google.com/apis/library)
2. Search for **Google Wallet API**
3. Click **Enable**

### Step 2: Create a Service Account
1. Go to **IAM & Admin → Service Accounts**
2. Click **Create Service Account**
3. Name: `jtaps-wallet-passes`
4. Role: **Editor** or custom role with Wallet API permissions
5. Click **Create Key** → JSON → Download

### Step 3: Set Up the Issuer Account
1. Go to [Google Pay & Wallet Console](https://pay.google.com/business/console)
2. Sign in and create an Issuer Account
3. Note your **Issuer ID** (numeric, e.g., `3388000000000001234`)
4. Add your service account email as a user

### Step 4: Base64-Encode and Set Environment Variables
```bash
# Get the private key from the service account JSON
cat service-account.json | python3 -c "import sys,json; print(json.load(sys.stdin)['private_key'])" > google-key.pem
base64 -i google-key.pem -o google-key.b64
```

Add to your `.env` or Vercel environment variables:
```env
GOOGLE_WALLET_ISSUER_ID=3388000000000001234
GOOGLE_WALLET_CLASS_ID=jtaps_loyalty
GOOGLE_SERVICE_ACCOUNT_EMAIL=jtaps-wallet-passes@yourproject.iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_KEY_BASE64=<contents of google-key.b64>
```

---

## Testing

### Without Wallet Configuration
The loyalty card UI works without any wallet configuration:
1. Log in as a customer at `/login`
2. Go to Dashboard → "Loyalty Card" tab (or visit `/loyalty-card` directly)
3. You'll see the card with points, tier, QR code
4. Wallet buttons will show "coming soon" message

### With Apple Wallet
1. Set the environment variables above
2. Click "Add to Apple Wallet" on an iPhone or Mac
3. The `.pkpass` file downloads and prompts to add to Wallet
4. The pass shows near JTAPS location (GPS triggered)

### With Google Wallet
1. Set the environment variables above
2. Click "Add to Google Wallet" on an Android device
3. Opens Google Wallet with the loyalty card saved
4. Points and tier show in the Google Wallet app

---

## Architecture

```
src/
  lib/wallet.ts            — Core wallet pass generation (Apple & Google)
  pages/
    api/wallet/
      apple-pass.ts        — GET: generates and downloads .pkpass
      google-pass.ts       — GET: generates Google Wallet save URL
      status.ts            — GET: returns member data + wallet config status
    loyalty-card.astro     — Standalone loyalty card page
  components/
    LoyaltyCard.tsx        — React component (card UI, QR code, wallet buttons)
  styles/
    loyalty-card.css       — All loyalty card styling

wallet-pass-migration.sql — Database migration
```

### API Endpoints

| Endpoint | Method | Auth | Returns |
|---|---|---|---|
| `/api/wallet/status` | GET | Bearer token | Member data + wallet availability |
| `/api/wallet/apple-pass` | GET | Bearer token | `.pkpass` file download |
| `/api/wallet/google-pass` | GET | Bearer token | `{ url: "..." }` save URL |

### Data Flow

1. Customer logs in → visits Dashboard or `/loyalty-card`
2. `LoyaltyCard` component calls `/api/wallet/status` to get member data + which wallets are configured
3. Card renders with points, tier, QR code, and available wallet buttons
4. When customer clicks a wallet button:
   - **Apple**: Downloads `.pkpass` → customer taps to add to Wallet
   - **Google**: Opens Google Wallet save URL in new tab
5. Pass installation tracked in `wallet_passes` table

---

## Env Variable Summary

| Variable | Required For | Description |
|---|---|---|
| `APPLE_PASS_TYPE_ID` | Apple Wallet | Pass Type ID from Apple Developer |
| `APPLE_TEAM_ID` | Apple Wallet | Your Apple Developer Team ID |
| `APPLE_PASS_CERT_BASE64` | Apple Wallet | Base64 signing certificate |
| `APPLE_PASS_KEY_BASE64` | Apple Wallet | Base64 private key |
| `APPLE_WWDR_CERT_BASE64` | Apple Wallet | Base64 WWDR certificate |
| `APPLE_PASS_KEY_PASSPHRASE` | Apple Wallet | (Optional) Key passphrase |
| `GOOGLE_WALLET_ISSUER_ID` | Google Wallet | Google Pay issuer ID |
| `GOOGLE_WALLET_CLASS_ID` | Google Wallet | Loyalty class ID |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Google Wallet | Service account email |
| `GOOGLE_SERVICE_ACCOUNT_KEY_BASE64` | Google Wallet | Base64 private key |
