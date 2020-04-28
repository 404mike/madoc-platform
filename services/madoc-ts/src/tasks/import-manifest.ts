import { OmekaApi } from '../utility/omeka-api';
import { BaseTask } from './base-task';
import * as importCanvas from './import-canvas';
import * as tasks from './api';
import { api } from '../gateway/api.server';
import { Job } from 'bullmq';
import { Vault } from '@hyperion-framework/vault';
import { STATUS } from './api';
import fetch from 'node-fetch';
import { ImportCanvasTask } from './import-canvas';
import { createHash } from 'crypto';
import { entity, fromInternationalString, jsonMedia, url } from '../utility/field-value';
import { Resource, ResourceItem } from '../omeka/Resource';
import { mysql } from '../utility/mysql';
import { iiifGetLabel } from '../utility/iiif-get-label';
import { DatabasePoolType, sql } from 'slonik';
import mkdirp from 'mkdirp';
import { writeFileSync } from 'fs';

export const type = 'madoc-manifest-import';

export const status = [
  // 0 - not started
  'pending',
  // 1 - accepted
  'accepted',
  // 2 - in progress
  'waiting for canvases',
  // 3 - done
  'done',
  // 4+ custom
  'importing canvases',
] as const;

export interface ImportManifestTask extends BaseTask {
  type: 'madoc-manifest-import';
  parameters: [number];
  status: -1 | 0 | 1 | 2 | 3 | 4;
  state: {
    omekaId?: number;
    errorMessage?: string;
    isDuplicate?: boolean;
  };
}

export function createTask(manifestUrl: string, omekaUserId: number): ImportManifestTask {
  return {
    type: 'madoc-manifest-import',
    name: 'Importing manifest',
    description: `Importing manifest from url ${manifestUrl}`,
    subject: manifestUrl,
    state: {},
    events: [
      'madoc-ts.created',
      `madoc-ts.subtask_type_status.madoc-canvas-import.${importCanvas.status.indexOf('done')}`,
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

const ENABLE_POSTGRES = true;
const fileDirectory = process.env.OMEKA_FILE_DIRECTORY || '/home/node/app/omeka-files';

export const jobHandler = async (job: Job<{ taskId: string }>, omeka: OmekaApi, postgres: DatabasePoolType) => {
  switch (job.name) {
    case 'created': {
      // Vault for parsing IIIF
      const vault = new Vault();

      // Get the task.
      const task = await api.acceptTask<ImportManifestTask>(job.data.taskId);
      const [omekaUserId] = task.parameters;

      // 1. Fetch collection
      const text = await fetch(task.subject).then(r => r.text());
      const json = JSON.parse(text);
      const iiifManifest = await vault.loadManifest(task.subject, json);
      const idHash = createHash('sha1')
        .update(iiifManifest.id)
        .digest('hex');

      let item: any;
      let itemAlready: Resource | undefined;
      if (ENABLE_POSTGRES) {
        await postgres.transaction(async connection => {
          // 0. Write media to disk
          mkdirp.sync(`${fileDirectory}/original/madoc-manifests/${idHash}`);
          writeFileSync(`${fileDirectory}/original/madoc-manifests/${idHash}/manifest.json`, Buffer.from(text));

          // @todo item exists eqv.

          // 1. Insert into resource
          item = await connection.one<{ id: number }>(
            sql`insert into iiif_resource (type, source) VALUES ('manifest', ${iiifManifest.id}) RETURNING *`
          );

          // 2. Add metadata.
          const labels = fromInternationalString(iiifManifest.label);
          const atLeastOneLabel = labels.length ? labels : [{ value: 'Untitled manifest', lang: '@none' }];
          const metadata = [
            ...atLeastOneLabel.map(label => ({ key: 'label', value: label.value, language: label.lang || '@none' })),
            ...fromInternationalString(iiifManifest.summary).map(summary => ({
              key: 'summary',
              value: summary.value,
              language: summary.lang || '@none',
            })),
          ];

          if (metadata.length) {
            const inserts = metadata.map(
              value => sql`(
                ${value.key}, 
                ${value.value || ''}, 
                ${value.language}, 
                ${item.id},
                'iiif'
              )`
            );
            await connection.query(
              sql`insert into iiif_metadata (key, value, language, resource_id, source)
                  VALUES ${sql.join(inserts, sql`,`)}`
            );
          }
        });
      } else {
        // 3. Add manifest into Omeka.

        itemAlready = await omeka
          .one<Resource | undefined>(
            mysql`SELECT r.*
              FROM resource r
                       LEFT JOIN value v on r.id = v.resource_id
                       LEFT JOIN property p on v.property_id = p.id
              WHERE p.local_name = 'identifier'
                AND v.uri = ${iiifManifest.id}`
          )
          .catch(() => undefined);

        if (itemAlready) {
          await api.updateTask(
            task.id,
            changeStatus('done', {
              name: iiifGetLabel(iiifManifest.label),
              state: { omekaId: itemAlready.id, isDuplicate: !!itemAlready },
            })
          );
          return;
        }

        item = await omeka.createItemFromTemplate(
          'IIIF Manifest',
          ResourceItem,
          {
            'dcterms:title': fromInternationalString(iiifManifest.label),
            'dcterms:description': fromInternationalString(iiifManifest.summary),
            'dcterms:identifier': [url('Manifest URI', iiifManifest.id)],
            'dcterms:source': [
              jsonMedia(
                'Manifest source',
                `/madoc-manifests/${idHash}/manifest.json`,
                iiifManifest.id,
                Buffer.from(text)
              ),
            ],
          },
          omekaUserId
        );
      }

      // 4. Add sub tasks for manifests
      const subtasks: ImportCanvasTask[] = [];
      for (const canvasRef of iiifManifest.items) {
        if (canvasRef.type === 'Canvas') {
          subtasks.push(
            importCanvas.createTask(
              canvasRef.id,
              omekaUserId,
              `/madoc-manifests/${idHash}/manifest.json`,
              iiifManifest.id
            )
          );
        }
      }

      if (subtasks.length && task.id) {
        await api.addSubtasks(subtasks, task.id); // @todo make tasks API fifo
      }

      // 5. If no canvases, then mark as done
      if (subtasks.length === 0) {
        await api.updateTask(task.id, changeStatus('done'));
        return;
      }

      // 6. Set task to waiting for canvases
      await api.updateTask(
        task.id,
        changeStatus('waiting for canvases', {
          name: iiifGetLabel(iiifManifest.label),
          state: { omekaId: item.id, isDuplicate: !!itemAlready },
        })
      );

      break;
    }
    case `subtask_type_status.${importCanvas.type}.${STATUS.DONE}`: {
      // 0. Set task to processing manifests
      // 1. Update Omeka with manifest ids from sub tasks
      const task = await api.getTaskById<ImportManifestTask>(job.data.taskId);
      const [omekaUserId] = task.parameters;
      const subtasks = task.subtasks || [];

      if (!task.state.omekaId) {
        return;
      }

      if (ENABLE_POSTGRES) {
        const omekaId = task.state.omekaId;
        if (!omekaId) {
          await api.updateTask(job.data.taskId, changeStatus('error' as any));
          return;
        }

        const inserts = [];
        for (const subtask of subtasks) {
          if (subtask.type === importCanvas.type) {
            inserts.push(
              sql`(
                ${omekaId},
                ${subtask.state.omekaId},
                ${subtask.state.canvasOrder}
              )`
            );
          }
        }

        await postgres.query(
          sql`INSERT INTO iiif_resource_items (resource_id, item_id, item_index) VALUES ${sql.join(inserts, sql`,`)}`
        );
      } else {
        const fields = [];
        for (const subtask of subtasks) {
          if (subtask.type === importCanvas.type) {
            const omekaId = subtask.state.omekaId;
            fields.push(entity(omekaId, 'resource:item'));
          }
        }

        await omeka.updateItem(
          task.state.omekaId,
          {
            'sc:hasCanvases': fields,
          },
          omekaUserId
        );
      }

      await api.updateTask(job.data.taskId, changeStatus('done'));
      break;
    }
  }
};
