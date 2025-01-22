# Enterprise Voicemail System

A comprehensive voicemail system with Asterisk integration, web dashboard, and DID management.

## Docker Deployment

### Prerequisites
- Docker
- Docker Compose
- Google Cloud credentials (for speech-to-text)

### Quick Start

1. Clone the repository:
```bash
git clone <repository-url>
cd voicemail_system_dashboard_by_seanwichers
```

2. Configure environment:
   - Place your Google Cloud credentials file in the root directory as `credentials.json`
   - Update SQL Server credentials in `docker-compose.yml` if needed
   - Configure Asterisk settings in `asterisk/sip.conf` and `asterisk/extensions.conf`

3. Initialize configuration files:
```bash
echo '[]' > projects.json
echo '{"catchAllEnabled": false}' > settings.json
```

4. Build and start services:
```bash
docker-compose up -d
```

5. Access the dashboard at `http://localhost:5000`

### Volumes
- `voicemail_data`: Stores recorded voicemails
- `custom_greetings`: Stores custom greeting messages
- `mssql_data`: Persists SQL Server data

### Ports
- 5000: Web dashboard
- 5060: SIP (UDP)
- 1433: SQL Server

### Maintenance

- View logs:
```bash
docker-compose logs -f voicemail
```

- Restart services:
```bash
docker-compose restart
```

- Stop services:
```bash
docker-compose down
```

### Backup

To backup data, copy the following:
1. Docker volumes (`voicemail_data`, `custom_greetings`, `mssql_data`)
2. Configuration files (`projects.json`, `settings.json`)

## Features
- Web-based voicemail management dashboard
- Catch-all voicemail box for unrecognized DIDs
- Voicemail transcription using Google Cloud Speech-to-Text
- DID management with expiration tracking
- Email notifications for new voicemails
- SQL Server integration for DNC list