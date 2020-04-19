import React, { MouseEvent, MouseEventHandler } from 'react';
import { CollapseIcon } from './CollapseIcon';
import { Detail } from './Detail';
import styled, { css } from 'styled-components';

const CollapseContainer = styled.div<{ active?: boolean }>`
  display: flex;
  height: 100%;
  cursor: pointer;
  align-items: center;
  &:hover {
    font-weight: bold;
  }
  svg {
    transition: transform 0.2s;
  }
  ${props =>
    props.active &&
    css`
      font-weight: bold;
      svg {
        transform: rotate(90deg);
      }
    `}
`;

const CollapseLabel = styled.div`
  font-size: 12px;
  margin-left: 10px;
`;

export const Collapse: React.FC<{ active?: boolean; label: string; onClick?: (e: MouseEvent) => void }> = ({
  label,
  active,
  onClick,
}) => (
  <Detail onClick={onClick}>
    <CollapseContainer active={active}>
      <CollapseIcon width={10} />
      <CollapseLabel>{label}</CollapseLabel>
    </CollapseContainer>
  </Detail>
);
