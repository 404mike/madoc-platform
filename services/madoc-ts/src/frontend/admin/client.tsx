import React from 'react';
import { hydrate } from 'react-dom';
import AdminApp, { AdminAppProps } from './index';
import cookies from 'browser-cookies';
import { BrowserRouter } from 'react-router-dom';
import { api } from '../../gateway/api.browser';

const component = document.getElementById('admin-component');

const [, slug] = window.location.pathname.match(/s\/([^/]*)/) as string[];
const jwt = cookies.get(`madoc/${slug}`);

if (component && jwt) {
  const propScript = document.getElementById('admin-data');
  const { basename, ...props }: AdminAppProps & { basename: string } = propScript
    ? JSON.parse(propScript.innerText)
    : { tasks: [] };

  hydrate(
    <BrowserRouter basename={basename}>
      <AdminApp jwt={jwt} api={api} />
    </BrowserRouter>,
    component
  );
}
