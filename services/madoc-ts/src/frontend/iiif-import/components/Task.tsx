import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { CollapseButton } from '../atoms/CollapseButton';
import { Status } from '../atoms/Status';
import { TaskName } from '../atoms/TaskName';
import { AvatarList } from '../atoms/AvatarList';
import { Author } from '../atoms/Author';
import { TypeLabel } from '../atoms/TypeLabel';
import { TaskRow } from '../atoms/TaskRow';
import { MetadataPair } from '../atoms/MetadataPair';
import { Collapse } from '../atoms/Collapse';
import { Detail } from '../atoms/Detail';
import { DetailList } from '../atoms/DetailList';
import { BaseTask } from '../../../tasks/base-task';
import { JwtContext } from '../index';
import { CodeBlock } from '../atoms/CodeBlock';
import { CollapseSection } from '../atoms/CollapseSection';
import { RenderState } from '../atoms/RenderState';
import { ReingestButton } from './ReingestButton';
import { SubtaskProgress } from '../atoms/SubtaskProgress';

export const Task: React.FC<Partial<BaseTask> & { hideDone?: boolean }> = ({ children, hideDone, ...props }) => {
  const [fullTask, setFullTask] = useState<BaseTask>();
  const [loading, setLoading] = useState(false);
  const jwt = useContext(JwtContext);

  const task: Partial<BaseTask> = fullTask ? fullTask : props;

  const authorName =
    fullTask && fullTask.creator ? (fullTask.creator.name ? fullTask.creator.name : fullTask.creator.id) : '';
  const [open, setIsOpen] = useState(false);
  const fetchFullTask = useCallback(() => {
    if (task.id) {
      setLoading(true);
      fetch(`/api/tasks/${task.id}`, {
        credentials: 'omit',
        headers: {
          Authorization: `Bearer ${jwt}`,
        },
      })
        .then(r => r.json())
        .then(setFullTask)
        .then(() => setLoading(false));
    }
  }, [jwt, task.id]);

  useEffect(() => {
    if (open && task.status !== 3 && task.status !== -1) {
      const interval = setInterval(() => {
        fetchFullTask();
      }, 5000);

      return () => {
        clearInterval(interval);
      };
    }
    return () => {
      // Nothing for this.
    };
  }, [fetchFullTask, open, task.status]);

  const onToggle = useCallback(
    value => {
      if (!fullTask && value) {
        fetchFullTask();
      }
      setIsOpen(value);
    },
    [fetchFullTask, fullTask]
  );

  const hasData =
    task.subject ||
    task.description ||
    (task.parameters && task.parameters.length > 0) ||
    (task.state && Object.keys(task.state).length > 0);

  const subtasks = task.subtasks || [];

  const [subtasksDone, subtasksProgress] = useMemo(() => {
    let done = 0;
    let progress = 0;
    for (const subtask of subtasks) {
      if (subtask.status === 3) {
        done++;
        continue;
      }
      if (subtask.status === 2 || subtask.status > 3) {
        progress++;
      }
    }
    return [done, progress];
  }, [subtasks]);

  return (
    <>
      <TaskRow open={open}>
        <CollapseButton onToggle={onToggle} />
        <Status status={task.status || 0} text={task.status_text || 'unknown'} />
        <TaskName>{task.name}</TaskName>
        {open && authorName && (
          <AvatarList>
            <Author title={authorName}>{authorName.slice(0, 1).toUpperCase()}</Author>
          </AvatarList>
        )}
        <TypeLabel>{task.type}</TypeLabel>
      </TaskRow>
      {open &&
        (loading && !hasData ? (
          <Detail small>Loading...</Detail>
        ) : hasData ? (
          <DetailList>
            {task.subject && (
              <MetadataPair label="Subject" href={task.subject}>
                {task.subject}
              </MetadataPair>
            )}
            {task.description && <MetadataPair label="Description">{task.description}</MetadataPair>}
            <MetadataPair label="State">
              <RenderState type={task.type} state={task.state} /> <ReingestButton task={task} />
            </MetadataPair>
            {(task.parameters || []).length > 0 && (
              <CollapseSection label="Parameters">
                <CodeBlock>{JSON.stringify(task.parameters, null, 4)}</CodeBlock>
              </CollapseSection>
            )}
            {Object.keys(task.state || {}).length > 0 && (
              <CollapseSection label="Raw state">
                <CodeBlock>{JSON.stringify(task.state, null, 4)}</CodeBlock>
              </CollapseSection>
            )}
            {subtasks.length > 0 ? (
              <>
                <SubtaskProgress total={subtasks.length} done={subtasksDone} progress={subtasksProgress}/>
                <CollapseSection label="Sub tasks" nested open>
                  {subtasks.map(t =>
                    hideDone && t.status === 3 ? null : <Task key={t.id} hideDone={hideDone} {...t} />
                  )}
                </CollapseSection>
              </>
            ) : null}
          </DetailList>
        ) : (
          <Detail small>No extra detail</Detail>
        ))}
      <div style={{ marginBottom: open ? 30 : 0, transition: 'margin-bottom .3s' }}></div>
    </>
  );
};
