import React, { useEffect, useRef } from 'react';

// Dynamische API URL basierend auf dem aktuellen Host
const API_URL = `http://${window.location.hostname}:4000`;

const RTSPStream = ({ printer, fullscreen, ...props }) => {
  const videoRef = useRef(null);
  const wsRef = useRef(null);
  const mediaSourceRef = useRef(null);
  const sourceBufferRef = useRef(null);

  useEffect(() => {
    if (!printer || !videoRef.current) return;

    console.log('RTSPStream mounted:', { printer, fullscreen });

    let isComponentMounted = true;

    const setupStream = async () => {
      try {
        // 1. Erst Stream im Backend starten
        const response = await fetch(`${API_URL}/stream/${printer.id}`);
        const data = await response.json();
        
        if (!data.status === 'success') {
          throw new Error('Failed to start stream');
        }

        // 2. MediaSource Setup
        mediaSourceRef.current = new MediaSource();
        videoRef.current.src = URL.createObjectURL(mediaSourceRef.current);

        mediaSourceRef.current.addEventListener('sourceopen', () => {
          try {
            if (!isComponentMounted) return;
            sourceBufferRef.current = mediaSourceRef.current.addSourceBuffer(
              'video/mp2t; codecs="avc1.640029"'
            );
            
            // 3. WebSocket Verbindung
            const wsUrl = `ws://${window.location.hostname}:9000/stream/${printer.id}`;
            console.log('Connecting to WebSocket:', wsUrl);
            
            wsRef.current = new WebSocket(wsUrl);
            wsRef.current.binaryType = 'arraybuffer';
            
            wsRef.current.onopen = () => {
              console.log('WebSocket Connected');
            };

            wsRef.current.onclose = () => {
              console.log('WebSocket Closed');
            };

            wsRef.current.onerror = (error) => {
              console.error('WebSocket Error:', error);
            };
            
            wsRef.current.onmessage = (event) => {
              if (sourceBufferRef.current && !sourceBufferRef.current.updating) {
                try {
                  sourceBufferRef.current.appendBuffer(event.data);
                } catch (e) {
                  if (e.name === 'QuotaExceededError') {
                    sourceBufferRef.current.remove(0, videoRef.current.currentTime - 1);
                  }
                }
              }
            };
          } catch (e) {
            console.error('Error in sourceopen:', e);
          }
        });
      } catch (e) {
        console.error('Error setting up stream:', e);
      }
    };

    setupStream();

    // Cleanup
    return () => {
      isComponentMounted = false;
      
      // Stream im Backend stoppen
      fetch(`${API_URL}/stream/${printer.id}/stop`, { method: 'POST' })
        .catch(e => console.warn('Error stopping stream:', e));
      
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
        } catch (e) {
          console.warn('Error removing source buffer:', e);
        }
        sourceBufferRef.current = null;
      }
      mediaSourceRef.current = null;
    };
  }, [printer, fullscreen]);

  return (
    <video
      ref={videoRef}
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