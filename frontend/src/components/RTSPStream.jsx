import React, { useEffect, useRef, useState } from 'react';
import { Box } from '@mui/material';

// Dynamische API URL basierend auf dem aktuellen Host
const API_URL = `http://${window.location.hostname}:4000`;

const RTSPStream = ({ printer, fullscreen, onFullscreenExit }) => {
  const videoRef = useRef(null);
  const mediaSourceRef = useRef(null);
  const sourceBufferRef = useRef(null);
  const websocketRef = useRef(null);
  const [error, setError] = useState(null);
  const bufferQueue = useRef([]);
  const isProcessing = useRef(false);
  // Flag um zu prüfen ob Komponente mounted ist
  const mountedRef = useRef(true);

  // Separater Effekt nur für Fullscreen
  useEffect(() => {
    if (!videoRef.current) return;

    const handleFullscreenChange = () => {
      // Wenn Fullscreen beendet wird, Parent-Komponente informieren
      if (!document.fullscreenElement && fullscreen) {
        // Callback zum Parent um fullscreen auf false zu setzen
        onFullscreenExit?.();
      }
    };

    // Fullscreen-Change Event Listener
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    if (fullscreen) {
      try {
        videoRef.current.requestFullscreen();
      } catch (err) {
        console.warn('Fullscreen error:', err);
      }
    }

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [fullscreen]);

  // Separater Effekt für Stream-Setup
  useEffect(() => {
    // Wenn es nur ein Fullscreen-Toggle ist, nicht neu initialisieren
    if (videoRef.current && document.fullscreenElement === videoRef.current) {
      console.log('Skipping stream setup - just fullscreen toggle');
      return;
    }

    console.log('Setting up stream for printer:', printer.id);
    setupMediaSource();

    return () => {
      // Cleanup nur wenn wirklich notwendig
      if (!document.fullscreenElement) {
        console.log('Full stream cleanup');
        mountedRef.current = false;
        cleanup();
      } else {
        console.log('Skipping cleanup - in fullscreen mode');
      }
    };
  }, [printer.id]); // Nur von printer.id abhängig

  const setupMediaSource = async () => {
    try {
      // Nur cleanup wenn nicht im Fullscreen
      if (!document.fullscreenElement) {
        cleanup();
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

  const connectWebSocket = (wsUrl = null) => {
    if (websocketRef.current) return; // Verhindere doppelte Verbindungen

    // Nutze übergebene URL oder erstelle neue
    const url = wsUrl || `ws://${window.location.hostname}:${printer.wsPort}/stream/${printer.id}`;
    console.log('Connecting to WebSocket:', url);
    
    const ws = new WebSocket(url);
    websocketRef.current = ws;

    ws.onopen = () => {
      console.log('WebSocket Connected, waiting for video data...');
      // Nur State updaten wenn noch mounted
      if (mountedRef.current) {
        setError(null);
      }
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

    ws.onerror = (e) => {
      console.error('WebSocket Error:', e);
      // Nur State updaten wenn noch mounted
      if (mountedRef.current) {
        setError('Failed to connect to video stream');
      }
    };

    ws.onclose = () => {
      console.log('WebSocket Closed');
      websocketRef.current = null;  // Reset websocket ref
      // Reconnect wenn noch mounted
      if (mountedRef.current) {
        setTimeout(() => connectWebSocket(url), 1000);
      }
    };
  };

  const cleanup = () => {
    // WebSocket cleanup
    if (websocketRef.current) {
      websocketRef.current.close();
      websocketRef.current = null;
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