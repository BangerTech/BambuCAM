import React, { useRef, useEffect, useState } from 'react';

const RTSPStream = ({ printer, fullscreen }) => {
  const canvasRef = useRef(null);
  const wsRef = useRef(null);
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  
  useEffect(() => {
    console.log("RTSPStream mounted:", { printer, fullscreen });
    const canvas = canvasRef.current;
    if (!canvas || !printer) return;

    const connectWebSocket = () => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.close();
      }

      // Canvas-Größe setzen
      canvas.width = fullscreen ? window.innerWidth : canvas.offsetWidth;
      canvas.height = fullscreen ? window.innerHeight : canvas.offsetHeight;

      const wsUrl = `ws://${window.location.hostname}:${printer.wsPort}/stream/${printer.id}`;
      console.log("Connecting to WebSocket:", wsUrl);
      
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("WebSocket Connected");
        setConnectionAttempts(0);
      };

      ws.onclose = () => {
        console.log("WebSocket Closed");
        // Reconnect-Versuch nach 2 Sekunden, maximal 5 Versuche
        if (connectionAttempts < 5) {
          setTimeout(() => {
            setConnectionAttempts(prev => prev + 1);
            connectWebSocket();
          }, 2000);
        }
      };

      ws.onerror = (error) => {
        console.error("WebSocket Error:", error);
      };

      ws.onmessage = (event) => {
        console.log("Received WebSocket data:", event.data.size, "bytes");
        const ctx = canvas.getContext('2d');
        const img = new Image();
        
        img.onload = () => {
          // Bildgröße an Canvas anpassen
          if (fullscreen) {
            const scale = Math.min(
              canvas.width / img.width,
              canvas.height / img.height
            );
            const x = (canvas.width - img.width * scale) / 2;
            const y = (canvas.height - img.height * scale) / 2;
            
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
          } else {
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          }
          URL.revokeObjectURL(img.src); // Speicher freigeben
        };

        img.src = URL.createObjectURL(event.data);
      };
    };

    // Initial connection
    connectWebSocket();

    // Cleanup function
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [printer, fullscreen, connectionAttempts]); // connectionAttempts hinzugefügt

  // Window resize handler
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (canvas && fullscreen) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [fullscreen]);

  return (
    <canvas 
      ref={canvasRef}
      style={{
        width: fullscreen ? '100vw' : '100%',
        height: fullscreen ? '100vh' : '100%',
        backgroundColor: '#000',
        display: 'block'
      }}
    />
  );
};

export default RTSPStream; 