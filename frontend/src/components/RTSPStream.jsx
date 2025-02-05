import React, { useEffect, useRef } from 'react';

const RTSPStream = ({ printer }) => {
  const videoRef = useRef(null);
  const wsRef = useRef(null);
  const mediaSourceRef = useRef(null);
  const sourceBufferRef = useRef(null);
  const queueRef = useRef([]);

  useEffect(() => {
    if (!printer) return;

    const setupMediaSource = () => {
      try {
        mediaSourceRef.current = new MediaSource();
        videoRef.current.src = URL.createObjectURL(mediaSourceRef.current);

        mediaSourceRef.current.addEventListener('sourceopen', () => {
          try {
            // Korrekter MIME-Type für MPEG-TS mit H.264
            sourceBufferRef.current = mediaSourceRef.current.addSourceBuffer(
              'video/mp2t; codecs="avc1.640029"'
            );
            
            const wsUrl = `ws://${window.location.hostname}:${printer.wsPort}/stream/${printer.id}`;
            console.log('Connecting to WebSocket:', wsUrl);
            
            wsRef.current = new WebSocket(wsUrl);
            wsRef.current.binaryType = 'arraybuffer';
            
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

            // Debug Events
            wsRef.current.onopen = () => console.log('WebSocket Connected');
            wsRef.current.onerror = (e) => console.error('WebSocket Error:', e);
            wsRef.current.onclose = () => console.log('WebSocket Closed');
            
          } catch (e) {
            console.error('Error in sourceopen:', e);
          }
        });
      } catch (e) {
        console.error('Error setting up MediaSource:', e);
      }
    };

    setupMediaSource();

    // Füge ein Video-Error-Event hinzu
    videoRef.current.onerror = (error) => {
      console.error('Video error:', error);
    };

    return () => {
      try {
        if (wsRef.current) {
          wsRef.current.close();
        }
        if (videoRef.current && videoRef.current.src) {
          URL.revokeObjectURL(videoRef.current.src);
        }
        if (sourceBufferRef.current && mediaSourceRef.current) {
          try {
            mediaSourceRef.current.removeSourceBuffer(sourceBufferRef.current);
          } catch (e) {
            console.warn('Error removing source buffer:', e);
          }
        }
      } catch (e) {
        console.warn('Error during cleanup:', e);
      }
    };
  }, [printer]);

  return (
    <video 
      ref={videoRef} 
      autoPlay 
      playsInline 
      muted
      controls
      style={{ 
        width: '100%', 
        height: '100%',
        objectFit: 'contain',
        backgroundColor: '#000'
      }}
    />
  );
};

export default RTSPStream; 