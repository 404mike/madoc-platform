import { Collapse } from './Collapse';
import React, { useState } from 'react';
import { Detail } from './Detail';

export const CollapseSection: React.FC<{ label: string; nested?: boolean; open?: boolean }> = ({
  label,
  nested,
  open = false,
  children,
}) => {
  const [isOpen, setIsOpen] = useState(open);

  return (
    <>
      <Collapse label={label} active={isOpen} onClick={() => setIsOpen(o => !o)} />
      {isOpen ? <Detail nested={nested}>{children}</Detail> : null}
    </>
  );
};
