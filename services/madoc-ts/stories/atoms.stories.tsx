import * as React from 'react';
import { Button, SmallButton, TinyButton } from '../src/frontend/admin/atoms/Button';

export default { title: 'Atoms' };

export const buttons = () => (
  <div>
    <Button>Button</Button>
    <br />
    <br />
    <SmallButton>Small button</SmallButton>
    <br />
    <br />
    <TinyButton>Tiny button</TinyButton>
  </div>
);
