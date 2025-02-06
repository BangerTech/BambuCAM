import React, { useState, useEffect } from 'react';
import { 
  Dialog, 
  DialogTitle, 
  DialogContent,
  IconButton,
  Typography,
  Box,
  LinearProgress,
  Button
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import PowerSettingsNewIcon from '@mui/icons-material/PowerSettingsNew';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import { API_URL } from '../config';

const SystemStatsDialog = ({ open, onClose }) => {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch(`${API_URL}/system/stats`);
        const data = await response.json();
        setStats(data);
      } catch (error) {
        console.error('Error fetching system stats:', error);
      }
    };

    if (open) {
      fetchStats();
      const interval = setInterval(fetchStats, 2000);
      return () => clearInterval(interval);
    }
  }, [open]);

  const handleShutdown = async () => {
    if (window.confirm('Are you sure you want to shutdown the system?')) {
      try {
        await fetch(`${API_URL}/system/shutdown`, { method: 'POST' });
      } catch (error) {
        console.error('Error during shutdown:', error);
      }
    }
  };

  const handleReboot = async () => {
    if (window.confirm('Are you sure you want to reboot the system?')) {
      try {
        await fetch(`${API_URL}/system/reboot`, { method: 'POST' });
      } catch (error) {
        console.error('Error during reboot:', error);
      }
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      PaperProps={{
        sx: {
          background: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(0, 255, 255, 0.3)',
          borderRadius: '1rem',
          minWidth: '300px'
        }
      }}
    >
      <DialogTitle sx={{ color: '#00ffff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        System Statistics
        <IconButton onClick={onClose} sx={{ color: '#00ffff' }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      
      <DialogContent>
        {stats ? (
          <Box sx={{ color: '#00ffff' }}>
            {/* CPU Usage */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle1">CPU Usage</Typography>
              <LinearProgress 
                variant="determinate" 
                value={stats.cpu_percent}
                sx={{
                  height: 10,
                  borderRadius: 5,
                  backgroundColor: 'rgba(0, 255, 255, 0.2)',
                  '& .MuiLinearProgress-bar': {
                    backgroundColor: '#00ffff'
                  }
                }}
              />
              <Typography variant="body2" sx={{ mt: 1 }}>{stats.cpu_percent}%</Typography>
            </Box>

            {/* Memory Usage */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle1">Memory Usage</Typography>
              <LinearProgress 
                variant="determinate" 
                value={(stats.memory_used / stats.memory_total) * 100}
                sx={{
                  height: 10,
                  borderRadius: 5,
                  backgroundColor: 'rgba(0, 255, 255, 0.2)',
                  '& .MuiLinearProgress-bar': {
                    backgroundColor: '#00ffff'
                  }
                }}
              />
              <Typography variant="body2" sx={{ mt: 1 }}>
                {Math.round(stats.memory_used / 1024 / 1024)}MB / {Math.round(stats.memory_total / 1024 / 1024)}MB
              </Typography>
            </Box>

            {/* Disk Usage */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle1">Disk Usage</Typography>
              <LinearProgress 
                variant="determinate" 
                value={(stats.disk_used / stats.disk_total) * 100}
                sx={{
                  height: 10,
                  borderRadius: 5,
                  backgroundColor: 'rgba(0, 255, 255, 0.2)',
                  '& .MuiLinearProgress-bar': {
                    backgroundColor: '#00ffff'
                  }
                }}
              />
              <Typography variant="body2" sx={{ mt: 1 }}>
                {Math.round(stats.disk_used / 1024 / 1024 / 1024)}GB / {Math.round(stats.disk_total / 1024 / 1024 / 1024)}GB
              </Typography>
            </Box>

            {/* System Temperature */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle1">System Temperature</Typography>
              <Typography variant="body2">{stats.temperature}°C</Typography>
            </Box>

            {/* Power Controls */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2 }}>
              <Button
                startIcon={<RestartAltIcon />}
                onClick={handleReboot}
                sx={{
                  color: '#00ffff',
                  border: '1px solid #00ffff',
                  '&:hover': {
                    backgroundColor: 'rgba(0, 255, 255, 0.1)'
                  }
                }}
              >
                Reboot
              </Button>
              <Button
                startIcon={<PowerSettingsNewIcon />}
                onClick={handleShutdown}
                sx={{
                  color: '#00ffff',
                  border: '1px solid #00ffff',
                  '&:hover': {
                    backgroundColor: 'rgba(0, 255, 255, 0.1)'
                  }
                }}
              >
                Shutdown
              </Button>
            </Box>
          </Box>
        ) : (
          <Box sx={{ textAlign: 'center', color: '#00ffff' }}>
            <Typography>Loading system stats...</Typography>
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default SystemStatsDialog; 