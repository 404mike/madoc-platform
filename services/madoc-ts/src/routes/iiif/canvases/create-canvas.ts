import { RouteMiddleware } from '../../../types';
import { userWithScope } from '../../../utility/user-with-scope';
import { sql } from 'slonik';

// @todo return full canvas.
export const createCanvas: RouteMiddleware = async context => {
  const { userUrn, siteId } = userWithScope(context, ['site.admin']);

  const canvasJson = JSON.stringify(context.requestBody.canvas);
  const localSource = context.requestBody.local_source;
  const thumbnail = context.requestBody.thumbnail || null;

  // create_canvas(canvas json, local_source text, thumbnail text, sid integer, extra_context text, added_by text)
  const { canonical_id } = await context.connection.one<{ derived_id: number; canonical_id: number }>(
    sql`select * from create_canvas(${canvasJson}, ${
      localSource ? localSource : null
    }, ${thumbnail}, ${siteId}, null, ${userUrn})`
  );

  context.response.body = { id: canonical_id };
  context.response.status = 201;
};
