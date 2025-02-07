import { Fab, useTheme, useMediaQuery } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';

const AddPrinterButton = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  return (
    <Fab
      color="primary"
      aria-label="add"
      onClick={handleClick}
      sx={{
        width: isMobile ? 35 : 45,
        height: isMobile ? 35 : 45,
        minHeight: 'unset',
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        border: '1px solid #00ffff',
        color: '#00ffff',
        '&:hover': {
          backgroundColor: 'rgba(0, 255, 255, 0.1)',
        }
      }}
    >
      <AddIcon sx={{ fontSize: isMobile ? '1.2rem' : '1.5rem' }} />
    </Fab>
  );
};

export default AddPrinterButton; 