/**
 * ADMIN TOOLBAR UI
 * Floating toolbar for walkthrough authoring
 */

class AuthoringToolbar {
  constructor() {
    this.element = null;
    this.isVisible = false;
    this.walkthroughList = [];
    this.onCreateClick = null;
    this.onEditClick = null;
    this.onPublishClick = null;
    this.onTestClick = null;
  }

  show() {
    if (this.element) {
      this.element.style.display = 'block';
      this.isVisible = true;
      return;
    }

    this.element = document.createElement('div');
    this.element.id = 'ig-admin-toolbar';
    this.element.style.cssText = `
      position: fixed;
      top: 16px;
      right: 16px;
      background: white;
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.2);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      z-index: 2147483646;
      min-width: 280px;
      max-width: 360px;
      overflow: hidden;
    `;

    this.element.innerHTML = `
      <div style="
        background: linear-gradient(135deg, #4f46e5, #7c3aed);
        color: white;
        padding: 16px;
        display: flex;
        align-items: center;
        gap: 12px;
      ">
        <div style="
          width: 36px;
          height: 36px;
          background: rgba(255,255,255,0.2);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
        ">IG</div>
        <div>
          <div style="font-weight: 600; font-size: 15px;">Authoring Mode</div>
          <div style="font-size: 12px; opacity: 0.9;">Create walkthroughs</div>
        </div>
        <button id="ig-toolbar-close" style="
          margin-left: auto;
          background: none;
          border: none;
          color: white;
          font-size: 20px;
          cursor: pointer;
          padding: 4px;
        ">×</button>
      </div>
      
      <div style="padding: 16px;">
        <button id="ig-create-walkthrough" style="
          width: 100%;
          padding: 12px;
          background: #4f46e5;
          color: white;
          border: none;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          font-size: 14px;
          margin-bottom: 16px;
        ">
          + Create New Walkthrough
        </button>
        
        <div id="ig-walkthrough-list" style="
          max-height: 300px;
          overflow-y: auto;
        ">
          <!-- Walkthrough list populated here -->
        </div>
      </div>
      
      <div style="
        padding: 12px 16px;
        background: #f9fafb;
        border-top: 1px solid #e5e7eb;
        font-size: 12px;
        color: #6b7280;
        text-align: center;
      ">
        v1.0.0 • Drafts auto-saved
      </div>
    `;

    document.body.appendChild(this.element);
    this.isVisible = true;

    // Event listeners
    this.element.querySelector('#ig-toolbar-close').addEventListener('click', () => {
      this.hide();
    });

    this.element.querySelector('#ig-create-walkthrough').addEventListener('click', () => {
      this.showCreateModal();
    });

    console.log('[IG Toolbar] Admin toolbar shown');
  }

  hide() {
    if (this.element) {
      this.element.style.display = 'none';
      this.isVisible = false;
    }
  }

  setWalkthroughList(walkthroughs) {
    this.walkthroughList = walkthroughs;
    this.renderWalkthroughList();
  }

  renderWalkthroughList() {
    const container = this.element?.querySelector('#ig-walkthrough-list');
    if (!container) return;

    if (this.walkthroughList.length === 0) {
      container.innerHTML = `
        <div style="
          text-align: center;
          padding: 32px 16px;
          color: #9ca3af;
          font-size: 14px;
        ">
          <div style="font-size: 32px; margin-bottom: 8px;">📝</div>
          <div>No walkthroughs yet</div>
          <div style="font-size: 12px; margin-top: 4px;">Create your first guide above</div>
        </div>
      `;
      return;
    }

    container.innerHTML = this.walkthroughList.map(w => {
      const isDraft = w.status === 'draft';
      const isPublished = w.status === 'published';
      const stepCount = w.steps?.length || 0;
      
      return `
        <div style="
          padding: 12px;
          background: ${isDraft ? '#fef3c7' : '#dcfce7'};
          border-radius: 8px;
          margin-bottom: 8px;
          border: 1px solid ${isDraft ? '#fcd34d' : '#86efac'};
        ">
          <div style="display: flex; justify-content: space-between; align-items: start;">
            <div>
              <div style="font-weight: 600; font-size: 14px; color: #1f2937;">${w.name}</div>
              <div style="font-size: 12px; color: #6b7280; margin-top: 2px;">
                ${stepCount} step${stepCount !== 1 ? 's' : ''} • ${isDraft ? 'Draft' : 'Published'}
              </div>
            </div>
            <span style="
              font-size: 11px;
              padding: 2px 8px;
              border-radius: 4px;
              background: ${isDraft ? '#f59e0b' : '#22c55e'};
              color: white;
              font-weight: 500;
            ">${isDraft ? 'DRAFT' : 'LIVE'}</span>
          </div>
          
          <div style="display: flex; gap: 8px; margin-top: 12px;">
            ${isDraft ? `
              <button class="ig-btn-edit" data-id="${w.walkthroughId}" style="
                flex: 1;
                padding: 6px;
                background: white;
                border: 1px solid #d1d5db;
                border-radius: 6px;
                font-size: 12px;
                cursor: pointer;
              ">Edit</button>
              <button class="ig-btn-publish" data-id="${w.walkthroughId}" style="
                flex: 1;
                padding: 6px;
                background: #4f46e5;
                color: white;
                border: none;
                border-radius: 6px;
                font-size: 12px;
                cursor: pointer;
              ">Publish</button>
            ` : `
              <button class="ig-btn-test" data-id="${w.walkthroughId}" style="
                flex: 1;
                padding: 6px;
                background: white;
                border: 1px solid #d1d5db;
                border-radius: 6px;
                font-size: 12px;
                cursor: pointer;
              ">Test</button>
              <button class="ig-btn-archive" data-id="${w.walkthroughId}" style="
                flex: 1;
                padding: 6px;
                background: white;
                border: 1px solid #d1d5db;
                border-radius: 6px;
                font-size: 12px;
                cursor: pointer;
                color: #ef4444;
              ">Archive</button>
            `}
          </div>
        </div>
      `;
    }).join('');

    // Add event listeners
    container.querySelectorAll('.ig-btn-edit').forEach(btn => {
      btn.addEventListener('click', () => {
        if (this.onEditClick) this.onEditClick(btn.dataset.id);
      });
    });

    container.querySelectorAll('.ig-btn-publish').forEach(btn => {
      btn.addEventListener('click', () => {
        if (this.onPublishClick) this.onPublishClick(btn.dataset.id);
      });
    });

    container.querySelectorAll('.ig-btn-test').forEach(btn => {
      btn.addEventListener('click', () => {
        if (this.onTestClick) this.onTestClick(btn.dataset.id);
      });
    });
  }

  showCreateModal() {
    const modal = document.createElement('div');
    modal.id = 'ig-create-modal';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.5);
      z-index: 2147483647;
      display: flex;
      align-items: center;
      justify-content: center;
    `;

    modal.innerHTML = `
      <div style="
        background: white;
        border-radius: 16px;
        padding: 24px;
        width: 90%;
        max-width: 400px;
        box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      ">
        <h2 style="margin: 0 0 16px; font-size: 20px;">Create Walkthrough</h2>
        
        <div style="margin-bottom: 16px;">
          <label style="display: block; font-size: 14px; font-weight: 500; margin-bottom: 4px;">
            Name
          </label>
          <input id="ig-wt-name" type="text" placeholder="e.g., 'New User Setup'" style="
            width: 100%;
            padding: 10px;
            border: 1px solid #d1d5db;
            border-radius: 8px;
            font-size: 14px;
            box-sizing: border-box;
          ">
        </div>
        
        <div style="margin-bottom: 16px;">
          <label style="display: block; font-size: 14px; font-weight: 500; margin-bottom: 4px;">
            Starting URL
          </label>
          <input id="ig-wt-url" type="text" value="${window.location.href}" style="
            width: 100%;
            padding: 10px;
            border: 1px solid #d1d5db;
            border-radius: 8px;
            font-size: 14px;
            box-sizing: border-box;
          ">
        </div>
        
        <div style="display: flex; gap: 12px;">
          <button id="ig-cancel-create" style="
            flex: 1;
            padding: 12px;
            background: #f3f4f6;
            border: none;
            border-radius: 8px;
            font-weight: 600;
            cursor: pointer;
          ">Cancel</button>
          <button id="ig-confirm-create" style="
            flex: 1;
            padding: 12px;
            background: #4f46e5;
            color: white;
            border: none;
            border-radius: 8px;
            font-weight: 600;
            cursor: pointer;
          ">Create</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector('#ig-cancel-create').addEventListener('click', () => {
      modal.remove();
    });

    modal.querySelector('#ig-confirm-create').addEventListener('click', async () => {
      const name = modal.querySelector('#ig-wt-name').value;
      const url = modal.querySelector('#ig-wt-url').value;

      if (!name) {
        alert('Please enter a name');
        return;
      }

      modal.remove();

      if (this.onCreateClick) {
        this.onCreateClick(name, url);
      }
    });
  }
}

// Global instance
window.AuthoringToolbar = new AuthoringToolbar();
