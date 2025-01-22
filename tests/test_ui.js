import { UIManager } from '../js/uiManager.js';
import { ProjectManager } from '../js/projectManager.js';
import { SettingsManager } from '../js/settingsManager.js';
import { VoicemailSystem } from '../js/voicemail.js';

describe('Voicemail System UI Tests', () => {
	let app;
	let uiManager;
	
	beforeEach(() => {
		document.body.innerHTML = `
			<div id="dashboard-view" class="view"></div>
			<div id="settings-view" class="view"></div>
			<div id="project-list"></div>
			<div id="did-list"></div>
			<div id="voicemail-list"></div>
			<div id="toast-container"></div>
			<div id="catchAllEnabled"></div>
			<div class="catch-all-settings"></div>
		`;
		
		app = {
			projectManager: new ProjectManager(),
			settingsManager: new SettingsManager(),
			voicemailSystem: new VoicemailSystem()
		};
		
		uiManager = new UIManager(app);
	});
	
	test('View switching', () => {
		uiManager.showView('dashboard');
		expect(document.getElementById('dashboard-view').classList.contains('d-none')).toBeFalsy();
		expect(document.getElementById('settings-view').classList.contains('d-none')).toBeTruthy();
	});
	
	test('Catch-all toggle', async () => {
		const toggle = document.getElementById('catchAllEnabled');
		const settings = document.querySelector('.catch-all-settings');
		
		toggle.checked = true;
		toggle.dispatchEvent(new Event('change'));
		
		expect(settings.style.display).toBe('block');
	});
	
	test('Project list rendering', () => {
		const projects = [
			{
				id: 'test1',
				name: 'Test Project 1',
				dids: ['+1234567890'],
				newMessages: 2
			}
		];
		
		app.projectManager.projects = new Map(projects.map(p => [p.id, p]));
		uiManager.refreshProjectList();
		
		const projectList = document.getElementById('project-list');
		expect(projectList.innerHTML).toContain('Test Project 1');
		expect(projectList.innerHTML).toContain('+1234567890');
	});
	
	test('Notification display', () => {
		uiManager.showNotification('Test notification', 'success');
		const toast = document.querySelector('.toast');
		expect(toast).toBeTruthy();
		expect(toast.querySelector('.toast-body').textContent).toBe('Test notification');
	});
	
	test('Settings form update', () => {
		const settings = {
			notificationEmail: 'test@example.com',
			notificationSMS: '+1234567890',
			transcriptionEnabled: true,
			catchAllEnabled: true,
			catchAllGreeting: 'Test greeting'
		};
		
		app.settingsManager.settings = settings;
		uiManager.refreshSettings();
		
		const form = document.getElementById('settings-form');
		expect(form.querySelector('[name="notificationEmail"]').value).toBe('test@example.com');
		expect(form.querySelector('[name="catchAllEnabled"]').checked).toBeTruthy();
	});
});