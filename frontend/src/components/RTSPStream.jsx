import React, { useEffect, useRef, useState } from 'react';
import { Logger } from '../utils/logger';

const RTSPStream = ({ printer }) => {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (printer?.type === 'BAMBULAB') {
      const videoElement = videoRef.current;
      if (!videoElement) return;
      if (streamRef.current) return;

      const streamUrl = `/go2rtc/stream.html?src=${encodeURIComponent(printer.streamUrl)}`;
      Logger.info('STREAM', 'Init', `Starting MSE stream from ${streamUrl}`);

      const iframe = document.createElement('iframe');
      iframe.src = streamUrl;
      iframe.style.width = '100%';
      iframe.style.height = '100%';
      iframe.style.border = 'none';
      videoElement.parentNode.replaceChild(iframe, videoElement);
      streamRef.current = iframe;

      return () => {
        if (iframe.parentNode) {
          iframe.parentNode.removeChild(iframe);
          streamRef.current = null;
        }
      };
    }
  }, [printer?.type]);

  // Für MJPEG Streams (Creality/OctoPrint)
  if (printer?.type !== 'BAMBULAB') {
    return (
      <img 
        src={printer.streamUrl}
        alt="Printer Stream"
        style={{width: '100%', height: '100%'}}
        onError={() => setError('Failed to load stream')}
        onLoad={() => setLoading(false)}
      />
    );
  }

  return (
    <>
      {error && <div>Error: {error}</div>}
      {loading && <div>Loading stream...</div>}
      <div
        ref={videoRef}
        style={{width: '100%', height: '100%'}}
      />
    </>
  );
};

export default RTSPStream; 