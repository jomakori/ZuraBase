# Comprehensive Sync System Documentation

## Overview

This document describes the unified sync system implemented for the Strands module. The system consolidates all sync operations into a single, reusable service and replaces all browser-native dialogs with custom UI components.

## Architecture

### Core Components

#### 1. **SyncService** (`syncService.ts`)
The central service that handles all sync operations:

- **Single Strand Sync**: `syncSingle(strand, options)`
- **Multiple Strands Sync**: `syncMultiple(strands, options)`
- **Cancellation Support**: `cancel()`
- **Progress Tracking**: Real-time progress callbacks
- **Error Handling**: Friendly, user-facing error messages

**Key Features:**
- Automatic polling for sync completion
- Configurable timeout and retry logic
- Human-readable status messages
- Abort signal support for cancellation

#### 2. **Custom UI Components**

##### Dialog Component (`components/Dialog.tsx`)
Replaces browser-native `alert()` and `confirm()` dialogs.

**Variants:**
- `info` - Blue theme for informational messages
- `success` - Green theme for success confirmations
- `warning` - Yellow theme for warnings
- `danger` - Red theme for destructive actions

**Features:**
- Smooth fade-in/scale-in animations
- Keyboard accessibility
- Customizable buttons
- Optional cancel button

##### Toast Component (`components/Toast.tsx`)
Non-blocking notifications for status updates.

**Variants:**
- `info` - Blue theme
- `success` - Green theme
- `warning` - Yellow theme
- `error` - Red theme

**Features:**
- Auto-dismiss with configurable duration
- Slide-in animation from right
- Manual dismiss button
- Stacks multiple toasts

##### SyncProgressModal Component (`components/SyncProgressModal.tsx`)
Enhanced modal for displaying sync progress.

**Features:**
- Real-time progress bar with percentage
- Current item being synced
- Success/failure statistics
- Cancellation support (optional)
- Status-based color coding
- Animated progress indicators

### Data Flow

```
User Action
    ↓
Component (StrandsList/StrandDetail/StrandsApp)
    ↓
SyncService.syncSingle() or syncMultiple()
    ↓
StrandsApi.syncStrand() - Initiates backend sync
    ↓
Polling Loop - Checks for completion
    ↓
Progress Callbacks - Updates UI
    ↓
Completion/Error - Final status
```

## Usage Examples

### Single Strand Sync

```typescript
import { syncService } from './syncService';
import { useState } from 'react';

const [showProgress, setShowProgress] = useState(false);
const [progress, setProgress] = useState<SyncProgress>({
  total: 0,
  completed: 0,
  failed: 0,
  status: 'syncing',
});

const handleSync = async (strand: Strand) => {
  setShowProgress(true);
  
  try {
    await syncService.syncSingle(strand, {
      onProgress: (progress) => {
        setProgress(progress);
      },
    });
    
    // Show success notification
    setToast({
      show: true,
      message: 'Strand synced successfully!',
      variant: 'success',
    });
  } catch (error) {
    // Handle error
    setToast({
      show: true,
      message: 'Failed to sync strand',
      variant: 'error',
    });
  } finally {
    setTimeout(() => setShowProgress(false), 2000);
  }
};
```

### Multiple Strands Sync

```typescript
const handleBulkSync = async (strands: Strand[]) => {
  setShowProgress(true);
  
  try {
    const results = await syncService.syncMultiple(strands, {
      onProgress: (progress) => {
        setProgress(progress);
      },
      onComplete: (results) => {
        const successful = results.filter(r => r.success).length;
        console.log(`Synced ${successful} of ${results.length} strands`);
      },
    });
  } catch (error) {
    console.error('Bulk sync failed:', error);
  }
};
```

### Using Custom Dialogs

```typescript
import Dialog from '../components/Dialog';

const [showDialog, setShowDialog] = useState(false);

// Confirmation dialog
<Dialog
  isOpen={showDialog}
  title="Confirm Action"
  message="Are you sure you want to proceed?"
  variant="warning"
  confirmText="Yes, Continue"
  cancelText="Cancel"
  onConfirm={handleConfirm}
  onCancel={() => setShowDialog(false)}
/>
```

### Using Toast Notifications

```typescript
import Toast from '../components/Toast';

const [toast, setToast] = useState({
  show: false,
  message: '',
  variant: 'info' as const,
});

// Show toast
setToast({
  show: true,
  message: 'Operation completed successfully!',
  variant: 'success',
});

// Render toast
<Toast
  isOpen={toast.show}
  message={toast.message}
  variant={toast.variant}
  duration={5000}
  onClose={() => setToast({ ...toast, show: false })}
/>
```

## Status Messages

The sync system provides clear, human-readable status messages:

- **Preparing**: "Preparing to sync strands..."
- **In Progress**: "Syncing strands... X of Y processed"
- **Success**: "All X strands synced successfully!"
- **Partial Success**: "Sync completed with N errors. M strands synced successfully."
- **Cancelled**: "Sync cancelled. X of Y strands processed."
- **Error**: Specific error message based on the failure type

## Error Handling

The system provides friendly error messages for common scenarios:

- **Network Error**: "Unable to connect to server. Please check your connection."
- **Authentication Error**: "Session expired. Please log in again."
- **Service Unavailable**: "AI service is currently unavailable. Please try again later."
- **Timeout**: "Sync timeout - taking longer than expected"
- **Generic Error**: Displays the actual error message

## Animations

All UI components include smooth animations defined in `index.css`:

- **fadeIn**: Fade in effect for overlays
- **scaleIn**: Scale and fade in for modals
- **slideInRight**: Slide in from right for toasts
- **pulse**: Pulsing effect for active progress bars

## Migration Guide

### Replacing Browser Dialogs

**Before:**
```typescript
const confirmed = window.confirm('Delete this item?');
if (confirmed) {
  deleteItem();
}
```

**After:**
```typescript
const [showDialog, setShowDialog] = useState(false);

<Dialog
  isOpen={showDialog}
  title="Delete Item"
  message="Are you sure you want to delete this item?"
  variant="danger"
  confirmText="Delete"
  onConfirm={() => {
    setShowDialog(false);
    deleteItem();
  }}
  onCancel={() => setShowDialog(false)}
/>
```

### Replacing Alert Messages

**Before:**
```typescript
alert('Operation completed successfully!');
```

**After:**
```typescript
setToast({
  show: true,
  message: 'Operation completed successfully!',
  variant: 'success',
});
```

## Best Practices

1. **Always use custom dialogs** instead of browser-native `alert()`, `confirm()`, or `prompt()`
2. **Use toasts for non-blocking notifications** (success, info, warnings)
3. **Use dialogs for actions requiring user confirmation** (delete, destructive actions)
4. **Show progress modals for long-running operations** (syncing multiple items)
5. **Provide clear, actionable error messages** to users
6. **Allow cancellation** for long-running operations when possible
7. **Use appropriate variants** to convey the message type visually

## Files Modified/Created

### Created:
- `frontend/src/components/Dialog.tsx` - Custom dialog component
- `frontend/src/components/Toast.tsx` - Toast notification component
- `frontend/src/strands/syncService.ts` - Unified sync service
- `frontend/src/strands/SYNC_SYSTEM.md` - This documentation

### Modified:
- `frontend/src/strands/StrandsList.tsx` - Uses new sync system
- `frontend/src/strands/StrandDetail.tsx` - Uses new sync system
- `frontend/src/strands/StrandsApp.tsx` - Uses new sync system
- `frontend/src/strands/components/SyncProgressModal.tsx` - Enhanced with cancellation
- `frontend/src/strands/hooks.ts` - Fixed flickering issue, removed alerts
- `frontend/src/strands/api.ts` - Removed alert calls
- `frontend/src/index.css` - Added animations

### Removed:
- `frontend/src/strands/syncUtils.ts` - Replaced by syncService.ts

## Future Enhancements

1. **Batch Progress**: Show individual item progress in bulk operations
2. **Retry Logic**: Automatic retry for failed syncs
3. **Offline Support**: Queue syncs when offline
4. **Sync History**: Track and display sync history
5. **Conflict Resolution**: Handle sync conflicts gracefully
6. **Real-time Updates**: WebSocket support for live sync status

## Troubleshooting

### Flickering Dashboard
**Issue**: Dashboard components re-rendering unnecessarily
**Solution**: Fixed in `hooks.ts` by using dependency array instead of useCallback

### Sync Failures
**Issue**: Backend sync endpoints returning errors
**Solution**: Check backend logs, ensure AI service is configured, verify authentication

### Progress Not Updating
**Issue**: Progress callbacks not firing
**Solution**: Ensure `onProgress` callback is provided and state is being updated correctly

## Support

For issues or questions about the sync system, please refer to:
- This documentation
- Component source code comments
- Backend API documentation for sync endpoints
