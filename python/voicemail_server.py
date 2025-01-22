import os
import json
import uuid
import jwt
from datetime import datetime, timedelta
import pjsua as pj
from flask import Flask, request, jsonify, send_file
from security_config import (
    require_auth, validate_password, check_ip_whitelist,
    rate_limit, sanitize_input, audit_log
)
from flask_cors import CORS
from flask_talisman import Talisman
import threading
import pymssql
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.audio import MIMEAudio
import smtplib
import asterisk.manager
from dateutil.parser import parse
from apscheduler.schedulers.background import BackgroundScheduler

app = Flask(__name__)

# Update CORS configuration
CORS(app, resources={
    r"/api/*": {
        "origins": os.environ.get('ALLOWED_ORIGINS', 'http://localhost:5000').split(','),
        "methods": ["GET", "POST", "PUT", "DELETE", "PATCH"],
        "allow_headers": ["Authorization", "Content-Type"]
    }
})

# Add security headers
Talisman(app,
    force_https=True,
    strict_transport_security=True,
    session_cookie_secure=True,
    session_cookie_http_only=True,
    feature_policy={
        'geolocation': '\'none\'',
        'microphone': '\'none\'',
        'camera': '\'none\''
    },
    content_security_policy={
        'default-src': '\'self\'',
        'script-src': ['\'self\'', '\'unsafe-inline\'', 'cdn.jsdelivr.net'],
        'style-src': ['\'self\'', '\'unsafe-inline\'', 'cdn.jsdelivr.net'],
        'img-src': ['\'self\'', 'data:', 'cdn.jsdelivr.net'],
        'font-src': ['\'self\'', 'cdn.jsdelivr.net'],
        'connect-src': ['\'self\'']
    }
)

# Add security middleware
@app.before_request
def security_middleware():
    if not check_ip_whitelist():
        return jsonify({"error": "Access denied"}), 403

# JWT Configuration
JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY', 'your-secure-jwt-key-here')
JWT_EXPIRATION = timedelta(hours=8)

VOICEMAIL_DIR = "voicemails"
PROJECTS_FILE = "projects.json"
SETTINGS_FILE = "settings.json"

class VoicemailServer:
    def __init__(self):
        self.lib = None
        self.acc = None
        self.projects = self.load_projects()
        self.settings = self.load_settings()
        
        if not os.path.exists(VOICEMAIL_DIR):
            os.makedirs(VOICEMAIL_DIR)
            
        # Initialize Asterisk Manager connection
        self.ami = None
        self.connect_asterisk()
        
        # Initialize scheduler for DID management
        self.scheduler = BackgroundScheduler()
        self.scheduler.start()
        self.setup_did_monitoring()

    def load_projects(self):
        if os.path.exists(PROJECTS_FILE):
            with open(PROJECTS_FILE, 'r') as f:
                return json.load(f)
        return []
        
    def save_projects(self):
        with open(PROJECTS_FILE, 'w') as f:
            json.dump(self.projects, f)
            
    def load_settings(self):
        if os.path.exists(SETTINGS_FILE):
            with open(SETTINGS_FILE, 'r') as f:
                return json.load(f)
        return {
            "notificationEmail": "",
            "notificationSMS": "",
            "transcriptionEnabled": True,
            "retentionDays": 30,
            "maxMessageLength": 300,
            "defaultGreeting": "Please leave a message after the tone."
        }
        
    def save_settings(self):
        with open(SETTINGS_FILE, 'w') as f:
            json.dump(self.settings, f)

    def init_pjsua(self):
        self.lib = pj.Lib()
        try:
            self.lib.init()
            self.lib.create_transport(pj.TransportType.UDP, pj.TransportConfig(5060))
            self.lib.start()
            
            acc_cfg = pj.AccountConfig()
            acc_cfg.id = "sip:voicemail@localhost"
            acc_cfg.reg_uri = "sip:localhost"
            self.acc = self.lib.create_account(acc_cfg)
            
            print("SIP server initialized")
            
        except pj.Error as e:
            print("Error initializing PJSUA:", str(e))
            self.lib.destroy()

    def connect_asterisk(self):
        try:
            self.ami = asterisk.manager.Manager()
            self.ami.connect('localhost')  # Or your Asterisk server address
            self.ami.login('admin', 'password')  # Replace with your AMI credentials
            
            # Register event handlers
            self.ami.register_event('Newchannel', self.handle_new_call)
            self.ami.register_event('Hangup', self.handle_hangup)
            
            print("Connected to Asterisk Manager Interface")
        except Exception as e:
            print(f"Failed to connect to Asterisk: {str(e)}")

    def handle_new_call(self, event):
        # Handle incoming calls
        channel = event.get('Channel')
        callerid = event.get('CallerID')
        
        # Find project based on DID
        did = self.extract_did(event)
        project = self.find_project_for_did(did)
        
        if project:
            # Play greeting
            greeting = project.get('greetingUrl', 'default-greeting.wav')
            self.ami.command(f'Playback({greeting})')
            
            # Start recording
            recording_path = f"{VOICEMAIL_DIR}/{uuid.uuid4()}.wav"
            self.ami.command(f'Monitor(wav,{recording_path},m)')

    def handle_hangup(self, event):
        # Stop recording and process voicemail
        channel = event.get('Channel')
        self.ami.command(f'StopMonitor({channel})')
        
        # Process the recorded voicemail
        # Add to project's voicemail list
        # Send notifications

    def setup_did_monitoring(self):
        # Check DIDs daily for expiration and 90-day alerts
        self.scheduler.add_job(
            self.monitor_dids,
            'interval',
            days=1,
            id='did_monitor',
            replace_existing=True
        )

    def monitor_dids(self):
        today = datetime.now()
        
        for project in self.projects:
            for did in project.get('dids', []):
                # Check end date
                if did.get('endDate'):
                    end_date = parse(did['endDate'])
                    if end_date <= today:
                        self.archive_did(project['id'], did['number'])
                        continue
                
                # Check 90-day counter
                start_date = parse(did['startDate'])
                days_active = (today - start_date).days
                
                if days_active >= 90:
                    self.send_did_alert(project['id'], did['number'], days_active)

    def send_did_alert(self, project_id, did, days_active):
        project = next((p for p in self.projects if p['id'] == project_id), None)
        if not project:
            return
            
        # Send email alert
        subject = f"DID Alert: {did} active for {days_active} days"
        body = f"""
        The DID {did} in project {project['name']} has been active for {days_active} days.
        Please review if this DID is still needed.
        
        Project: {project['name']}
        DID: {did}
        Active Since: {project['dids'][did]['startDate']}
        """
        
        # Send email using your preferred method
        self.send_email_alert(subject, body)

    def extract_did(self, event):
        # Extract DID from event
        channel = event.get('Channel')
        # Replace this with actual logic to extract DID from event
        return ''

    def find_project_for_did(self, did):
        for project in self.projects:
            if did in project.get('dids', []):
                return project
        return None

    def send_email_alert(self, subject, body):
        # Implement email sending logic here
        pass

    def archive_did(self, project_id, did):
        project = next((p for p in self.projects if p['id'] == project_id), None)
        if not project:
            return
            
        did_obj = next((d for d in project['dids'] if d['number'] == did), None)
        if not did_obj:
            return
            
        # Archive DID
        did_obj['archived'] = True
        did_obj['archiveDate'] = datetime.now().isoformat()
        
        # Remove from active DIDs
        project['dids'] = [d for d in project['dids'] if d['number'] != did]
        
        # Add to archived DIDs
        if 'archivedDids' not in project:
            project['archivedDids'] = []
        project['archivedDids'].append(did_obj)
        
        self.save_projects()

    def remove_asterisk_did(self, did):
        # Implement logic to remove DID from Asterisk
        pass

    def setup_asterisk_did(self, project_id, did):
        # Implement logic to setup DID in Asterisk
        pass

# API Routes
@app.route('/api/projects', methods=['GET'])
@require_auth
@rate_limit('get_projects')
def get_projects():
    audit_log('get_projects', request.user['id'], 'projects', None, 'success')
    return jsonify(server.projects)

@app.route('/api/projects', methods=['POST'])
@require_auth
@rate_limit('create_project')
def create_project():
    project = sanitize_input(request.json)
    project['id'] = str(uuid.uuid4())
    project['voicemails'] = []
    server.projects.append(project)
    server.save_projects()
    return jsonify(project)

@app.route('/api/projects/<id>', methods=['PATCH'])
def update_project(id):
    project = next((p for p in server.projects if p['id'] == id), None)
    if not project:
        return jsonify({"error": "Project not found"}), 404
        
    updates = request.json
    project.update(updates)
    server.save_projects()
    return jsonify(project)

@app.route('/api/projects/<id>', methods=['DELETE'])
def delete_project(id):
    server.projects = [p for p in server.projects if p['id'] != id]
    server.save_projects()
    return jsonify({"success": True})

@app.route('/api/settings', methods=['GET'])
def get_settings():
    return jsonify(server.settings)

@app.route('/api/settings', methods=['POST'])
@require_auth
@rate_limit('update_settings')
def update_settings():
    settings = sanitize_input(request.json)
    server.settings.update(settings)
    server.save_settings()
    return jsonify(server.settings)

@app.route('/api/settings/catch-all', methods=['POST'])
def update_catch_all():
    try:
        data = request.json
        server.settings['catchAllEnabled'] = data['enabled']
        server.save_settings()
        
        # Update Asterisk system variable
        ami_command = f"setvar CATCH_ALL_ENABLED {1 if data['enabled'] else 0}"
        server.ami.command(ami_command)
        
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/settings/catch-all-greeting', methods=['POST'])
def update_catch_all_greeting():
    try:
        data = request.json
        server.settings['catchAllGreeting'] = data['greeting']
        server.save_settings()
        
        # Generate and save greeting audio file
        greeting_path = "/var/lib/asterisk/sounds/custom/catch-all-greeting.wav"
        # Implement text-to-speech or use pre-recorded audio file
        
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/voicemails/<id>/audio', methods=['GET'])
def get_voicemail_audio(id):
    audio_path = os.path.join(VOICEMAIL_DIR, f"{id}.wav")
    if os.path.exists(audio_path):
        return send_file(audio_path)
    return jsonify({"error": "Voicemail not found"}), 404

@app.route('/api/voicemails/<id>/notes', methods=['POST'])
def add_note(id):
    note_data = request.json
    # In a real implementation, save to database
    return jsonify({"success": True})

@app.route('/api/dnc', methods=['POST'])
def add_to_dnc():
    try:
        phone = request.json['phoneNumber']
        
        # Connect to remote SQL Server
        conn = pymssql.connect(
            server='your_server',
            user='your_username',
            password='your_password',
            database='your_database'
        )
        
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO DNCSoftphone (PhoneNumber, DateAdded, AddedBy) VALUES (%s, GETDATE(), %s)",
            (phone, "VOICEMAIL_SYSTEM")
        )
        
        conn.commit()
        conn.close()
        
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/voicemails/<id>/add-to-dnc', methods=['POST'])
@require_auth
@rate_limit('add_to_dnc')
def add_voicemail_to_dnc(id):
    try:
        # Find voicemail
        voicemail = next((vm for vm in [v for p in server.projects for v in p.get('voicemails', [])] if vm['id'] == id), None)
        if not voicemail:
            return jsonify({"error": "Voicemail not found"}), 404

        # Connect to SQL Server
        conn = pymssql.connect(
            server=os.environ.get('SQL_SERVER_HOST', 'your_server'),
            user=os.environ.get('SQL_SERVER_USER', 'your_username'),
            password=os.environ.get('SQL_SERVER_PASSWORD', 'your_password'),
            database=os.environ.get('SQL_SERVER_DB', 'your_database')
        )
        
        cursor = conn.cursor()
        
        # Add to DNC with additional metadata
        cursor.execute("""
            INSERT INTO DNCSoftphone (
                PhoneNumber, 
                DateAdded, 
                AddedBy, 
                Source, 
                VoicemailId, 
                Notes
            ) VALUES (%s, GETDATE(), %s, %s, %s, %s)
        """, (
            voicemail['caller'],
            request.user['id'],
            'VOICEMAIL_SYSTEM',
            voicemail['id'],
            request.json.get('notes', '')
        ))
        
        conn.commit()
        conn.close()
        
        # Log the action
        audit_log('add_to_dnc', request.user['id'], 'voicemail', id, 'success')
        
        return jsonify({
            "success": True,
            "message": f"Added {voicemail['caller']} to DNC list"
        })
        
    except Exception as e:
        audit_log('add_to_dnc', request.user['id'], 'voicemail', id, 'error')
        return jsonify({"error": str(e)}), 500

@app.route('/api/voicemails/<id>/share', methods=['POST'])
@require_auth
@rate_limit('share_voicemail')
def share_voicemail(id):
    try:
        recipients = sanitize_input(request.json['recipients'])
        voicemail = next((vm for vm in [v for p in server.projects for v in p.get('voicemails', [])] if vm['id'] == id), None)
        
        if not voicemail:
            return jsonify({"error": "Voicemail not found"}), 404
            
        # Configure email settings
        smtp_server = "smtp.your_server.com"
        smtp_port = 587
        sender_email = "voicemail@your_company.com"
        password = "your_password"
        
        # Create message
        msg = MIMEMultipart()
        msg['Subject'] = f'Shared Voicemail from {voicemail["caller"]}'
        msg['From'] = sender_email
        msg['To'] = ', '.join(recipients)
        
        # Add body
        body = f"""A voicemail has been shared with you:
        
        From: {voicemail['caller']}
        Duration: {voicemail['duration']}
        Time: {voicemail['timestamp']}
        
        Listen to the attached audio file.
        """
        msg.attach(MIMEText(body, 'plain'))
        
        # Attach audio file
        with open(f"{VOICEMAIL_DIR}/{id}.wav", 'rb') as f:
            audio = MIMEAudio(f.read(), 'wav')
            audio.add_header('Content-Disposition', 'attachment', filename=f'voicemail_{id}.wav')
            msg.attach(audio)
        
        # Send email
        with smtplib.SMTP(smtp_server, smtp_port) as server:
            server.starttls()
            server.login(sender_email, password)
            server.send_message(msg)
        
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/projects/<id>/dids', methods=['POST'])
def add_did(id):
    try:
        project = next((p for p in server.projects if p['id'] == id), None)
        if not project:
            return jsonify({"error": "Project not found"}), 404
            
        did = request.json['did']
        
        # Check if DID exists in any other project
        for p in server.projects:
            if did in p.get('dids', []):
                return jsonify({"error": "DID already exists in another project"}), 400
                
        if 'dids' not in project:
            project['dids'] = []
            
        project['dids'].append(did)
        server.save_projects()
        return jsonify({"success": True, "did": did})
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/projects/<id>/dids/<did>', methods=['DELETE'])
def remove_did(id, did):
    try:
        project = next((p for p in server.projects if p['id'] == id), None)
        if not project:
            return jsonify({"error": "Project not found"}), 404
            
        if did not in project.get('dids', []):
            return jsonify({"error": "DID not found in project"}), 404
            
        project['dids'].remove(did)
        server.save_projects()
        return jsonify({"success": True})
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/archive/number/<number>', methods=['POST'])
def archive_number(number):
    try:
        # Connect to archive database
        conn = pymssql.connect(
            server='your_archive_server',
            user='your_username',
            password='your_password',
            database='your_archive_db'
        )
        
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO ArchivedNumbers 
            (PhoneNumber, ArchivedDate, ArchivedBy, Reason) 
            VALUES (%s, GETDATE(), %s, %s)
            """,
            (number, request.json.get('archivedBy', 'SYSTEM'), request.json.get('reason', ''))
        )
        
        conn.commit()
        conn.close()
        
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/numbers/<number>/meta', methods=['GET'])
def get_number_metadata(number):
    try:
        # Get metadata from various sources
        meta = {
            "carrier": "Sample Carrier",
            "type": "mobile",
            "location": "US",
            "archived": False,
            "dnc": False,
            "history": []
        }
        
        # Check archive status
        archive_conn = pymssql.connect(
            server='your_archive_server',
            user='your_username',
            password='your_password',
            database='your_archive_db'
        )
        
        cursor = archive_conn.cursor()
        cursor.execute("SELECT TOP 1 1 FROM ArchivedNumbers WHERE PhoneNumber = %s", (number,))
        meta["archived"] = cursor.fetchone() is not None
        
        # Check DNC status
        dnc_conn = pymssql.connect(
            server='your_dnc_server',
            user='your_username',
            password='your_password',
            database='your_dnc_db'
        )
        
        cursor = dnc_conn.cursor()
        cursor.execute("SELECT TOP 1 1 FROM DNCSoftphone WHERE PhoneNumber = %s", (number,))
        meta["dnc"] = cursor.fetchone() is not None
        
        # Get call history
        cursor.execute(
            """
            SELECT TOP 10 
                CallDate, 
                CallType, 
                Duration, 
                Result
            FROM CallHistory 
            WHERE PhoneNumber = %s 
            ORDER BY CallDate DESC
            """, 
            (number,)
        )
        
        meta["history"] = [
            {
                "date": row[0].isoformat(),
                "type": row[1],
                "duration": row[2],
                "result": row[3]
            }
            for row in cursor.fetchall()
        ]
        
        return jsonify(meta)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/projects/<id>/notes', methods=['POST'])
def add_project_note(id):
    try:
        project = next((p for p in server.projects if p['id'] == id), None)
        if not project:
            return jsonify({"error": "Project not found"}), 404
            
        if 'notes' not in project:
            project['notes'] = []
            
        note = {
            'id': str(uuid.uuid4()),
            'text': request.json['text'],
            'created_at': datetime.now().isoformat(),
            'created_by': request.json.get('created_by', 'SYSTEM')
        }
        
        project['notes'].append(note)
        server.save_projects()
        
        return jsonify({"success": True, "note": note})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/projects/<id>/notes/<note_id>', methods=['DELETE'])
def delete_project_note(id, note_id):
    try:
        project = next((p for p in server.projects if p['id'] == id), None)
        if not project:
            return jsonify({"error": "Project not found"}), 404
            
        project['notes'] = [n for n in project.get('notes', []) if n['id'] != note_id]
        server.save_projects()
        
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/projects/<id>/dids/bulk', methods=['POST'])
def add_bulk_dids(id):
    try:
        data = request.json
        dids = data['dids']
        
        project = next((p for p in server.projects if p['id'] == id), None)
        if not project:
            return jsonify({"error": "Project not found"}), 404
            
        # Validate DIDs
        existing_dids = set()
        for p in server.projects:
            existing_dids.update(d['number'] for d in p.get('dids', []))
            
        # Filter out existing DIDs
        new_dids = [d for d in dids if d['number'] not in existing_dids]
        
        if not new_dids:
            return jsonify({"error": "All DIDs already exist"}), 400
            
        # Add DIDs to project
        if 'dids' not in project:
            project['dids'] = []
            
        project['dids'].extend(new_dids)
        server.save_projects()
        
        # Setup Asterisk for new DIDs
        for did in new_dids:
            server.setup_asterisk_did(id, did['number'])
        
        return jsonify({"success": True, "dids": new_dids})
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/projects/<id>/dids/<did>/archive', methods=['POST'])
def archive_did(id, did):
    try:
        project = next((p for p in server.projects if p['id'] == id), None)
        if not project:
            return jsonify({"error": "Project not found"}), 404
            
        did_obj = next((d for d in project['dids'] if d['number'] == did), None)
        if not did_obj:
            return jsonify({"error": "DID not found"}), 404
            
        # Archive DID
        did_obj['archived'] = True
        did_obj['archiveDate'] = datetime.now().isoformat()
        
        # Remove from active DIDs
        project['dids'] = [d for d in project['dids'] if d['number'] != did]
        
        # Add to archived DIDs
        if 'archivedDids' not in project:
            project['archivedDids'] = []
        project['archivedDids'].append(did_obj)
        
        server.save_projects()
        
        # Remove from Asterisk
        server.remove_asterisk_did(did)
        
        return jsonify({"success": True})
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Add authentication routes
@app.route('/api/auth/login', methods=['POST'])
@rate_limit('login')
def login():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    
    # Validate credentials against database
    if not username or not password:
        return jsonify({"error": "Missing credentials"}), 400
        
    # Generate JWT token
    token = jwt.encode({
        'id': username,
        'exp': datetime.utcnow() + JWT_EXPIRATION
    }, JWT_SECRET_KEY)
    
    audit_log('login', username, 'auth', None, 'success')
    return jsonify({"token": token})

@app.route('/api/auth/change-password', methods=['POST'])
@require_auth
@rate_limit('change_password')
def change_password():
    data = request.json
    new_password = data.get('new_password')
    
    if not validate_password(new_password):
        return jsonify({"error": "Invalid password format"}), 400
        
    # Update password in database
    audit_log('change_password', request.user['id'], 'auth', None, 'success')
    return jsonify({"success": True})

def start_server():
    global server
    server = VoicemailServer()
    server.init_pjsua()
    return server

if __name__ == '__main__':
    server = start_server()
    threading.Thread(target=app.run, kwargs={'host': '0.0.0.0', 'port': 5000}).start()