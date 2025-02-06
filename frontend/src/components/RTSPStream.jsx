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

    let retryCount = 0;
    const maxRetries = 3;
    let isComponentMounted = true;

    const setupMediaSource = () => {
      if (!isComponentMounted || !videoRef.current) return;
      try {
        mediaSourceRef.current = new MediaSource();
        videoRef.current.src = URL.createObjectURL(mediaSourceRef.current);

        mediaSourceRef.current.addEventListener('sourceopen', () => {
          try {
            if (!isComponentMounted) return;
            sourceBufferRef.current = mediaSourceRef.current.addSourceBuffer(
              'video/mp2t; codecs="avc1.640029"'
            );
            
            const wsUrl = `ws://${window.location.hostname}:9000/stream/${printer.id}`;
            console.log('Connecting to WebSocket:', wsUrl);
            
            wsRef.current = new WebSocket(wsUrl);
            wsRef.current.binaryType = 'arraybuffer';
            
            wsRef.current.onopen = () => {
              if (!isComponentMounted) return;
              console.log('WebSocket Connected');
              retryCount = 0;
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
            };
            
            wsRef.current.onmessage = (event) => {
              if (sourceBufferRef.current && !sourceBufferRef.current.updating) {
                try {
                  sourceBufferRef.current.appendBuffer(event.data);
                } catch (e) {
                  console.error('Error appending buffer:', e);
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
        console.error('Error setting up MediaSource:', e);
      }
    };

    setupMediaSource();

    return () => {
      isComponentMounted = false;
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