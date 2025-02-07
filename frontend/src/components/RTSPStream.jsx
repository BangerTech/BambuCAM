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
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const reconnectTimeoutRef = useRef(null);

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
    try {
      const wsUrl = `ws://${window.location.hostname}:${printer.wsPort}/stream/${printer.id}`;
      console.log('Connecting to WebSocket:', wsUrl);
      
      if (wsRef.current) {
        wsRef.current.close();
      }

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket Connected, waiting for video data...');
        reconnectAttempts.current = 0; // Reset reconnect counter on successful connection
      };

      ws.onmessage = handleVideoData;

      ws.onerror = (error) => {
        console.error('WebSocket Error:', error);
        handleReconnect();
      };

      ws.onclose = () => {
        console.log('WebSocket Closed');
        handleReconnect();
      };
    } catch (error) {
      console.error('WebSocket connection error:', error);
      handleReconnect();
    }
  };

  const handleReconnect = () => {
    if (reconnectAttempts.current < maxReconnectAttempts) {
      console.log(`Attempting to reconnect (${reconnectAttempts.current + 1}/${maxReconnectAttempts})...`);
      
      // Clear any existing timeout
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }

      // Exponential backoff: 2^n * 1000ms (1s, 2s, 4s, 8s, 16s)
      const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 16000);
      
      reconnectTimeoutRef.current = setTimeout(() => {
        reconnectAttempts.current++;
        setupMediaSource();
      }, delay);
    } else {
      setError('Stream connection lost. Please refresh the page.');
    }
  };

  const cleanup = () => {
    console.log('Cleaning up RTSPStream...');
    
    // Stoppe alle Reconnect-Versuche
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    // WebSocket cleanup
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    // Buffer cleanup
    if (sourceBufferRef.current && mediaSourceRef.current) {
      try {
        if (sourceBufferRef.current.updating) {
          sourceBufferRef.current.abort();
        }
        mediaSourceRef.current.removeSourceBuffer(sourceBufferRef.current);
      } catch (err) {
        console.warn('Error removing source buffer:', err);
      }
      sourceBufferRef.current = null;
    }

    // MediaSource cleanup
    if (mediaSourceRef.current && videoRef.current) {
      try {
        if (mediaSourceRef.current.readyState === 'open') {
          mediaSourceRef.current.endOfStream();
        }
        URL.revokeObjectURL(videoRef.current.src);
      } catch (err) {
        console.warn('Error revoking object URL:', err);
      }
      mediaSourceRef.current = null;
    }

    // Reset state
    bufferQueue.current = [];
    isProcessing.current = false;
    reconnectAttempts.current = 0;
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
        
        // Warte bis der vorherige Buffer-Update abgeschlossen ist
        if (sourceBufferRef.current.updating) {
          await new Promise(resolve => {
            sourceBufferRef.current.addEventListener('updateend', resolve, { once: true });
          });
        }

        // Buffer Management
        if (sourceBufferRef.current.buffered.length > 0) {
          const start = sourceBufferRef.current.buffered.start(0);
          const end = sourceBufferRef.current.buffered.end(0);
          if (end - start > 2) {
            try {
              await new Promise((resolve, reject) => {
                sourceBufferRef.current.remove(start, end - 2);
                sourceBufferRef.current.addEventListener('updateend', resolve, { once: true });
                sourceBufferRef.current.addEventListener('error', reject, { once: true });
              });
            } catch (err) {
              console.warn('Error removing old buffer:', err);
            }
          }
        }

        // Append neuen Buffer
        try {
          sourceBufferRef.current.appendBuffer(data);
          await new Promise((resolve, reject) => {
            sourceBufferRef.current.addEventListener('updateend', resolve, { once: true });
            sourceBufferRef.current.addEventListener('error', reject, { once: true });
          });
        } catch (err) {
          if (err.name === 'QuotaExceededError') {
            // Buffer ist voll - alte Daten entfernen
            if (sourceBufferRef.current.buffered.length > 0) {
              const start = sourceBufferRef.current.buffered.start(0);
              const end = sourceBufferRef.current.buffered.end(0);
              await new Promise(resolve => {
                sourceBufferRef.current.remove(start, end - 1);
                sourceBufferRef.current.addEventListener('updateend', resolve, { once: true });
              });
            }
            continue; // Versuche es erneut mit dem aktuellen Frame
          }
          throw err;
        }
      }
    } catch (err) {
      console.error('Error processing buffer queue:', err);
      handleReconnect();
    } finally {
      isProcessing.current = false;
    }
  };

  const handleVideoData = async (event) => {
    try {
      const data = await event.data.arrayBuffer();
      
      // Begrenze Queue-Größe
      if (bufferQueue.current.length > 30) { // ~1 Sekunde bei 30fps
        bufferQueue.current = bufferQueue.current.slice(-15); // Behalte nur die letzten 15 Frames
      }
      
      bufferQueue.current.push(data);
      
      // Vermeide rekursive Aufrufe
      if (!isProcessing.current) {
        processBufferQueue();
      }
    } catch (err) {
      console.error('Error handling WebSocket message:', err);
      handleReconnect();
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