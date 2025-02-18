import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import Logger from '../utils/logger';

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
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (bufferResetTimeout.current) {
      clearTimeout(bufferResetTimeout.current);
      bufferResetTimeout.current = null;
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
  }, []);

  // 2. Reconnect Funktion
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
  }, [cleanup]);

  // 3. Error Handler Funktionen
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

  // 4. Setup Stream Funktion
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

      const video = videoRef.current;
      if (!video) return;

      // Stream vom Backend anfordern
      const response = await fetch(`/api/stream/${printer.id}?url=${encodeURIComponent(printer.streamUrl)}`);
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to start stream');
      }

      // MediaSource Setup
      const mediaSource = new MediaSource();
      mediaSourceRef.current = mediaSource;

      await new Promise((resolve, reject) => {
        mediaSource.addEventListener('sourceopen', () => {
          try {
            const sourceBuffer = mediaSource.addSourceBuffer('video/mp4; codecs="avc1.42E01E"');
            sourceBufferRef.current = sourceBuffer;

            // Buffer Management
            sourceBuffer.addEventListener('updateend', () => {
              try {
                if (sourceBuffer.buffered.length > 0) {
                  const currentTime = video.currentTime;
                  const bufferEnd = sourceBuffer.buffered.end(0);
                  
                  if (bufferEnd - currentTime > 5) {
                    sourceBuffer.remove(0, currentTime - 1);
                  }
                }
              } catch (e) {
                console.debug('Buffer management error:', e);
              }
            });

            resolve();
          } catch (e) {
            reject(e);
          }
        });
      });

      video.src = URL.createObjectURL(mediaSource);

      // WebSocket Setup
      const wsUrl = `ws://${window.location.hostname}:${data.port}/stream/${printer.id}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        Logger.logStream('WebSocket', 'Connected');
        setLoading(false);
        reconnectAttempts.current = 0;
        lastDataReceived.current = Date.now();
        errorCount.current = 0;
      };

      ws.onmessage = async (event) => {
        lastDataReceived.current = Date.now();
        try {
          const data = await event.data.arrayBuffer();
          
          if (!sourceBufferRef.current || mediaSourceRef.current?.readyState !== 'open') {
            console.debug('SourceBuffer or MediaSource not ready');
            return;
          }

          if (!sourceBufferRef.current.updating) {
            try {
              sourceBufferRef.current.appendBuffer(data);
            } catch (e) {
              if (e.name === 'QuotaExceededError') {
                const buffered = sourceBufferRef.current.buffered;
                if (buffered.length > 0) {
                  sourceBufferRef.current.remove(0, buffered.end(0) - 2);
                }
              }
            }
          }
        } catch (error) {
          console.debug('Stream error:', error);
          reconnect();
        }
      };

      ws.onerror = () => {
        console.debug('WebSocket error');
        if (!isReconnecting.current) {
          reconnect();
        }
      };

      ws.onclose = () => {
        console.debug('WebSocket closed');
        if (!isReconnecting.current) {
          reconnect();
        }
      };

    } catch (error) {
      console.error('Stream setup failed:', error);
      setError('Stream-Initialisierung fehlgeschlagen');
      setLoading(false);
      if (!isReconnecting.current && handleErrorRef.current) {
        handleErrorRef.current();
      }
    } finally {
      setupInProgress.current = false;
    }
  }, [cleanup, handleVideoError, handleBufferError]);

  // 5. Setze die handleErrorRef auf die reconnect Funktion
  useEffect(() => {
    handleErrorRef.current = reconnect;
  }, [reconnect]);

  // 6. Initialer Stream-Start und Cleanup
  useEffect(() => {
    initStream();
    return () => {
      console.debug('Component unmounting, cleaning up...');
      mountedRef.current = false;
      cleanup();
    };
  }, [initStream, cleanup]);

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

  // Behalte nur diesen einen useEffect für Stream-Setup
  useEffect(() => {
    Logger.info('Initializing stream for printer:', printer);
    
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

  // Prüfe ob Video-Element verfügbar ist
  const isVideoReady = () => {
    return videoRef.current && !videoRef.current.error;
  };

  const appendNextBuffer = () => {
    if (pendingBuffersRef.current.length > 0 && sourceBufferRef.current && !sourceBufferRef.current.updating) {
      try {
        sourceBufferRef.current.appendBuffer(pendingBuffersRef.current.shift());
      } catch (e) {
        console.error('Error appending buffer:', e);
      }
    }
  };

  // Buffer Management mit Sicherheitsprüfungen
  const manageBuffer = () => {
    if (!isVideoReady() || !sourceBufferRef.current) return;

    const buffered = sourceBufferRef.current.buffered;
    if (buffered.length > 0) {
      try {
        const currentTime = videoRef.current.currentTime;
        const bufferEnd = buffered.end(0);
        
        if (bufferEnd - currentTime > 10) {
          sourceBufferRef.current.remove(0, currentTime - 5);
        }
      } catch (e) {
        console.warn('Buffer management failed:', e);
      }
    }
    appendNextBuffer();
  };

  // Automatischer Neustart bei Stream-Ende
  const handleStreamEnd = () => {
    console.log('Stream ended, attempting restart...');
    cleanup();
    setTimeout(() => {
      if (mountedRef.current) {
        setupBambuStream();
      }
    }, 1000);
  };

  const setupBambuStream = useCallback(async () => {
    try {
      console.log('Setting up Bambu Lab RTSP stream');
      cleanup();
      setLoading(true);
      setError(null);

      // Stream vom Backend anfordern
      const response = await fetch(`/api/stream/${printer.id}?url=${encodeURIComponent(printer.streamUrl)}`);
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to start stream');
      }

      // MediaSource Setup
      const video = videoRef.current;
      if (!video) return;

      // WebSocket Verbindung
      const wsUrl = `ws://${window.location.hostname}:${data.port}/stream/${printer.id}`;
      console.log('Connecting to WebSocket:', wsUrl);
      
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      // Blob Setup für Video
    const mediaSource = new MediaSource();
      video.src = URL.createObjectURL(mediaSource);
    
    mediaSource.addEventListener('sourceopen', () => {
        const sourceBuffer = mediaSource.addSourceBuffer('video/mp4; codecs="avc1.42E01E"');
        let isFirstChunk = true;
        let errorCount = 0;
        const MAX_ERRORS = 5;
        
        ws.onmessage = async (event) => {
          try {
            lastDataReceived.current = Date.now();
            const data = await event.data.arrayBuffer();
            
            if (sourceBuffer.updating) {
              return;
            }

            // Prüfe ob Video-Element Fehler hat
            if (videoRef.current.error) {
              errorCount++;
              console.debug(`Video error detected (${errorCount}/${MAX_ERRORS}):`, videoRef.current.error.message);
              
              if (errorCount >= MAX_ERRORS) {
                console.warn('Too many video errors, reconnecting...');
                reconnect();
                return;
              }

              // Versuche Video-Element zurückzusetzen
              try {
                await sourceBuffer.abort();
                sourceBuffer.timestampOffset = 0;
                videoRef.current.currentTime = 0;
              } catch (e) {
                console.debug('Reset failed:', e);
              }
            }
            
            try {
              sourceBuffer.appendBuffer(data);
              if (isFirstChunk) {
                isFirstChunk = false;
                videoRef.current.play().catch(console.debug);
              }
              errorCount = 0; // Reset Error-Counter bei erfolgreicher Verarbeitung
            } catch (e) {
              if (e.name === 'QuotaExceededError') {
                // Buffer voll - ältere Daten entfernen
                const buffered = sourceBuffer.buffered;
                if (buffered.length > 0) {
                  const currentTime = videoRef.current.currentTime;
                  sourceBuffer.remove(0, currentTime - 1); // Behalte 1 Sekunde Puffer
                }
              } else {
                console.debug('Buffer warning:', e.message);
                errorCount++;
              }
            }
          } catch (error) {
            console.error('Fatal stream error:', error);
            reconnect();
          }
        };

        // Buffer Management
        sourceBuffer.addEventListener('updateend', () => {
          try {
            const buffered = sourceBuffer.buffered;
            if (buffered.length > 0) {
              const currentTime = videoRef.current.currentTime;
              const bufferEnd = buffered.end(0);
              
              // Entferne alte Daten wenn Buffer zu groß wird
              if (bufferEnd - currentTime > 10) {
                sourceBuffer.remove(0, currentTime - 2);
              }
            }
          } catch (e) {
            console.debug('Buffer cleanup skipped:', e.message);
          }
        });

        ws.onopen = () => {
          console.log('WebSocket connected');
          setLoading(false);
          reconnectAttempts.current = 0;
        };

        ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          setError('Stream-Verbindung unterbrochen');
          reconnect();
        };

        ws.onclose = () => {
          console.log('WebSocket closed');
          reconnect();
        };
      });

      // Verbesserte Video Event Handler
      video.addEventListener('loadstart', () => Logger.logStream('Video', 'Initial laden'));
      video.addEventListener('playing', () => {
        Logger.logStream('Video', 'Stream läuft');
        setLoading(false);
      });
      video.addEventListener('waiting', () => {
        console.debug('Video: Puffern...');
        // Nur kurzes Puffern erlauben
        setTimeout(() => {
          if (videoRef.current && videoRef.current.readyState <= 2) {
            console.debug('Puffer-Timeout - Neustart');
            reconnect();
          }
        }, 5000);
      });
      video.addEventListener('error', (e) => {
        const error = e.target.error;
        console.debug('Video warning:', error.message);
        // Nur bei schweren Fehlern reconnecten
        if (error.code === MediaError.MEDIA_ERR_DECODE) {
          reconnect();
        }
      });

    } catch (error) {
      console.error('Fehler beim Stream-Setup:', error);
      setError('Stream-Initialisierung fehlgeschlagen');
      setLoading(false);
      reconnect();
    }
  }, [printer.id, printer.streamUrl, cleanup]);

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
    if (printer.type !== 'CREALITY') {
      const checkInterval = setInterval(() => {
        if (Date.now() - lastDataReceived.current > 5000 && !isReconnecting.current) {
          console.log('Keine Daten für 5 Sekunden - Neustart');
          reconnect();
        }
      }, 5000);

      return () => clearInterval(checkInterval);
    }
  }, [reconnect, printer.type]);

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