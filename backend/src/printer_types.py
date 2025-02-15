PRINTER_CONFIGS = {
    'BAMBULAB': {
        'stream_type': 'rtsp',
        'stream_url_template': 'rtsps://bblp:{access_code}@{ip}:322/streaming/live/1',
        'ffmpeg_options': [
            '-rtsp_transport', 'tcp',
            '-fflags', 'nobuffer',
            '-flags', 'low_delay',
            '-max_delay', '100000'
        ]
    },
    'CREALITY': {
        'stream_type': 'mjpeg',
        'stream_url_template': 'http://{ip}:8080/?action=stream',
        'ffmpeg_options': [
            '-f', 'mjpeg',
            '-reconnect', '1',
            '-reconnect_at_eof', '1'
        ]
    },
    'CUSTOM': {
        'stream_type': 'auto',
        'stream_url_template': '{stream_url}',  # Direkt die eingegebene URL verwenden
        'ffmpeg_options': []  # Basis-Optionen, werden je nach URL angepasst
    }
} 