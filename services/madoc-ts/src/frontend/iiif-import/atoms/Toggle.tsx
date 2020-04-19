import styled from 'styled-components';
import React, { useState } from 'react';

const ToggleContainer = styled.div`
  width: 38px;
  height: 22px;
  padding: 2px;
  border-radius: 11px;
  border: 1px solid #ddd;
`;

const ToggleBall = styled.div<{ active?: boolean }>`
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: ${props => (props.active ? 'green' : 'red')};
  transform: translateX(${props => (props.active ? '16px' : '0px')});
`;

export const Toggle: React.FC<{ onChange: (value: boolean) => void; value: boolean }> = ({ value, onChange }) => {
  const [active, setActive] = useState(value);

  return (
    <ToggleContainer
      onClick={() => {
        setActive(a => !a);
        onChange(!active);
      }}
    >
      <ToggleBall active={active} />
    </ToggleContainer>
  );
};
