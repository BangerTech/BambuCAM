import { createTheme } from '@mui/material';

export const lightTheme = createTheme({
  palette: {
    mode: 'light',
    background: {
      default: '#f5f5f7',
      paper: '#ffffff'
    },
    primary: {
      main: '#007AFF'
    }
  }
});

export const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    background: {
      default: '#1a1a1a',
      paper: '#2d2d2d'
    },
    primary: {
      main: '#0A84FF'
    }
  }
}); 