import styled, { css } from 'styled-components';

export const Button = styled.a<{ hollow?: boolean; warning?: boolean }>`
  display: inline-block;
  background: #333333;
  color: #fff;
  padding: 0.4em 0.8em;
  border-radius: 2px;
  margin-bottom: 0.3em;
  text-decoration: none;
  font-size: 0.9em;
  border: 2px solid #333;

  & ~ & {
    margin-left: 0.3em;
  }

  ${props =>
    props.warning
      ? css`
          background: #fff;
          font-weight: bold;
          color: #c07703;
          border: 2px solid #c07703;
        `
      : ''}

  ${props =>
    props.hollow
      ? css`
          background: #fff;
          font-weight: bold;
          color: #333;
          border: 2px solid #333;
        `
      : ''}
`;
