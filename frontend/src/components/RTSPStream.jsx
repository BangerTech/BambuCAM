import React, { useEffect } from 'react';

const RTSPStream = ({ url }) => {
  useEffect(() => {
    const canvasId = `canvas-${Date.now()}`;
    const canvas = document.getElementById(canvasId);
    
    if (canvas && typeof JSMpeg !== 'undefined') {
      new JSMpeg.Player(url, {
        canvas: canvas,
        audio: false,
        pauseWhenHidden: false
      });
    }
  }, [url]);

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <canvas 
        id={`canvas-${Date.now()}`} 
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  );
};

export default RTSPStream; 