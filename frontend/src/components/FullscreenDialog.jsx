import React from 'react';
import { Dialog } from '@mui/material';
import styled from '@emotion/styled';

const StyledDialog = styled(Dialog)`
  .MuiDialog-paper {
    margin: 0;
    max-width: none;
    width: 100%;
    height: 100%;
    max-height: none;
    background: black;
  }
`;

const FullscreenDialog = ({ children, ...props }) => {
  return <StyledDialog {...props}>{children}</StyledDialog>;
};

export default FullscreenDialog; 