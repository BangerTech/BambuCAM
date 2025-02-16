import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import logger from '../utils/logger';

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

  // Bestimme die Stream-URL basierend auf dem Druckertyp
  const streamUrl = printer.type === 'CREALITY' 
    ? `http://${printer.ip}:8080/?action=stream`
    : null;

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

          const wsUrl = `ws://${window.location.hostname}:${window.location.port}/api/stream/${printer.id}?url=${encodeURIComponent(streamUrl)}`;
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

  // Behalte nur diesen einen useEffect für Stream-Setup
  useEffect(() => {
    logger.info('Initializing stream for printer:', printer);
    
    // Wenn es nur ein Fullscreen-Toggle ist, nicht neu initialisieren
    if (videoRef.current && document.fullscreenElement === videoRef.current) {
      console.log('Skipping stream setup - just fullscreen toggle');
      return;
    }
    
    if (printer.type === 'BAMBULAB') {
      console.log('Setting up Bambu Lab RTSP stream');
      setupBambuStream();
    } else if (printer.type === 'CREALITY') {
      console.log('Setting up Creality MJPEG stream');
      setupCrealityStream();
    }

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

  const setupBambuStream = () => {
    const mediaSource = new MediaSource();
    mediaSourceRef.current = mediaSource;
    
    mediaSource.addEventListener('sourceopen', () => {
      console.log('MediaSource opened');
      setupSourceBuffer();
    });

    if (videoRef.current) {
      videoRef.current.src = URL.createObjectURL(mediaSource);
    }
  };

  const setupCrealityStream = () => {
    if (videoRef.current) {
      // Erstelle ein img Element für MJPEG
      const img = document.createElement('img');
      const streamUrl = `http://${printer.ip}:8080/?action=stream`;
      console.log('Using stream URL:', streamUrl);
      
      img.src = streamUrl;
      img.style.width = '100%';
      img.style.height = '100%';
      img.style.objectFit = 'contain';
      
      // Event Handler für Fehler
      img.onerror = () => {
        console.error('Error loading MJPEG stream');
        setError(true);
        setLoading(false);
      };
      
      // Event Handler für erfolgreiches Laden
      img.onload = () => {
        console.log('MJPEG stream loaded');
        setLoading(false);
        setError(false);
      };
      
      // Ersetze das video Element mit dem img Element
      if (videoRef.current.parentNode) {
        videoRef.current.parentNode.replaceChild(img, videoRef.current);
        videoRef.current = img;
      }
    }
  };

  const setupSourceBuffer = () => {
    if (printer.type !== 'BAMBULAB') return;
    
    console.log('Setting up SourceBuffer...');
    try {
      const sourceBuffer = mediaSourceRef.current.addSourceBuffer('video/mp4; codecs="avc1.64001f"');
      sourceBufferRef.current = sourceBuffer;
      
      // Starte WebSocket nur für Bambu Lab
      const streamUrl = `rtsps://bblp:${printer.accessCode}@${printer.ip}:322/streaming/live/1`;
      connectWebSocket(streamUrl);
    } catch (err) {
      console.error('Error setting up source buffer:', err);
      setError('Failed to initialize video stream');
    }
  };

  const connectWebSocket = (streamUrl) => {
    try {
        const wsUrl = `ws://${window.location.hostname}:${window.location.port}/api/stream/${printer.id}?url=${encodeURIComponent(streamUrl)}`;
        console.log('Connecting to WebSocket:', wsUrl);
        
        const ws = new WebSocket(wsUrl);
        
        ws.onopen = () => {
            console.log('WebSocket connected');
            setLoading(false);
        };
        
        ws.onclose = () => {
            console.log('WebSocket closed');
            handleWebSocketError();
        };
        
        ws.onerror = () => {
            console.error('WebSocket error:', error);
            handleWebSocketError();
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
                
                // Setze Loading erst nach mehreren Frames zurück
                if (bufferQueue.current.length > 5) {
                    setLoading(false);
                }
            } catch (err) {
                console.error('Error handling WebSocket message:', err);
            }
        };
    } catch (error) {
        console.error('WebSocket connection error:', error);
    }
  };

  const cleanup = () => {
    console.log('Cleaning up stream component');
    if (videoRef.current) {
      console.log('Cleaning up video/image element');
      if (videoRef.current instanceof HTMLImageElement) {
        videoRef.current.src = '';
        videoRef.current.onerror = null;
        videoRef.current.onload = null;
      } else {
        videoRef.current.onloadstart = null;
        videoRef.current.onloadeddata = null;
        videoRef.current.onerror = null;
        videoRef.current.src = '';
        videoRef.current.load();
        
        // Cleanup WebSocket nur für Bambu Lab
        if (printer.type === 'BAMBULAB' && websocketRef.current) {
          try {
            websocketRef.current.onclose = null;
            websocketRef.current.onerror = null;
            websocketRef.current.onmessage = null;
            websocketRef.current.close();
          } catch (err) {
            console.warn('Error closing WebSocket:', err);
          }
          websocketRef.current = null;
        }

        // Cleanup MediaSource nur für Bambu Lab
        if (printer.type === 'BAMBULAB' && mediaSourceRef.current) {
          try {
            URL.revokeObjectURL(videoRef.current.src);
          } catch (err) {
            console.warn('Error revoking object URL:', err);
          }
          mediaSourceRef.current = null;
        }
      }
    }
  };

  return (
    <Box sx={{
      position: 'relative',
      width: '100%',
      height: '100%',
      zIndex: 1
    }}>
      {printer.type === 'CREALITY' ? (
        <img 
          src={streamUrl} 
          alt="RTSP Stream" 
          style={{
            width: '100%',
            height: '100%',
            objectFit: fullscreen ? 'contain' : 'cover'
          }}
          onLoad={() => setLoading(false)}
          onError={() => {
            setError('Failed to load stream');
            setLoading(false);
          }}
        />
      ) : (
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
      )}
      
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
          {loading && <CircularProgress size={24} />}
          {error && <Typography>{error}</Typography>}
        </Box>
      )}
    </Box>
  );
};

export default RTSPStream; 