import styled from 'styled-components';

export const CroppedImage = styled.div`
  background: #4e4e4e;
  width: 100px;
  height: 100px;
  display: flex;
  justify-content: center;
  align-items: center;
  overflow: hidden;
  img {
    display: inline-block;
    object-fit: contain;
    flex-shrink: 0;
    width: 100%;
    height: 100%;
  }
`;
