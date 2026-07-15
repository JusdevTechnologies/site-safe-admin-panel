# Apple ADE Enrollment Flow

## Architecture Overview

```
Apple Business Manager
        │
        │ (MDM server assignment / device sync)
        ▼
NanoDEP                      ← Lightweight Apple DEP (Device Enrollment Program)
        │                        implementation that proxies to /server
        │ (DEP API calls)
        ▼
Middleware (/server)         ← This project's Express middleware
        │                        generates .mobileconfig, tracks enrollment
        │ (MDM commands / check-in)
        ▼
NanoMDM                      ← MDM server that talks APNs to devices
        │
        │ (APNs push / device responses)
        ▼
Apple Device
```

## Apache Routing

| Path       | Backend    | Purpose                            |
| ---------- | ---------- | ---------------------------------- |
| `/server`  | Middleware | ADE profile generation, enrollment |
| `/account` | NanoDEP    | DEP account management             |
| `/profile` | NanoDEP    | DEP profile management             |
| `/session` | NanoDEP    | DEP authentication tokens          |
| `/checkin` | NanoMDM    | MDM check-in protocol              |
| `/mdm`     | NanoMDM    | MDM command protocol               |
| `/v1`      | NanoMDM    | NanoMDM API                        |

## Enrollment Lifecycle

### Step 1: Apple Business Manager (ABM) Assignment

An administrator assigns devices to the MDM server in Apple Business Manager.

- **ABM API**: Apple Business Manager REST API
- **Direction**: ABM → (sync) → Middleware
- **Endpoint**: `POST /server/sync/abm`
- **Purpose**: Records device assignment (serial number, model, organization) in the `ade_device_assignments` table.
- **Data flow**: ABM webhook → middleware → `ADESyncService.syncAbmAssignment()`

### Step 2: Factory Reset / Device Power-On

When a factory-reset iPhone/iPad powers on, it contacts Apple's DEP servers to check if it's assigned to an MDM server.

- **Apple Protocol**: DEP (Device Enrollment Program)
- **Direction**: Apple Device → Apple DEP Servers → NanoDEP → Middleware
- **DEP APIs involved**:
  1. Device checks for enrollment profile via DEP
  2. NanoDEP authenticates with Apple DEP
  3. NanoDEP calls middleware for device lookup

### Step 3: Device Lookup

NanoDEP identifies the device and looks it up in the middleware.

- **Endpoint**: `POST /server/device/lookup`
- **Direction**: NanoDEP → Middleware
- **Expected Request**: `{ serialNumber, model?, udid? }`
- **Expected Response**: `{ success, data: { id, serialNumber, status, profileUuid, ... } }`
- **Auth**: ADE API Key (`X-ADE-API-Key` header)
- **Service**: `ADEDeviceService.lookupDevice()`
- **Lifecycle transition**: `pending → assigned`
- **Purpose**: Creates or retrieves the enrollment record for the device.

### Step 4: Profile Resolution

The middleware resolves which enrollment profile applies to the device.

- **Endpoint**: `POST /server/device/profile`
- **Direction**: NanoDEP → Middleware
- **Service**: `ADEEnrollmentProfileService.getProfileForDevice()`
- **Resolution strategy (priority order)**:
  1. Already-assigned profile on the enrollment record
  2. Model-matched profile (from profile configuration)
  3. Organization-matched profile
  4. Default active profile
  5. Auto-created default profile

### Step 5: Profile Generation

Middleware dynamically generates the Apple enrollment profile (`.mobileconfig`).

- **Endpoint**: `POST /server/profile/generate`
- **Direction**: NanoDEP → Middleware (or directly by admin)
- **Service**: `ADEProfileGenerator.generateMobileconfig()`
- **Lifecycle transition**: `assigned → profile_generated`

#### Profile Generation Architecture

The generator has been split into specialized builders:

```
ADEProfileGenerator.generateMobileconfig()
  │
  ├── ProfileValidator.validate()
  │     Validates ServerURL, CheckInURL, Topic, UUIDs, Organization
  │
  ├── CertificateLoader.loadRootCACertificates()
  │     Reads PEM/DER files from configured path, converts to base64
  │
  ├── CertificateLoader.loadIdentityCertificate()
  │     Reads PKCS#12 file from configured path
  │
  ├── RootCAPayloadBuilder.build(cert)
  │     → com.apple.security.root payload
  │
  ├── IdentityPayloadBuilder.build(cert)
  │     → com.apple.security.pkcs12 payload
  │
  ├── MDMPayloadBuilder.build({serverUrl, topic, ...})
  │     → com.apple.mdm payload with IdentityCertificateUUID ref
  │
  ├── PayloadAssembler.assemble({rootCa, identity, mdm})
  │     → Complete profile dictionary with SkipSetupItems
  │
  ├── XMLSerializer.serialize(profileDict)
  │     → XML plist string with validation
  │
  └── ProfileSigner.sign(xml)
        → CMS signing wrapper (stub for POC)
```

#### Generated Profile Structure

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "...">
<plist version="1.0">
<dict>
  <key>PayloadContent</key>
  <array>
    <!-- 1. Root CA Payload (optional) -->
    <dict>
      <key>PayloadType</key><string>com.apple.security.root</string>
      <key>PayloadContent</key><data>BASE64_DER_CERT</data>
      ...
    </dict>

    <!-- 2. Identity Certificate Payload (optional) -->
    <dict>
      <key>PayloadType</key><string>com.apple.security.pkcs12</string>
      <key>PayloadContent</key><data>BASE64_PKCS12</data>
      ...
    </dict>

    <!-- 3. MDM Payload (required) -->
    <dict>
      <key>PayloadType</key><string>com.apple.mdm</string>
      <key>ServerURL</key><string>...</string>
      <key>CheckInURL</key><string>...</string>
      <key>Topic</key><string>com.apple.mgmt.XXXX</string>
      <key>IdentityCertificateUUID</key><string>UUID</string>  <!-- if identity present -->
      <key>AnchorCertificates</key>
      <array>
        <data>BASE64_DER_CERT</data>
      </array>
      ...
    </dict>
  </array>

  <key>PayloadDisplayName</key><string>...</string>
  <key>PayloadIdentifier</key><string>com.kokken.mdm.enrollment.UUID</string>
  <key>PayloadOrganization</key><string>Kokken Robotics ...</string>
  <key>SkipSetupItems</key>
  <array>
    <string>AppleID</string>
    <string>Privacy</string>
    ...
  </array>
</dict>
</plist>
```

### Step 6: Profile Delivery

The generated profile is delivered to the device with the correct Apple MIME type.

- **Endpoint**: `POST /server/profile/download`
- **Direction**: NanoDEP → Middleware → Apple Device
- **MIME type**: `application/x-apple-aspen-config`
- **Content-Disposition**: `attachment; filename="enrollment_<serial>.mobileconfig"`
- **Lifecycle transition**: `profile_generated → profile_delivered`

### Step 7: Device Downloads Profile

The device downloads and installs the enrollment profile automatically.

- **Apple Protocol**: The device receives the `.mobileconfig` via DEP
- **Lifecycle transition**: `profile_delivered → enrollment_started`
- At this point, the device shows the "Remote Management — [Organization]" screen.

### Step 8: Enrollment Start

The device contacts the middleware to begin MDM enrollment.

- **Endpoint**: `POST /server/enrollment/start`
- **Direction**: Device → NanoDEP → Middleware
- **Service**: `ADEEnrollmentService.startEnrollment()`
- **Lifecycle transition**: `pending → enrollment_started`
- **Key data**: Serial number, UDID, model

### Step 9: MDM Check-In

The device authenticates with the MDM server (NanoMDM) and establishes the MDM channel.

- **Direction**: Device ↔ NanoMDM (via `/checkin` routed by Apache)
- **Protocol**: Apple MDM Check-In protocol
  - **Authenticate**: Device sends its identity
  - **TokenUpdate**: Device sends push magic and token
  - **CheckOut**: Optional, when device unenrolls
- **Lifecycle transitions**:
  - `enrollment_started → authenticated` (Authenticate received)
  - `authenticated → checkin_received` (TokenUpdate received)

### Step 10: NanoMDM Event Correlation

The middleware correlates NanoMDM events with enrollment records.

- **Endpoint**: `POST /server/events/nanomdm`
- **Direction**: NanoMDM → Middleware (via webhook)
- **Service**: `ADESyncService.correlateNanoMDMEvent()`
- **Lifecycle transition**: `checkin_received → mdm_connection`

### Step 11: DeviceConfigured Event

After Setup Assistant completes on the device, Apple sends a DeviceConfigured event.

- **Endpoint**: `POST /server/enrollment/device-configured`
- **Direction**: Device → NanoDEP → Middleware
- **Service**: `ADEEnrollmentService.handleDeviceConfigured()`
- **Lifecycle transitions**:
  - `mdm_connection → device_configured`
  - If `await_device_configured` is false: `device_configured → completed`

### Step 12: Enrollment Complete

If awaiting DeviceConfigured, an admin or automated process completes the enrollment.

- **Endpoint**: `POST /server/enrollment/status`
- **Direction**: Admin/Middleware → Middleware
- **Service**: `ADEEnrollmentService.updateEnrollmentStatus()`
- **Lifecycle transition**: `device_configured → completed`
- **Final state**: The device is fully managed by NanoMDM

## API Reference

### ADE Profile Endpoints

| Method | Path                            | Auth            | Purpose                    |
| ------ | ------------------------------- | --------------- | -------------------------- |
| POST   | `/server/device/lookup`         | ADE API Key     | Lookup/register device     |
| GET    | `/server/device/:serial`        | ADE API Key     | Get device by serial       |
| POST   | `/server/device/profile`        | ADE API Key     | Resolve profile for device |
| POST   | `/server/device/profile/assign` | ADE API Key     | Assign profile to device   |
| POST   | `/server/profile/generate`      | ADE API Key     | Generate .mobileconfig     |
| POST   | `/server/profile/download`      | ADE API Key     | Download .mobileconfig     |
| POST   | `/server/profile`               | JWT super_admin | Create enrollment profile  |
| GET    | `/server/profile/:uuid`         | ADE API Key     | Get profile by UUID        |
| PATCH  | `/server/profile/:uuid`         | JWT super_admin | Update profile             |
| GET    | `/server/profiles`              | JWT super_admin | List profiles              |

### Enrollment Endpoints

| Method | Path                                   | Auth            | Purpose                  |
| ------ | -------------------------------------- | --------------- | ------------------------ |
| POST   | `/server/enrollment/start`             | ADE API Key     | Start enrollment         |
| POST   | `/server/enrollment/status`            | ADE API Key     | Update enrollment status |
| POST   | `/server/enrollment/device-configured` | ADE API Key     | Handle DeviceConfigured  |
| GET    | `/server/enrollment/by-serial/:serial` | ADE API Key     | Get enrollment by serial |
| GET    | `/server/enrollment/:id`               | ADE API Key     | Get enrollment by ID     |
| GET    | `/server/enrollments`                  | JWT super_admin | List enrollments         |

### Event & Sync Endpoints

| Method | Path                               | Auth            | Purpose                  |
| ------ | ---------------------------------- | --------------- | ------------------------ |
| POST   | `/server/events`                   | ADE API Key     | Record enrollment event  |
| POST   | `/server/events/nanomdm`           | ADE API Key     | Correlate NanoMDM event  |
| POST   | `/server/certificate`              | JWT super_admin | Store cert metadata      |
| PATCH  | `/server/certificate/:id`          | JWT super_admin | Update cert metadata     |
| GET    | `/server/certificate/:id`          | ADE API Key     | Get cert metadata        |
| GET    | `/server/certificates`             | JWT super_admin | List certificates        |
| DELETE | `/server/certificate/:id`          | JWT super_admin | Delete cert metadata     |
| POST   | `/server/sync/abm`                 | ADE API Key     | Sync ABM assignment      |
| GET    | `/server/sync/assignments`         | JWT super_admin | List ABM assignments     |
| GET    | `/server/sync/assignments/:serial` | ADE API Key     | Get assignment by serial |

## Profile Generation Builders

### ProfileValidator

Validates all required fields before XML generation. Rejects:

- Missing or invalid `ServerURL`
- Missing or invalid `CheckInURL`
- Missing or malformed `Topic` (must start with `com.apple.mgmt.`)
- Missing or invalid `Profile UUID`
- Missing `Organization`
- Missing `Profile Identifier`
- Invalid `IdentityCertificatePayloadUuid`

### CertificateLoader

Reads certificate files from configured filesystem paths:

- `ADE_ROOT_CA_CERT_PATH`: Path to a PEM/DER file or directory of certificates
- `ADE_IDENTITY_CERT_PATH`: Path to a PKCS#12 file
- `ADE_IDENTITY_CERT_PASSWORD`: Password for the PKCS#12 file (optional)

Handles:

- Single PEM file → extracts DER, base64 encodes
- Directory of `.pem`/`.crt`/`.cer`/`.der` files → loads all
- Missing paths → returns empty/null gracefully

### MDMPayloadBuilder

Generates the `com.apple.mdm` payload:

- Required: `ServerURL`, `CheckInURL`, `Topic`, `SignMessage`
- Boolean flags: `IsSupervised`, `IsMandatory`, `IsMDMRemovable`, `AwaitDeviceConfigured`
- Optional: `IdentityCertificateUUID` (references identity cert payload UUID)
- Optional: `AnchorCertificates` (array of base64 DER certs for TLS trust)
- Fixed: `AccessRights: 8191`, `UserIdentity: false`, `CheckInWhenRemoving: true`

### RootCAPayloadBuilder

Generates `com.apple.security.root` payloads for each root CA certificate.

- `PayloadContent`: Base64-encoded DER certificate data

### IdentityPayloadBuilder

Generates `com.apple.security.pkcs12` payload.

- Returns `{ payloadUuid, payload }` so the MDM payload can reference it
- `PayloadContent`: Base64-encoded PKCS#12 data

### PayloadAssembler

Combines all payloads in correct order:

1. Root CA certificate payloads (0 or more)
2. Identity certificate payload (0 or 1)
3. MDM payload (always 1)

Adds top-level profile keys:

- `PayloadContent`, `PayloadDescription`, `PayloadDisplayName`, `PayloadIdentifier`
- `PayloadOrganization`, `PayloadRemovalDisallowed`, `PayloadType`, `PayloadUUID`
- `PayloadVersion`, `TargetDeviceType: 5`
- Optional: `OrganizationDisplayName`, `SupportEmailAddress`, `SupportPhoneNumber`
- Optional: `Department`, `Language`, `Region`
- Optional: `SkipSetupItems`

### XMLSerializer

Converts the profile dictionary to valid XML plist.

- Proper XML escaping of all string values
- Balanced tag validation (`<dict>`/`</dict>`, `<array>`/`</array>`)
- Empty result detection

### ProfileSigner

Future-ready CMS/PKCS#7 detached signature wrapper.

- POC mode: returns unsigned XML
- Architecture supports future `CMSDetachedSignature` inclusion
- `wrapSignedContent()` method for signed profile assembly

## Supported SkipSetupItems

| Identifier          | Description                         |
| ------------------- | ----------------------------------- |
| `AppleID`           | Apple ID setup                      |
| `Appearance`        | Appearance settings                 |
| `Biometrics`        | Touch ID / Face ID                  |
| `Diagnostics`       | Diagnostic data                     |
| `DisplayTone`       | Display and tone                    |
| `FileVault`         | FileVault (macOS)                   |
| `ICDP`              | iCloud Data Protection (deprecated) |
| `ICloudStorage`     | iCloud storage                      |
| `Location`          | Location services                   |
| `Messages`          | iMessage/FaceTime                   |
| `MoveFromAndroid`   | Move from Android                   |
| `Onboarding`        | Onboarding screens                  |
| `Passcode`          | Passcode setup                      |
| `Payment`           | Apple Pay                           |
| `Privacy`           | Privacy settings                    |
| `Restore`           | Restore from backup                 |
| `RestoreCompleted`  | Restore completed                   |
| `ScreenTime`        | Screen Time                         |
| `Siri`              | Siri setup                          |
| `SoftwareUpdate`    | Software update                     |
| `TOS`               | Terms of service                    |
| `TrustCertificates` | Trust certificates                  |
| `WatchMigration`    | Watch migration                     |
| `Welcome`           | Welcome screen                      |
| `Zoom`              | Zoom display                        |

## Enrollment Status Lifecycle

```
pending → assigned → profile_generated → profile_delivered → enrollment_started
    │                                                         │
    └── failed (any step)                                     │
                                                              ▼
                                                authenticated → checkin_received
                                                                    │
                                                                    ▼
                                                              mdm_connection
                                                                    │
                                                                    ▼
                                                              device_configured → completed
                                                                    │
                                                                    └── failed
```

## Configuration

Key environment variables for the enrollment flow are documented in `.env.example`.

---

## NanoMDM: Using TLS Client Cert Instead of Mdm-Signature

If the device is not sending the `Mdm-Signature` header (log: `empty Mdm-Signature header` / `missing MDM certificate`), you can use TLS client certificate forwarding.

### 1. Enrollment Profile

Set `ADE_SIGN_MESSAGE=false` in `.env` (or uncomment in `.env.example`) to tell the device _not_ to sign MDM messages.

### 2. Apache mTLS + Header Forwarding

Require client certs on the `/mdm` location and forward the PEM to NanoMDM via header:

```apache
SSLVerifyClient optional_no_ca
SSLVerifyDepth 10

<Location /mdm>
    SSLVerifyClient require
    SSLVerifyDepth 10
    SSLOptions +StdEnvVars +ExportCertData
    RequestHeader set X-Client-Cert "%{SSL_CLIENT_CERT}s"
</Location>
```

### 3. NanoMDM Startup

Run NanoMDM with the `-cert-header` flag to read the device cert from the forwarded header instead of extracting it from `Mdm-Signature`:

```sh
nanomdm -cert-header X-Client-Cert ...
```

This tells NanoMDM to call `cert-extract` on the `X-Client-Cert` header value (the DER-decoded client cert from the proxy) rather than on the `Mdm-Signature` HTTP header. The device's built-in DEP identity certificate presented during TLS handshake is used for authentication.
