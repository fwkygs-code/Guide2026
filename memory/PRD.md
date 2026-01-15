# InterGuide - Interactive Walkthrough & Knowledge Base SaaS

## Original Problem Statement
Multi-tenant SaaS web app that allows companies and individuals to create, host, and share interactive tutorials and knowledge bases using text, images, GIFs, and video, all presented in a modern, Apple-style UI.

## User Personas
1. **Content Creators** - Companies and individuals creating walkthroughs
2. **End Users** - People viewing and following walkthroughs
3. **Workspace Admins** - Managing users and content within workspaces

## Core Requirements
- Multi-tenant workspaces with roles (Owner, Admin, Editor, Viewer)
- Rich content creation with text, images, videos, GIFs
- Block-based WYSIWYG editor inspired by Figma/Notion
- Full Hebrew/RTL support
- Publishing and versioning system
- Public portal for end users
- Analytics and feedback collection

## Tech Stack
- **Frontend:** React, TailwindCSS, Tiptap.js, dnd-kit
- **Backend:** FastAPI (Python), Motor (async MongoDB)
- **Database:** MongoDB

---

## What's Been Implemented (January 12, 2026)

### Core Features - COMPLETED
- [x] User authentication (signup/login with JWT)
- [x] Multi-tenant workspace management
- [x] Walkthrough CRUD operations
- [x] Three-pane Canvas Builder (Left Sidebar, Live Canvas, Right Inspector)
- [x] Block-based content system

### Canvas Builder - COMPLETED
- [x] Block types: Heading, Text, Image, Video, File, Button, Divider, Spacer, Problem
- [x] Tiptap.js rich-text editor with:
  - [x] Placeholder text (shows/hides correctly)
  - [x] Floating toolbar on text selection
  - [x] Bold, Italic, Underline formatting
  - [x] Text alignment (left, center, right)
  - [x] Lists (bullet and numbered)
  - [x] Links
- [x] Block controls (drag, duplicate, delete)
- [x] Hebrew/RTL auto-detection
- [x] File upload to backend

### Walkthrough Viewer - COMPLETED
- [x] Public portal page
- [x] Step-by-step navigation
- [x] Progress tracking
- [x] Support for both legacy content and block-based content
- [x] Feedback collection
- [x] Analytics tracking

### Backend API - COMPLETED
- [x] Workspaces API
- [x] Walkthroughs API with steps
- [x] Categories API
- [x] File upload and serving
- [x] Analytics events
- [x] Feedback collection

---

## Prioritized Backlog

### P0 - Critical (Next Sprint)
- [ ] **Auto-save functionality** - Save changes automatically every few seconds
- [ ] **Versioning system** - Create version snapshots on publish, enable rollback
- [ ] **Complete media preview** - Ensure uploaded images/videos show immediately in preview

### P1 - High Priority
- [ ] **Column layouts** - Support 1-4 column layouts for blocks
- [ ] **Custom HTML block** - Allow raw HTML injection
- [ ] **Common Problems UI** - Inline panel with floating tooltip preview
- [ ] **Export to PDF/DOCX** - Download walkthroughs as documents
- [ ] **State machine navigation** - Deterministic navigation with checkoff support

### P2 - Medium Priority
- [ ] **Analytics Dashboard** - Funnels, heatmaps, completion rates
- [ ] **Embedding options** - iframe and JS widget generation
- [ ] **White-labeling** - Custom domains, hide platform branding
- [ ] **Translation integration** - Google Translate support

### P3 - Nice to Have
- [ ] **Password-protected walkthroughs**
- [ ] **Category management UI improvements**
- [ ] **Advanced block settings** - Padding, margins, animations
- [ ] **Undo/Redo system**

---

## API Endpoints

### Authentication
- `POST /api/auth/signup` - Register user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user

### Workspaces
- `GET /api/workspaces` - List workspaces
- `POST /api/workspaces` - Create workspace
- `GET /api/workspaces/{id}` - Get workspace
- `PUT /api/workspaces/{id}` - Update workspace

### Walkthroughs
- `GET /api/workspaces/{ws_id}/walkthroughs` - List walkthroughs
- `POST /api/workspaces/{ws_id}/walkthroughs` - Create walkthrough
- `GET /api/workspaces/{ws_id}/walkthroughs/{id}` - Get walkthrough
- `PUT /api/workspaces/{ws_id}/walkthroughs/{id}` - Update walkthrough
- `DELETE /api/workspaces/{ws_id}/walkthroughs/{id}` - Delete walkthrough

### Steps
- `POST /api/workspaces/{ws_id}/walkthroughs/{wt_id}/steps` - Add step
- `PUT /api/workspaces/{ws_id}/walkthroughs/{wt_id}/steps/{step_id}` - Update step
- `DELETE /api/workspaces/{ws_id}/walkthroughs/{wt_id}/steps/{step_id}` - Delete step

### Media
- `POST /api/upload` - Upload file (auth required)
- `GET /api/media/{filename}` - Get media file (public)

---

## Test Credentials
- Email: test456@test.com
- Password: Test123!
- Workspace ID: 43bfb196-bd7a-41c6-bc45-ed1c9f5cc624

---

## Known Issues
1. Minor Tiptap console warning about duplicate extensions (LOW priority, doesn't affect functionality)
2. Media preview after upload needs verification in published walkthroughs

## Architecture Notes
- Frontend uses Shadcn/UI components from `/app/frontend/src/components/ui/`
- Block data structure stored in steps as `blocks: Array<Block>`
- Legacy content supported via `step.content` field
- RTL detection uses regex for Hebrew/Arabic characters
