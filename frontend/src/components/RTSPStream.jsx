import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import { Logger, LOG_CATEGORIES } from '../utils/logger';

// Dynamische API URL basierend auf dem aktuellen Host
const API_URL = `http://${window.location.hostname}:4000`;

const RTSPStream = ({ printer, fullscreen, onFullscreenExit }) => {
  const videoRef = useRef(null);
  const mediaSourceRef = useRef(null);
  const sourceBufferRef = useRef(null);
  const wsRef = useRef(null);
  const [error, setError] = useState(null);
  const bufferQueue = useRef([]);
  const isProcessing = useRef(false);
  const mountedRef = useRef(true);
  const resetTimerRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const lastDataReceived = useRef(Date.now());
  const pendingBuffersRef = useRef([]);
  const reconnectTimerRef = useRef(null);
  const isReconnecting = useRef(false);
  const setupInProgress = useRef(false);
  const errorCount = useRef(0);
  const maxErrorCount = 5;
  const bufferResetTimeout = useRef(null);
  const videoErrorCount = useRef(0);
  const bufferErrorCount = useRef(0);
  const maxVideoErrors = 3;
  const maxBufferErrors = 5;
  const reconnectDelay = useRef(1000);
  const maxReconnectDelay = 30000;
  const handleErrorRef = useRef(null);

  // Bestimme die Stream-URL basierend auf dem Druckertyp
  const streamUrl = printer.type === 'CREALITY' 
    ? `http://${printer.ip}:8080/?action=stream`
    : null;

  // 1. Cleanup Funktion
  const cleanup = useCallback(() => {
    Logger.logStream('Cleanup', 'Cleaning up stream resources');
    isReconnecting.current = true;
    
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    
    if (sourceBufferRef.current && mediaSourceRef.current) {
      try {
        if (mediaSourceRef.current.readyState === 'open') {
          sourceBufferRef.current.abort();
          mediaSourceRef.current.removeSourceBuffer(sourceBufferRef.current);
        }
      } catch (e) {
        console.debug('Cleanup error:', e);
      }
    }
    
    if (videoRef.current) {
      videoRef.current.src = '';
      videoRef.current.load();
    }
    
    bufferQueue.current = [];
    isProcessing.current = false;
    sourceBufferRef.current = null;
    mediaSourceRef.current = null;
    errorCount.current = 0;
    videoErrorCount.current = 0;
    bufferErrorCount.current = 0;
    reconnectDelay.current = 1000;
    isReconnecting.current = false;
  }, []);

  // 2. Stream Setup Funktion
  const initStream = useCallback(async () => {
    if (setupInProgress.current) {
      console.debug('Setup already in progress, aborting');
      return;
    }

    try {
      setupInProgress.current = true;
      cleanup();
      setLoading(true);
      setError(null);

      const response = await fetch(`${API_URL}/api/stream/${printer.id}?url=${encodeURIComponent(printer.streamUrl)}`);
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to start stream');
      }

      if (data.direct) {
        setupMjpegStream(data.url);
        return;
      }

      const video = videoRef.current;
      if (!video) return;

      const mediaSource = new MediaSource();
      mediaSourceRef.current = mediaSource;
      video.src = URL.createObjectURL(mediaSource);

      mediaSource.addEventListener('sourceopen', () => {
        try {
          const sourceBuffer = mediaSource.addSourceBuffer('video/mp4; codecs="avc1.42E01E"');
          sourceBufferRef.current = sourceBuffer;
          
          // Optimierte Buffer-Verwaltung
          sourceBuffer.addEventListener('updateend', () => {
            try {
              const buffered = sourceBuffer.buffered;
              if (buffered.length > 0) {
                const currentTime = video.currentTime;
                const bufferEnd = buffered.end(0);
                
                // Kleinerer Buffer für geringere Latenz (von go2rtc inspiriert)
                if (bufferEnd - currentTime > 2) {  // Reduziert von 4 auf 2 Sekunden
                  sourceBuffer.remove(0, currentTime - 0.5);
                }
              }
            } catch (e) {
              console.debug('Buffer cleanup skipped:', e.message);
            }
          });

          const wsUrl = `ws://${window.location.hostname}:${data.port}/stream/${printer.id}`;
          const ws = new WebSocket(wsUrl);
          wsRef.current = ws;

          ws.onopen = () => {
            Logger.logStream('WebSocket', 'Connected');
            setLoading(false);
            reconnectAttempts.current = 0;
          };

          ws.onmessage = async (event) => {
            lastDataReceived.current = Date.now();
            try {
              const data = await event.data.arrayBuffer();
              if (sourceBuffer && !sourceBuffer.updating) {
                sourceBuffer.appendBuffer(data);
                
                // Automatisches Abspielen sobald genug gepuffert
                if (!video.playing && sourceBuffer.buffered.length > 0) {
                  const buffered = sourceBuffer.buffered.end(0) - sourceBuffer.buffered.start(0);
                  if (buffered > 0.5) {
                    video.play().catch(console.debug);
                  }
                }
              }
            } catch (error) {
              console.error('Error processing video data:', error);
              reconnect();
            }
          };

          // Original Error Handler
          ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            reconnect();
          };

          ws.onclose = () => {
            console.log('WebSocket closed');
            if (!isReconnecting.current && mountedRef.current) {
              reconnect();
            }
          };

          // Video Event Listener
          video.addEventListener('error', (e) => {
            console.error('Video error:', e);
          });

        } catch (error) {
          console.error('Error in sourceopen:', error);
          setError('Failed to initialize stream');
          setLoading(false);
        }
      });

    } catch (error) {
      console.error('Stream setup failed:', error);
      setError('Stream initialization failed');
      setLoading(false);
    } finally {
      setupInProgress.current = false;
    }
  }, [cleanup, printer.id, printer.streamUrl]);

  // 3. Reconnect Funktion
  const reconnect = useCallback(() => {
    if (!mountedRef.current || isReconnecting.current) {
      Logger.logStream('Reconnect', 'Aborted: already reconnecting or unmounted');
      return;
    }
    
    if (reconnectAttempts.current >= maxReconnectAttempts) {
      Logger.warn('Maximum reconnection attempts reached');
      setError('Verbindung fehlgeschlagen - Bitte Seite neu laden');
      cleanup();
      return;
    }

    isReconnecting.current = true;
    cleanup();
    
    reconnectAttempts.current++;
    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 10000);
    
    reconnectTimerRef.current = setTimeout(() => {
      if (mountedRef.current) {
        isReconnecting.current = false;
        initStream();
      }
    }, delay);
  }, [cleanup, initStream, maxReconnectAttempts]);

  // 4. Error Handler Funktionen
  const handleVideoError = useCallback((error) => {
    console.debug('Video error:', error);
    videoErrorCount.current++;
    
    if (videoErrorCount.current > maxVideoErrors) {
      console.warn(`Too many video errors (${videoErrorCount.current}/${maxVideoErrors})`);
      if (!isReconnecting.current && handleErrorRef.current) {
        handleErrorRef.current();
      }
    }
  }, []);

  const handleBufferError = useCallback((error) => {
    console.debug('Buffer error:', error);
    bufferErrorCount.current++;
    
    if (bufferErrorCount.current > maxBufferErrors) {
      console.warn(`Too many buffer errors (${bufferErrorCount.current}/${maxBufferErrors})`);
      if (!isReconnecting.current && handleErrorRef.current) {
        handleErrorRef.current();
      }
    }
  }, []);

  // 5. Setze die handleErrorRef auf die reconnect Funktion
  useEffect(() => {
    handleErrorRef.current = reconnect;
  }, [reconnect]);

  // 6. Initialer Stream-Start und Cleanup
  useEffect(() => {
    Logger.info('Initializing stream for printer:', printer);
    
    // Wenn es nur ein Fullscreen-Toggle ist, nicht neu initialisieren
    if (videoRef.current && document.fullscreenElement === videoRef.current) {
        console.log('Skipping stream setup - just fullscreen toggle');
        return;
    }
    
    // Für MJPEG Streams (OctoPrint und Creality)
    if (printer.type === 'OCTOPRINT' || printer.type === 'CREALITY') {
        setupMjpegStream(printer.streamUrl);
        return;
    }
    
    // Für BambuLab
    if (printer.type === 'BAMBULAB') {
        console.log('Setting up Bambu Lab RTSP stream');
        initStream();
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
}, [printer.id, printer.type]);

  const processNextBuffer = useCallback(() => {
    if (!sourceBufferRef.current || !bufferQueue.current.length || isProcessing.current) {
      return;
    }

    try {
      isProcessing.current = true;
      if (!sourceBufferRef.current.updating) {
        const nextBuffer = bufferQueue.current.shift();
        sourceBufferRef.current.appendBuffer(nextBuffer);
      }
    } catch (error) {
      console.error('Error processing buffer:', error);
      if (error.name === 'QuotaExceededError') {
        // Buffer voll - alte Daten entfernen
        const buffered = sourceBufferRef.current.buffered;
        if (buffered.length > 0) {
          sourceBufferRef.current.remove(0, buffered.end(0) - 2);
        }
      }
    } finally {
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
          wsRef.current = ws;

          ws.onopen = () => {
            console.log('WebSocket connected');
            setLoading(false);
            reconnectAttempts.current = 0;
          };

          ws.onmessage = async (event) => {
            try {
              console.log('WS Daten empfangen, Länge:', event.data.size);
              const data = await event.data.arrayBuffer();
              console.log('ArrayBuffer erstellt, Länge:', data.byteLength);
              
              if (sourceBufferRef.current && !sourceBufferRef.current.updating) {
                try {
                  sourceBufferRef.current.appendBuffer(data);
                  console.log('Daten erfolgreich an SourceBuffer angehängt');
                } catch (e) {
                  console.error('Fehler beim Anhängen der Daten:', e);
                }
              } else {
                console.log('SourceBuffer nicht bereit:', {
                  exists: !!sourceBufferRef.current,
                  updating: sourceBufferRef.current?.updating
                });
              }
            } catch (error) {
              console.error('Fehler bei der Datenverarbeitung:', error);
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

  const setupMjpegStream = (url) => {
    if (videoRef.current) {
      // Erstelle ein img Element für MJPEG
      const img = document.createElement('img');
      console.log('Using stream URL:', url);
      
      img.src = url;
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
      // Hole die Stream-URL vom Backend
      fetch(`${API_URL}/api/stream/${printer.id}?url=${encodeURIComponent(streamUrl)}`)
        .then(response => response.json())
        .then(data => {
          if (data.success) {
            const wsUrl = `ws://${window.location.hostname}:${data.port}/stream/${printer.id}`;
        console.log('Connecting to WebSocket:', wsUrl);
        const ws = new WebSocket(wsUrl);
            wsRef.current = ws;
        
        ws.onopen = () => {
              console.log('WebSocket connection established');
            setLoading(false);
        };

        ws.onmessage = async (event) => {
            try {
                const data = await event.data.arrayBuffer();
                const buffer = new Uint8Array(data);
                
                if (sourceBufferRef.current && !sourceBufferRef.current.updating) {
                  bufferQueue.current.push(buffer);
                  if (!isProcessing.current) {
                    processNextBuffer();
                  }
                }
              } catch (error) {
                console.error('Error processing video data:', error);
              }
            };

            ws.onerror = (error) => {
              console.error('WebSocket error:', error);
              setError('Failed to connect to video stream');
              setLoading(false);
            };

            ws.onclose = () => {
              console.log('WebSocket connection closed');
              if (mountedRef.current) {
                setError('Video stream connection lost');
                setLoading(false);
              }
            };
          } else {
            throw new Error(data.error || 'Failed to get WebSocket URL');
          }
        })
        .catch(e => {
          console.error('Error getting WebSocket URL:', e);
          setError(true);
          setLoading(false);
        });

    } catch (e) {
      console.error('Error connecting to WebSocket:', e);
      setError(true);
      setLoading(false);
    }
  };

  // Prüfe regelmäßig auf Datenverlust - nur für Bambu Lab
  useEffect(() => {
    if (printer.type === 'BAMBULAB') {
      const checkInterval = setInterval(() => {
        if (Date.now() - lastDataReceived.current > 5000 && !isReconnecting.current) {
          console.log('Keine Daten für 5 Sekunden - Neustart');
          reconnect();
        }
      }, 5000);

      return () => clearInterval(checkInterval);
    }
  }, [reconnect, printer.type]);

  const setupWebSocket = useCallback(async () => {
    try {
      // Hole Stream-URL mit Port vom Backend
      const response = await fetch(`${API_URL}/api/stream/${printer.id}/start`);
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to start stream');
      }

      // Nutze den zugewiesenen Port für die WebSocket-Verbindung
      const wsUrl = `ws://${window.location.hostname}:${data.port}`;
      
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      // ...
    } catch (error) {
      // ...
    }
  }, [printer.id]);

  const getStreamUrl = useCallback(() => {
    if (!printer) return null;
    // Neuer Code für go2rtc WebRTC Stream
    if (printer.type === 'BAMBULAB') {
      return `http://${window.location.hostname}/go2rtc/stream.html?src=${printer.id}`;
    } else if (printer.type === 'OCTOPRINT' || printer.type === 'CREALITY') {
      // Für MJPEG Streams direkte URL verwenden
      return printer.streamUrl;
    }
    return null;
  }, [printer]);

  return (
    <Box sx={{
      position: 'relative',
      width: '100%',
      height: '100%',
      zIndex: 1
    }}>
      {printer?.type === 'BAMBULAB' ? (
        <iframe
          src={getStreamUrl()}
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
            backgroundColor: '#000'
          }}
          allowFullScreen
          onLoad={() => setLoading(false)}
          onError={() => {
            setError('Failed to load stream');
            setLoading(false);
          }}
        />
      ) : (
        <img 
          src={getStreamUrl()}
          alt="Printer Stream"
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