# VoiceOut Role Permissions

## Role Definitions

### User (Client)
- **Primary Function**: Submit and track invoices
- **Permissions**:
  - Create new invoices
  - Submit invoices for review
  - View own invoices
  - Approve/reject manager-prepared invoices
  - Download and print invoices
  - Receive notifications about invoice status

### Manager
- **Primary Function**: Process and approve invoices
- **Permissions**:
  - Review submitted invoices
  - Add digital signature to invoices
  - Request revisions from clients
  - Upload scanned invoice documents
  - Mark invoices as sent to billed clients
  - Update invoice status through workflow
  - View all workspace invoices
  - Access manager dashboard view

### Admin (Workspace Owner)
- **Primary Function**: Manage workspace and members
- **Permissions**:
  - All User (Client) permissions
  - Add/remove workspace members
  - Invite new members via email
  - Change member roles
  - Update workspace settings
  - Delete workspace
  - View team management interface
  - Switch between client and manager views (UI only)
  
**Important**: Admin role does NOT have invoice processing capabilities. They cannot:
- Sign invoices digitally
- Upload scanned invoices
- Approve/reject invoices as a manager would

## View Modes

### Client View
- Available to: All roles
- Shows: Client dashboard with invoice creation and tracking

### Manager View
- Available to: Manager role only
- Shows: Manager dashboard with pending invoices for review

### Admin Toggle
- Admins can toggle between client and manager views for UI purposes
- However, they cannot perform manager-specific actions (signing, uploading)
- This is purely for viewing different dashboard layouts

## Workflow Separation

The invoice workflow is strictly separated:
1. **Clients** create and submit invoices
2. **Managers** review, sign, and process invoices
3. **Admins** manage the workspace infrastructure but stay out of invoice processing

This separation ensures clear responsibilities and prevents confusion about who can perform which actions in the invoice workflow.