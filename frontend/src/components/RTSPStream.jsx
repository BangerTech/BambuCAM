import React, { useEffect, useRef, useState } from 'react';
import { Logger } from '../utils/logger';

const RTSPStream = ({ printer }) => {
  const videoRef = useRef(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (printer?.type === 'BAMBULAB') {
      const videoElement = videoRef.current;
      if (!videoElement) return;

      // MSE Stream URL
      const streamUrl = `/go2rtc/api/mse?src=${printer.id}`;
      Logger.info('STREAM', 'Init', `Starting MSE stream from ${streamUrl}`);

      videoElement.src = streamUrl;
      videoElement.onerror = (e) => {
        Logger.error('STREAM', 'Video', 'Failed to load video:', e);
        setError('Failed to load video stream');
        setLoading(false);
      };
      videoElement.onloadeddata = () => {
        Logger.info('STREAM', 'Video', 'Video stream loaded');
        setLoading(false);
      };

      return () => {
        videoElement.src = '';
      };
    }
  }, [printer]);

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
      <video
        ref={videoRef}
        autoPlay
        playsInline
        style={{width: '100%', height: '100%'}}
      />
    </>
  );
};

export default RTSPStream; 