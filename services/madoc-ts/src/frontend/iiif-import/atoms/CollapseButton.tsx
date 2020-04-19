import styled, { css } from 'styled-components';
import React, { useEffect, useState } from 'react';
import { CollapseIcon } from './CollapseIcon';

const CollapseButtonWrapper = styled.button<{ active?: boolean }>`
  background: #eee;
  width: 28px;
  height: 28px;
  margin: 0 4px;
  border-radius: 3px;
  transition: background 0.3s, border-color 0.3s;
  cursor: pointer;
  border: 2px solid #eee;
  &:hover,
  &:active {
    background: #ddd;
    border-color: #ddd;
  }
  &:focus {
    transition: background 0.3s;
    border: 2px solid #2879ff;
    outline: none;
  }
  svg {
    transition: transform 0.2s;
  }
  ${props =>
    props.active &&
    css`
      svg {
        transform: rotate(90deg);
      }
    `}
`;

export const CollapseButton: React.FC<{ onToggle?: (value: boolean) => void }> = ({ onToggle }) => {
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (onToggle) {
      onToggle(active);
    }
  }, [onToggle, active]);

  return (
    <CollapseButtonWrapper active={active} onClick={() => setActive(a => !a)}>
      <CollapseIcon />
    </CollapseButtonWrapper>
  );
};
