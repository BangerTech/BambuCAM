import React, { useEffect, useRef } from 'react';

const RTSPStream = ({ printer }) => {
  const videoRef = useRef(null);
  const wsRef = useRef(null);

  useEffect(() => {
    if (!printer) return;
    
    // Hole die Backend-URL aus der Umgebung oder verwende Standard
    const backendUrl = process.env.REACT_APP_API_URL || window.location.origin;
    const wsUrl = backendUrl.replace(/^http/, 'ws');
    
    // Verbinde zum Stream
    wsRef.current = new WebSocket(`${wsUrl}:${printer.wsPort}/stream/${printer.id}`);
    
    wsRef.current.onmessage = (event) => {
      // ... Rest des Codes ...
    };
    
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [printer]);
  
  return <video ref={videoRef} autoPlay playsInline />;
};

export default RTSPStream; 