import { BaseTask } from './base-task';

export const STATUS = {
  NOT_STARTED: 0,
  ACCEPTED: 1,
  IN_PROGRESS: 2,
  DONE: 3,
};

export function changeStatus<Task extends BaseTask>(
  availableStatuses: any,
  newStatus: string,
  data: { state?: any; name?: string; description?: string } = {}
): Partial<Task> {
  const statusIdx = availableStatuses.indexOf(newStatus);

  return {
    status: statusIdx,
    status_text: statusIdx === -1 ? 'error' : availableStatuses[statusIdx],
    ...data,
  } as Partial<Task>;
}
