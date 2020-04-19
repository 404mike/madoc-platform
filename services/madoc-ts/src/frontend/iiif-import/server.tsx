// Fetch data
// Send data to component
// Render component to string
// Add inline script tag for bootstrapped data
import React from 'react';
import { renderToString } from 'react-dom/server';
import { api } from '../../gateway/api.server';
import IIIFImportPage from './index';
import { ServerStyleSheet } from 'styled-components';

export async function render({ jwt }: { jwt: string }) {
  const sheet = new ServerStyleSheet(); // <-- creating out stylesheet
  const tasks = await api.getTasks(jwt);

  const markup = renderToString(sheet.collectStyles(<IIIFImportPage tasks={tasks || []} />));
  const styles = sheet.getStyleTags(); // <-- getting all the tags from the sheet

  sheet.seal();

  return `
    ${styles}
    <div id="iiif-import-component">${markup}</div>
    <script crossorigin src="https://unpkg.com/react@16/umd/react.development.js"></script>
    <script crossorigin src="https://unpkg.com/react-dom@16/umd/react-dom.development.js"></script>
    <script type="application/json" id="iiif-import-data">${JSON.stringify({ tasks })}</script>
  `;
}
