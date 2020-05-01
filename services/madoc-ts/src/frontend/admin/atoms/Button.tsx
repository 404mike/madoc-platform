import styled from 'styled-components';

export const Button = styled.button`
  cursor: pointer;
  font-size: 16px;
  line-height: 22px;
  padding: 3px 10px;
  background: #333;
  color: #fff;
  border: 2px solid #333;
  border-bottom-width: 3px;
  text-decoration: none;
  &:focus {
    outline: 2px solid #42a0db;
  }
`;

export const SmallButton = styled(Button)`
  font-size: 14px;
  line-height: 18px;
  padding: 3px 10px;
`;

export const TinyButton = styled(Button)`
  font-size: 12px;
  line-height: 14px;
  padding: 2px 10px;
`;

export const ButtonRow = styled.div`
  margin: 1em 0;
  ${Button} ~ ${Button} {
    margin-left: .5em;
  }
`;
