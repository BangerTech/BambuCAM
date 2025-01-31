import React from 'react';
import { Box } from '@mui/material';
import styled from '@emotion/styled';

const StyledControls = styled(Box)`
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 16px;
  background: linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0) 100%);
  display: flex;
  justify-content: space-between;
  align-items: center;
  z-index: 1;
`;

const ControlsOverlay = ({ children, ...props }) => {
  return <StyledControls {...props}>{children}</StyledControls>;
};

export default ControlsOverlay; 