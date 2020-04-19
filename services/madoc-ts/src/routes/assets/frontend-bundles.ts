import { existsSync } from 'fs';
import { RouteMiddleware } from '../../types';
import * as path from 'path';
import send from 'koa-send';

export const frontendBundles: RouteMiddleware<{ slug: string; bundleId: string }> = async context => {
  if (context.params.bundleId.match(/\.\./)) {
    context.status = 404;
    return;
  }

  const bundle = path.resolve(
    __dirname,
    '..',
    '..',
    '..',
    'lib',
    'frontend',
    context.params.bundleId,
    'build',
    'bundle.js'
  );

  if (existsSync(bundle)) {
    await send(context, bundle, { root: '/' });
    return;
  }

  context.status = 404;
};
