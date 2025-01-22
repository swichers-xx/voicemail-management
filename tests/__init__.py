import os
import shutil

def setup_test_environment():
	# Create test directories
	test_dirs = ['test_data', 'voicemails']
	for dir_name in test_dirs:
		os.makedirs(dir_name, exist_ok=True)

	# Create initial test data
	with open('projects.json', 'w') as f:
		f.write('[]')
	
	with open('settings.json', 'w') as f:
		f.write('{"catchAllEnabled": false}')

def teardown_test_environment():
	# Clean up test directories
	test_dirs = ['test_data', 'voicemails']
	for dir_name in test_dirs:
		if os.path.exists(dir_name):
			shutil.rmtree(dir_name)
	
	# Clean up test files
	test_files = ['projects.json', 'settings.json']
	for file_name in test_files:
		if os.path.exists(file_name):
			os.remove(file_name)