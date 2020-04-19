// Status
// Name of task
// Assignee
// Event type
import styled from 'styled-components';

export const TaskRow = styled.div<{ open?: boolean }>`
  background: #fff;
  padding: 4px;
  display: flex;
  width: 100%;
  height: 40px;
  align-items: center;
`;
