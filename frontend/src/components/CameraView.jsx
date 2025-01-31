import React from 'react';
import { Paper } from '@mui/material';
import styled from '@emotion/styled';

const Container = styled.div`
  width: 100%;
  margin: 0;
  padding: 0;
`;

const StyledCameraView = styled(Paper)`
  position: relative;
  width: 100%;
  padding-top: 56.25%; // 16:9 Aspect Ratio
  background: #000;
  border-radius: 15px;
  overflow: hidden;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;
  
  &:hover {
    transform: scale(1.02);
    box-shadow: 0 8px 16px rgba(0,0,0,0.2);
  }
`;

const ContentContainer = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
`;

const CameraView = ({ children, ...props }) => {
  return (
    <Container>
      <StyledCameraView elevation={3} {...props}>
        <ContentContainer>
          {children}
        </ContentContainer>
      </StyledCameraView>
    </Container>
  );
};

export default CameraView; 