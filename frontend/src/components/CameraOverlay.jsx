import React from 'react';
import { Box } from '@mui/material';
import styled from '@emotion/styled';

const StyledOverlay = styled(Box)`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  padding: 16px;
  background: linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0) 100%);
  color: white;
  display: flex;
  justify-content: space-between;
  align-items: center;
  z-index: 1;
`;

const CameraOverlay = ({ children, ...props }) => {
  return <StyledOverlay {...props}>{children}</StyledOverlay>;
};

export default CameraOverlay; 