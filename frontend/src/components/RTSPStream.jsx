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
  // Flag um zu prüfen ob Komponente mounted ist
  const mountedRef = useRef(true);
  const resetTimerRef = useRef(null);
  const [loading, setLoading] = useState(false);

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

  // Reset-Timer Setup
  useEffect(() => {
    // Wenn es nur ein Fullscreen-Toggle ist, Timer nicht neu starten
    if (videoRef.current && document.fullscreenElement === videoRef.current) {
      return;
    }

    // Alten Timer aufräumen
    if (resetTimerRef.current) {
      clearInterval(resetTimerRef.current);
    }

    // Neuen Timer setzen (4 Minuten = 240000 ms)
    resetTimerRef.current = setInterval(() => {
      resetStreamStack();
    }, 240000);

    return () => {
      if (resetTimerRef.current) {
        clearInterval(resetTimerRef.current);
        resetTimerRef.current = null;
      }
    };
  }, [printer.id, resetStreamStack]);

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
    if (!mountedRef.current) return;

    if (websocketRef.current) {
        try {
            websocketRef.current.onclose = null; // Prevent auto-reconnect
            websocketRef.current.close();
            console.log("Previous WebSocket closed");
        } catch (err) {
            console.error("Error closing WebSocket:", err);
        }
        websocketRef.current = null;
    }

    const backoff = (retries) => {
        return Math.min(1000 * Math.pow(2, retries), 10000);
    };

    let retryCount = 0;
    const maxRetries = 3;

    const tryConnect = () => {
        const url = wsUrl || `ws://${window.location.hostname}:${printer.wsPort}/stream/${printer.id}`;
        console.log(`Connecting to WebSocket (attempt ${retryCount + 1}/${maxRetries}):`, url);
        
        const ws = new WebSocket(url);
        websocketRef.current = ws;

        ws.onopen = () => {
            console.log('WebSocket Connected');
            retryCount = 0;
            setError(null);
        };

        ws.onclose = (e) => {
            if (retryCount < maxRetries) {
                const delay = backoff(retryCount++);
                console.log(`Reconnecting in ${delay}ms...`);
                setTimeout(tryConnect, delay);
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
                
                // Setze Loading erst nach mehreren Frames zurück
                if (bufferQueue.current.length > 5) {
                    setLoading(false);
                    
                    // Reset Timer erst wenn Stream wirklich läuft
                    if (resetTimerRef.current) {
                        clearInterval(resetTimerRef.current);
                    }
                    resetTimerRef.current = setInterval(() => {
                        resetStreamStack();
                    }, 240000);
                }
            } catch (err) {
                console.error('Error handling WebSocket message:', err);
            }
        };

        ws.onerror = (e) => {
            console.error('WebSocket Error:', e);
            // Detailliertere Fehlermeldung
            if (mountedRef.current) {
                setError(`Failed to connect to video stream (${e.type})`);
                setLoading(false);
            }
        };
    };

    tryConnect();
  };

  const cleanup = () => {
    console.log('Performing cleanup...');
    
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
                {error ? 'Reconnecting...' : 'Connecting...'}
              </Typography>
            </>
          )}
          {error && !loading && error}
        </Box>
      )}
    </Box>
  );
};

export default RTSPStream; 