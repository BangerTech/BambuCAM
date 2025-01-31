import React from 'react';
import { Paper } from '@mui/material';
import styled from '@emotion/styled';

const StyledCameraView = styled(Paper)`
  aspect-ratio: 16/9;
  overflow: hidden;
  border-radius: 15px;
  background: #000;
  transition: transform 0.3s ease;
  position: relative;
  cursor: pointer;
  
  &:hover {
    transform: scale(1.02);
  }
`;

const CameraView = ({ children, ...props }) => {
  return (
    <StyledCameraView elevation={3} {...props}>
      {children}
    </StyledCameraView>
  );
};

export default CameraView; 