#!/usr/bin/env python3
import sys
import json
import os
import asterisk.agi

def check_did(agi, did):
	# Get absolute paths for config files
	base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
	projects_file = os.path.join(base_dir, 'projects.json')
	settings_file = os.path.join(base_dir, 'settings.json')

	# Load projects file
	try:
		with open(projects_file, 'r') as f:
			projects = json.load(f)
	except FileNotFoundError:
		projects = []

	# Load settings to check catch-all status
	try:
		with open(settings_file, 'r') as f:
			settings = json.load(f)
			catch_all_enabled = settings.get('catchAllEnabled', False)
	except FileNotFoundError:
		catch_all_enabled = False

	# Check if DID exists in any project
	did_exists = any(did in project.get('dids', []) for project in projects)

	# Set variables for dialplan
	agi.set_variable('DID_EXISTS', '1' if did_exists else '0')
	agi.set_variable('CATCH_ALL_ENABLED', '1' if catch_all_enabled else '0')

if __name__ == '__main__':
	agi = asterisk.agi.AGI()
	did = sys.argv[1] if len(sys.argv) > 1 else ''
	check_did(agi, did)