import React, { useEffect, useRef, useState } from 'react';
import { Box } from '@mui/material';

// Dynamische API URL basierend auf dem aktuellen Host
const API_URL = `http://${window.location.hostname}:4000`;

const RTSPStream = ({ printer, fullscreen }) => {
  const videoRef = useRef(null);
  const mediaSourceRef = useRef(null);
  const sourceBufferRef = useRef(null);
  const wsRef = useRef(null);
  const [error, setError] = useState(null);
  const bufferQueue = useRef([]);
  const isProcessing = useRef(false);
  const isFullscreenRef = useRef(fullscreen);
  const isInitializedRef = useRef(false);
  const fullscreenChangeRef = useRef(false);

  // Effekt für Fullscreen-Änderungen
  useEffect(() => {
    if (!videoRef.current) return;
    
    fullscreenChangeRef.current = true;
    isFullscreenRef.current = fullscreen;

    const handleFullscreenChange = () => {
      fullscreenChangeRef.current = false;
      if (!document.fullscreenElement && !document.webkitFullscreenElement) {
        // Nur neu initialisieren wenn wirklich nötig
        if (!mediaSourceRef.current || !sourceBufferRef.current) {
          setupMediaSource();
        }
      }
    };

    if (fullscreen) {
      try {
        if (videoRef.current.requestFullscreen) {
          videoRef.current.requestFullscreen();
        } else if (videoRef.current.webkitRequestFullscreen) {
          videoRef.current.webkitRequestFullscreen();
        }
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
      } catch (err) {
        console.warn('Fullscreen error:', err);
        fullscreenChangeRef.current = false;
      }
    }

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, [fullscreen]);

  // Stream Setup Effekt
  useEffect(() => {
    if (!isInitializedRef.current) {
      console.log('RTSPStream initializing:', { printer, fullscreen });
      setupMediaSource();
      isInitializedRef.current = true;
    }

    return () => {
      // Nur aufräumen wenn kein Fullscreen-Wechsel
      if (!fullscreenChangeRef.current) {
        console.log('RTSPStream unmounting, cleaning up...');
        cleanup();
        isInitializedRef.current = false;
      }
    };
  }, [printer.id]);

  const setupMediaSource = async () => {
    try {
      if (mediaSourceRef.current) {
        console.log('MediaSource already exists, skipping setup');
        return;
      }

      console.log('Setting up new MediaSource...');
      const mediaSource = new MediaSource();
      mediaSourceRef.current = mediaSource;
      videoRef.current.src = URL.createObjectURL(mediaSource);

      mediaSource.addEventListener('sourceopen', () => {
        console.log('MediaSource opened');
        setupSourceBuffer();
      });

    } catch (err) {
      console.error('Error setting up MediaSource:', err);
      setError(err.message);
    }
  };

  const setupSourceBuffer = () => {
    try {
      if (sourceBufferRef.current) return; // Verhindere doppeltes Setup

      console.log('Setting up SourceBuffer...');
      const mimeType = 'video/mp2t; codecs="avc1.640029"';
      sourceBufferRef.current = mediaSourceRef.current.addSourceBuffer(mimeType);
      
      // Konfiguriere SourceBuffer
      sourceBufferRef.current.mode = 'sequence';
      sourceBufferRef.current.addEventListener('error', (e) => {
        console.error('SourceBuffer error:', e);
      });

      connectWebSocket();
    } catch (err) {
      console.error('Error setting up SourceBuffer:', err);
      setError(err.message);
    }
  };

  const connectWebSocket = () => {
    if (wsRef.current) return; // Verhindere doppelte Verbindungen

    const wsUrl = `ws://${window.location.hostname}:${printer.wsPort}/stream/${printer.id}`;
    console.log('Connecting to WebSocket:', wsUrl);
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('WebSocket Connected, waiting for video data...');
    };

    // Funktion zum Verarbeiten der Queue
    const processBufferQueue = async () => {
      if (isProcessing.current || !sourceBufferRef.current || bufferQueue.current.length === 0) {
        return;
      }

      isProcessing.current = true;
      
      try {
        while (bufferQueue.current.length > 0 && !sourceBufferRef.current.updating) {
          const data = bufferQueue.current.shift();
          sourceBufferRef.current.appendBuffer(data);
          await new Promise(resolve => {
            sourceBufferRef.current.addEventListener('updateend', resolve, { once: true });
          });
        }
      } catch (err) {
        console.error('Error processing buffer queue:', err);
      } finally {
        isProcessing.current = false;
        
        // Falls noch Daten in der Queue sind, weiter verarbeiten
        if (bufferQueue.current.length > 0) {
          processBufferQueue();
        }
      }
    };

    ws.onmessage = async (event) => {
      try {
        const data = await event.data.arrayBuffer();
        bufferQueue.current.push(data);
        processBufferQueue();
      } catch (err) {
        console.error('Error handling WebSocket message:', err);
      }
    };

    ws.onerror = (event) => {
      console.error('WebSocket Error:', event);
      setError('WebSocket connection failed');
    };

    ws.onclose = () => {
      console.log('WebSocket Closed');
      wsRef.current = null;
    };
  };

  const cleanup = () => {
    // WebSocket cleanup
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    // SourceBuffer cleanup
    if (sourceBufferRef.current && mediaSourceRef.current) {
      try {
        mediaSourceRef.current.removeSourceBuffer(sourceBufferRef.current);
      } catch (err) {
        console.warn('Error removing source buffer:', err);
      }
      sourceBufferRef.current = null;
    }

    // MediaSource cleanup
    if (mediaSourceRef.current && videoRef.current) {
      try {
        URL.revokeObjectURL(videoRef.current.src);
      } catch (err) {
        console.warn('Error revoking object URL:', err);
      }
      mediaSourceRef.current = null;
    }
  };

  return (
    <Box sx={{ width: '100%', height: '100%', position: 'relative' }}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{
          width: '100%',
          height: '100%',
          objectFit: fullscreen ? 'contain' : 'cover',
          backgroundColor: 'black'
        }}
      />
      {error && (
        <Box sx={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          color: 'red',
          backgroundColor: 'rgba(0,0,0,0.7)',
          padding: '10px',
          borderRadius: '5px'
        }}>
          {error}
        </Box>
      )}
    </Box>
  );
};

export default RTSPStream; 