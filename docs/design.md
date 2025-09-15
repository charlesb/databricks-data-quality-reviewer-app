# Technical Design Document
*Data Quality Reviewer App - DLT Quarantine Management System*

## High-Level Design

The Data Quality Reviewer App is a web-based interface built on the existing Databricks App template, providing data stewards with tools to review, edit, and remediate quarantined data from Delta Live Tables pipelines.

### Architecture Overview

```
┌─────────────────────┐    ┌─────────────────────┐    ┌─────────────────────┐
│   React Frontend    │───▶│   FastAPI Backend   │───▶│  Databricks Tables  │
│                     │    │                     │    │                     │
│ • Quarantine Viewer │    │ • Table Operations  │    │ • quarantine_bad_txs│
│ • Batch Editor      │    │ • Data Validation   │    │ • cleaned_new_txs   │
│ • Real-time Updates │    │ • Audit Logging     │    │ • audit_trail       │
│ • Constraint UI     │    │ • Pipeline Triggers │    │                     │
└─────────────────────┘    └─────────────────────┘    └─────────────────────┘
                                      │
                                      ▼
                           ┌─────────────────────┐
                           │    DLT Pipeline     │
                           │                     │
                           │ dbdemos_dlt_loan_   │
                           │ charles_bernard_    │
                           │ dbdemos_dlt_loans   │
                           └─────────────────────┘
```

### Technology Stack

**Frontend (React + TypeScript)**
- React 18 with TypeScript for type safety
- shadcn/ui components for consistent UI
- Tailwind CSS for styling
- React Query for API state management and caching
- Date picker components for date fields
- Real-time updates via WebSocket or polling

**Backend (FastAPI + Python)**
- FastAPI for high-performance API endpoints
- Databricks SDK for table operations and pipeline management
- Pydantic models for data validation
- SQLAlchemy/Pandas for data manipulation
- Background tasks for pipeline triggers
- WebSocket support for real-time notifications

**Data Layer (Databricks)**
- Unity Catalog tables for data storage
- Delta Live Tables for data processing
- Structured Streaming for change detection
- Databricks Jobs API for pipeline management

### Libraries and Frameworks

**Frontend Dependencies (to add)**
```json
{
  "@tanstack/react-query": "^5.82.0",    // Already included
  "react-day-picker": "^9.8.0",          // Already included
  "@radix-ui/react-checkbox": "latest",   // For batch selection
  "@radix-ui/react-switch": "latest",     // For toggles
  "socket.io-client": "^4.7.0",           // Real-time updates
  "date-fns": "^4.1.0"                     // Already included
}
```

**Backend Dependencies (to add)**
```toml
[dependencies]
databricks-sdk = "^0.30.0"    # Databricks integration
pandas = "^2.2.0"             # Data manipulation
sqlalchemy = "^2.0.0"         # Database operations
websockets = "^12.0"          # Real-time notifications
celery = "^5.3.0"             # Background tasks (optional)
redis = "^5.0.0"              # Caching and task queue
```

### Data Architecture

**Primary Tables**
1. **Quarantine Table**: `charles_bernard.dbdemos_dlt_loans.quarantine_bad_txs`
   - **Editable Fields**: `next_payment_date`, `balance`, `arrears_balance`, `cost_center_code`
   - **Display Fields**: All 24 columns for context
   - **Unique Identifier**: Combination of `id + date + status` (composite key)
   - **Violation Detection**: Inferred from constraint validation

2. **Target Table**: `charles_bernard.dbdemos_dlt_loans.cleaned_new_txs`
   - **Destination**: Successfully corrected records
   - **Schema**: Same as quarantine table minus `_rescued_data`

3. **Audit Table**: `charles_bernard.dbdemos_dlt_loans.audit_trail` (to create)
   ```sql
   CREATE TABLE audit_trail (
     audit_id BIGINT GENERATED ALWAYS AS IDENTITY,
     record_id BIGINT,
     record_date STRING,
     user_email STRING,
     action STRING,  -- 'EDIT', 'MERGE', 'VALIDATION_FAILED'
     old_values STRING,  -- JSON
     new_values STRING,  -- JSON
     violation_types STRING,  -- JSON array
     timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
     session_id STRING
   )
   ```

**Violation Type Detection Logic**
```python
def detect_violations(record):
    violations = []

    # Payment date constraint
    if record['next_payment_date'] <= '2020-12-31':
        violations.append('PAYMENT_DATE')

    # Balance constraints
    if record['balance'] <= 0 or record['arrears_balance'] <= 0:
        violations.append('BALANCE')

    # Cost center constraint
    if not record['cost_center_code']:
        violations.append('COST_CENTER')

    return violations
```

### Integration Points

**1. Databricks SDK Integration**
```python
from databricks.sdk import WorkspaceClient
from databricks.sdk.service.sql import StatementExecutionAPI

# Table operations
class QuarantineService:
    def __init__(self):
        self.client = WorkspaceClient()

    def get_quarantine_records(self, violation_type=None):
        # Query quarantine table with optional filtering
        pass

    def validate_and_merge(self, records):
        # Re-validate against DLT expectations
        # Merge valid records to cleaned_new_txs
        pass
```

**2. DLT Pipeline Integration**
```python
from databricks.sdk.service.jobs import JobsAPI

class PipelineService:
    def trigger_pipeline(self, pipeline_name="dbdemos_dlt_loan_charles_bernard_dbdemos_dlt_loans"):
        # Trigger DLT pipeline after successful merges
        job = self.client.jobs.list(name=pipeline_name)
        if job:
            self.client.jobs.run_now(job_id=job.job_id)
```

**3. Real-time Updates Architecture**
```python
# Option 1: Databricks Streaming (Preferred)
class ChangeDetectionService:
    def monitor_quarantine_changes(self):
        # Use Databricks Auto Loader or Structured Streaming
        # Detect new records in quarantine table
        # Push notifications via WebSocket
        pass

# Option 2: Polling Fallback
class PollingService:
    def poll_quarantine_table(self, interval=30):
        # Fallback if streaming not available
        # Poll every 30 seconds for changes
        pass
```

## Implementation Plan

### Phase 1: Core Features (MVP)
**Priority: Critical - 2-3 weeks**

**Backend Implementation:**
1. **Quarantine Data API** (`/api/quarantine`)
   - `GET /quarantine/records` - List quarantined records
   - `GET /quarantine/records/{violation_type}` - Filter by violation
   - `POST /quarantine/validate` - Validate single record
   - `POST /quarantine/merge` - Merge corrected records

2. **Data Models**
   ```python
   class QuarantineRecord(BaseModel):
       id: int
       date: str
       next_payment_date: Optional[str] = None
       balance: Optional[int] = None
       arrears_balance: Optional[int] = None
       cost_center_code: Optional[str] = None
       violation_types: List[str]
       # ... other display fields
   ```

3. **Core Services**
   - `QuarantineService` - Table operations
   - `ValidationService` - Constraint checking
   - `AuditService` - Change tracking

**Frontend Implementation:**
1. **Quarantine Viewer Component**
   ```tsx
   interface QuarantineViewerProps {
     violationType?: string;
   }

   const QuarantineViewer: React.FC<QuarantineViewerProps> = ({
     violationType
   }) => {
     // Display filtered quarantine records
     // Show violation context and record details
   };
   ```

2. **Single Record Editor**
   ```tsx
   const RecordEditor: React.FC<{record: QuarantineRecord}> = ({
     record
   }) => {
     // Constraint-specific form fields:
     // - DatePicker for next_payment_date
     // - NumberInput for balance fields
     // - TextInput for cost_center_code
   };
   ```

3. **Validation & Merge**
   - Pre-save validation feedback
   - Success/failure notifications
   - Automatic refresh after merge

### Phase 2: Batch Operations & Automation
**Priority: High - 2-3 weeks after Phase 1**

**Backend Enhancements:**
1. **Batch Processing API**
   - `POST /quarantine/batch/validate` - Validate multiple records
   - `POST /quarantine/batch/merge` - Merge multiple records
   - Background task processing for large batches

2. **Real-time Updates**
   - WebSocket endpoint: `ws://localhost:8000/ws/quarantine`
   - Databricks change stream monitoring
   - Push notifications for new quarantined data

3. **Pipeline Integration**
   - Automatic DLT pipeline triggering
   - Pipeline status monitoring
   - Integration with Databricks Jobs API

**Frontend Enhancements:**
1. **Batch Selection Interface**
   ```tsx
   const BatchEditor: React.FC = () => {
     const [selectedRecords, setSelectedRecords] = useState<string[]>([]);

     // Multi-select checkboxes
     // Bulk edit form
     // Batch validation preview
     // Progress indicators for batch operations
   };
   ```

2. **Real-time Updates**
   - WebSocket connection management
   - Auto-refresh on data changes
   - Toast notifications for new quarantined data

3. **Progress Tracking**
   - Batch operation progress bars
   - Success/failure summaries
   - Retry mechanisms for failed operations

### Phase 3: Advanced Features & Analytics
**Priority: Medium - 2-3 weeks after Phase 2**

**Analytics Dashboard:**
1. **Metrics API** (`/api/metrics`)
   - Resolution rates and times
   - Violation type trends
   - User activity statistics

2. **Dashboard Components**
   ```tsx
   const MetricsDashboard: React.FC = () => {
     // Resolution time charts
     // Success rate indicators
     // Violation type distribution
     // User activity heatmaps
   };
   ```

**Advanced Features:**
1. **Enhanced Filtering**
   - Date range selection
   - Multi-criteria search
   - Saved filter presets

2. **Audit Trail Viewer**
   - Change history for each record
   - User activity logs
   - Compliance reporting

3. **Performance Optimization**
   - Data pagination and virtualization
   - Caching strategies
   - Database query optimization

## Development Workflow

### Getting Started
1. **Environment Setup**
   ```bash
   # Already completed in Step 1
   ./setup.sh  # Databricks authentication configured
   ```

2. **Install Additional Dependencies**
   ```bash
   # Backend dependencies
   uv add databricks-sdk pandas sqlalchemy websockets redis

   # Frontend dependencies (if needed)
   cd client && bun add socket.io-client @radix-ui/react-checkbox @radix-ui/react-switch
   ```

### Development Process
1. **Start Development Server**
   ```bash
   nohup ./watch.sh > /tmp/databricks-app-watch.log 2>&1 &
   ```

2. **API-First Development**
   - Implement backend APIs first
   - Test with FastAPI docs interface
   - Generate TypeScript client automatically

3. **Component Development**
   - Build React components using shadcn/ui
   - Test with Playwright automation
   - Validate against real Databricks data

4. **Integration Testing**
   - Test with actual quarantine data
   - Verify DLT pipeline integration
   - Validate audit trail functionality

### Deployment Strategy
1. **Staged Deployment**
   - Test environment first
   - Production deployment with `./deploy.sh`
   - Monitor with `uv run python dba_logz.py <app-url>`

2. **Data Safety**
   - Start with read-only operations
   - Implement transaction rollback
   - Comprehensive audit logging

3. **User Acceptance Testing**
   - Data steward feedback sessions
   - Performance benchmarking
   - Security validation

This architecture provides a scalable, maintainable solution that integrates seamlessly with your existing Databricks DLT pipeline while providing an intuitive interface for data stewards.