#!/usr/bin/env python3
import sys
import os
import json
import shutil
from datetime import datetime
import requests
from google.cloud import speech
from google.cloud import storage

def process_voicemail(voicemail_id, caller_number, did):
	# Get absolute paths
	base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
	voicemail_dir = os.path.join(base_dir, 'voicemails')
	projects_file = os.path.join(base_dir, 'projects.json')
	
	recording_file = os.path.join("/var/spool/asterisk/voicemail", f"{voicemail_id}.wav")
	dest_path = os.path.join(voicemail_dir, f"{voicemail_id}.wav")
	
	# Create voicemail directory if it doesn't exist
	os.makedirs(voicemail_dir, exist_ok=True)
	
	# Move recording to application storage
	shutil.move(recording_file, dest_path)
	
	# Get audio duration
	duration = get_audio_duration(dest_path)
	
	# Transcribe voicemail
	transcription = transcribe_audio(dest_path)
	
	# Create voicemail metadata
	metadata = {
		'id': voicemail_id,
		'caller': caller_number,
		'did': did,
		'timestamp': datetime.now().isoformat(),
		'duration': duration,
		'transcription': transcription,
		'audioUrl': dest_path,
		'isNew': True,
		'isCatchAll': did == 'catch-all'
	}
	
	# Save metadata
	save_metadata(metadata, voicemail_dir)
	
	# If this is a catch-all voicemail, add it to the catch-all project
	if did == 'catch-all':
		add_to_catch_all_project(metadata, projects_file)
	
	# Send notifications
	send_notifications(metadata)

def add_to_catch_all_project(metadata, projects_file):
	try:
		with open(projects_file, 'r') as f:
			projects = json.load(f)
	except FileNotFoundError:
		projects = []
	
	# Find or create catch-all project
	catch_all_project = next(
		(p for p in projects if p.get('isCatchAll', False)),
		None
	)
	
	if not catch_all_project:
		catch_all_project = {
			'id': 'catch-all',
			'name': 'General Voicemail Box',
			'description': 'Voicemails from unrecognized DIDs',
			'isCatchAll': True,
			'voicemails': []
		}
		projects.append(catch_all_project)
	
	# Add voicemail to project
	catch_all_project['voicemails'].append(metadata)
	
	# Save updated projects
	with open(projects_file, 'w') as f:
		json.dump(projects, f)

def get_audio_duration(file_path):
	# Implementation to get audio duration
	return "0:30"  # Placeholder

def transcribe_audio(file_path):
	client = speech.SpeechClient()
	
	with open(file_path, 'rb') as audio_file:
		content = audio_file.read()
	
	audio = speech.RecognitionAudio(content=content)
	config = speech.RecognitionConfig(
		encoding=speech.RecognitionConfig.AudioEncoding.LINEAR16,
		language_code="en-US"
	)
	
	response = client.recognize(config=config, audio=audio)
	return " ".join(result.alternatives[0].transcript for result in response.results)

def save_metadata(metadata, voicemail_dir):
	metadata_file = os.path.join(voicemail_dir, f"{metadata['id']}.json")
	with open(metadata_file, 'w') as f:
		json.dump(metadata, f)

def send_notifications(metadata):
	# Send email notification
	email_data = {
		'subject': f'New voicemail from {metadata["caller"]}',
		'body': f'You have received a new voicemail.\n\nTranscription: {metadata["transcription"]}'
	}
	requests.post('http://localhost:5000/api/notifications/email', json=email_data)

if __name__ == '__main__':
	if len(sys.argv) != 4:
		print("Usage: process_voicemail.py <voicemail_id> <caller_number> <did>")
		sys.exit(1)
	
	process_voicemail(sys.argv[1], sys.argv[2], sys.argv[3])