import React, { useEffect, useRef, useState } from 'react';
import { Logger } from '../utils/logger';

const RTSPStream = ({ printer }) => {
  const videoRef = useRef(null);
  const pcRef = useRef(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Nur für BambuLab Drucker
    if (printer?.type === 'BAMBULAB') {
      const setupWebRTC = async () => {
        try {
          Logger.info('STREAM', 'Init', `Initializing WebRTC stream for printer: ${printer.name} (${printer.id})`);
          Logger.debug('STREAM', 'Config', 'Printer configuration:', printer);
          
          // WebRTC Setup
          Logger.debug('STREAM', 'Setup', 'Creating RTCPeerConnection');
          const pc = new RTCPeerConnection({
            iceServers: [],
            sdpSemantics: 'unified-plan'
          });
          pcRef.current = pc;

          // Track Handler
          pc.ontrack = (event) => {
            Logger.debug('STREAM', 'Track', 'Received media track', event.track.kind);
            if (videoRef.current && event.streams[0]) {
              videoRef.current.srcObject = event.streams[0];
              videoRef.current.play()
                .then(() => {
                  Logger.info('STREAM', 'Video', 'Video playback started');
          setLoading(false);
                })
                .catch(err => {
                  Logger.error('STREAM', 'Video', 'Failed to start video playback:', err);
                });
            }
          };

          // ICE Kandidaten Logging
          pc.onicecandidate = (event) => {
            if (event.candidate) {
              Logger.debug('STREAM', 'ICE', 'New ICE candidate:', event.candidate.candidate);
            }
          };

          // Verbindungsstatus Logging
          pc.onconnectionstatechange = () => {
            Logger.info('STREAM', 'Connection', `WebRTC connection state: ${pc.connectionState}`);
          };

          // Erster Request mit Stream-URL
          Logger.debug('STREAM', 'API', 'Requesting WebRTC offer from go2rtc');
          const response = await fetch(`/go2rtc/api/webrtc`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            body: JSON.stringify({
              src: printer.streamUrl,  // Hier die Stream-URL verwenden
              sdp: ''  // Leerer SDP für ersten Request
            })
          });

          if (!response.ok) {
            const errorText = await response.text();
            Logger.error('STREAM', 'API', `Failed to get WebRTC offer: ${response.status}`, errorText);
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          
          const data = await response.json();
          Logger.debug('STREAM', 'SDP', 'Received offer from go2rtc');

          // Remote Description setzen
          Logger.debug('STREAM', 'SDP', 'Setting remote description');
          await pc.setRemoteDescription(new RTCSessionDescription(data));
          
          // Answer erstellen
          Logger.debug('STREAM', 'SDP', 'Creating answer');
          const answer = await pc.createAnswer();
          Logger.debug('STREAM', 'SDP', 'Setting local description');
          await pc.setLocalDescription(answer);

          // Answer an go2rtc senden
          Logger.debug('STREAM', 'API', 'Sending answer to go2rtc');
          const answerResponse = await fetch(`/go2rtc/api/webrtc`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                src: printer.id,  // Wichtig: Wir nutzen die Stream-ID statt der URL
                sdp: answer.sdp
            })
          });

          if (!answerResponse.ok) {
            const errorText = await answerResponse.text();
            Logger.error('STREAM', 'API', `Failed to send answer to go2rtc: ${errorText}`);
            throw new Error(`Failed to send answer: ${errorText}`);
          }

          Logger.info('STREAM', 'Setup', 'WebRTC setup completed successfully');

    } catch (err) {
          Logger.error('STREAM', 'Setup', `Failed to setup stream: ${err.message}`, err);
              setError('Failed to connect to video stream');
          setLoading(false);
        }
      };

      setupWebRTC();

      // Cleanup
      return () => {
        Logger.debug('STREAM', 'Cleanup', 'Cleaning up WebRTC connection');
        if (pcRef.current) {
          pcRef.current.close();
          pcRef.current = null;
        }
        if (videoRef.current) {
          videoRef.current.srcObject = null;
        }
      };
    }
  }, [printer]);

  // Für MJPEG Streams (Creality/OctoPrint)
  if (printer?.type !== 'BAMBULAB') {
    Logger.debug('STREAM', 'Init', `Setting up MJPEG stream for ${printer?.type} printer`);
    return (
      <img 
        src={printer.streamUrl}
        alt="Printer Stream"
        style={{width: '100%', height: '100%'}}
        onError={() => {
          Logger.error('STREAM', 'MJPEG', 'Failed to load MJPEG stream');
          setError('Failed to load stream');
        }}
        onLoad={() => {
          Logger.info('STREAM', 'MJPEG', 'MJPEG stream loaded successfully');
        }}
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