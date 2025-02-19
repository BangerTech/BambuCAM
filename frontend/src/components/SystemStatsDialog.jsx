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
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    border: '1px solid #00ffff',
    boxShadow: '0 0 10px #00ffff',
    color: '#fff',
    minWidth: '300px'
  }
}));

const NeonProgress = styled(LinearProgress)(({ theme }) => ({
  height: 10,
  borderRadius: 5,
  '& .MuiLinearProgress-bar': {
    backgroundColor: '#00ffff',
    boxShadow: '0 0 5px #00ffff'
  },
  '& .MuiLinearProgress-dashed': {
    backgroundImage: 'none'
  }
}));

const StatBox = styled(Box)({
  marginBottom: '20px',
  '& .label': {
    color: '#00ffff',
    marginBottom: '5px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  }
});

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
        color: '#00ffff',
        textAlign: 'center',
        fontSize: '1.5rem',
        fontWeight: 'bold',
        textShadow: '0 0 10px #00ffff',
        pr: 6
      }}>
        System Statistics
        <IconButton
          onClick={onClose}
          sx={{
            position: 'absolute',
            right: 8,
            top: 8,
            color: '#00ffff'
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
              <div className="label">
                <Typography>CPU Usage</Typography>
                <Typography>{stats.cpu.percent}%</Typography>
              </div>
              <NeonProgress variant="determinate" value={stats.cpu.percent} />
              <Typography variant="caption" sx={{ color: '#888' }}>
                {stats.cpu.cores} Cores
              </Typography>
            </StatBox>

            <StatBox>
              <div className="label">
                <Typography>Memory Usage</Typography>
                <Typography>{stats.memory.percent}%</Typography>
              </div>
              <NeonProgress variant="determinate" value={stats.memory.percent} />
              <Typography variant="caption" sx={{ color: '#888' }}>
                {formatBytes(stats.memory.used)} GB / {formatBytes(stats.memory.total)} GB
              </Typography>
            </StatBox>

            <StatBox>
              <div className="label">
                <Typography>Disk Usage</Typography>
                <Typography>{stats.disk.percent}%</Typography>
              </div>
              <NeonProgress variant="determinate" value={stats.disk.percent} />
              <Typography variant="caption" sx={{ color: '#888' }}>
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