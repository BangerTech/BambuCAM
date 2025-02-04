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
        if (videoRef.current) {
          videoRef.current.src = URL.createObjectURL(mediaSourceRef.current);
        }

        mediaSourceRef.current.addEventListener('sourceopen', () => {
          try {
            // MPEG-TS mit H.264 Video
            sourceBufferRef.current = mediaSourceRef.current.addSourceBuffer(
              'video/mp2t; codecs="avc1.42E01E"'
            );
            
            const wsUrl = `ws://${window.location.hostname}:${printer.wsPort}/stream/${printer.id}`;
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
                  if (e.name === 'QuotaExceededError') {
                    // Entferne alte Daten bei Buffer-Überlauf
                    sourceBufferRef.current.remove(0, videoRef.current.currentTime - 2);
                  }
                }
              } else {
                // Queue für späteres Hinzufügen
                queueRef.current.push(event.data);
              }
            };
            
            // Buffer-Queue Verarbeitung
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
      style={{ 
        width: '100%', 
        height: '100%',
        objectFit: 'contain'
      }}
    />
  );
};

export default RTSPStream; 