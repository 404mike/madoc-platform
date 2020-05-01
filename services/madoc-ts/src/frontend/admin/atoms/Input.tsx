import styled from 'styled-components';

export const InputLabel = styled.label`
  font-size: 0.9em;
  font-weight: bold;
  margin-bottom: 0.5em;
`;

export const Input = styled.input`
  background: #fff;
  border: 2px solid #999;
  padding: 0.5em;
  font-size: 0.9em;
  line-height: 1.3em;
  &:focus {
    border-color: #333;
    outline: none;
  }
`;

export const InputContainer = styled.div`
  display: flex;
  flex-direction: column;
  max-width: 360px;
  margin: 0.5em 0;
`;

export const InputLink = styled.a`
  margin: 0.5em 0;
  font-size: 0.75em;
  color: #5071f4;
`;
