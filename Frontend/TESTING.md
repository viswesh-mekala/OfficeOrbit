# Testing Guide

This project now has a layered test skeleton for Expo + EAS development:

- Jest unit tests for business logic and recoverable attendance failures
- Expo Router integration tests for notification deep-link params
- Maestro flows for authenticated dashboard smoke coverage
- EAS Workflow scaffolding for Android E2E builds

## Commands

Run unit and integration tests locally:

```bash
npm run test:ci
```

Watch mode during development:

```bash
npm run test
```

Generate coverage:

```bash
npm run test:coverage
```

Run the local Maestro smoke flow after installing the Maestro CLI and launching an Android emulator/device with the app installed:

```bash
npm run test:e2e:android
```

## What is covered automatically

The current Jest suite focuses on the reliability-critical logic:

- pending attendance recovery creation and de-duplication
- notification deep-link routing payloads
- auto check-in dwell failure recovery
- offline queue handoff for network failures
- Expo Router parsing of recovery params on `/dashboard`

These tests live under:

- `__tests__/services`
- `__tests__/router`

## What still needs device-level verification

Mocks cannot prove Android OS behaviors such as:

- geofence enter/exit delivery while the app is backgrounded
- dwell timing under real background scheduling
- swipe-away / terminated-app limitations
- notification tray presentation on physical devices
- OEM battery optimization interference

Use the Maestro flows plus manual emulator/device runs for those scenarios.

## Maestro flows

Tracked flows are in `.maestro/`:

- `authenticated-dashboard.yml`
  - signs in with `TEST_EMAIL` and `TEST_PASSWORD`
  - asserts the dashboard attendance slider is visible
- `recovery-banner-template.yml`
  - expects a pre-created pending recovery state
  - validates that the dashboard recovery banner is shown

Export credentials before running the authenticated flow locally.

PowerShell example:

```powershell
$env:TEST_EMAIL = "tester@example.com"
$env:TEST_PASSWORD = "secret"
maestro test .maestro/authenticated-dashboard.yml
```

## EAS Workflow

Android E2E workflow scaffold:

- `.eas/workflows/e2e-test-android.yml`

This uses the `e2e-test` profile in `eas.json`, which builds an internal Android APK for Maestro.

## Recommended next tests

When you expand this suite, prioritize:

1. Dashboard manual check-in failure cases with rendered UI
2. Attendance recovery banner interactions
3. Notification tap -> dashboard recovery dialog behavior
4. Emulator mock-location route tests for background geofence entry
