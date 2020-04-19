import React from 'react';
import { hydrate } from 'react-dom';
import IIIFImportPage, { IIIFImportPageProps } from './index';
import cookies from 'browser-cookies';

const component = document.getElementById('iiif-import-component');

const [, slug] = window.location.pathname.match(/s\/([^/]*)/) as string[];
const jwt = cookies.get(`madoc/${slug}`);

if (component && jwt) {
  const propScript = document.getElementById('iiif-import-data');
  const props: IIIFImportPageProps = propScript ? JSON.parse(propScript.innerText) : { tasks: [] };

  hydrate(<IIIFImportPage {...props} jwt={jwt} />, component);
}
