import { ProjectManager } from './projectManager.js';
import { VoicemailSystem } from './voicemail.js';
import { UIManager } from './uiManager.js';
import { SettingsManager } from './settingsManager.js';
import { HelpSystem } from './helpSystem.js';
import { APIPlayground } from './apiPlayground.js';

class App {
  constructor() {
    this.projectManager = new ProjectManager();
    this.voicemailSystem = new VoicemailSystem();
    this.settingsManager = new SettingsManager();
    this.uiManager = new UIManager(this);
    this.helpSystem = new HelpSystem();
    this.apiPlayground = new APIPlayground();
  }

  async init() {
    await Promise.all([
      this.projectManager.init(),
      this.voicemailSystem.init(),
      this.settingsManager.init()
    ]);
    
    this.uiManager.init();
    this.helpSystem.init();
    this.apiPlayground.init();
    this.setupEventListeners();
    
    // Show dashboard by default
    this.uiManager.showView('dashboard');
  }

  setupEventListeners() {
    // Navigation 
    document.querySelectorAll('[id^="nav-"]').forEach(navItem => {
      navItem.addEventListener('click', (e) => {
        e.preventDefault();
        const view = e.target.closest('.nav-link').id.replace('nav-', '');
        this.uiManager.showView(view);
      });
    });

    // New Project Button
    document.querySelector('#new-project-btn')?.addEventListener('click', () => {
      this.uiManager.showNewProjectModal();
    });

    // Create Project Button (in modal)
    document.querySelector('#create-project-submit')?.addEventListener('click', () => {
      this.handleProjectCreation();
    });

    // Projects List
    document.querySelector('#project-list')?.addEventListener('click', (e) => {
      const projectItem = e.target.closest('[data-project-id]');
      if (projectItem) {
        const projectId = projectItem.dataset.projectId;
        this.projectManager.setCurrentProject(projectId);
        this.uiManager.refreshAll();
      }
    });

    // Share Voicemail Form Submit
    document.querySelector('#share-submit')?.addEventListener('click', async () => {
      const voicemailId = document.querySelector('#share-voicemail-id').value;
      const recipients = document.querySelector('#share-recipients').value
        .split(',')
        .map(e => e.trim())
        .filter(e => e);
      
      if (!recipients.length) {
        this.uiManager.showNotification('Please enter at least one recipient', 'error');
        return;
      }
      
      try {
        await this.voicemailSystem.shareVoicemail(voicemailId, recipients);
        const shareModal = bootstrap.Modal.getInstance(document.querySelector('#share-modal'));
        shareModal?.hide();
        this.uiManager.showNotification('Voicemail shared successfully', 'success');
      } catch (error) {
        this.uiManager.showNotification('Failed to share voicemail', 'error');
      }
    });

    // Settings Form
    document.querySelector('#settings-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      const settings = Object.fromEntries(formData.entries());
      try {
        await this.settingsManager.updateSettings(settings);
        this.uiManager.showNotification('Settings updated successfully', 'success');
      } catch (error) {
        this.uiManager.showNotification('Error updating settings', 'error');
      }
    });

    // Create Project Button (Projects View)
    document.querySelector('#create-project-btn')?.addEventListener('click', () => {
      this.uiManager.showNewProjectModal(); 
    });

    // DID Management
    document.addEventListener('click', (e) => {
      if (e.target.closest('.add-did-btn')) {
        this.uiManager.addDidInput();
      }
      if (e.target.closest('.remove-did-btn')) {
        e.target.closest('.input-group').remove();
      }
    });

    // Make app instance available globally for button handlers
    window.app = this;
  }

  async handleProjectCreation() {
    const form = document.getElementById('new-project-form');
    const formData = new FormData(form);
    
    try {
      const projectData = {
        name: formData.get('projectName'),
        description: formData.get('description'),
        dids: Array.from(formData.getAll('dids[]')).filter(did => did.trim()),
        greetingType: formData.get('greetingType'),
        greetingFile: formData.get('greetingFile')?.name
      };

      await this.projectManager.createProject(projectData);
      this.uiManager.closeNewProjectModal();
      this.uiManager.showNotification('Project created successfully', 'success');
      this.uiManager.refreshAll();
      form.reset();
    } catch (error) {
      this.uiManager.showNotification('Error creating project: ' + error.message, 'error');
    }
  }

  async handleDeleteProject(projectId) {
    if (confirm('Are you sure you want to delete this project?')) {
      try {
        await this.projectManager.deleteProject(projectId);
        this.uiManager.showNotification('Project deleted successfully', 'success');
        this.uiManager.refreshAll();
      } catch (error) {
        this.uiManager.showNotification('Error deleting project: ' + error.message, 'error');
      }
    }
  }
}

// Initialize the application
const app = new App();
app.init();