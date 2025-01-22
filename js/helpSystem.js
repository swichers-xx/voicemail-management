export class HelpSystem {
  constructor() {
    this.tooltips = new Map();
  }

  init() {
    this.initializeTooltips();
    this.setupHelpButton();
  }

  initializeTooltips() {
    // Initialize all tooltips
    const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
    this.tooltips = [...tooltipTriggerList].map(tooltipTriggerEl => new bootstrap.Tooltip(tooltipTriggerEl));
  }

  setupHelpButton() {
    const helpModal = new bootstrap.Modal(document.getElementById('help-modal'));
    document.getElementById('nav-help')?.addEventListener('click', (e) => {
      e.preventDefault();
      helpModal.show();
    });
  }

  // Call this when views change to reinitialize tooltips
  refreshTooltips() {
    // Destroy existing tooltips
    this.tooltips.forEach(tooltip => tooltip.dispose());
    // Reinitialize
    this.initializeTooltips();
  }
}