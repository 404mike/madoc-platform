import React from 'react';
import { Button } from './Button';
import { ErrorBar } from './ErrorBar';
import { ErrorIcon } from './ErrorIcon';

export const RenderState: React.FC<{ state: any; type?: string }> = ({ state, type }) => {
  if (!state) {
    return null;
  }

  const { isDuplicate, omekaId, error } = state;

  return (
    <>
      {error ? (
        <ErrorBar>
          <ErrorIcon height={16} inline />
          {error}
        </ErrorBar>
      ) : null}
      {isDuplicate ? <Button warning>Duplicate</Button> : null}
      {omekaId ? (
        <Button
          href={`/admin/${type === 'madoc-collection-import' ? 'item-set' : 'item'}/${omekaId}`}
          rel="noreferrer noopener"
          target="_blank"
        >
          Open in Omeka
        </Button>
      ) : null}
    </>
  );
};
