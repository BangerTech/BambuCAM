import React, { useEffect, useRef } from 'react';

const RTSPStream = ({ url, wsPort }) => {
  const canvasRef = useRef(null);
  
  useEffect(() => {
    if (!url || !wsPort) {
      console.log('Warte auf URL und Port:', { url, wsPort });
      return;
    }

    console.log('Verbinde mit WebSocket:', `ws://${window.location.hostname}:${wsPort}/stream`);
    
    const client = new JSMpeg.Player(`ws://${window.location.hostname}:${wsPort}/stream`, {
      canvas: canvasRef.current,
      audio: false,
      pauseWhenHidden: false
    });

    return () => {
      if (client) {
        client.destroy();
      }
    };
  }, [url, wsPort]);

  return (
    <canvas 
      ref={canvasRef}
      style={{
        width: '100%',
        height: '100%',
        objectFit: 'contain',
        background: '#000'
      }}
    />
  );
};

export default RTSPStream; 