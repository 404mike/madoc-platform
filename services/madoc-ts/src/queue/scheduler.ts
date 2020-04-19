import { QueueScheduler, QueueSchedulerOptions } from 'bullmq';
import { QueueEvents } from 'bullmq';

const configOptions: QueueSchedulerOptions = {
  connection: {
    host: process.env.REDIS_HOST,
    db: 2,
  },
};

const scheduler = new QueueScheduler('madoc-ts', configOptions);
const queueEvents = new QueueEvents('madoc-ts', configOptions);

queueEvents.on('completed', jobId => {
  console.log('done', jobId);
});

queueEvents.on('failed', (jobId, err) => {
  console.error('error', jobId, err);
});

queueEvents.on('waiting', ({ jobId }) => {
  console.log(`A job with ID ${jobId} is waiting`);
});

console.log(`Scheduler ${scheduler.name} starting...`);
scheduler
  .waitUntilReady()
  .then(() => {
    console.log(`Scheduler ${scheduler.name} started...`);
  })
  .catch(e => {
    console.log(e);
    console.log(`Scheduler ${scheduler.name} error`);
  });
