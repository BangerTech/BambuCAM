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
        // MediaSource erstellen
        mediaSourceRef.current = new MediaSource();
        videoRef.current.src = URL.createObjectURL(mediaSourceRef.current);

        mediaSourceRef.current.addEventListener('sourceopen', () => {
          try {
            // SourceBuffer für MPEG-TS erstellen
            sourceBufferRef.current = mediaSourceRef.current.addSourceBuffer('video/mp2t');
            
            // WebSocket verbinden
            const wsUrl = `wss://${window.location.hostname}:${printer.wsPort}/stream/${printer.id}`;
            console.log('Connecting to WebSocket:', wsUrl);
            
            wsRef.current = new WebSocket(wsUrl);
            
            wsRef.current.binaryType = 'arraybuffer';
            
            wsRef.current.onopen = () => {
              console.log('WebSocket connected');
            };
            
            wsRef.current.onmessage = (event) => {
              if (sourceBufferRef.current && !sourceBufferRef.current.updating) {
                try {
                  sourceBufferRef.current.appendBuffer(event.data);
                } catch (e) {
                  console.error('Error appending buffer:', e);
                }
              } else {
                queueRef.current.push(event.data);
              }
            };
            
            wsRef.current.onerror = (error) => {
              console.error('WebSocket error:', error);
            };
            
            // Queue processing
            sourceBufferRef.current.addEventListener('updateend', () => {
              if (queueRef.current.length > 0 && !sourceBufferRef.current.updating) {
                sourceBufferRef.current.appendBuffer(queueRef.current.shift());
              }
            });
            
          } catch (e) {
            console.error('Error in sourceopen:', e);
          }
        });
        
      } catch (e) {
        console.error('Error setting up MediaSource:', e);
      }
    };

    setupMediaSource();

    // Cleanup
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (mediaSourceRef.current) {
        URL.revokeObjectURL(videoRef.current.src);
      }
    };
  }, [printer]);

  return (
    <video 
      ref={videoRef} 
      autoPlay 
      playsInline 
      style={{ 
        width: '100%', 
        height: '100%',
        objectFit: 'contain'
      }}
    />
  );
};

export default RTSPStream; 