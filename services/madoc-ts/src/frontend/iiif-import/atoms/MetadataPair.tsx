import styled from 'styled-components';
import { Detail } from './Detail';
import React from 'react';

const Label = styled.div`
  font-weight: 600;
  font-size: 13px;
  text-decoration: none;
  margin-bottom: 4px;
  color: #000;
`;

const Value = styled.div`
  font-size: 13px;
  margin-bottom: 4px;
  text-decoration: none;
  color: #666;
`;

const NonInteractive = styled.div`
  padding-left: 16px;
`;

const Interactive = styled.div`
  background: #fff;
  border: 2px solid #eee;
  padding: 6px 14px 4px;
  border-radius: 5px;
  cursor: pointer;
  &:hover {
    border-color: #ddd;
  }
  &:focus,
  &:active {
    border-color: #2879ff;
  }
`;

export const MetadataPair: React.FC<{ label: string; href?: string }> = ({ href, label, children: value }) => {
  if (href) {
    return (
      <Detail as="a" href={href}>
        <Interactive>
          <Label>{label}</Label>
          <Value>{value}</Value>
        </Interactive>
      </Detail>
    );
  }
  return (
    <Detail>
      <NonInteractive>
        <Label>{label}</Label>
        <Value>{value}</Value>
      </NonInteractive>
    </Detail>
  );
};
