import React, { useEffect, useRef } from 'react';

const RTSPStream = ({ url, wsPort }) => {
  const canvasRef = useRef(null);
  const playerRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

  useEffect(() => {
    if (!url || !wsPort) {
      console.log('Warte auf URL und Port:', { url, wsPort });
      return;
    }

    const wsUrl = `ws://${window.location.hostname}:${wsPort}/stream`;
    console.log('Verbinde mit WebSocket:', wsUrl);
    
    const connectWebSocket = () => {
      if (canvasRef.current && typeof JSMpeg !== 'undefined') {
        try {
          if (playerRef.current) {
            playerRef.current.destroy();
          }

          playerRef.current = new JSMpeg.Player(wsUrl, {
            canvas: canvasRef.current,
            audio: false,
            pauseWhenHidden: false,
            onDestroy: () => {
              console.log('Player destroyed');
              if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
              }
            },
            onError: (error) => {
              console.error('JSMpeg Error:', error);
              // Automatischer Reconnect nach 2 Sekunden
              if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
              }
              reconnectTimeoutRef.current = setTimeout(connectWebSocket, 2000);
            }
          });
        } catch (error) {
          console.error('Fehler beim Erstellen des Players:', error);
          // Auch hier Reconnect versuchen
          if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
          }
          reconnectTimeoutRef.current = setTimeout(connectWebSocket, 2000);
        }
      }
    };

    connectWebSocket();

    // Cleanup
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (playerRef.current) {
        playerRef.current.destroy();
      }
    };
  }, [url, wsPort]);

  return (
    <canvas 
      ref={canvasRef}
      style={{ 
        width: '100%',
        height: '100%',
        backgroundColor: '#000'
      }}
    />
  );
};

export default RTSPStream; 