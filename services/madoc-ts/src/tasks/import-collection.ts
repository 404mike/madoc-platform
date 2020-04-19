import { OmekaApi } from '../utility/omeka-api';
import { BaseTask } from './base-task';
import * as importManifest from './import-manifest';
import * as tasks from './api';
import { Job } from 'bullmq';
import { Vault } from '@hyperion-framework/vault';
import { api } from '../gateway/api.server';
import { STATUS } from './api';
import fetch from 'node-fetch';
import { entity, fromInternationalString, url } from '../utility/field-value';
import { ImportManifestTask } from './import-manifest';
import { ResourceItemSet } from '../omeka/Resource';
import { iiifGetLabel } from '../utility/iiif-get-label';

export const type = 'madoc-collection-import';

export const status = [
  // 0 - not started
  'pending',
  // 1 - accepted
  'accepted',
  // 2 - in progress
  'waiting for manifests',
  // 3 - done
  'done',
  // 4+ custom
  'importing manifests',
] as const;

export interface ImportCollectionTask extends BaseTask {
  type: 'madoc-collection-import';
  parameters: [number];
  status: -1 | 0 | 1 | 2 | 3 | 4;
  state: {
    omekaId?: number;
    errorMessage?: string;
    isDuplicate?: boolean;
  };
}

export function createTask(collectionUrl: string, omekaUserId: number): ImportCollectionTask {
  return {
    type: 'madoc-collection-import',
    name: 'Importing collection',
    description: `Importing collection from url ${collectionUrl}`,
    subject: collectionUrl,
    state: {},
    events: [
      'madoc-ts.created',
      `madoc-ts.subtask_type_status.madoc-manifest-import.${importManifest.status.indexOf('done')}`,
    ],
    status: 0,
    status_text: status[0],
    parameters: [omekaUserId],
  };
}

export function changeStatus<K extends any>(
  newStatus: typeof status[K],
  data: { state?: any; name?: string; description?: string } = {}
) {
  return tasks.changeStatus(status, newStatus, data);
}

export const jobHandler = async (job: Job<{ taskId: string }>, omeka: OmekaApi) => {
  console.log('Starting collection parsing');
  switch (job.name) {
    case 'created': {
      console.log('collection.created');
      // Vault for parsing IIIF
      const vault = new Vault();

      // Get the task.
      const task = await api.acceptTask<ImportCollectionTask>(job.data.taskId);
      console.log('Fetched full task and accepted -> ', task.status, task.status_text);

      const [omekaUserId] = task.parameters;

      // 1. Fetch collection
      const json = await fetch(task.subject).then(r => r.json());
      const iiifCollection = await vault.loadCollection(task.subject, json);

      // 2. Add collection into Omeka.
      // @todo check if collection is already there.
      const item = await omeka.createItemFromTemplate(
        'IIIF Collection',
        ResourceItemSet,
        {
          'dcterms:title': fromInternationalString(iiifCollection.label),
          'dcterms:description': fromInternationalString(iiifCollection.summary),
          'dcterms:identifier': [url(iiifCollection.id, 'Collection URI')],
        },
        omekaUserId
      );

      // To save media:
      // - Save to disk under `files/original/{folder}`
      // - Add to media table, with storage id prefixed with that folder
      // - Save to value table
      //
      // Naming:
      // - files/original/madoc-manifests/{sha1-manifest-id}/manifest.json
      // - files/original/madoc-manifests/{sha1-manifest-id}/canvases/c0.json
      // Even if manifest path is imported, we will create the canvases.
      // Canvases have predicable paths.
      // They describe the original source order, and could be different from the CMS.

      // 3. Add sub tasks for manifests
      const subtasks: Array<ImportManifestTask | ImportCollectionTask> = [];
      for (const manifestRef of iiifCollection.items) {
        if (manifestRef.type === 'Manifest') {
          subtasks.push(importManifest.createTask(manifestRef.id, omekaUserId));
        }
        if (manifestRef.type === 'Collection') {
          subtasks.push(createTask(manifestRef.id, omekaUserId));
        }
      }

      if (subtasks.length && task.id) {
        await api.addSubtasks<ImportManifestTask | ImportCollectionTask>(subtasks, task.id);
      }

      // 4. If no manifests, then mark as done
      if (subtasks.length === 0) {
        await api.updateTask(task.id, changeStatus('done'));
        return;
      }

      // 5. Set task to waiting for manifests
      await api.updateTask(
        task.id,
        changeStatus('waiting for manifests', {
          name: iiifGetLabel(iiifCollection.label),
          state: {
            omekaId: item.id,
          },
        })
      );

      break;
    }
    case `subtask_type_status.${importManifest.type}.${STATUS.DONE}`: {
      // 1. Update Omeka with manifest ids from sub tasks
      const task = await api.getTaskById<ImportCollectionTask>(job.data.taskId);
      const [omekaUserId] = task.parameters;
      const subtasks = task.subtasks || [];

      if (!task.state.omekaId) {
        return;
      }

      const fields = [];
      const ids = [];

      for (const subtask of subtasks) {
        if (subtask.type === importManifest.type) {
          const omekaId = subtask.state.omekaId;
          console.log('Found of type', omekaId);
          if (ids.indexOf(omekaId) === -1) {
            fields.push(entity(omekaId, 'resource:item'));
            ids.push(omekaId);
          }
        }
      }

      if (fields.length) {
        await omeka.updateItem(
          task.state.omekaId,
          {
            'sc:hasManifests': fields,
          },
          omekaUserId
        );
      }
      await api.updateTask(job.data.taskId, changeStatus('done'));
      break;
    }
  }
};
