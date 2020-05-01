import styled from 'styled-components';

export const TableContainer = styled.div`
  border: 1px solid #ddd;
  border-bottom: none;
  display: flex;
  flex-direction: column;
  margin: 1em 0;
`;

export const TableRow = styled.div`
  border-bottom: 1px solid #ddd;
  padding: 4px;
  font-size: 0.8em;
  align-items: center;
  display: flex;
  width: 100%;
  background: #fff;
`;

export const TableRowLabel = styled.div`
  margin-left: 10px;
`;

export const TableActions = styled.div`
  justify-self: flex-end;
  margin-left: auto;
`;
