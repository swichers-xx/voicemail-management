# Base image
FROM python:3.8-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
	asterisk \
	asterisk-dev \
	build-essential \
	nodejs \
	npm \
	&& rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application files
COPY . .

# Install Node.js dependencies
RUN npm install

# Create necessary directories
RUN mkdir -p /var/spool/asterisk/voicemail \
	&& mkdir -p /var/lib/asterisk/sounds/custom

# Copy Asterisk configuration
COPY asterisk/sip.conf /etc/asterisk/
COPY asterisk/extensions.conf /etc/asterisk/

# Expose ports
EXPOSE 5000 5060/udp

# Start services
CMD ["sh", "-c", "service asterisk start && python python/voicemail_server.py"]