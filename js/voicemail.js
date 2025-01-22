export class VoicemailSystem {
  constructor() {
    this.voicemails = [];
    this.selectedVoicemail = null;
    this.notes = new Map(); // Store notes by voicemail ID
    
    // DNC confirmation handler
    document.getElementById('confirm-dnc')?.addEventListener('click', async () => {
        const id = document.getElementById('dnc-voicemail-id').value;
        const notes = document.getElementById('dnc-notes').value;
        const dncModal = bootstrap.Modal.getInstance(document.getElementById('dnc-modal'));
        
        try {
            const response = await fetch(`/api/voicemails/${id}/add-to-dnc`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ notes })
            });
            
            if (!response.ok) throw new Error('Failed to add to DNC');
            
            const result = await response.json();
            window.app.uiManager.showNotification(result.message, 'success');
            dncModal.hide();
        } catch (error) {
            window.app.uiManager.showNotification('Failed to add to DNC list', 'error');
        }
    });

    this.init();
  }

  async init() {
    await this.loadVoicemails();
    this.setupEventListeners();
    this.startPolling();
  }

  async loadVoicemails() {
    try {
      // Simulate API call - replace with actual API endpoint
      const response = await fetch('/api/voicemails');
      this.voicemails = await response.json();
      this.renderVoicemailList();
    } catch (error) {
      console.error('Error loading voicemails:', error);
      // For demo, populate with sample data
      this.loadSampleData();
    }
  }

  loadSampleData() {
    this.voicemails = [
      {
        id: 1,
        caller: "+1 (555) 123-4567",
        timestamp: new Date().toISOString(),
        duration: "0:45",
        isNew: true,
        transcription: "Hi, this is John calling about the project deadline...",
        audioUrl: "sample.mp3"
      },
      // Add more sample voicemails
    ];
    this.renderVoicemailList();
  }

  renderVoicemailList() {
    const list = document.getElementById('voicemail-list');
    if (!list) return;
    
    list.innerHTML = this.voicemails.map(vm => `
      <div class="list-group-item voicemail-item ${vm.id === this.selectedVoicemail?.id ? 'active' : ''}" 
           data-id="${vm.id}">
        <div class="d-flex w-100 justify-content-between">
          <h6 class="mb-1">${vm.caller}</h6>
          ${vm.isNew ? '<span class="badge badge-new">New</span>' : ''}
        </div>
        <p class="mb-1 small">${this.formatDate(vm.timestamp)}</p>
      </div>
    `).join('');
  }

  renderVoicemailDetails(voicemail) {
    const details = document.getElementById('voicemail-details');
    if (!details) return;
    
    if (!voicemail) {
      details.innerHTML = `
        <div class="text-center text-muted py-5">
          Select a voicemail to view details
        </div>
      `;
      return;
    }

    details.innerHTML = `
      <div class="voicemail-content">
        <audio class="audio-player" controls>
          <source src="${voicemail.audioUrl}" type="audio/mpeg">
          Your browser does not support the audio element.
        </audio>
        
        <ul class="metadata-list">
          <li><strong>Caller:</strong> ${voicemail.caller}</li>
          <li><strong>Time:</strong> ${this.formatDate(voicemail.timestamp)}</li>
          <li><strong>Duration:</strong> ${voicemail.duration}</li>
        </ul>

        <div class="transcription-box">
          <h6>Transcription:</h6>
          <p>${voicemail.transcription || 'Transcription not available'}</p>
        </div>

        <div class="notes-section mb-3">
          <h6>Notes:</h6>
          <div class="notes-list mb-2">
            ${(voicemail.notes || []).map(note => `
              <div class="note-item p-2 border-bottom">
                <div class="note-text">${note.text}</div>
                <small class="text-muted">
                  Added by ${note.user} on ${this.formatDate(note.timestamp)}
                </small>
              </div>
            `).join('')}
          </div>
          <div class="input-group">
            <input type="text" class="form-control note-input" placeholder="Add a note...">
            <button class="btn btn-outline-primary add-note-btn" data-id="${voicemail.id}">
              Add Note
            </button>
          </div>
        </div>

        <div class="action-buttons">
          <div class="btn-group mb-2">
          <button class="btn btn-primary mark-read-btn" data-id="${voicemail.id}">
            Mark as Read
          </button>
          <button class="btn btn-secondary download-btn" data-id="${voicemail.id}">
            Download
          </button>
          <button class="btn btn-danger delete-btn" data-id="${voicemail.id}">
            Delete
          </button>
          </div>
          
          <div class="btn-group">
          <button class="btn btn-warning add-dnc-btn" data-id="${voicemail.id}" data-phone="${voicemail.caller}">
            Add to DNC
          </button>
          <button class="btn btn-info share-btn" data-id="${voicemail.id}">
            Share
          </button>
          </div>
        </div>
      </div>
    `;

    // Set up action button event listeners
    details.querySelector('.add-note-btn')?.addEventListener('click', async () => {
      const input = details.querySelector('.note-input');
      const note = input.value.trim();
      if (note) {
        try {
          await this.addNote(voicemail.id, note);
          input.value = '';
          this.renderVoicemailDetails(voicemail);
        } catch (error) {
          window.app.uiManager.showNotification('Failed to add note', 'error');
        }
      }
    });

    details.querySelector('.add-dnc-btn')?.addEventListener('click', (e) => {
      const id = e.target.dataset.id;
      const phone = e.target.dataset.phone;
      
      // Set modal values
      document.getElementById('dnc-voicemail-id').value = id;
      document.getElementById('dnc-phone-number').textContent = phone;
      document.getElementById('dnc-notes').value = '';
      
      // Show modal
      const dncModal = new bootstrap.Modal(document.getElementById('dnc-modal'));
      dncModal.show();
    });


    details.querySelector('.share-btn')?.addEventListener('click', () => {
      document.querySelector('#share-voicemail-id').value = voicemail.id;
      const shareModal = new bootstrap.Modal(document.querySelector('#share-modal'));
      shareModal.show();
    });

    // Set up existing button listeners
    details.querySelector('.mark-read-btn')?.addEventListener('click', () => this.markAsRead(voicemail.id));
    details.querySelector('.download-btn')?.addEventListener('click', () => this.downloadAudio(voicemail.id));
    details.querySelector('.delete-btn')?.addEventListener('click', () => this.deleteVoicemail(voicemail.id));
  }

  setupEventListeners() {
    document.querySelector('#voicemail-list')?.addEventListener('click', (e) => {
      const item = e.target.closest('.voicemail-item');
      if (item) {
        const id = parseInt(item.dataset.id);
        this.selectVoicemail(id);
      }
    });

    // Share Modal Handler
    document.querySelector('#share-modal')?.addEventListener('shown.bs.modal', (e) => {
      document.querySelector('#share-recipients').value = '';
      document.querySelector('#share-message').value = '';
    });
  }

  selectVoicemail(id) {
    this.selectedVoicemail = this.voicemails.find(vm => vm.id === id);
    this.renderVoicemailList();
    this.renderVoicemailDetails(this.selectedVoicemail);
  }

  async markAsRead(id) {
    try {
      // Simulate API call
      // await fetch(`/api/voicemails/${id}/read`, { method: 'POST' });
      const voicemail = this.voicemails.find(vm => vm.id === id);
      if (voicemail) {
        voicemail.isNew = false;
        this.renderVoicemailList();
      }
    } catch (error) {
      console.error('Error marking voicemail as read:', error);
    }
  }

  async deleteVoicemail(id) {
    if (!confirm('Are you sure you want to delete this voicemail?')) return;
    
    try {
      // Simulate API call
      // await fetch(`/api/voicemails/${id}`, { method: 'DELETE' });
      this.voicemails = this.voicemails.filter(vm => vm.id !== id);
      if (this.selectedVoicemail?.id === id) {
        this.selectedVoicemail = null;
      }
      this.renderVoicemailList();
      this.renderVoicemailDetails(this.selectedVoicemail);
    } catch (error) {
      console.error('Error deleting voicemail:', error);
    }
  }

  async downloadAudio(id) {
    const voicemail = this.voicemails.find(vm => vm.id === id);
    if (!voicemail?.audioUrl) return;

    try {
      // In a real implementation, generate a download URL from your server
      const link = document.createElement('a');
      link.href = voicemail.audioUrl;
      link.download = `voicemail_${id}.mp3`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error downloading voicemail:', error);
    }
  }

  async addNote(voicemailId, note) {
    try {
      const response = await fetch(`/api/voicemails/${voicemailId}/notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ note })
      });
      
      if (!response.ok) throw new Error('Failed to add note');
      
      const voicemail = this.voicemails.find(vm => vm.id === voicemailId);
      if (voicemail) {
        if (!voicemail.notes) voicemail.notes = [];
        voicemail.notes.push({
          id: Date.now(),
          text: note,
          timestamp: new Date().toISOString(),
          user: 'Current User' // TODO: Get from auth system
        });
      }
      
      this.renderVoicemailDetails(voicemail);
    } catch (error) {
      console.error('Error adding note:', error);
      throw error;
    }
  }

  async addToDNC(phoneNumber) {
    try {
      const response = await fetch('/api/dnc', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ phoneNumber })
      });
      
      if (!response.ok) throw new Error('Failed to add to DNC');
      return true;
    } catch (error) {
      console.error('Error adding to DNC:', error);
      throw error;
    }
  }

  async shareVoicemail(voicemailId, recipients) {
    try {
      const response = await fetch(`/api/voicemails/${voicemailId}/share`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ recipients })
      });
      
      if (!response.ok) throw new Error('Failed to share voicemail');
      return true;
    } catch (error) {
      console.error('Error sharing voicemail:', error);
      throw error;
    }
  }

  formatDate(timestamp) {
    return new Date(timestamp).toLocaleString();
  }

  startPolling() {
    // Poll for new voicemails every 30 seconds
    setInterval(() => this.loadVoicemails(), 30000);
  }

  getVoicemailsForProject(projectId) {
    // In a real implementation, this would filter voicemails by project ID
    return this.voicemails;
  }
}

// Initialize the voicemail system
const voicemailSystem = new VoicemailSystem();