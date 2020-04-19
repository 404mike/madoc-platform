import React, { useEffect, useState } from 'react';
import { Task } from './Task';

export const AllTasks: React.FC = () => {
  const [tasks, setTasks] = useState<Array<{ id: string; name: string; type: string; status: number }>>([]);

  useEffect(() => {
    fetch('http://localhost:8888/api/tasks')
      .then(r => r.json())
      .then(r => setTasks(r));
  }, []);

  return (
    <div style={{ background: '#eee', height: '100vh', padding: 50 }}>
      {tasks.map(task => (
        <Task key={task.id} id={task.id} name={task.name} type={task.type} status={task.status} status_text="" />
      ))}
    </div>
  );
};
