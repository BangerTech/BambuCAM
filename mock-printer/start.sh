#!/bin/sh

# Starte RTSP Server auf verschiedenen Ports
gst-launch-1.0 -v videotestsrc pattern=ball ! \
    video/x-raw,width=1280,height=720,framerate=30/1 ! \
    x264enc ! rtph264pay ! \
    rtspserversink protocols=tcp port=8554 \
    address=0.0.0.0 service=8554 path=/streaming/live/1 &

gst-launch-1.0 -v videotestsrc pattern=snow ! \
    video/x-raw,width=1280,height=720,framerate=30/1 ! \
    x264enc ! rtph264pay ! \
    rtspserversink protocols=tcp port=8555 \
    address=0.0.0.0 service=8555 path=/streaming/live/1 &

gst-launch-1.0 -v videotestsrc pattern=smpte ! \
    video/x-raw,width=1280,height=720,framerate=30/1 ! \
    x264enc ! rtph264pay ! \
    rtspserversink protocols=tcp port=8556 \
    address=0.0.0.0 service=8556 path=/streaming/live/1 &

# Warte auf alle Hintergrundprozesse
wait 