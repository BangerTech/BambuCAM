import React from 'react';
import { Box } from '@mui/material';
import styled from '@emotion/styled';

const StyledOverlay = styled(Box)`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  min-height: 64px;
  padding: 16px;
  background: linear-gradient(
    to bottom,
    rgba(0,0,0,0.85) 0%,
    rgba(0,0,0,0.6) 60%,
    rgba(0,0,0,0) 100%
  );
  color: white;
  display: flex;
  justify-content: space-between;
  align-items: center;
  z-index: 2;
  pointer-events: auto;
  transition: opacity 0.2s ease;

  &:hover {
    opacity: 1;
  }
`;

const CameraOverlay = ({ children, ...props }) => {
  return <StyledOverlay {...props}>{children}</StyledOverlay>;
};

export default CameraOverlay; 