import os
from datetime import timedelta
from functools import wraps
from flask import request, jsonify
import jwt
from werkzeug.security import generate_password_hash, check_password_hash
import re

# Security settings
JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'your-secret-key-here')
JWT_EXPIRATION = timedelta(hours=8)
PASSWORD_PATTERN = r'^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}$'
ALLOWED_IPS = os.environ.get('ALLOWED_IPS', '127.0.0.1').split(',')
RATE_LIMIT = int(os.environ.get('RATE_LIMIT', '100'))
RATE_LIMIT_PERIOD = int(os.environ.get('RATE_LIMIT_PERIOD', '3600'))

def require_auth(f):
	@wraps(f)
	def decorated(*args, **kwargs):
		token = request.headers.get('Authorization')
		if not token:
			return jsonify({'error': 'No token provided'}), 401
		
		try:
			token = token.split(' ')[1]
			payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=['HS256'])
			request.user = payload
		except jwt.ExpiredSignatureError:
			return jsonify({'error': 'Token expired'}), 401
		except jwt.InvalidTokenError:
			return jsonify({'error': 'Invalid token'}), 401
			
		return f(*args, **kwargs)
	return decorated

def validate_password(password):
	return bool(re.match(PASSWORD_PATTERN, password))

def check_ip_whitelist():
	client_ip = request.remote_addr
	return client_ip in ALLOWED_IPS

def rate_limit(key_prefix):
	def decorator(f):
		@wraps(f)
		def decorated(*args, **kwargs):
			from redis import Redis
			redis_client = Redis(host='redis', port=6379, db=0)
			
			key = f"{key_prefix}:{request.remote_addr}"
			current = redis_client.get(key)
			
			if current is not None and int(current) >= RATE_LIMIT:
				return jsonify({'error': 'Rate limit exceeded'}), 429
				
			pipe = redis_client.pipeline()
			pipe.incr(key)
			pipe.expire(key, RATE_LIMIT_PERIOD)
			pipe.execute()
			
			return f(*args, **kwargs)
		return decorated
	return decorator

def sanitize_input(data):
	if isinstance(data, str):
		# Remove potential XSS
		data = data.replace('<', '&lt;').replace('>', '&gt;')
		# Prevent SQL injection
		data = data.replace("'", "''")
	elif isinstance(data, dict):
		return {k: sanitize_input(v) for k, v in data.items()}
	elif isinstance(data, list):
		return [sanitize_input(x) for x in data]
	return data

def audit_log(action, user_id, resource_type, resource_id, status):
	from datetime import datetime
	log_entry = {
		'timestamp': datetime.utcnow().isoformat(),
		'action': action,
		'user_id': user_id,
		'resource_type': resource_type,
		'resource_id': resource_id,
		'status': status,
		'ip_address': request.remote_addr,
		'user_agent': request.user_agent.string
	}
	# Save to database or log file
	return log_entry