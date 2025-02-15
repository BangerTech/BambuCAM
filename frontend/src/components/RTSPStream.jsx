import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';

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
  const mountedRef = useRef(true);
  const resetTimerRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 3;

  const processNextBuffer = useCallback(() => {
    if (!sourceBufferRef.current || !bufferQueue.current.length) {
      isProcessing.current = false;
      return;
    }

    isProcessing.current = true;
    try {
      if (!sourceBufferRef.current.updating) {
        const nextBuffer = bufferQueue.current.shift();
        sourceBufferRef.current.appendBuffer(nextBuffer);
      }
    } catch (error) {
      console.error('Error processing buffer:', error);
      isProcessing.current = false;
    }
  }, []);

  const handleWebSocketError = useCallback(() => {
    if (reconnectAttempts.current < maxReconnectAttempts) {
      const delay = Math.pow(2, reconnectAttempts.current) * 1000;
      reconnectAttempts.current += 1;
      setTimeout(() => {
        if (printer.type === 'BAMBULAB') {
          const streamUrl = `rtsps://bblp:${printer.accessCode}@${printer.ip}:322/streaming/live/1`;
          initializeWebSocket(streamUrl);
        }
      }, delay);
    } else {
      setError('Connection failed after 3 attempts');
    }
  }, [printer]);

  const initializeWebSocket = useCallback((streamUrl) => {
    cleanup();
    setLoading(true);
    setError(null);

    try {
      const ms = new MediaSource();
      mediaSourceRef.current = ms;
      videoRef.current.src = URL.createObjectURL(ms);

      ms.addEventListener('sourceopen', () => {
        try {
          sourceBufferRef.current = ms.addSourceBuffer('video/mp4; codecs="avc1.42E01E"');
          sourceBufferRef.current.mode = 'segments';
          sourceBufferRef.current.addEventListener('updateend', processNextBuffer);

          const wsUrl = `ws://${window.location.hostname}:4000/stream/${printer.id}/ws?url=${encodeURIComponent(streamUrl)}`;
          const ws = new WebSocket(wsUrl);
          websocketRef.current = ws;

          ws.onopen = () => {
            console.log('WebSocket connected');
            setLoading(false);
            reconnectAttempts.current = 0;
          };

          ws.onmessage = (event) => {
            if (mountedRef.current) {
              const data = new Uint8Array(event.data);
              bufferQueue.current.push(data);
              if (!isProcessing.current) {
                processNextBuffer();
              }
            }
          };

          ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            handleWebSocketError();
          };

          ws.onclose = () => {
            console.log('WebSocket closed');
            if (mountedRef.current) {
              handleWebSocketError();
            }
          };

        } catch (error) {
          console.error('Error in sourceopen:', error);
          setError('Failed to initialize stream');
          setLoading(false);
        }
      });

    } catch (error) {
      console.error('Error initializing WebSocket:', error);
      setError('Failed to initialize stream');
      setLoading(false);
    }
  }, [processNextBuffer, handleWebSocketError, printer.id]);

  // Neue handleStreamError Funktion
  const handleStreamError = useCallback(() => {
    if (reconnectAttempts.current < maxReconnectAttempts) {
      reconnectAttempts.current++;
      console.log(`Reconnect attempt ${reconnectAttempts.current}/${maxReconnectAttempts}`);
      
      setError(`Connection failed (Attempt ${reconnectAttempts.current}/${maxReconnectAttempts})`);
      setLoading(true);

      // Versuche nach einer Verzögerung neu zu verbinden
      setTimeout(() => {
        if (videoRef.current) {
          const streamUrl = `http://${printer.ip}:8080/?action=stream`;
          videoRef.current.src = streamUrl;
          videoRef.current.load();
        }
      }, 2000 * reconnectAttempts.current);
    } else {
      setError('Failed to connect after multiple attempts');
      setLoading(false);
    }
  }, [printer.ip, maxReconnectAttempts]);

  // Funktion zum Neustarten des Stream-Stacks
  const resetStreamStack = useCallback(async () => {
    console.log('Performing scheduled stream reset');
    setLoading(true);
    setError(null);
    
    try {
        cleanup();
        
        console.log(`Requesting stream reset for printer ${printer.id}`);
        const response = await fetch(`${API_URL}/stream/${printer.id}/reset`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Stream reset response:', data);
        
        if (data.success && data.new_port) {
            console.log(`Connecting to new port: ${data.new_port}`);
            const newWsUrl = `ws://${window.location.hostname}:${data.new_port}/stream/${printer.id}`;
            
            // Setup new MediaSource
            console.log('Setting up new MediaSource...');
            const mediaSource = new MediaSource();
            mediaSourceRef.current = mediaSource;
            videoRef.current.src = URL.createObjectURL(mediaSource);

            mediaSource.addEventListener('sourceopen', () => {
                console.log('MediaSource opened');
                setupSourceBuffer();
                // Connect to new WebSocket after SourceBuffer is ready
                connectWebSocket(newWsUrl);
            });
        } else {
            throw new Error(data.error || 'Stream reset failed');
        }
        
    } catch (err) {
        console.error('Error during stream reset:', err);
        setError(err.message || 'Stream reset failed');
        setLoading(false);
    }
  }, [printer.id]);

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
  }, [printer.id]);

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

  const connectWebSocket = () => {
    // Neue WebSocket URL ohne Port
    const url = `ws://${window.location.hostname}/stream/${printer.id}`;
    
    // Exponentieller Backoff
    const reconnect = (attempt = 0) => {
        if (attempt > 3) return;
        
        setTimeout(() => {
            if (!mountedRef.current) return;
            console.log(`Reconnect attempt ${attempt + 1}`);
            connectWebSocket();
        }, Math.pow(2, attempt) * 1000);
    };

    const ws = new WebSocket(url);
    
    ws.onopen = () => {
        console.log('WebSocket connected');
        setError(null);
    };
    
    ws.onclose = () => reconnect(0);
    ws.onerror = () => reconnect(0);
    
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
            
            // Setze Loading erst nach mehreren Frames zurück
            if (bufferQueue.current.length > 5) {
                setLoading(false);
            }
        } catch (err) {
            console.error('Error handling WebSocket message:', err);
        }
    };
  };

  const cleanup = () => {
    console.log('Starting cleanup...');
    
    if (videoRef.current) {
      console.log('Cleaning up video element');
      videoRef.current.src = '';
      videoRef.current.load();
    }
    
    // WebSocket cleanup
    if (websocketRef.current) {
        try {
            websocketRef.current.onclose = null; // Verhindere auto-reconnect
            websocketRef.current.onerror = null; // Verhindere Error Events
            websocketRef.current.onmessage = null;
            websocketRef.current.close();
        } catch (err) {
            console.warn('Error closing WebSocket:', err);
        }
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

    // Buffer Queue leeren
    bufferQueue.current = [];
    isProcessing.current = false;
  };

  useEffect(() => {
    console.log(`Initializing stream for printer:`, printer);
    
    if (printer.type === 'BAMBULAB') {
      console.log('Setting up Bambu Lab RTSP stream');
      const streamUrl = `rtsps://bblp:${printer.accessCode}@${printer.ip}:322/streaming/live/1`;
      initializeWebSocket(streamUrl);
    } else if (printer.type === 'CREALITY') {
      console.log('Setting up Creality MJPEG stream');
      if (videoRef.current) {
        // Stream über nginx proxy
        const streamUrl = `/stream/?action=stream`;
        videoRef.current.src = streamUrl;
        
        videoRef.current.onloadstart = () => {
          console.log('Video load started');
          setLoading(true);
        };
        
        videoRef.current.onloadeddata = () => {
          console.log('Video data loaded');
          setLoading(false);
          reconnectAttempts.current = 0;
        };
        
        videoRef.current.onerror = (e) => {
          console.error('Video error:', e.target.error);
          handleStreamError();
        };
      }
    }

    return () => {
      console.log('Cleaning up stream component');
      if (videoRef.current) {
        console.log('Cleaning up video element');
        videoRef.current.onloadstart = null;
        videoRef.current.onloadeddata = null;
        videoRef.current.onerror = null;
        videoRef.current.src = '';
        videoRef.current.load();
      }
      reconnectAttempts.current = 0;
    };
  }, [printer.id, handleStreamError]);

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
      {(loading || error) && (
        <Box sx={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          color: 'white',
          backgroundColor: 'rgba(0,0,0,0.7)',
          padding: '10px',
          borderRadius: '5px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 1
        }}>
          {loading && (
            <>
              <CircularProgress size={24} />
              <Typography>
                {error ? `Reconnecting (${reconnectAttempts.current}/${maxReconnectAttempts})...` : 'Connecting...'}
              </Typography>
            </>
          )}
          {error && !loading && (
            <Typography>
              {error}
              {reconnectAttempts.current >= maxReconnectAttempts && ' (Max retries reached)'}
            </Typography>
          )}
        </Box>
      )}
    </Box>
  );
};

export default RTSPStream; 