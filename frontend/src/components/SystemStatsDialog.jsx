import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Typography,
  Box,
  LinearProgress,
  IconButton
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { API_URL } from '../config';
import { styled } from '@mui/material/styles';
import { Logger, LOG_CATEGORIES } from '../utils/logger';

// Styled Components
const NeonDialog = styled(Dialog)(({ theme }) => ({
  '& .MuiPaper-root': {
    backgroundColor: theme.palette.mode === 'dark' ? 'rgba(0, 0, 0, 0.9)' : 'rgba(255, 255, 255, 0.95)',
    border: theme.palette.mode === 'dark' 
      ? '1px solid #00ffff' 
      : '1px solid #008080',
    boxShadow: theme.palette.mode === 'dark' 
      ? '0 0 10px #00ffff' 
      : '0 0 10px rgba(0, 128, 128, 0.3)',
    color: theme.palette.mode === 'dark' ? '#fff' : '#333'
  }
}));

const NeonProgress = styled(LinearProgress)(({ theme }) => ({
  height: 10,
  borderRadius: 5,
  backgroundColor: theme.palette.mode === 'dark' ? 'rgba(0, 255, 255, 0.2)' : 'rgba(0, 128, 128, 0.1)',
  '& .MuiLinearProgress-bar': {
    backgroundColor: theme.palette.mode === 'dark' ? '#00ffff' : '#008080',
    borderRadius: 5,
  },
  '&:hover': {
    boxShadow: theme.palette.mode === 'dark' ? '0 0 5px #00ffff' : '0 0 5px rgba(0, 128, 128, 0.3)',
  }
}));

const StatBox = styled(Box)(({ theme }) => ({
  border: theme.palette.mode === 'dark' ? '1px solid rgba(0, 255, 255, 0.3)' : '1px solid rgba(0, 128, 128, 0.3)',
  borderRadius: '8px',
  padding: '10px',
  margin: '5px 0',
  backgroundColor: theme.palette.mode === 'dark' ? 'rgba(0, 0, 0, 0.5)' : 'rgba(255, 255, 255, 0.5)',
  color: theme.palette.mode === 'dark' ? '#fff' : '#333',
  '&:hover': {
    boxShadow: theme.palette.mode === 'dark' ? '0 0 5px rgba(0, 255, 255, 0.5)' : '0 0 5px rgba(0, 128, 128, 0.3)',
    backgroundColor: theme.palette.mode === 'dark' ? 'rgba(0, 0, 0, 0.7)' : 'rgba(255, 255, 255, 0.7)',
  }
}));

const SystemStatsDialog = ({ open, onClose }) => {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);

  const fetchSystemStats = async () => {
    try {
      const response = await fetch(`${API_URL}/system/stats`);
      const data = await response.json();
      Logger.info('System stats:', data);
      setStats(data);
      setError(null);
    } catch (error) {
      Logger.error('Error fetching system stats:', error);
      setError('Failed to load system statistics');
    }
  };

  useEffect(() => {
    if (open) {
      fetchSystemStats();
      const interval = setInterval(fetchSystemStats, 2000);
      return () => clearInterval(interval);
    }
  }, [open]);

  // Funktion zum Formatieren der Bytes in GB
  const formatBytes = (bytes) => {
    const gb = bytes / (1024 * 1024 * 1024);
    return gb.toFixed(1);
  };

  return (
    <NeonDialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle sx={{ 
        color: theme => theme.palette.mode === 'dark' ? '#00ffff' : '#008080',
        textAlign: 'center',
        fontSize: '1.5rem',
        fontWeight: 'bold',
        textShadow: theme => theme.palette.mode === 'dark' ? '0 0 10px #00ffff' : 'none',
        pr: 6
      }}>
        System Statistics
        <IconButton
          onClick={onClose}
          sx={{
            position: 'absolute',
            right: 8,
            top: 8,
            color: theme => theme.palette.mode === 'dark' ? '#00ffff' : '#008080'
          }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent>
        {error ? (
          <Typography color="error">{error}</Typography>
        ) : stats ? (
          <>
            <StatBox>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography sx={{ color: theme => theme.palette.mode === 'dark' ? '#00ffff' : '#008080' }}>CPU Usage</Typography>
                <Typography>{stats.cpu.percent}%</Typography>
              </Box>
              <NeonProgress variant="determinate" value={stats.cpu.percent} />
              <Typography variant="caption" sx={{ color: '#888', mt: 0.5, display: 'block' }}>
                {stats.cpu.cores} Cores
              </Typography>
            </StatBox>

            <StatBox>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography sx={{ color: theme => theme.palette.mode === 'dark' ? '#00ffff' : '#008080' }}>Memory Usage</Typography>
                <Typography>{stats.memory.percent}%</Typography>
              </Box>
              <NeonProgress variant="determinate" value={stats.memory.percent} />
              <Typography variant="caption" sx={{ color: '#888', mt: 0.5, display: 'block' }}>
                {formatBytes(stats.memory.used)} GB / {formatBytes(stats.memory.total)} GB
              </Typography>
            </StatBox>

            <StatBox>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography sx={{ color: theme => theme.palette.mode === 'dark' ? '#00ffff' : '#008080' }}>Disk Usage</Typography>
                <Typography>{stats.disk.percent}%</Typography>
              </Box>
              <NeonProgress variant="determinate" value={stats.disk.percent} />
              <Typography variant="caption" sx={{ color: '#888', mt: 0.5, display: 'block' }}>
                {formatBytes(stats.disk.used)} GB / {formatBytes(stats.disk.total)} GB
              </Typography>
            </StatBox>
          </>
        ) : (
          <Box sx={{ display: 'flex', justifyContent: 'center' }}>
            <NeonProgress />
          </Box>
        )}
      </DialogContent>
    </NeonDialog>
  );
};

export default SystemStatsDialog; 