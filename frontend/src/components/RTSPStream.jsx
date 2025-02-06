import React, { useEffect, useRef } from 'react';

// Dynamische API URL basierend auf dem aktuellen Host
const API_URL = `http://${window.location.hostname}:4000`;

const RTSPStream = ({ printer, fullscreen, ...props }) => {
  const videoRef = useRef(null);
  const wsRef = useRef(null);
  const mediaSourceRef = useRef(null);
  const sourceBufferRef = useRef(null);
  const bufferCheckRef = useRef(null);
  const lastDataRef = useRef(Date.now());
  const isInitializedRef = useRef(false);
  const pendingBuffersRef = useRef([]);
  const logCountRef = useRef(0);  // Für Logging-Begrenzung

  useEffect(() => {
    if (!printer || !videoRef.current) return;

    console.log('RTSPStream mounted:', { printer, fullscreen });
    
    let retryCount = 0;
    const maxRetries = 3;
    let isComponentMounted = true;

    const initializeMediaSource = () => {
      return new Promise((resolve, reject) => {
        try {
          console.log('Initializing MediaSource...');
          const ms = new MediaSource();
          ms.addEventListener('sourceopen', () => {
            console.log('MediaSource opened');
            resolve(ms);
          });
          ms.addEventListener('error', (e) => {
            console.error('MediaSource error:', e);
            reject(e);
          });
          videoRef.current.src = URL.createObjectURL(ms);
        } catch (e) {
          reject(e);
        }
      });
    };

    const appendBuffer = (data) => {
      if (!sourceBufferRef.current || sourceBufferRef.current.updating) {
        // Log nur die ersten paar Buffer-Events
        if (logCountRef.current < 5) {
          console.log('Buffering data for later, pending buffers:', pendingBuffersRef.current.length);
          logCountRef.current++;
        }
        pendingBuffersRef.current.push(data);
        return;
      }

      try {
        // Log nur die ersten paar Chunks
        if (logCountRef.current < 5) {
          console.log('Appending buffer, size:', data.byteLength);
          logCountRef.current++;
        }
        sourceBufferRef.current.appendBuffer(data);
        
        if (videoRef.current.paused) {
          console.log('Starting video playback, readyState:', videoRef.current.readyState);
          videoRef.current.play().catch(e => {
            console.error('Play failed:', e);
            if (e.name === 'NotAllowedError') {
              console.log('Autoplay blocked, waiting for user interaction');
            }
          });
        }

        // Process any pending buffers
        if (pendingBuffersRef.current.length > 0 && !sourceBufferRef.current.updating) {
          // Log nur die ersten paar Verarbeitungen
          if (logCountRef.current < 5) {
            console.log('Processing pending buffer, remaining:', pendingBuffersRef.current.length);
            logCountRef.current++;
          }
          const nextBuffer = pendingBuffersRef.current.shift();
          appendBuffer(nextBuffer);
        }
      } catch (e) {
        console.error('Error appending buffer:', e);
        if (e.name === 'QuotaExceededError') {
          console.log('Buffer full, removing old data');
          sourceBufferRef.current.remove(0, videoRef.current.currentTime - 1);
        }
      }
    };

    const setupMediaSource = async () => {
      if (!isComponentMounted || !videoRef.current) return;
      
      try {
        console.log('Setting up new MediaSource...');
        
        // Cleanup old MediaSource
        if (mediaSourceRef.current) {
          if (sourceBufferRef.current) {
            try {
              mediaSourceRef.current.removeSourceBuffer(sourceBufferRef.current);
            } catch (e) {
              console.warn('Error removing old SourceBuffer:', e);
            }
          }
          mediaSourceRef.current = null;
          sourceBufferRef.current = null;
        }

        // Clear pending buffers
        pendingBuffersRef.current = [];

        // Initialize new MediaSource
        mediaSourceRef.current = await initializeMediaSource();
        console.log('Setting up SourceBuffer...');
        sourceBufferRef.current = mediaSourceRef.current.addSourceBuffer(
          'video/mp2t; codecs="avc1.640029"'
        );

        sourceBufferRef.current.addEventListener('updateend', () => {
          if (pendingBuffersRef.current.length > 0) {
            console.log('Buffer update complete, processing pending buffer');
            const nextBuffer = pendingBuffersRef.current.shift();
            appendBuffer(nextBuffer);
          }
        });
        
        sourceBufferRef.current.addEventListener('error', (e) => {
          console.error('SourceBuffer error:', e);
        });
        
        const wsUrl = `ws://${window.location.hostname}:9000/stream/${printer.id}`;
        console.log('Connecting to WebSocket:', wsUrl);
        
        wsRef.current = new WebSocket(wsUrl);
        wsRef.current.binaryType = 'arraybuffer';
        
        wsRef.current.onopen = () => {
          if (!isComponentMounted) return;
          console.log('WebSocket Connected, waiting for video data...');
          retryCount = 0;
          isInitializedRef.current = true;
        };

        wsRef.current.onclose = () => {
          console.log('WebSocket Closed');
          if (!isComponentMounted) return;
          if (retryCount < maxRetries) {
            console.log(`Attempting reconnect (${retryCount + 1}/${maxRetries})...`);
            retryCount++;
            setTimeout(setupMediaSource, 1000);
          }
        };

        wsRef.current.onerror = (error) => {
          console.error('WebSocket Error:', error);
          if (wsRef.current) {
            wsRef.current.close();
          }
        };

        wsRef.current.onmessage = (event) => {
          if (!isComponentMounted) return;
          lastDataRef.current = Date.now();
          
          // Log nur die ersten paar Nachrichten
          if (logCountRef.current < 5) {
            console.log('Received data chunk, size:', event.data.byteLength);
            logCountRef.current++;
          }
          
          if (!sourceBufferRef.current) {
            console.error('No SourceBuffer available!');
            return;
          }
          
          appendBuffer(event.data);
        };

        // Add video element event listeners
        videoRef.current.addEventListener('error', (e) => {
          console.error('Video error:', e);
        });

        videoRef.current.addEventListener('stalled', () => {
          console.log('Video stalled');
        });

        videoRef.current.addEventListener('waiting', () => {
          console.log('Video waiting for data');
        });

        videoRef.current.addEventListener('playing', () => {
          console.log('Video playing');
        });

      } catch (e) {
        console.error('Error in setupMediaSource:', e);
        if (retryCount < maxRetries) {
          retryCount++;
          console.log(`Retrying setup (${retryCount}/${maxRetries})...`);
          setTimeout(setupMediaSource, 1000);
        }
      }
    };

    setupMediaSource();

    // Reset log counter when component unmounts
    return () => {
      console.log('RTSPStream unmounting, cleaning up...');
      isComponentMounted = false;
      isInitializedRef.current = false;
      if (bufferCheckRef.current) {
        clearInterval(bufferCheckRef.current);
      }
      try {
        if (wsRef.current) {
          wsRef.current.close();
          wsRef.current = null;
        }
        if (videoRef.current && videoRef.current.src) {
          URL.revokeObjectURL(videoRef.current.src);
          videoRef.current.src = '';
        }
        if (sourceBufferRef.current && mediaSourceRef.current) {
          try {
            mediaSourceRef.current.removeSourceBuffer(sourceBufferRef.current);
            sourceBufferRef.current = null;
          } catch (e) {
            console.warn('Error removing source buffer:', e);
          }
        }
        mediaSourceRef.current = null;
      } catch (e) {
        console.warn('Error during cleanup:', e);
      }
      logCountRef.current = 0;
    };
  }, [printer]);

  return (
    <video
      ref={videoRef}
      {...props}
      autoPlay
      playsInline
      muted
      controls={false}
      style={{ 
        width: '100%',
        height: '100%',
        objectFit: fullscreen ? 'contain' : 'cover',
        ...props.style
      }}
    />
  );
};

export default RTSPStream; 