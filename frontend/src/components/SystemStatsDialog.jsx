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
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        console.log('System stats:', data); // Debug log
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

  const formatBytes = (bytes) => {
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 B';
    const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
    return Math.round(bytes / Math.pow(1024, i), 2) + ' ' + sizes[i];
  };

  const formatUptime = (seconds) => {
    const days = Math.floor(seconds / (24 * 60 * 60));
    const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60));
    const minutes = Math.floor((seconds % (60 * 60)) / 60);
    return `${days}d ${hours}h ${minutes}m`;
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
            {/* System Info */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle1">System Information</Typography>
              <Typography variant="body2">Platform: {stats.platform}</Typography>
              <Typography variant="body2">Machine: {stats.machine}</Typography>
              <Typography variant="body2">Uptime: {formatUptime(stats.uptime)}</Typography>
            </Box>

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
                value={stats.memory_percent}
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
                {formatBytes(stats.memory_used)} / {formatBytes(stats.memory_total)} ({stats.memory_percent}%)
              </Typography>
            </Box>

            {/* Disk Usage */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle1">Disk Usage</Typography>
              <LinearProgress 
                variant="determinate" 
                value={stats.disk_percent}
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
                {formatBytes(stats.disk_used)} / {formatBytes(stats.disk_total)} ({stats.disk_percent}%)
              </Typography>
            </Box>

            {/* Temperature (nur wenn verfügbar) */}
            {stats.temperature > 0 && (
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle1">System Temperature</Typography>
                <Typography variant="body2">{stats.temperature}°C</Typography>
              </Box>
            )}

            {/* Load Average (nur auf Linux) */}
            {stats.platform === 'Linux' && (
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle1">Load Average</Typography>
                <Typography variant="body2">
                  1min: {stats.load_average[0].toFixed(1)}% | 
                  5min: {stats.load_average[1].toFixed(1)}% | 
                  15min: {stats.load_average[2].toFixed(1)}%
                </Typography>
              </Box>
            )}

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