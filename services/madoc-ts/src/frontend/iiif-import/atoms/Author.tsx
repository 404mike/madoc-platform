import styled from 'styled-components';

import ColorHash from 'color-hash';

const hash = new ColorHash({ saturation: 0.7, lightness: 0.8 });
const hash2 = new ColorHash({ saturation: 1, lightness: 0.2 });

export const Author = styled.button<{ title: string }>`
  border-radius: 50%;
  background-color: ${props => hash.hex(props.title)};
  color: ${props => hash2.hex(props.title)};
  font-weight: bold;
  text-align: center;
  line-height: 22px;
  height: 28px;
  width: 28px;
  font-size: 12px;
  border: 2px solid #fff;
  transition: border-color 0.3s;
  user-select: none;
  &:active,
  &:focus {
    transition: none;
    border-color: ${props => hash2.hex(props.title)};
    outline: none;
  }
`;
