# Product Requirements Document
*Data Quality Reviewer App - DLT Quarantine Management Interface*

## Overview

The Data Quality Reviewer App provides a user-friendly web interface for data stewards to review, edit, and remediate quarantined data from Delta Live Tables (DLT) pipelines. The app specifically handles records that fail DLT expectations and end up in the quarantine table `charles_bernard.dbdemos_dlt_loans.quarantine_bad_txs`.

**Problem Statement:**
When DLT pipelines detect data quality violations using expectations, bad records are quarantined but require manual review and correction by non-technical users (data stewards, data domain owners). Currently, there's no user-friendly interface for this critical data governance task.

**Solution:**
A web-based interface that allows data stewards to:
- View quarantined records filtered by violation type
- Batch edit multiple records with constraint-specific UI controls
- Re-validate and merge corrected data back to production
- Track all changes with comprehensive audit trails

## Target Users

**Primary Users: Data Stewards**
- Non-technical business users responsible for data quality
- Domain experts who understand business rules but not SQL
- Need simple, intuitive interfaces for data correction
- Work with quarantined data daily as part of data governance processes

**Secondary Users: Data Domain Owners**
- Business stakeholders who own specific data domains
- Responsible for ensuring data meets business requirements
- Need visibility into data quality issues and resolution status

## Core Features

### 1. Quarantine Data Viewer
- **Filter by Violation Type**: View records grouped by specific DLT constraint violations
  - Payment Date violations (next_payment_date > date('2020-12-31'))
  - Balance violations (balance > 0 AND arrears_balance > 0)
  - Cost Center violations (cost_center_code IS NOT NULL)
- **Real-time Data**: Auto-refresh interface when new quarantined data arrives
- **Record Details**: Full record view with violation context and original values

### 2. Batch Editing Interface
- **Multi-select Records**: Select multiple records for bulk editing
- **Constraint-specific UI Controls**:
  - **Date Picker** for payment date corrections
  - **Number inputs** for balance and arrears_balance fields
  - **Text input** for cost center code entry
- **Validation Preview**: Show which records will pass validation before saving
- **Batch Save**: Apply corrections to multiple records simultaneously

### 3. Data Validation & Merge
- **Pre-merge Validation**: Re-validate edited records against original DLT expectations
- **Automatic Merge**: Successfully validated records merge back to `cleaned_new_txs` table
- **Re-quarantine Handling**: Records that still fail validation return to quarantine
- **DLT Pipeline Trigger**: Automatically trigger DLT pipeline re-run after successful merges

### 4. Audit Trail & Notifications
- **Change Tracking**: Log who edited what records and when
- **Violation History**: Track how many times a record has been quarantined
- **Real-time Notifications**: Alert when new quarantined data arrives
- **Success Metrics**: Dashboard showing resolution rates and processing times

### 5. Integration Features
- **Databricks Integration**: Seamless connection to Databricks workspace and tables
- **DLT Pipeline Integration**: Monitor and trigger pipeline runs
- **Table Monitoring**: Watch quarantine table for new records
- **Data Refresh**: Keep interface synchronized with latest quarantine data

## User Stories

### Epic 1: Review Quarantined Data
- **As a data steward**, I want to see all quarantined records filtered by violation type, so I can focus on specific data quality issues
- **As a data steward**, I want to understand why each record was quarantined, so I can make appropriate corrections
- **As a data steward**, I want the interface to auto-refresh, so I always see the latest quarantined data

### Epic 2: Correct Data Quality Issues
- **As a data steward**, I want to edit multiple records at once, so I can efficiently process large batches of similar violations
- **As a data steward**, I want date pickers for payment dates, so I can easily select valid dates
- **As a data steward**, I want to edit balance fields with clear validation, so I ensure positive values
- **As a data steward**, I want to enter cost center codes with validation feedback, so I know my entries are correct

### Epic 3: Merge Corrected Data
- **As a data steward**, I want corrected data to be re-validated before merging, so I'm confident the fixes are correct
- **As a data steward**, I want successful corrections to automatically merge back to production, so the clean data is immediately available
- **As a data steward**, I want failed corrections to return to quarantine, so I can try again with different values

### Epic 4: Track Changes and Results
- **As a data steward**, I want to see who made what changes when, so we have full audit trails
- **As a data domain owner**, I want notifications when new quarantined data arrives, so I can ensure timely resolution
- **As a data domain owner**, I want to see metrics on resolution rates, so I can track data quality improvements

## Success Metrics

### Primary KPIs
- **Resolution Time**: Average time from quarantine to production (target: < 1 hour)
- **Resolution Rate**: Percentage of quarantined records successfully corrected (target: > 95%)
- **First-time Fix Rate**: Percentage of records corrected on first attempt (target: > 90%)

### Secondary KPIs
- **User Adoption**: Number of active data stewards using the interface
- **Data Quality Improvement**: Reduction in recurring quarantine violations
- **Processing Efficiency**: Records processed per hour per steward
- **Audit Compliance**: 100% audit trail coverage for all data corrections

### Operational Metrics
- **System Availability**: App uptime (target: > 99%)
- **Response Time**: Interface load time (target: < 3 seconds)
- **Data Freshness**: Delay between quarantine and interface visibility (target: < 5 minutes)

## Implementation Priority

### Phase 1: Core Quarantine Review (MVP)
**Priority: Critical - Immediate Value**
- View quarantined records with basic filtering
- Single-record editing with constraint-specific UI
- Manual merge back to production table
- Basic audit logging

**Deliverable**: Data stewards can review and fix quarantined records one by one
**Timeline**: 2-3 weeks
**Success Criteria**: Can process individual quarantined records end-to-end

### Phase 2: Batch Operations & Automation
**Priority: High - Efficiency Gains**
- Batch selection and editing capabilities
- Automatic validation before merge
- Auto-refresh and real-time notifications
- DLT pipeline trigger integration

**Deliverable**: Efficient batch processing with automated workflows
**Timeline**: 2-3 weeks after Phase 1
**Success Criteria**: Can process 50+ records simultaneously with full automation

### Phase 3: Advanced Features & Analytics
**Priority: Medium - Enhanced Experience**
- Advanced filtering and search
- Resolution metrics dashboard
- Historical trend analysis
- Performance optimization

**Deliverable**: Production-ready tool with analytics and optimization
**Timeline**: 2-3 weeks after Phase 2
**Success Criteria**: Data stewards prefer this tool over manual SQL processes

### Phase 4: Enterprise Features
**Priority: Low - Future Enhancement**
- Role-based permissions (if needed later)
- Multi-pipeline support
- Advanced notification systems
- Integration with other data governance tools

**Note**: Phase 4 features are currently not required based on user feedback, but can be added if business needs evolve.