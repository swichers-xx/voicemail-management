export class UIManager {
  constructor(app) {
    this.app = app;
    this.currentView = 'dashboard';
    this.modal = null;
    this.toastContainer = null;
    this.shareModal = null;
    this.helpModal = null;
    this.setupCatchAllSettings();
  }

  setupCatchAllSettings() {
    const catchAllToggle = document.getElementById('catchAllEnabled');
    const catchAllSettings = document.querySelector('.catch-all-settings');

    if (catchAllToggle) {
      catchAllToggle.addEventListener('change', async (e) => {
        try {
          await this.app.settingsManager.toggleCatchAll(e.target.checked);
          catchAllSettings.style.display = e.target.checked ? 'block' : 'none';
          this.showNotification('Catch-all settings updated', 'success');
        } catch (error) {
          this.showNotification('Failed to update catch-all settings', 'error');
          e.target.checked = !e.target.checked;
        }
      });
    }

    // Initialize catch-all settings visibility
    if (catchAllSettings) {
      catchAllSettings.style.display = catchAllToggle?.checked ? 'block' : 'none';
    }
  }

  init() {
    this.initializeToasts();
    this.initializeModals();
    this.setupEventListeners();
    this.refreshAll();
  }

  initializeModals() {
    // Initialize all modals on page load
    const newProjectModal = document.getElementById('new-project-modal');
    if (newProjectModal) {
      this.modal = new bootstrap.Modal(newProjectModal);
    }
    
    const shareModal = document.getElementById('share-modal');
    if (shareModal) {
      this.shareModal = new bootstrap.Modal(shareModal);
    }
    
    const helpModal = document.getElementById('help-modal');
    if (helpModal) {
      this.helpModal = new bootstrap.Modal(helpModal);
    }
  }

  initializeToasts() {
    // Create toast container if it doesn't exist
    if (!document.getElementById('toast-container')) {
      const container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'toast-container position-fixed bottom-0 end-0 p-3';
      document.body.appendChild(container);
    }
    this.toastContainer = document.getElementById('toast-container');
  }

  setupEventListeners() {
    // Navigation event handlers
    document.querySelectorAll('[id^="nav-"]').forEach(navItem => {
      navItem.addEventListener('click', (e) => {
        e.preventDefault();
        const view = e.target.closest('.nav-link').id.replace('nav-', '');
        this.showView(view);
      });
    });

    // DID input management
    document.body.addEventListener('click', (e) => {
      if (e.target.closest('.add-did-btn')) {
        this.addDidInput();
      }
      if (e.target.closest('.remove-did-btn')) {
        e.target.closest('.input-group').remove();
      }
    });

    // Project List Click Handler
    const projectList = document.getElementById('project-list');
    if (projectList) {
      projectList.addEventListener('click', (e) => {
        const item = e.target.closest('[data-project-id]');
        if (item) {
          const projectId = item.dataset.projectId;
          this.app.projectManager.setCurrentProject(projectId);
          this.refreshAll();
        }
      });
    }

    // Greeting type selection
    const greetingSelect = document.querySelector('select[name="greetingType"]');
    if (greetingSelect) {
      greetingSelect.addEventListener('change', (e) => {
        const uploadDiv = document.getElementById('custom-greeting-upload');
        if (uploadDiv) {
          uploadDiv.classList.toggle('d-none', e.target.value !== 'custom');
        }
      });
    }

    // New Project Button
    const newProjectBtn = document.querySelector('#new-project-btn');
    if (newProjectBtn) {
      newProjectBtn.addEventListener('click', () => {
        this.showNewProjectModal();
      });
    }

    // Share Modal Handler
    const shareModal = document.getElementById('share-modal');
    if (shareModal) {
      shareModal.addEventListener('shown.bs.modal', () => {
        const recipientsInput = document.querySelector('#share-recipients');
        const messageInput = document.querySelector('#share-message');
        if (recipientsInput) recipientsInput.value = '';
        if (messageInput) messageInput.value = '';
      });
    }

    // Share Submit Button
    const shareSubmitBtn = document.querySelector('#share-submit');
    if (shareSubmitBtn) {
      shareSubmitBtn.addEventListener('click', async () => {
        const voicemailId = document.querySelector('#share-voicemail-id')?.value;
        const recipients = document.querySelector('#share-recipients')?.value
          .split(',')
          .map(e => e.trim())
          .filter(e => e);
        
        if (!recipients?.length) {
          this.showNotification('Please enter at least one recipient', 'error');
          return;
        }
        
        try {
          await this.app.voicemailSystem.shareVoicemail(voicemailId, recipients);
          this.shareModal?.hide();
          this.showNotification('Voicemail shared successfully', 'success');
        } catch (error) {
          this.showNotification('Failed to share voicemail', 'error');
        }
      });
    }

    // Settings Form
    const settingsForm = document.querySelector('#settings-form');
    if (settingsForm) {
      settingsForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const settings = Object.fromEntries(formData.entries());
        try {
          await this.app.settingsManager.updateSettings(settings);
          this.showNotification('Settings updated successfully', 'success');
        } catch (error) {
          this.showNotification('Error updating settings', 'error');
        }
      });
    }
  }

  showView(viewName) {
    const views = document.querySelectorAll('.view');
    views.forEach(view => {
      if (view) {
        view.classList.add('d-none');
      }
    });

    const targetView = document.getElementById(`${viewName}-view`);
    if (targetView) {
      targetView.classList.remove('d-none');
      this.currentView = viewName;
      this.refreshAll();
      
      // Refresh tooltips when view changes
      if (this.app.helpSystem) {
        this.app.helpSystem.refreshTooltips();
      }
    }
  }

  refreshAll() {
    switch (this.currentView) {
      case 'dashboard':
        this.refreshDashboard();
        break;
      case 'projects':
        this.refreshProjectsView();
        break;
      case 'settings':
        this.refreshSettings();
        break;
    }
  }

  refreshDashboard() {
    this.refreshProjectList();
    this.refreshDidList();
    this.refreshVoicemailList();
  }

  refreshProjectList() {
    const projectList = document.getElementById('project-list');
    const projects = this.app.projectManager.getAllProjects();
    
    projectList.innerHTML = projects.map(project => `
      <a href="#" class="list-group-item list-group-item-action" data-project-id="${project.id}">
        <div class="d-flex w-100 justify-content-between">
          <h6 class="mb-1">${project.name}</h6>
          ${project.newMessages ? `<span class="badge bg-primary">${project.newMessages}</span>` : ''}
        </div>
        <small class="text-muted">${project.dids.length} DIDs</small>
      </a>
    `).join('');
  }

  refreshDidList() {
    const didList = document.getElementById('did-list');
    const currentProject = this.app.projectManager.getCurrentProject();
    const template = document.getElementById('did-item-template');
    
    if (!currentProject || !currentProject.dids) {
      didList.innerHTML = '<div class="list-group-item text-muted">No DIDs assigned</div>';
      return;
    }

    didList.innerHTML = '';
    
    currentProject.dids.forEach(did => {
      const item = template.content.cloneNode(true);
      const container = item.querySelector('.list-group-item');
      
      // Set DID number
      item.querySelector('.did-number').textContent = did.number;
      
      // Set dates
      const dates = item.querySelector('.did-dates');
      dates.textContent = `Active: ${new Date(did.startDate).toLocaleDateString()}`;
      if (did.endDate) {
        dates.textContent += ` - ${new Date(did.endDate).toLocaleDateString()}`;
      }
      
      // Calculate and show expiry
      const today = new Date();
      const startDate = new Date(did.startDate);
      const daysActive = Math.floor((today - startDate) / (1000 * 60 * 60 * 24));
      const expiryEl = item.querySelector('.did-expiry');
      
      if (daysActive >= 90) {
        expiryEl.textContent = `⚠️ Active for ${daysActive} days`;
        expiryEl.classList.add('text-danger');
      } else {
        expiryEl.textContent = `${90 - daysActive} days until review`;
      }
      
      // Update progress bar
      const progress = item.querySelector('.progress-bar');
      const progressPercent = Math.min((daysActive / 90) * 100, 100);
      progress.style.width = `${progressPercent}%`;
      progress.classList.toggle('bg-danger', daysActive >= 90);
      
      // Setup button handlers
      item.querySelector('.archive-did-btn').addEventListener('click', () => {
        this.handleDidArchive(currentProject.id, did.number);
      });
      
      item.querySelector('.edit-did-btn').addEventListener('click', () => {
        this.showEditDidModal(currentProject.id, did);
      });
      
      didList.appendChild(item);
    });
  }

  refreshVoicemailList() {
    const currentProject = this.app.projectManager.getCurrentProject();
    const voicemails = currentProject ? 
      this.app.voicemailSystem.getVoicemailsForProject(currentProject.id) : [];
    
    const list = document.getElementById('voicemail-list');
    list.innerHTML = voicemails.length ? voicemails.map(vm => `
      <div class="list-group-item voicemail-item ${vm.isNew ? 'new' : ''}" data-id="${vm.id}">
        <div class="d-flex w-100 justify-content-between">
          <h6 class="mb-1">${vm.caller}</h6>
          <small>${this.formatDate(vm.timestamp)}</small>
        </div>
        <small class="text-muted">Duration: ${vm.duration}</small>
      </div>
    `).join('') : '<div class="list-group-item text-muted">No voicemails available</div>';
  }

  refreshProjectsView() {
    const tbody = document.querySelector('#projects-table tbody');
    const projects = this.app.projectManager.getAllProjects();
    
    tbody.innerHTML = projects.map(project => `
      <tr>
        <td>${project.name}</td>
        <td>${project.dids.length}</td>
        <td>${project.newMessages}</td>
        <td>${project.totalMessages}</td>
        <td>
          <div class="btn-group">
            <button class="btn btn-sm btn-outline-primary" onclick="editProject('${project.id}')">
              <i class="bi bi-pencil"></i>
            </button>
            <button class="btn btn-sm btn-outline-danger" onclick="deleteProject('${project.id}')">
              <i class="bi bi-trash"></i>
            </button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  refreshSettings() {
    const form = document.getElementById('settings-form');
    const settings = this.app.settingsManager.getSettings();
    
    form.innerHTML = `
      <div class="mb-3">
        <label class="form-label">Notification Email</label>
        <input type="email" class="form-control" name="notificationEmail" value="${settings.notificationEmail}">
      </div>
      <div class="mb-3">
        <label class="form-label">Notification SMS</label>
        <input type="tel" class="form-control" name="notificationSMS" value="${settings.notificationSMS}">
      </div>
      <div class="mb-3">
        <div class="form-check form-switch">
          <input class="form-check-input" type="checkbox" name="transcriptionEnabled" 
                 ${settings.transcriptionEnabled ? 'checked' : ''}>
          <label class="form-check-label">Enable Transcription</label>
        </div>
      </div>
      <div class="mb-3">
        <label class="form-label">Message Retention (days)</label>
        <input type="number" class="form-control" name="retentionDays" value="${settings.retentionDays}">
      </div>
      <div class="mb-3">
        <label class="form-label">Max Message Length (seconds)</label>
        <input type="number" class="form-control" name="maxMessageLength" value="${settings.maxMessageLength}">
      </div>
      <div class="mb-3">
        <label class="form-label">Default Greeting</label>
        <textarea class="form-control" name="defaultGreeting" rows="3">${settings.defaultGreeting}</textarea>
      </div>
      <button type="submit" class="btn btn-primary">Save Settings</button>
    `;
  }

  showNewProjectModal() {
    this.modal.show();
  }

  closeNewProjectModal() {
    this.modal.hide();
  }

  addDidInput() {
    const container = document.getElementById('did-inputs');
    const newInput = document.createElement('div');
    newInput.className = 'input-group mb-2';
    newInput.innerHTML = `
      <input type="tel" class="form-control" name="dids[]" placeholder="+1234567890">
      <button type="button" class="btn btn-outline-danger remove-did-btn">
        <i class="bi bi-dash-lg"></i>
      </button>
    `;
    container.appendChild(newInput);
  }

  showNotification(message, type = 'info') {
    const toastId = 'toast-' + Date.now();
    const html = `
      <div id="${toastId}" class="toast" role="alert" aria-live="assertive" aria-atomic="true">
        <div class="toast-header bg-${type}">
          <strong class="me-auto text-white">Notification</strong>
          <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
        <div class="toast-body">
          ${message}
        </div>
      </div>
    `;
    
    this.toastContainer.insertAdjacentHTML('beforeend', html);
    const toastElement = document.getElementById(toastId);
    const toast = new bootstrap.Toast(toastElement);
    toast.show();
    
    // Remove toast after it's hidden
    toastElement.addEventListener('hidden.bs.toast', () => {
      toastElement.remove();
    });
  }

  formatDate(timestamp) {
    return new Date(timestamp).toLocaleString();
  }

  async handleDidArchive(projectId, did) {
    if (confirm(`Are you sure you want to archive ${did}?`)) {
      try {
        await this.app.projectManager.archiveDid(projectId, did);
        this.showNotification(`DID ${did} archived successfully`, 'success');
        this.refreshAll();
      } catch (error) {
        this.showNotification('Error archiving DID: ' + error.message, 'error');
      }
    }
  }

  async handleProjectCreation() {
    const form = document.getElementById('new-project-form');
    const formData = new FormData(form);
    
    try {
      const projectData = {
        name: formData.get('projectName'),
        description: formData.get('description'),
        greetingType: formData.get('greetingType'),
        greetingFile: formData.get('greetingFile')?.name
      };

      // Create project first
      const project = await this.app.projectManager.createProject(projectData);
      
      // Then add DIDs if any were entered
      const bulkDids = formData.get('bulkDids');
      if (bulkDids.trim()) {
        await this.app.projectManager.addBulkDids(
          project.id,
          bulkDids,
          formData.get('didStartDate'),
          formData.get('didEndDate')
        );
      }

      this.closeNewProjectModal();
      this.showNotification('Project created successfully', 'success');
      this.refreshAll();
      form.reset();
    } catch (error) {
      this.showNotification('Error creating project: ' + error.message, 'error');
    }
  }
}