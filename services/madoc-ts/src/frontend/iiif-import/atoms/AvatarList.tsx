import styled from 'styled-components';

export const AvatarList = styled.div`
  button {
    position: relative;
  }
  & > button ~ button {
    margin-left: -13px;
    transition: border-color 0.3s, margin-left 0.3s;
    &:focus {
      transition: margin-left 0.3s;
    }
  }
  &:hover > button ~ button {
    margin-left: 3px;
  }
`;
