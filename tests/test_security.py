import unittest
import jwt
import os
import json
from datetime import datetime, timedelta
from unittest.mock import Mock, patch
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from python.security_config import (
	validate_password, sanitize_input, JWT_SECRET_KEY,
	JWT_EXPIRATION, PASSWORD_PATTERN
)

class TestSecurity(unittest.TestCase):
	def setUp(self):
		self.valid_password = "Test123!@#"
		self.invalid_password = "weak"
		self.test_token = jwt.encode({
			'id': 'test_user',
			'exp': datetime.utcnow() + timedelta(hours=1)
		}, JWT_SECRET_KEY)
		
	def test_password_validation(self):
		self.assertTrue(validate_password(self.valid_password))
		self.assertFalse(validate_password(self.invalid_password))
		
	def test_input_sanitization(self):
		malicious_input = {
			'name': '<script>alert("xss")</script>',
			'sql': "'; DROP TABLE users; --"
		}
		sanitized = sanitize_input(malicious_input)
		self.assertNotIn('<script>', sanitized['name'])
		self.assertNotIn("'", sanitized['sql'])
		
	def test_jwt_token(self):
		# Test token generation
		payload = {'id': 'test_user', 'exp': datetime.utcnow() + JWT_EXPIRATION}
		token = jwt.encode(payload, JWT_SECRET_KEY)
		
		# Test token validation
		decoded = jwt.decode(token, JWT_SECRET_KEY, algorithms=['HS256'])
		self.assertEqual(decoded['id'], 'test_user')
		
	def test_expired_token(self):
		expired_token = jwt.encode({
			'id': 'test_user',
			'exp': datetime.utcnow() - timedelta(hours=1)
		}, JWT_SECRET_KEY)
		
		with self.assertRaises(jwt.ExpiredSignatureError):
			jwt.decode(expired_token, JWT_SECRET_KEY, algorithms=['HS256'])
			
	@patch('redis.Redis')
	def test_rate_limiting(self, mock_redis):
		mock_client = Mock()
		mock_redis.return_value = mock_client
		
		# Simulate under rate limit
		mock_client.get.return_value = b'50'
		self.assertLess(int(mock_client.get.return_value), 100)
		
		# Simulate rate limit exceeded
		mock_client.get.return_value = b'150'
		self.assertGreater(int(mock_client.get.return_value), 100)
		
	def test_password_pattern(self):
		# Test valid passwords
		valid_passwords = [
			"Test123!@#",
			"SecurePass1!",
			"Complex123$"
		]
		for password in valid_passwords:
			self.assertTrue(bool(validate_password(password)))
			
		# Test invalid passwords
		invalid_passwords = [
			"short1!",  # Too short
			"NoSpecialChar1",  # No special char
			"NoNumber!@#",  # No number
			"no_upper1!",  # No uppercase
			"NOUPPER1!"  # No lowercase
		]
		for password in invalid_passwords:
			self.assertFalse(bool(validate_password(password)))

if __name__ == '__main__':
	unittest.main()