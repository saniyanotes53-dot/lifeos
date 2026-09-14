import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('TimetableScreen has no stale references to requestPerm', () => {
  const timetableSource = readFileSync(new URL('../src/components/TimetableScreen.jsx', import.meta.url), 'utf8');
  assert.equal(timetableSource.includes('requestPerm'), false, 'TimetableScreen.jsx must not reference requestPerm');
  assert.equal(timetableSource.includes('onClick={requestPerm}'), false, 'TimetableScreen.jsx must not have onClick={requestPerm}');
});

test('TimetableScreen implements browser push states and derived backgroundPushOn', () => {
  const timetableSource = readFileSync(new URL('../src/components/TimetableScreen.jsx', import.meta.url), 'utf8');

  // Verify handlers are defined and used
  assert.ok(timetableSource.includes('handleEnablePush'), 'handleEnablePush must be present');
  assert.ok(timetableSource.includes('handleDisablePush'), 'handleDisablePush must be present');
  assert.ok(timetableSource.includes('toggleInAppReminders'), 'toggleInAppReminders must be present');
  assert.ok(timetableSource.includes('remindersOn'), 'remindersOn must be present');
  assert.ok(timetableSource.includes('backgroundPushOn'), 'backgroundPushOn must be defined');

  // Verify all 4 required banner messages
  assert.ok(
    timetableSource.includes('Browser reminders are on. Chrome can notify you even when Life OS is closed.'),
    'State "on" message must match specification'
  );
  assert.ok(
    timetableSource.includes('Enable Chrome notifications to receive reminders even when Life OS is closed.'),
    'State "off" message must match specification'
  );
  assert.ok(
    timetableSource.includes('Chrome notifications are blocked for Life OS. Open Chrome site settings → Notifications → Allow.'),
    'State "denied" message must match specification'
  );
  assert.ok(
    timetableSource.includes('Background browser notifications are not supported by this browser.'),
    'State "unsupported" message must match specification'
  );

  // Verify buttons and handlers for each state
  assert.ok(timetableSource.includes('onClick={handleDisablePush}'), 'Disable button must call handleDisablePush');
  assert.ok(timetableSource.includes('onClick={handleEnablePush}'), 'Enable Chrome notifications must call handleEnablePush');
  assert.ok(timetableSource.includes('Blocked'), 'Blocked button must be present for denied state');
  assert.ok(timetableSource.includes('Unsupported'), 'Unsupported button must be present for unsupported state');
  assert.ok(timetableSource.includes('onClick={toggleInAppReminders}'), 'In-app reminder toggle must call toggleInAppReminders');
});

test('ScreenErrorBoundary provides defensive fallback and navigation reset', () => {
  const boundarySource = readFileSync(new URL('../src/components/ScreenErrorBoundary.jsx', import.meta.url), 'utf8');

  assert.ok(boundarySource.includes('Something went wrong while loading this screen.'), 'Fallback UI message must match');
  assert.ok(boundarySource.includes('Return to Dashboard'), 'Return to Dashboard button must be present');
  assert.ok(boundarySource.includes('Reload Life OS'), 'Reload Life OS button must be present');
  assert.ok(boundarySource.includes('console.error'), 'Must log caught error with console.error');
  assert.ok(!boundarySource.includes('error.stack'), 'Must not expose stack traces to users');
  assert.ok(boundarySource.includes('componentDidCatch'), 'Must implement componentDidCatch');
  assert.ok(boundarySource.includes('getDerivedStateFromError'), 'Must implement getDerivedStateFromError');
});

test('App.jsx wraps screen views in ScreenErrorBoundary without interfering with auth', () => {
  const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');

  assert.ok(appSource.includes('import ScreenErrorBoundary from "./components/ScreenErrorBoundary"'), 'App.jsx must import ScreenErrorBoundary');
  assert.ok(appSource.includes('<ScreenErrorBoundary'), 'App.jsx must wrap screens in ScreenErrorBoundary');
  assert.ok(appSource.includes('resetKey={tab}'), 'ScreenErrorBoundary must receive resetKey');
  assert.ok(appSource.includes('onReturnToDashboard='), 'ScreenErrorBoundary must handle onReturnToDashboard');
});

test('Production timetable source has zero stale requestPerm references across all variants', () => {
  const timetableSrc = readFileSync(new URL('../src/components/TimetableScreen.jsx', import.meta.url), 'utf8');
  assert.equal(timetableSrc.includes('requestPerm'), false);
  const lifeosTimetableSrc = readFileSync(new URL('../lifeos/src/components/TimetableScreen.jsx', import.meta.url), 'utf8');
  assert.equal(lifeosTimetableSrc.includes('requestPerm'), false);
});
