# Voicemail System Installation Guide

## Prerequisites
- Python 3.8 or higher
- Asterisk 18 or higher
- Node.js 14 or higher (for development)
- SQL Server instance for DNC list
- Google Cloud account for speech-to-text (optional)

## Installation Steps

1. Install Asterisk and dependencies:
```bash
sudo apt-get update
sudo apt-get install asterisk asterisk-dev
```

2. Copy Asterisk configuration files:
```bash
sudo cp asterisk/sip.conf /etc/asterisk/
sudo cp asterisk/extensions.conf /etc/asterisk/
sudo chown asterisk:asterisk /etc/asterisk/*.conf
```

3. Install Python dependencies:
```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

4. Set up voicemail directories:
```bash
sudo mkdir -p /usr/local/voicemail
sudo cp -r python/* /usr/local/voicemail/
sudo chown -R asterisk:asterisk /usr/local/voicemail
```

5. Install systemd service:
```bash
sudo cp systemd/voicemail.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable voicemail
sudo systemctl start voicemail
```

6. Configure Google Cloud credentials (if using speech-to-text):
```bash
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/credentials.json"
```

7. Start the services:
```bash
sudo systemctl restart asterisk
sudo systemctl start voicemail
```

## Configuration

1. Update SIP trunk settings in `/etc/asterisk/sip.conf`
2. Configure email notifications in the web interface
3. Set up Google Cloud credentials if using speech-to-text
4. Configure SQL Server connection for DNC list integration

## Testing

1. Make a test call to your configured DID
2. Check the web interface for the recorded voicemail
3. Verify email notifications are working
4. Test transcription if enabled

## Troubleshooting

- Check Asterisk logs: `sudo tail -f /var/log/asterisk/messages`
- Check voicemail service logs: `sudo journalctl -u voicemail`
- Verify Asterisk is running: `sudo systemctl status asterisk`
- Test SIP registration: `asterisk -rx "sip show peers"`