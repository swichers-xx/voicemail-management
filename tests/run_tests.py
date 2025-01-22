#!/usr/bin/env python3
import unittest
import subprocess
import sys
import os
from __init__ import setup_test_environment, teardown_test_environment

def run_python_tests():
	print("Running Python tests...")
	try:
		setup_test_environment()
		loader = unittest.TestLoader()
		start_dir = os.path.dirname(os.path.abspath(__file__))
		suite = loader.discover(start_dir, pattern='test_*.py')
		
		runner = unittest.TextTestRunner(verbosity=2)
		python_result = runner.run(suite)
		return python_result.wasSuccessful()
	finally:
		teardown_test_environment()

def run_js_tests():
	print("\nRunning JavaScript tests...")
	try:
		result = subprocess.run(['npm', 'test'], 
							  cwd=os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
							  capture_output=True,
							  text=True)
		print(result.stdout)
		if result.stderr:
			print("Errors:", result.stderr)
		return result.returncode == 0
	except Exception as e:
		print(f"Error running JavaScript tests: {e}")
		return False

if __name__ == '__main__':
	os.chdir(os.path.dirname(os.path.abspath(__file__)))
	python_success = run_python_tests()
	js_success = run_js_tests()
	
	if not (python_success and js_success):
		sys.exit(1)
	print("\nAll tests passed successfully!")