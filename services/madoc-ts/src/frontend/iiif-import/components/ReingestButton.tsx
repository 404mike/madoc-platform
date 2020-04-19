import React, { useCallback, useContext } from 'react';
import { BaseTask } from '../../../tasks/base-task';
import { JwtContext } from '../index';
import { Button } from '../atoms/Button';

export const ReingestButton: React.FC<{ task: Partial<BaseTask> }> = ({ task }) => {
  const jwt = useContext(JwtContext);
  const reingest = useCallback(() => {
    if (task.status !== 0) {
      fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        credentials: 'omit',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify({
          status: 0,
        }),
      });
    }
  }, [jwt, task]);

  return task.status !== 0 ? <Button onClick={reingest}>Reingest</Button> : null;
};
