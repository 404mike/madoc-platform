import styled, { css } from 'styled-components';
import { TaskRow } from './TaskRow';

export const Detail = styled.div<{ small?: boolean; nested?: boolean }>`
  background: ${props => (props.nested ? 'transparent' : '#fff')};
  padding: 8px 12px;
  position: relative;
  text-decoration: none;
  color: inherit;

  ${props =>
    props.small
      ? css`
          font-size: 12px;
          text-align: center;
          color: #999;
          padding: 15px;
        `
      : ''}

  ${props =>
    props.nested
      ? css`
          &:hover {
            & > ${TaskRow}:after, &:before {
              background: #b3bfef;
            }
          }

          margin: 8px 0px 8px 30px;
          padding: 0;
          & > ${TaskRow}:after {
            content: '';
            background: #d8d8d8;
            transition: background-color 0.3s;
            height: 4px;
            width: 16px;
            position: absolute;
            left: -16px;
            //bottom: 18px;
          }
          &:before {
            content: '';
            position: absolute;
            width: 4px;
            //height: 100%;
            box-sizing: content-box;
            transition: background-color 0.3s;
            padding-top: 0;
            top: -8px;
            background: #d8d8d8;
            bottom: 18px;
            left: -16px;
          }
        `
      : ''}
`;
