# webext-core - Job Scheduler

Package: `@webext-core/job-scheduler`

Schedule recurring and one-time background jobs backed by the browser Alarms API. Jobs survive extension restarts because alarms persist across service worker lifetimes.

Requires the `alarms` permission in `manifest.json`.

## Setup

```ts
import { defineJobScheduler } from '@webext-core/job-scheduler';

export const scheduler = defineJobScheduler();
```

Call `scheduler.scheduleJob(...)` inside the **background script**.

## `scheduleJob(job)`

Schedules a job. If a job with the same `id` was already scheduled and the configuration has changed, it updates the existing alarm.

```ts
await scheduler.scheduleJob(job);
```

## `removeJob(jobId)`

Cancels and removes a scheduled job by its ID.

```ts
await scheduler.removeJob('my-job');
```

## Job Types

### Interval — Repeating at a Fixed Duration

```ts
import { defineJobScheduler } from '@webext-core/job-scheduler';

const scheduler = defineJobScheduler();

await scheduler.scheduleJob({
  id: 'sync-data',
  type: 'interval',
  duration: 30 * 60 * 1000, // 30 minutes in milliseconds
  execute: async () => {
    await syncDataFromServer();
  },
});
```

Set `immediate: true` to execute the job immediately when first scheduled (has no effect on updates to an existing job):

```ts
await scheduler.scheduleJob({
  id: 'startup-sync',
  type: 'interval',
  duration: 15 * 60 * 1000,
  immediate: true,
  execute: async () => { /* ... */ },
});
```

### Cron — Expression-Based Schedule

Backed by `cron-parser`. See [supported expressions](https://github.com/harrisiirak/cron-parser#supported-format).

```ts
await scheduler.scheduleJob({
  id: 'daily-cleanup',
  type: 'cron',
  expression: '0 2 * * *', // 2:00 AM every day
  execute: async () => {
    await cleanupOldData();
  },
});
```

`CronJob` extends `cron-parser`'s `ParserOptions`, so you can pass options like `tz` (timezone):

```ts
await scheduler.scheduleJob({
  id: 'nightly',
  type: 'cron',
  expression: '0 0 * * *',
  tz: 'America/New_York',
  execute: async () => { /* ... */ },
});
```

### Once — Runs a Single Time

```ts
await scheduler.scheduleJob({
  id: 'onboarding-reminder',
  type: 'once',
  date: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
  execute: async () => {
    await showOnboardingReminder();
  },
});
```

`date` accepts a `Date`, a date string, or a numeric timestamp. If the date is in the past, the job is not scheduled.

## 1-Minute Minimum Interval Constraint

The browser Alarms API enforces a **minimum firing interval of 1 minute**. Intervals shorter than 60,000 ms are silently rounded up to 1 minute. This applies to both `interval` jobs (via `duration`) and `cron` expressions.

```ts
// This fires at most once per minute, not every 10 seconds
await scheduler.scheduleJob({
  id: 'fast-poll',
  type: 'interval',
  duration: 10_000, // effectively 60_000
  execute: () => poll(),
});
```

## Event Handlers: `on('success')` and `on('error')`

Listen for job outcomes. Returns a `RemoveListenerFn`:

```ts
const removeSuccess = scheduler.on('success', (job, result) => {
  console.log(`Job "${job.id}" succeeded with result:`, result);
});

const removeError = scheduler.on('error', (job, error) => {
  console.error(`Job "${job.id}" failed:`, error);
});

// Unsubscribe later
removeSuccess();
removeError();
```

## Logger Config

Suppress or customize logging:

```ts
const scheduler = defineJobScheduler({
  logger: null, // Disable all logging
});

const scheduler2 = defineJobScheduler({
  logger: myCustomLogger, // Must implement: debug, log, warn, error
});
```

## Full Background Script Example

```ts
// background.ts
import { defineJobScheduler } from '@webext-core/job-scheduler';

const scheduler = defineJobScheduler();

scheduler.on('error', (job, err) => {
  console.error(`[scheduler] Job "${job.id}" failed:`, err);
});

await scheduler.scheduleJob({
  id: 'hourly-sync',
  type: 'interval',
  duration: 60 * 60 * 1000, // 1 hour
  immediate: true,
  execute: async () => {
    const data = await fetch('https://api.example.com/data').then(r => r.json());
    await browser.storage.local.set({ lastSync: Date.now(), data });
  },
});

await scheduler.scheduleJob({
  id: 'weekly-report',
  type: 'cron',
  expression: '0 9 * * 1', // Monday at 9:00 AM
  execute: async () => {
    await sendWeeklyReport();
  },
});
```
