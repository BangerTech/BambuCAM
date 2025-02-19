from functools import wraps
from flask import request, jsonify

def require_cloud_token(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({
                'error': 'Cloud token is required for God Mode'
            }), 401
        
        token = auth_header.split(' ')[1]
        if not token:
            return jsonify({
                'error': 'Invalid cloud token'
            }), 401
            
        return f(*args, **kwargs)
    return decorated_function 