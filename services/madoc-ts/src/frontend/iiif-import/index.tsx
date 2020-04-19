import React, { useState } from 'react';
import { BaseTask } from '../../tasks/base-task';
import { Task } from './components/Task';
import { Toggle } from './atoms/Toggle';

export type IIIFImportPageProps = {
  tasks: Array<BaseTask>;
  jwt?: string;
};

export const JwtContext = React.createContext('');

const IIIFImportPage: React.FC<IIIFImportPageProps> = ({ jwt, tasks }) => {
  const [hide, setHide] = useState(false);
  return (
    <JwtContext.Provider value={jwt || ''}>
      <div style={{ padding: 50 }}>
        <h1>Tasks</h1>
        <div>
          Hide done: <Toggle onChange={setHide} value={hide} />
        </div>
        {tasks.map(task => (hide && task.status === 3 ? null : <Task key={task.id} hideDone={hide} {...task} />))}
      </div>
    </JwtContext.Provider>
  );
};

export default IIIFImportPage;
