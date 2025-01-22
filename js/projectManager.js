export class ProjectManager {
  constructor() {
    this.projects = new Map();
    this.currentProject = null;
  }

  async init() {
    await this.loadProjects();
  }

  async loadProjects() {
    try {
      const response = await fetch('/api/projects');
      const projects = await response.json();
      
      projects.forEach(project => {
        // Add special styling for catch-all project
        if (project.isCatchAll) {
          project.className = 'catch-all-project';
          project.icon = 'bi-inbox';
        }
        this.projects.set(project.id, project);
      });
    } catch (error) {
      console.error('Error loading projects:', error);
      this.loadSampleData();
    }
  }

  loadSampleData() {
    const sampleProjects = [
      {
        id: 'p1',
        name: 'Main Office',
        description: 'Primary business line voicemails',
        dids: ['+1 (555) 123-4567', '+1 (555) 123-4568'],
        greetingType: 'default',
        newMessages: 3,
        totalMessages: 15
      },
      {
        id: 'p2',
        name: 'Support Line',
        description: 'Customer support voicemails',
        dids: ['+1 (555) 999-8888'],
        greetingType: 'custom',
        greetingUrl: 'support-greeting.wav',
        newMessages: 1,
        totalMessages: 8
      }
    ];

    sampleProjects.forEach(project => {
      this.projects.set(project.id, project);
    });
  }

  async createProject(projectData) {
    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(projectData)
      });

      if (!response.ok) {
        throw new Error('Failed to create project');
      }

      const project = await response.json();
      this.projects.set(project.id, project);
      return project;
    } catch (error) {
      console.error('Error creating project:', error);
      throw error;
    }
  }

  async updateProject(projectId, updates) {
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updates)
      });

      if (!response.ok) {
        throw new Error('Failed to update project');
      }

      const updated = await response.json();
      this.projects.set(projectId, updated);
      return updated;
    } catch (error) {
      console.error('Error updating project:', error);
      throw error;
    }
  }

  async deleteProject(projectId) {
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Failed to delete project');
      }

      this.projects.delete(projectId);
    } catch (error) {
      console.error('Error deleting project:', error);
      throw error;
    }
  }

  getProject(projectId) {
    return this.projects.get(projectId);
  }

  getAllProjects() {
    return Array.from(this.projects.values());
  }

  setCurrentProject(projectId) {
    this.currentProject = this.getProject(projectId);
    return this.currentProject;
  }

  getCurrentProject() {
    return this.currentProject;
  }

  async addDid(projectId, did) {
    try {
      const response = await fetch(`/api/projects/${projectId}/dids`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ did })
      });

      if (!response.ok) {
        throw new Error('Failed to add DID');
      }

      const result = await response.json();
      const project = this.projects.get(projectId);
      if (project) {
        if (!project.dids) project.dids = [];
        project.dids.push(did);
      }
      return result;
    } catch (error) {
      console.error('Error adding DID:', error);
      throw error;
    }
  }

  async removeDid(projectId, did) {
    try {
      const response = await fetch(`/api/projects/${projectId}/dids/${did}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Failed to remove DID');
      }

      const project = this.projects.get(projectId);
      if (project) {
        project.dids = project.dids.filter(d => d !== did);
      }
    } catch (error) {
      console.error('Error removing DID:', error);
      throw error;
    }
  }

  async archiveNumber(number, reason = '', archivedBy = '') {
    try {
      const response = await fetch(`/api/archive/number/${number}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reason, archivedBy })
      });

      if (!response.ok) {
        throw new Error('Failed to archive number');
      }

      return await response.json();
    } catch (error) {
      console.error('Error archiving number:', error);
      throw error;
    }
  }

  async getNumberMetadata(number) {
    try {
      const response = await fetch(`/api/numbers/${number}/meta`);
      if (!response.ok) {
        throw new Error('Failed to get number metadata');
      }
      return await response.json();
    } catch (error) {
      console.error('Error getting number metadata:', error);
      throw error;
    }
  }

  async addProjectNote(projectId, text, createdBy = '') {
    try {
      const response = await fetch(`/api/projects/${projectId}/notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ text, created_by: createdBy })
      });

      if (!response.ok) {
        throw new Error('Failed to add note');
      }

      const result = await response.json();
      const project = this.projects.get(projectId);
      if (project) {
        if (!project.notes) project.notes = [];
        project.notes.push(result.note);
      }
      return result;
    } catch (error) {
      console.error('Error adding note:', error);
      throw error;
    }
  }

  renderProjectList() {
    const list = document.getElementById('project-list');
    if (!list) return;

    Array.from(this.projects.values()).forEach(project => {
      const item = document.createElement('div');
      item.className = `list-group-item ${project.className || ''}`;
      item.dataset.projectId = project.id;
      
      item.innerHTML = `
        <div class="d-flex w-100 justify-content-between align-items-center">
          <div>
            <i class="${project.icon || 'bi-folder'} me-2"></i>
            <span class="project-name">${project.name}</span>
            ${project.isCatchAll ? '<span class="badge bg-secondary ms-2">Catch-All</span>' : ''}
          </div>
          <div class="project-stats">
            <span class="badge bg-primary">${project.voicemails?.length || 0}</span>
          </div>
        </div>
      `;
      
      list.appendChild(item);
    });
  }

  async deleteProjectNote(projectId, noteId) {
    try {
      const response = await fetch(`/api/projects/${projectId}/notes/${noteId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Failed to delete note');
      }

      const project = this.projects.get(projectId);
      if (project) {
        project.notes = project.notes.filter(n => n.id !== noteId);
      }
    } catch (error) {
      console.error('Error deleting note:', error);
      throw error;
    }
  }

  async archiveDid(projectId, did) {
    try {
      const response = await fetch(`/api/projects/${projectId}/dids/${did}/archive`, {
        method: 'POST'
      });

      if (!response.ok) {
        throw new Error('Failed to archive DID');
      }

      // Update local state
      const project = this.projects.get(projectId);
      if (project && project.dids) {
        project.dids = project.dids.filter(d => d !== did);
      }
    } catch (error) {
      console.error('Error archiving DID:', error);
      throw error;
    }
  }

  async addBulkDids(projectId, didsInput, startDate, endDate) {
    // Split DIDs by newline or comma and clean
    const dids = didsInput
      .split(/[\n,]/)
      .map(did => did.trim())
      .filter(did => did);

    const didObjects = dids.map(number => ({
      number,
      startDate, 
      endDate,
      added: new Date().toISOString()
    }));

    try {
      const response = await fetch(`/api/projects/${projectId}/dids/bulk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ dids: didObjects })
      });

      if (!response.ok) {
        throw new Error('Failed to add DIDs');
      }

      const result = await response.json();
      
      // Update local state
      const project = this.projects.get(projectId);
      if (project) {
        if (!project.dids) project.dids = [];
        project.dids.push(...result.dids);
      }

      return result;
    } catch (error) {
      console.error('Error adding DIDs:', error);
      throw error;
    }
  }
}