import React from 'react';
import { UniversalComponent } from '../../types';

const Homepage: UniversalComponent<{ name: string }, { jwt: string }> = ({ name }) => {
  return <h1>Hello {name}</h1>;
};

Homepage.getData = async (params, api) => {
  return {
    name: 'Someone',
  };
};

export { Homepage };
