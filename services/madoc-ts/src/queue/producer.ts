import { Worker, WorkerOptions } from 'bullmq';

import * as manifest from '../tasks/import-manifest';
import * as collection from '../tasks/import-collection';
import * as canvas from '../tasks/import-canvas';
import { OmekaApi } from '../utility/omeka-api';
import { createMysqlPool } from '../database/create-mysql-pool';
import { createPostgresPool } from '../database/create-postgres-pool';

const configOptions: WorkerOptions = {
  connection: {
    host: process.env.REDIS_HOST,
    db: 2,
  },
  concurrency: 2,
};

const mysqlPool = createMysqlPool();

const worker = new Worker(
  'madoc-ts',
  async job => {
    console.log('starting job..', job.id);

    try {
      const postgres = createPostgresPool();
      const omeka = new OmekaApi(mysqlPool);
      switch (job.data.type) {
        case collection.type:
          return await collection.jobHandler(job, omeka, postgres).catch(err => {
            throw err;
          });
        case manifest.type:
          return await manifest.jobHandler(job, omeka, postgres).catch(err => {
            throw err;
          });
        case canvas.type:
          return await canvas.jobHandler(job, omeka, postgres).catch(err => {
            throw err;
          });
      }
    } catch (e) {
      console.log(e);
      await job.retry('failed');
    }

    // switch (job.name) {
    //   case 'subtask_type_status.type-a.1':
    //     console.log('ALL TASKS ARE of type A are at status 1');
    //     break;
    //
    //   case 'created': {
    //     console.log('Fetching task...');
    //     const fullTask = await getTaskById(job.data.taskId);
    //     console.log('Task ID created', fullTask);
    //     break;
    //   }
    // }
    //
    // // Artificial timeout.
    // await new Promise(resolve => setTimeout(resolve, 1000));
  },
  configOptions
);

console.log(`Worker ${worker.name} started...`);
