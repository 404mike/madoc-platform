import React, { useState } from 'react';
import { UniversalComponent } from '../../../types';
import { useHistory } from 'react-router-dom';
import { useApi } from '../../index';

export const CreateCollection: UniversalComponent<{}> = () => {
  const api = useApi();
  const [label, setLabel] = useState('');
  const [summary, setSummary] = useState('');
  const [loading, setLoading] = useState(false);
  const history = useHistory();

  const onSave = () => {
    setLoading(true);

    api.createCollection({ label: { en: [label] }, summary: { en: [summary] } }).then(r => {
      history.push(`/collections/${r.id}`);
    });
  };

  return (
    <div>
      <h1>Create collection</h1>
      <label>Label</label>
      <input type="text" disabled={loading} value={label} onChange={e => setLabel(e.currentTarget.value)} />

      <label>Summary</label>
      <input type="text" disabled={loading} value={summary} onChange={e => setSummary(e.currentTarget.value)} />

      <button onClick={onSave}>Create</button>
    </div>
  );
};

CreateCollection.getData = async () => {
  return {};
};
