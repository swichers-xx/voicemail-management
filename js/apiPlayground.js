export class APIPlayground {
  constructor() {
    this.endpoints = [];
    this.currentEndpoint = null;
    this.prettifyEnabled = false;
  }

  init() {
    this.loadEndpoints();
    this.setupEventListeners();
  }

  loadEndpoints() {
    // Load endpoints from OpenAPI spec
    this.endpoints = [
      {
        method: 'GET',
        path: '/api/projects',
        description: 'Get all projects',
        parameters: [],
        responses: {
          '200': {
            description: 'Success',
            content: {
              'application/json': {
                example: {
                  projects: [
                    {
                      id: 'p1',
                      name: 'Project 1',
                      description: 'Example project'
                    }
                  ]
                }
              }
            }
          }
        }
      },
      {
        method: 'POST',
        path: '/api/projects',
        description: 'Create a new project',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  description: { type: 'string' },
                  dids: { 
                    type: 'array',
                    items: { type: 'string' }
                  }
                },
                required: ['name']
              },
              example: {
                name: 'New Project',
                description: 'Project description',
                dids: ['+1234567890']
              }
            }
          }
        },
        responses: {
          '201': {
            description: 'Created'
          }
        }
      },
      {
        method: 'POST',
        path: '/api/projects/{id}/dids',
        description: 'Add a DID to a project',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' }
          }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  did: { type: 'string' }
                },
                required: ['did']
              },
              example: {
                did: '+1234567890'
              }
            }
          }
        }
      },
      {
        method: 'DELETE',
        path: '/api/projects/{id}/dids/{did}',
        description: 'Remove a DID from a project',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' }
          },
          {
            name: 'did',
            in: 'path',
            required: true,
            schema: { type: 'string' }
          }
        ]
      },
      {
        method: 'POST',
        path: '/api/archive/number/{number}',
        description: 'Archive a phone number',
        parameters: [
          {
            name: 'number',
            in: 'path',
            required: true,
            schema: { type: 'string' }
          }
        ],
        requestBody: {
          required: false,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  archivedBy: { type: 'string' },
                  reason: { type: 'string' }
                }
              },
              example: {
                archivedBy: 'John Doe',
                reason: 'No longer in service'
              }
            }
          }
        }
      },
      {
        method: 'GET',
        path: '/api/numbers/{number}/meta',
        description: 'Get metadata for a phone number',
        parameters: [
          {
            name: 'number',
            in: 'path',
            required: true,
            schema: { type: 'string' }
          }
        ]
      },
      {
        method: 'POST',
        path: '/api/projects/{id}/notes',
        description: 'Add a note to a project',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' }
          }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  text: { type: 'string' },
                  created_by: { type: 'string' }
                },
                required: ['text']
              },
              example: {
                text: 'Important note about this project',
                created_by: 'John Doe'
              }
            }
          }
        }
      },
      {
        method: 'DELETE',
        path: '/api/projects/{id}/notes/{note_id}',
        description: 'Delete a project note',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' }
          },
          {
            name: 'note_id',
            in: 'path',
            required: true,
            schema: { type: 'string' }
          }
        ]
      }
    ];

    this.renderEndpointList();
  }

  setupEventListeners() {
    // Endpoint selection
    document.getElementById('endpoint-list')?.addEventListener('click', (e) => {
      const item = e.target.closest('.list-group-item');
      if (item) {
        this.selectEndpoint(item.dataset.index);
      }
    });

    // Form submission
    document.getElementById('api-request-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.sendRequest();
    });

    // Pretty print toggle
    document.getElementById('pretty-print')?.addEventListener('change', (e) => {
      this.prettifyEnabled = e.target.checked;
      this.formatRequestBody();
    });

    // Add param/header buttons
    document.querySelector('.add-param-btn')?.addEventListener('click', () => {
      this.addInputGroup('params');
    });

    document.querySelector('.add-header-btn')?.addEventListener('click', () => {
      this.addInputGroup('headers');
    });

    // Request body input
    document.getElementById('request-body')?.addEventListener('input', (e) => {
      this.validateJSON(e.target);
    });
  }

  renderEndpointList() {
    const list = document.getElementById('endpoint-list');
    if (!list) return;

    list.innerHTML = this.endpoints.map((endpoint, index) => `
      <div class="list-group-item" data-index="${index}">
        <div class="d-flex justify-content-between align-items-start">
          <div>
            <span class="endpoint-method ${endpoint.method.toLowerCase()}">${endpoint.method}</span>
            <code>${endpoint.path}</code>
          </div>
        </div>
        <div class="mt-1 small text-muted">${endpoint.description}</div>
      </div>
    `).join('');
  }

  selectEndpoint(index) {
    this.currentEndpoint = this.endpoints[index];
    
    // Update form
    document.getElementById('request-method').value = this.currentEndpoint.method;
    document.getElementById('request-url').value = this.currentEndpoint.path;
    
    // Clear and populate request body if example exists
    const requestBody = document.getElementById('request-body');
    if (this.currentEndpoint.requestBody?.content['application/json']?.example) {
      const example = this.currentEndpoint.requestBody.content['application/json'].example;
      requestBody.value = this.prettifyEnabled ? 
        JSON.stringify(example, null, 2) : 
        JSON.stringify(example);
    } else {
      requestBody.value = '';
    }
    
    // Update UI state
    document.querySelectorAll('#endpoint-list .list-group-item').forEach(item => {
      item.classList.remove('active');
    });
    document.querySelector(`[data-index="${index}"]`)?.classList.add('active');
  }

  async sendRequest() {
    const method = document.getElementById('request-method').value;
    const url = document.getElementById('request-url').value;
    const requestBody = document.getElementById('request-body').value;
    
    // Gather parameters
    const params = new URLSearchParams();
    document.querySelectorAll('[name="param-key[]"]').forEach((key, index) => {
      const value = document.querySelectorAll('[name="param-value[]"]')[index].value;
      if (key.value && value) {
        params.append(key.value, value);
      }
    });

    // Gather headers
    const headers = new Headers();
    headers.append('Content-Type', 'application/json');
    document.querySelectorAll('[name="header-key[]"]').forEach((key, index) => {
      const value = document.querySelectorAll('[name="header-value[]"]')[index].value;
      if (key.value && value) {
        headers.append(key.value, value);
      }
    });

    // Show loading state
    document.getElementById('response-status').textContent = 'Loading...';
    document.getElementById('response-time').textContent = '';
    document.getElementById('response-body').textContent = '';

    const startTime = performance.now();

    try {
      const response = await fetch(`${url}${params.toString() ? '?' + params.toString() : ''}`, {
        method,
        headers,
        body: method !== 'GET' ? requestBody : undefined
      });

      const endTime = performance.now();
      const responseTime = Math.round(endTime - startTime);

      // Update response section
      const statusEl = document.getElementById('response-status');
      statusEl.textContent = `${response.status} ${response.statusText}`;
      statusEl.className = response.ok ? 'success' : 'error';

      document.getElementById('response-time').textContent = `${responseTime}ms`;

      const responseBody = await response.json();
      document.getElementById('response-body').textContent = 
        this.prettifyEnabled ? 
          JSON.stringify(responseBody, null, 2) : 
          JSON.stringify(responseBody);

    } catch (error) {
      document.getElementById('response-status').textContent = 'Error';
      document.getElementById('response-status').className = 'error';
      document.getElementById('response-body').textContent = error.message;
    }
  }

  addInputGroup(type) {
    const container = document.getElementById(`${type}-container`);
    const newGroup = document.createElement('div');
    newGroup.className = 'input-group mb-2';
    newGroup.innerHTML = `
      <input type="text" class="form-control" placeholder="Key" name="${type}-key[]">
      <input type="text" class="form-control" placeholder="Value" name="${type}-value[]">
      <button type="button" class="btn btn-outline-danger remove-input-btn">
        <i class="bi bi-dash-lg"></i>
      </button>
    `;
    
    newGroup.querySelector('.remove-input-btn').addEventListener('click', () => {
      newGroup.remove();
    });
    
    container.appendChild(newGroup);
  }

  validateJSON(textarea) {
    try {
      if (textarea.value.trim()) {
        JSON.parse(textarea.value);
        textarea.classList.remove('is-invalid');
      }
    } catch (e) {
      textarea.classList.add('is-invalid');
    }
  }

  formatRequestBody() {
    const textarea = document.getElementById('request-body');
    if (!textarea.value.trim()) return;

    try {
      const json = JSON.parse(textarea.value);
      textarea.value = this.prettifyEnabled ? 
        JSON.stringify(json, null, 2) : 
        JSON.stringify(json);
    } catch (e) {
      // If invalid JSON, leave as-is
    }
  }
}