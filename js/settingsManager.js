export class SettingsManager {
  constructor() {
    this.settings = {
      notificationEmail: '',
      notificationSMS: '',
      transcriptionEnabled: true,
      retentionDays: 30,
      maxMessageLength: 300,
      defaultGreeting: 'Please leave a message after the tone.',
      catchAllEnabled: false,
      catchAllGreeting: 'You have reached our general voicemail box. Please leave a message after the tone.'
    };
  }

  async init() {
    await this.loadSettings();
  }

  async loadSettings() {
    try {
      const response = await fetch('/api/settings');
      this.settings = await response.json();
    } catch (error) {
      console.error('Error loading settings:', error);
      // Keep default settings
    }
  }

  async updateSettings(newSettings) {
    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newSettings)
      });

      if (!response.ok) {
        throw new Error('Failed to update settings');
      }

      this.settings = await response.json();
      return this.settings;
    } catch (error) {
      console.error('Error updating settings:', error);
      throw error;
    }
  }

  getSettings() {
    return this.settings;
  }

  async toggleCatchAll(enabled) {
    try {
      const response = await fetch('/api/settings/catch-all', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ enabled })
      });

      if (!response.ok) {
        throw new Error('Failed to update catch-all setting');
      }

      this.settings.catchAllEnabled = enabled;
      return true;
    } catch (error) {
      console.error('Error updating catch-all setting:', error);
      throw error;
    }
  }

  async updateCatchAllGreeting(greeting) {
    try {
      const response = await fetch('/api/settings/catch-all-greeting', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ greeting })
      });

      if (!response.ok) {
        throw new Error('Failed to update catch-all greeting');
      }

      this.settings.catchAllGreeting = greeting;
      return true;
    } catch (error) {
      console.error('Error updating catch-all greeting:', error);
      throw error;
    }
  }
}