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
            // MPEG-TS mit H.264 Video (Baseline Profile)
            sourceBufferRef.current = mediaSourceRef.current.addSourceBuffer(
              'video/mp2t; codecs="avc1.42001E"'  // Baseline Profile Level 3.0
            );
            
            const wsUrl = `ws://${window.location.hostname}:${printer.wsPort}/stream/${printer.id}`;
            console.log('Connecting to WebSocket:', wsUrl);
            
            wsRef.current = new WebSocket(wsUrl);
            wsRef.current.binaryType = 'arraybuffer';
            
            wsRef.current.onopen = () => {
              console.log('WebSocket connected');
            };

            wsRef.current.onerror = (error) => {
              console.error('WebSocket error:', error);
            };

            wsRef.current.onclose = (event) => {
              console.log('WebSocket closed:', event.code, event.reason);
              // Versuche Reconnect nach 5 Sekunden
              setTimeout(setupMediaSource, 5000);
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