import sys
from unittest.mock import MagicMock

# Mock external dependencies
mock_pjsua = MagicMock()
mock_pjsua.Lib = MagicMock
mock_pjsua.AccountConfig = MagicMock
mock_pjsua.Error = Exception

mock_asterisk = MagicMock()
mock_asterisk.manager = MagicMock()
mock_asterisk.agi = MagicMock()

mock_speech = MagicMock()
mock_speech.SpeechClient = MagicMock

mock_storage = MagicMock()
mock_storage.Client = MagicMock

# Install mocks
sys.modules['pjsua'] = mock_pjsua
sys.modules['asterisk.manager'] = mock_asterisk.manager
sys.modules['asterisk.agi'] = mock_asterisk.agi
sys.modules['google.cloud.speech'] = mock_speech
sys.modules['google.cloud.storage'] = mock_storage