import React, { useEffect, useRef } from 'react';

const RTSPStream = ({ url }) => {
  const canvasRef = useRef(null);
  const playerRef = useRef(null);

  useEffect(() => {
    console.log('Initialisiere Stream mit URL:', url);
    
    if (!url) {
      console.error('Keine Stream-URL vorhanden');
      return;
    }

    const wsUrl = `ws://${window.location.hostname}:${url.includes('mock-printer') ? '9100' : '9101'}/stream`;
    console.log('WebSocket URL:', wsUrl);

    if (canvasRef.current && typeof JSMpeg !== 'undefined') {
      if (playerRef.current) {
        playerRef.current.destroy();
      }

      try {
        playerRef.current = new JSMpeg.Player(wsUrl, {
          canvas: canvasRef.current,
          audio: false,
          pauseWhenHidden: false,
          videoBufferSize: 1024*1024*2,
          onError: (error) => {
            console.error('Stream Fehler:', error);
          }
        });
      } catch (error) {
        console.error('Fehler beim Initialisieren des Players:', error);
      }
    }

    return () => {
      if (playerRef.current) {
        playerRef.current.destroy();
      }
    };
  }, [url]);

  return (
    <div style={{ 
      width: '100%', 
      paddingBottom: '56.25%', // 16:9 Aspect Ratio
      position: 'relative',
      background: '#000'
    }}>
      <canvas 
        ref={canvasRef}
        style={{ 
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          objectFit: 'contain'
        }}
      />
    </div>
  );
};

export default RTSPStream; 