import { OmekaApi } from '../utility/omeka-api';
import { BaseTask } from './base-task';
import * as tasks from './api';
import { api } from '../gateway/api.server';
import { Job } from 'bullmq';
import { Vault } from '@hyperion-framework/vault';
import cache from 'memory-cache';
import { readFileSync, writeFileSync } from 'fs';
import { Canvas, CanvasNormalized, ManifestNormalized } from '@hyperion-framework/types';
import { Resource, ResourceItem } from '../omeka/Resource';
import { fromInternationalString, jsonMedia, url, urlMedia } from '../utility/field-value';
import { createHash } from 'crypto';
import { mysql } from '../utility/mysql';
import { iiifGetLabel } from '../utility/iiif-get-label';
import mkdirp from 'mkdirp';
import { DatabasePoolType, sql } from 'slonik';

export const type = 'madoc-canvas-import';

export const status = [
  // 0 - not started
  'pending',
  // 1 - accepted
  'accepted',
  // 2 - in progress
  'in progress',
  // 3 - done
  'done',
  // 4+ custom
  // ...
] as const;

export interface ImportCanvasTask extends BaseTask {
  type: 'madoc-canvas-import';
  parameters: [number, string, string];
  status: -1 | 0 | 1 | 2 | 3 | 4;
  state: {
    omekaId?: number;
    errorMessage?: string;
    isDuplicate?: boolean;
    canvasOrder?: number;
  };
}

export function createTask(
  canvasUrl: string,
  omekaUserId: number,
  pathToManifest: string,
  manifestId: string
): ImportCanvasTask {
  return {
    type: 'madoc-canvas-import',
    name: 'Importing canvas',
    description: `Importing canvas from url ${canvasUrl}`,
    subject: canvasUrl,
    state: {},
    events: ['madoc-ts.created'],
    status: 0,
    status_text: status[0],
    parameters: [omekaUserId, pathToManifest, manifestId],
  };
}

export function changeStatus<K extends any>(
  newStatus: typeof status[K] | 'error',
  data: { state?: any; name?: string; description?: string } = {}
) {
  return tasks.changeStatus(status, newStatus, data);
}

function loadManifest(file: string) {
  const fileFromCache = cache.get(file);
  if (fileFromCache) {
    const file1 = JSON.parse(fileFromCache);
    const file2 = JSON.parse(fileFromCache);
    return [file1, file2];
  }

  const manifestJson = readFileSync(OmekaApi.getFileDirectory(file)).toString('utf-8');
  cache.put(file, manifestJson, 300); // 5 minutes cache a manifest.
  const file1 = JSON.parse(manifestJson);
  const file2 = JSON.parse(manifestJson);

  return [file1, file2];
}

function sharedVault(manifestId: string): Vault {
  const oldVault = cache.get(`vault:${manifestId}`);
  if (oldVault) {
    return oldVault;
  }

  const vault = new Vault();
  cache.put(`vault:${manifestId}`, vault, 600); // 10 minutes cache for vault.
  return vault;
}

async function getThumbnail(vault: Vault, canvas: any) {
  try {
    return await vault.getThumbnail(
      canvas,
      {
        maxWidth: 650,
        maxHeight: 650,
      } as any,
      true
    );
  } catch (e) {
    return undefined;
  }
}

const ENABLE_POSTGRES = true;
const fileDirectory = process.env.OMEKA_FILE_DIRECTORY || '/home/node/app/omeka-files';

export const jobHandler = async (job: Job<{ taskId: string }>, omeka: OmekaApi, postgres: DatabasePoolType) => {
  switch (job.name) {
    case 'created': {
      try {
        // Accept and fetch the task.
        // @todo handle case where getting task fails, return job to queue.
        const task = await api.acceptTask<ImportCanvasTask>(job.data.taskId);

        // console.log('Loading manifest...');
        // 1. Load from disk.
        // @todo handle case where fetch fails, return job to queue?
        const [omekaUserId, pathToManifest, manifestId] = task.parameters;
        const [manifestJson, unmodifiedManifest] = loadManifest(pathToManifest);

        // console.log('Loading vault...');

        // Vault for parsing IIIF
        const vault = sharedVault(manifestId);

        // @todo wrap this up to be fail-safe with the above.

        const state = vault.getState();

        const manifestJsonId = manifestJson['@id'] ? manifestJson['@id'] : manifestJson.id;

        if (state.hyperion.requests[manifestId]) {
          // console.log('-> Found manifest');
          let times = 0;
          if (state.hyperion.requests[manifestId].loadingState === 'RESOURCE_LOADING') {
            while (times < 10) {
              if (state.hyperion.requests[manifestId].loadingState === 'RESOURCE_LOADING') {
                await new Promise(resolve => setTimeout(resolve, 1000));
              } else {
                break;
              }
              times++;
            }
          }
          if (state.hyperion.requests[manifestId].loadingState === 'RESOURCE_ERROR') {
            // console.log('-> Did errored manifest');
            // I don't know? Try again?
            await vault.loadManifest(manifestJsonId, manifestJson);
          }
        } else if (!state.hyperion.entities.Manifest[manifestJsonId]) {
          // console.log('-> Did not find manifest');
          await vault.loadManifest(manifestJsonId, manifestJson).catch(err => {
            // console.log(err);
          });
        }

        // console.log('Loading parsed manifest...');
        const manifest = vault.fromRef<ManifestNormalized>({ id: manifestId, type: 'Manifest' });

        // @todo handle case where canvas does not exist.
        const canvas = vault.fromRef<CanvasNormalized>({ id: task.subject, type: 'Canvas' });
        const idHash = createHash('sha1')
          .update(manifestId)
          .digest('hex');

        const idList = (manifest.items || []).map(ref => ref.id);
        const canvasOrder = idList.indexOf(canvas.id);
        // This could be improved.
        // @todo wrap with checks.
        const canvasJson = unmodifiedManifest.sequences[0].canvases.find((c: any) => c['@id'] === canvas.id);

        let item: any;
        let itemAlready: any;

        if (ENABLE_POSTGRES) {
          await postgres.transaction(async connection => {
            // 0. Write media to disk
            mkdirp.sync(`${fileDirectory}/original/madoc-manifests/${idHash}/canvases/`);
            writeFileSync(
              `${fileDirectory}/original/madoc-manifests/${idHash}/canvases/c${canvasOrder}.json`,
              Buffer.from(JSON.stringify(canvasJson))
            );

            // @todo item exists eqv.
            const thumbnail = await getThumbnail(vault, canvas);
            const thumbId = thumbnail && thumbnail.best && thumbnail.best.id ? thumbnail.best.id : undefined;

            // 1. Insert into resource
            item = await connection.one<{ id: number }>(
              sql`insert into iiif_resource (type, source, default_thumbnail) 
                    VALUES ('canvas', ${canvas.id}, ${thumbId || null}) RETURNING *`
            );

            // 2. Add metadata.
            const labels = fromInternationalString(canvas.label);
            const atLeastOneLabel = labels.length ? labels : [{ value: 'Untitled canvas', lang: '@none' }];
            const metadata = [
              ...atLeastOneLabel.map(label => ({ key: 'label', value: label.value, language: label.lang || '@none' })),
              ...fromInternationalString(canvas.summary).map(summary => ({
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
          // @todo move to itemWithIdentifier in Omeka
          itemAlready = await omeka
            .one<Resource | undefined>(
              mysql`SELECT r.*
              FROM resource r
                       LEFT JOIN value v on r.id = v.resource_id
                       LEFT JOIN property p on v.property_id = p.id
              WHERE p.local_name = 'identifier'
                AND v.uri = ${canvas.id}`
            )
            .catch(() => undefined);

          if (itemAlready) {
            await api.updateTask(
              task.id,
              changeStatus('done', {
                name: iiifGetLabel(canvas.label),
                state: { omekaId: itemAlready.id, canvasOrder, isDuplicate: true },
              })
            );
            return;
          }

          // @todo wrap this up, fallback to nothing.
          const thumbnail = await getThumbnail(vault, canvas);
          const thumbId = thumbnail && thumbnail.best && thumbnail.best.id ? thumbnail.best.id : undefined;

          if (thumbId) {
            // console.log(`Found thumb ${thumbId}`);
          }

          // console.log('Updating omeka...');

          // 3. Add collection into Omeka.
          item = await omeka.createItemFromTemplate(
            'IIIF Canvas',
            ResourceItem,
            {
              'dcterms:title': fromInternationalString(canvas.label),
              'dcterms:description': fromInternationalString(canvas.summary),
              'dcterms:identifier': [url('Canvas URI', canvas.id)],
              'foaf:thumbnail': [thumbId ? urlMedia('Thumbnail', thumbId) : undefined],
              'dcterms:source': [
                jsonMedia(
                  'Canvas source',
                  `/madoc-manifests/${idHash}/canvases/c${canvasOrder}.json`,
                  canvas.id,
                  Buffer.from(JSON.stringify(canvasJson))
                ),
              ],
            },
            omekaUserId
          );
        }

        // console.log('Updating task...');

        // 6. Set task to waiting for canvases
        await api.updateTask(
          task.id,
          changeStatus('done', {
            name: iiifGetLabel(canvas.label),
            state: { omekaId: item.id, canvasOrder },
          })
        );
      } catch (e) {
        // console.log(e);
        await api.updateTask(
          job.data.taskId,
          changeStatus('error', {
            state: { error: e.toString() },
          })
        );
      }

      // console.log('Done.');

      break;
    }
  }
};
