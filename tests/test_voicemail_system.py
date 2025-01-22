import unittest
import os
import json
import shutil
from unittest.mock import Mock, patch
import sys
sys.path.append('../python')

from voicemail_server import VoicemailServer
from process_voicemail import process_voicemail
from check_did import check_did

class TestVoicemailSystem(unittest.TestCase):
	def setUp(self):
		self.test_dir = 'test_data'
		os.makedirs(self.test_dir, exist_ok=True)
		self.server = VoicemailServer()
		
	def tearDown(self):
		shutil.rmtree(self.test_dir, ignore_errors=True)
		
	def test_project_management(self):
		# Test project creation
		project = {
			'name': 'Test Project',
			'description': 'Test Description',
			'dids': ['+1234567890']
		}
		self.server.projects.append(project)
		self.server.save_projects()
		
		# Verify project was saved
		self.assertTrue(os.path.exists('projects.json'))
		with open('projects.json', 'r') as f:
			saved_projects = json.load(f)
		self.assertEqual(len(saved_projects), 1)
		self.assertEqual(saved_projects[0]['name'], 'Test Project')
		
	def test_catch_all_functionality(self):
		# Test catch-all settings
		self.server.settings['catchAllEnabled'] = True
		self.server.settings['catchAllGreeting'] = 'Test greeting'
		self.server.save_settings()
		
		# Verify settings were saved
		self.assertTrue(os.path.exists('settings.json'))
		with open('settings.json', 'r') as f:
			saved_settings = json.load(f)
		self.assertTrue(saved_settings['catchAllEnabled'])
		
	@patch('asterisk.agi.AGI')
	def test_did_checking(self, mock_agi):
		# Setup mock AGI
		agi = Mock()
		mock_agi.return_value = agi
		
		# Test DID checking
		check_did(agi, '+1234567890')
		
		# Verify AGI variables were set
		agi.set_variable.assert_any_call('DID_EXISTS', '1')
		
	@patch('google.cloud.speech.SpeechClient')
	def test_voicemail_processing(self, mock_speech_client):
		# Setup mock transcription
		mock_client = Mock()
		mock_speech_client.return_value = mock_client
		mock_client.recognize.return_value.results = []
		
		# Create test voicemail file
		test_file = os.path.join(self.test_dir, 'test_voicemail.wav')
		with open(test_file, 'wb') as f:
			f.write(b'dummy audio data')
			
		# Test voicemail processing
		process_voicemail('test_id', '+1234567890', '+9876543210')
		
		# Verify voicemail metadata was created
		self.assertTrue(os.path.exists(f"voicemails/test_id.json"))

if __name__ == '__main__':
	unittest.main()