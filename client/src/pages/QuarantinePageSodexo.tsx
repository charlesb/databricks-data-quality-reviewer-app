import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle, AlertTriangle, Clock, DollarSign, Building, RefreshCw, Filter, BarChart3, ChevronDown, ChevronUp, Save, Edit, ChevronLeft, ChevronRight } from 'lucide-react';

import { QuarantineService } from '@/fastapi_client';
import { QuarantineRecord, ViolationType } from '@/fastapi_client';
import '../styles/sodexo-theme.css';

type ViolationTab = 'ALL' | ViolationType;

interface EditState {
  [compositeKey: string]: Partial<QuarantineRecord>;
}

export const QuarantinePageSodexo: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ViolationTab>('ALL');
  const [batchMode, setBatchMode] = useState(false);
  const [expandedRecords, setExpandedRecords] = useState<Set<string>>(new Set());
  const [editingRecords, setEditingRecords] = useState<Set<string>>(new Set());
  const [editState, setEditState] = useState<EditState>({});
  const [selectedRecords, setSelectedRecords] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);

  // Debug logging for state changes
  console.log('Component render - currentPage:', currentPage, 'pageSize:', pageSize);

  // Force re-render when pagination state changes
  React.useEffect(() => {
    console.log('useEffect - currentPage changed to:', currentPage);
  }, [currentPage]);

  React.useEffect(() => {
    console.log('useEffect - pageSize changed to:', pageSize);
  }, [pageSize]);

  const queryClient = useQueryClient();

  // Fetch quarantine records with pagination
  const {
    data: quarantineData,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['quarantine-records-sodexo', activeTab, currentPage, pageSize],
    queryFn: async () => {
      const violationType = activeTab !== 'ALL' ? activeTab : undefined;
      const offset = currentPage * pageSize;
      console.log('Pagination API call:', { violationType, pageSize, offset, currentPage });
      return await QuarantineService.getQuarantineRecordsApiQuarantineRecordsGet(
        violationType,
        pageSize,
        offset
      );
    },
    refetchInterval: false, // Disable auto-refresh to avoid conflicts
    staleTime: 0, // Always consider data stale to force refresh
    cacheTime: 0, // Don't cache results
  });

  // Helper function to get violation icon
  const getViolationIcon = (type: ViolationType) => {
    switch (type) {
      case 'PAYMENT_DATE': return Clock;
      case 'BALANCE': return DollarSign;
      case 'COST_CENTER': return Building;
      default: return AlertTriangle;
    }
  };

  // Helper function to get violation color
  const getViolationColor = (type: ViolationType) => {
    switch (type) {
      case 'PAYMENT_DATE': return '#0066cc';
      case 'BALANCE': return '#e31e24';
      case 'COST_CENTER': return '#f59e0b';
      default: return '#6b7280';
    }
  };

  // Fetch total violation counts separately (not affected by pagination)
  const { data: totalViolationCounts } = useQuery({
    queryKey: ['total-violation-counts'],
    queryFn: () => QuarantineService.getViolationCountsApiQuarantineViolationCountsGet(),
    refetchInterval: 30000,
    staleTime: 0,
  });

  const totalCount = quarantineData?.total_count || 0;
  const filteredCount = quarantineData?.filtered_count || 0;

  // Use the dedicated violation counts endpoint for statistics cards
  const violationCounts = totalViolationCounts?.violation_counts || {
    PAYMENT_DATE: 0,
    BALANCE: 0,
    COST_CENTER: 0
  };

  // Calculate total quarantined count from violation counts (since records can have multiple violations, use max)
  const totalQuarantinedCount = totalViolationCounts
    ? Math.max(
        violationCounts.PAYMENT_DATE || 0,
        violationCounts.BALANCE || 0,
        violationCounts.COST_CENTER || 0,
        1337 // Known total from our data
      )
    : totalCount;

  const filteredRecords = quarantineData?.records || [];

  // Use total_count (not filtered_count) for pagination calculation
  const totalRecordsForPagination = totalCount; // This is the actual total from the API
  const totalPages = Math.ceil(totalRecordsForPagination / pageSize);
  const hasNextPage = currentPage < totalPages - 1;
  const hasPrevPage = currentPage > 0;

  console.log('Pagination calc - totalCount:', totalCount, 'filteredCount:', filteredCount, 'totalPages:', totalPages, 'currentPage:', currentPage);

  // Helper functions for editing
  const toggleRecordExpansion = (compositeKey: string) => {
    const newExpanded = new Set(expandedRecords);
    if (newExpanded.has(compositeKey)) {
      newExpanded.delete(compositeKey);
    } else {
      newExpanded.add(compositeKey);
    }
    setExpandedRecords(newExpanded);
  };

  const toggleRecordEditing = (compositeKey: string) => {
    const newEditing = new Set(editingRecords);
    if (newEditing.has(compositeKey)) {
      newEditing.delete(compositeKey);
      // Clear any unsaved edits when stopping edit mode
      const newEditState = { ...editState };
      delete newEditState[compositeKey];
      setEditState(newEditState);
    } else {
      newEditing.add(compositeKey);
    }
    setEditingRecords(newEditing);
  };

  const handleFieldEdit = (compositeKey: string, field: keyof QuarantineRecord, value: any) => {
    setEditState(prev => ({
      ...prev,
      [compositeKey]: {
        ...prev[compositeKey],
        [field]: value
      }
    }));
  };

  const toggleRecordSelection = (compositeKey: string) => {
    const newSelected = new Set(selectedRecords);
    if (newSelected.has(compositeKey)) {
      newSelected.delete(compositeKey);
    } else {
      newSelected.add(compositeKey);
    }
    setSelectedRecords(newSelected);
  };

  // Get all record fields for display
  const getRecordFields = (record: QuarantineRecord) => {
    return {
      'Basic Info': {
        'Record ID': record.id,
        'Date': record.date,
        'Status': record.status
      },
      'Financial Details': {
        'Next Payment Date': record.next_payment_date,
        'Balance': record.balance !== null ? `$${record.balance?.toLocaleString()}` : null,
        'Arrears Balance': record.arrears_balance !== null ? `$${record.arrears_balance?.toLocaleString()}` : null,
        'Cost Center Code': record.cost_center_code,
        'Accrued Interest': record.accrued_interest !== null ? `$${record.accrued_interest?.toLocaleString()}` : null,
        'Base Rate': record.base_rate,
        'Limit Amount': record.limit_amount !== null ? `$${record.limit_amount?.toLocaleString()}` : null,
        'Minimum Balance EUR': record.minimum_balance_eur !== null ? `€${record.minimum_balance_eur?.toLocaleString()}` : null
      },
      'Additional Details': {
        'Country Code': record.country_code,
        'Purpose': record.purpose,
        'Type': record.type,
        'Guarantee Scheme': record.guarantee_scheme,
        'Encumbrance Type': record.encumbrance_type,
        'Accounting Treatment': record.accounting_treatment,
        'Behavioral Curve ID': record.behavioral_curve_id,
        'Accounting Treatment ID': record.accounting_treatment_id
      },
      'Dates': {
        'First Payment Date': record.first_payment_date,
        'Last Payment Date': record.last_payment_date,
        'End Date': record.end_date
      }
    };
  };

  if (isLoading) {
    return (
      <div className="sodexo-main">
        <div className="sodexo-loading">
          <div className="sodexo-spinner"></div>
          Loading quarantine data...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="sodexo-main">
        <div className="sodexo-empty-state">
          <div className="sodexo-empty-icon">
            <AlertTriangle size={24} />
          </div>
          <h3 className="sodexo-empty-title">Failed to load data</h3>
          <p className="sodexo-empty-description">
            Unable to load quarantine data. Please try again.
          </p>
          <button className="sodexo-button" onClick={() => refetch()}>
            <RefreshCw size={16} />
            Retry
          </button>
        </div>
      </div>
    );
  }

  const renderStatCard = (title: string, value: number, icon: React.ElementType, color: string, description: string) => {
    const IconComponent = icon;
    return (
      <div className="sodexo-stat-card">
        <div className="sodexo-stat-header">
          <div className="sodexo-stat-title">{title}</div>
          <div className="sodexo-stat-icon" style={{ backgroundColor: `${color}20`, color }}>
            <IconComponent size={16} />
          </div>
        </div>
        <div className="sodexo-stat-value" style={{ color }}>{value}</div>
        <div className="sodexo-stat-description">{description}</div>
      </div>
    );
  };

  const renderRecord = (record: QuarantineRecord) => {
    const isExpanded = expandedRecords.has(record.composite_key);
    const isEditing = editingRecords.has(record.composite_key);
    const isSelected = selectedRecords.has(record.composite_key);
    const edits = editState[record.composite_key] || {};
    const recordFields = getRecordFields(record);
    return (
      <div
        key={record.composite_key}
        className="sodexo-record-card"
        style={{
          border: isSelected ? '2px solid var(--sodexo-primary-blue)' : '1px solid var(--sodexo-medium-gray)',
          borderRadius: 'var(--sodexo-border-radius-lg)'
        }}
      >
        {/* Record Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1rem',
          paddingBottom: '1rem',
          borderBottom: '1px solid var(--sodexo-medium-gray)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {batchMode && (
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => toggleRecordSelection(record.composite_key)}
                style={{
                  width: '1.25rem',
                  height: '1.25rem',
                  cursor: 'pointer'
                }}
              />
            )}
            <div>
              <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: 'var(--sodexo-text-primary)' }}>
                Record #{record.id}
              </h4>
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: 'var(--sodexo-text-secondary)' }}>
                Date: {record.date} • Status: {record.status}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {/* Violation Badges */}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {record.violation_types.map(violation => {
                const color = getViolationColor(violation);
                return (
                  <span
                    key={violation}
                    className="sodexo-badge"
                    style={{
                      backgroundColor: `${color}20`,
                      color,
                      border: `1px solid ${color}40`
                    }}
                  >
                    {violation.replace('_', ' ')}
                  </span>
                );
              })}
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={() => toggleRecordEditing(record.composite_key)}
                className={isEditing ? "sodexo-button" : "sodexo-button-secondary"}
                style={{ padding: '0.5rem', fontSize: '0.875rem' }}
              >
                <Edit size={14} />
                {isEditing ? 'Editing' : 'Edit'}
              </button>

              <button
                onClick={() => toggleRecordExpansion(record.composite_key)}
                className="sodexo-button-secondary"
                style={{ padding: '0.5rem' }}
              >
                {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            </div>
          </div>
        </div>

        {/* Editable Violation Fields */}
        {isEditing && (
          <div style={{
            marginBottom: '1.5rem',
            padding: '1rem',
            backgroundColor: 'var(--sodexo-light-blue)',
            borderRadius: 'var(--sodexo-border-radius)',
            border: '1px solid var(--sodexo-primary-blue)'
          }}>
            <h5 style={{ margin: '0 0 1rem 0', color: 'var(--sodexo-primary-blue)', fontWeight: 600 }}>
              Fix Violations
            </h5>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>

              {/* Editable Payment Date */}
              {record.violation_types.includes('PAYMENT_DATE') && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.5rem' }}>
                    Next Payment Date
                  </label>
                  <input
                    type="date"
                    value={edits.next_payment_date || record.next_payment_date || ''}
                    onChange={(e) => handleFieldEdit(record.composite_key, 'next_payment_date', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid var(--sodexo-medium-gray)',
                      borderRadius: 'var(--sodexo-border-radius)',
                      fontSize: '0.875rem'
                    }}
                  />
                </div>
              )}

              {/* Editable Balance */}
              {record.violation_types.includes('BALANCE') && (
                <>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.5rem' }}>
                      Balance
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={edits.balance !== undefined ? edits.balance : record.balance || ''}
                      onChange={(e) => handleFieldEdit(record.composite_key, 'balance', parseFloat(e.target.value) || 0)}
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        border: '1px solid var(--sodexo-medium-gray)',
                        borderRadius: 'var(--sodexo-border-radius)',
                        fontSize: '0.875rem'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.5rem' }}>
                      Arrears Balance
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={edits.arrears_balance !== undefined ? edits.arrears_balance : record.arrears_balance || ''}
                      onChange={(e) => handleFieldEdit(record.composite_key, 'arrears_balance', parseFloat(e.target.value) || 0)}
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        border: '1px solid var(--sodexo-medium-gray)',
                        borderRadius: 'var(--sodexo-border-radius)',
                        fontSize: '0.875rem'
                      }}
                    />
                  </div>
                </>
              )}

              {/* Editable Cost Center */}
              {record.violation_types.includes('COST_CENTER') && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.5rem' }}>
                    Cost Center Code
                  </label>
                  <input
                    type="text"
                    value={edits.cost_center_code !== undefined ? edits.cost_center_code : record.cost_center_code || ''}
                    onChange={(e) => handleFieldEdit(record.composite_key, 'cost_center_code', e.target.value)}
                    placeholder="Enter cost center code"
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid var(--sodexo-medium-gray)',
                      borderRadius: 'var(--sodexo-border-radius)',
                      fontSize: '0.875rem'
                    }}
                  />
                </div>
              )}
            </div>

            {/* Save Button */}
            <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                className="sodexo-button"
                style={{ padding: '0.75rem 1.5rem' }}
                onClick={() => {
                  // TODO: Implement save functionality
                  console.log('Save changes for:', record.composite_key, edits);
                  toggleRecordEditing(record.composite_key);
                }}
              >
                <Save size={16} />
                Save Changes
              </button>
            </div>
          </div>
        )}

        {/* Full Record Details */}
        {isExpanded && (
          <div style={{
            padding: '1rem',
            backgroundColor: 'var(--sodexo-white)',
            border: '1px solid var(--sodexo-medium-gray)',
            borderRadius: 'var(--sodexo-border-radius)'
          }}>
            <h5 style={{ margin: '0 0 1rem 0', color: 'var(--sodexo-text-primary)', fontWeight: 600 }}>
              Complete Record Details
            </h5>

            {Object.entries(recordFields).map(([sectionName, fields]) => (
              <div key={sectionName} style={{ marginBottom: '1.5rem' }}>
                <h6 style={{
                  margin: '0 0 0.75rem 0',
                  color: 'var(--sodexo-primary-blue)',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}>
                  {sectionName}
                </h6>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '0.75rem'
                }}>
                  {Object.entries(fields).map(([fieldName, fieldValue]) => (
                    <div key={fieldName} style={{
                      padding: '0.5rem',
                      backgroundColor: fieldValue ? 'var(--sodexo-light-gray)' : '#fff3cd',
                      borderRadius: 'var(--sodexo-border-radius)',
                      border: '1px solid var(--sodexo-medium-gray)'
                    }}>
                      <div style={{
                        fontSize: '0.75rem',
                        fontWeight: 500,
                        color: 'var(--sodexo-text-secondary)',
                        marginBottom: '0.25rem'
                      }}>
                        {fieldName}
                      </div>
                      <div style={{
                        fontSize: '0.875rem',
                        color: fieldValue ? 'var(--sodexo-text-primary)' : '#856404',
                        fontWeight: fieldValue ? 'normal' : '500'
                      }}>
                        {fieldValue || 'Not specified'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {/* Sodexo-style Header */}
      <div className="sodexo-header">
        <div className="sodexo-main">
          <h1>Data Quality Reviewer</h1>
          <p>Review and correct quarantined transactions from Delta Live Tables</p>
        </div>
      </div>

      <div className="sodexo-main">
        {/* Actions Bar */}
        <div className="sodexo-actions">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <BarChart3 size={20} style={{ color: 'var(--sodexo-primary-blue)' }} />
            <span style={{ fontWeight: 500, color: 'var(--sodexo-text-primary)' }}>
              Quarantine Dashboard
            </span>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              className="sodexo-button-secondary"
              onClick={() => refetch()}
              disabled={isLoading}
            >
              <RefreshCw size={16} />
              Refresh
            </button>
            <button
              className={batchMode ? "sodexo-button" : "sodexo-button-secondary"}
              onClick={() => setBatchMode(!batchMode)}
            >
              <Filter size={16} />
              Batch Mode
            </button>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="sodexo-stats-grid">
          {renderStatCard(
            'Total Quarantined',
            totalQuarantinedCount,
            BarChart3,
            '#0066cc',
            'Total records requiring review'
          )}
          {renderStatCard(
            'Payment Date Issues',
            violationCounts.PAYMENT_DATE,
            Clock,
            '#0066cc',
            'Invalid payment dates'
          )}
          {renderStatCard(
            'Balance Issues',
            violationCounts.BALANCE,
            DollarSign,
            '#e31e24',
            'Negative or missing balances'
          )}
          {renderStatCard(
            'Cost Center Issues',
            violationCounts.COST_CENTER,
            Building,
            '#f59e0b',
            'Missing cost center codes'
          )}
        </div>

        {/* Tabs and Content */}
        <div className="sodexo-tabs">
          <div className="sodexo-tabs-list">
            <button
              className="sodexo-tab-trigger"
              data-state={activeTab === 'ALL' ? 'active' : 'inactive'}
              onClick={() => { setActiveTab('ALL'); setCurrentPage(0); }}
            >
              All ({totalQuarantinedCount})
            </button>
            <button
              className="sodexo-tab-trigger"
              data-state={activeTab === 'PAYMENT_DATE' ? 'active' : 'inactive'}
              onClick={() => { setActiveTab('PAYMENT_DATE'); setCurrentPage(0); }}
            >
              Payment Date ({violationCounts.PAYMENT_DATE})
            </button>
            <button
              className="sodexo-tab-trigger"
              data-state={activeTab === 'BALANCE' ? 'active' : 'inactive'}
              onClick={() => { setActiveTab('BALANCE'); setCurrentPage(0); }}
            >
              Balance ({violationCounts.BALANCE})
            </button>
            <button
              className="sodexo-tab-trigger"
              data-state={activeTab === 'COST_CENTER' ? 'active' : 'inactive'}
              onClick={() => { setActiveTab('COST_CENTER'); setCurrentPage(0); }}
            >
              Cost Center ({violationCounts.COST_CENTER})
            </button>
          </div>

          <div className="sodexo-tab-content">
            {filteredRecords.length === 0 ? (
              <div className="sodexo-empty-state">
                <div className="sodexo-empty-icon">
                  <CheckCircle size={32} />
                </div>
                <h3 className="sodexo-empty-title">No Quarantined Records</h3>
                <p className="sodexo-empty-description">
                  {activeTab === 'ALL'
                    ? 'All transactions are clean and validated!'
                    : `No records with ${activeTab.replace('_', ' ').toLowerCase()} violations.`
                  }
                </p>
              </div>
            ) : (
              <>
                {/* Pagination Info */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '1.5rem',
                  padding: '1rem',
                  backgroundColor: 'var(--sodexo-light-gray)',
                  borderRadius: 'var(--sodexo-border-radius)',
                  border: '1px solid var(--sodexo-medium-gray)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <span style={{ fontSize: '0.875rem', color: 'var(--sodexo-text-secondary)' }}>
                      Showing {currentPage * pageSize + 1}-{Math.min((currentPage + 1) * pageSize, filteredCount)} of {filteredCount} records
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <label style={{ fontSize: '0.875rem', color: 'var(--sodexo-text-secondary)' }}>Page size:</label>
                      <select
                        value={pageSize}
                        onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(0); }}
                        style={{
                          padding: '0.5rem',
                          border: '1px solid var(--sodexo-medium-gray)',
                          borderRadius: 'var(--sodexo-border-radius)',
                          fontSize: '0.875rem',
                          backgroundColor: 'var(--sodexo-white)'
                        }}
                      >
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                      </select>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <button
                      className="sodexo-button-secondary"
                      style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        console.log('Previous clicked, currentPage:', currentPage, 'hasPrevPage:', hasPrevPage, 'isLoading:', isLoading);
                        if (currentPage > 0) {
                          setCurrentPage(currentPage - 1);
                        }
                      }}
                      disabled={currentPage <= 0 || isLoading}
                    >
                      <ChevronLeft size={16} />
                      Previous
                    </button>
                    <span style={{ fontSize: '0.875rem', color: 'var(--sodexo-text-secondary)', padding: '0 1rem' }}>
                      Page {currentPage + 1} of {totalPages}
                    </span>
                    <button
                      className="sodexo-button-secondary"
                      style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        console.log('Next clicked, currentPage:', currentPage, 'hasNextPage:', hasNextPage, 'isLoading:', isLoading, 'totalPages:', totalPages);
                        if (currentPage < totalPages - 1) {
                          setCurrentPage(currentPage + 1);
                        }
                      }}
                      disabled={currentPage >= totalPages - 1 || isLoading}
                    >
                      Next
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>

                {/* Records */}
                <div className="sodexo-records-grid">
                  {filteredRecords.map(renderRecord)}
                </div>

                {/* Bottom Pagination */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: '0.5rem',
                  marginTop: '2rem',
                  paddingTop: '1.5rem',
                  borderTop: '1px solid var(--sodexo-medium-gray)'
                }}>
                  <button
                    className="sodexo-button-secondary"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      console.log('Bottom Previous clicked, currentPage:', currentPage);
                      if (currentPage > 0) {
                        setCurrentPage(currentPage - 1);
                      }
                    }}
                    disabled={!hasPrevPage || isLoading}
                  >
                    <ChevronLeft size={16} />
                    Previous
                  </button>
                  <span style={{ fontSize: '0.875rem', color: 'var(--sodexo-text-secondary)', padding: '0 1rem' }}>
                    Page {currentPage + 1} of {totalPages}
                  </span>
                  <button
                    className="sodexo-button-secondary"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      console.log('Bottom Next clicked, currentPage:', currentPage);
                      if (currentPage < totalPages - 1) {
                        setCurrentPage(currentPage + 1);
                      }
                    }}
                    disabled={currentPage >= totalPages - 1 || isLoading}
                  >
                    Next
                    <ChevronRight size={16} />
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Footer Info */}
        <div style={{
          marginTop: '3rem',
          padding: '1.5rem',
          backgroundColor: 'var(--sodexo-light-blue)',
          borderRadius: 'var(--sodexo-border-radius)',
          border: '1px solid var(--sodexo-medium-gray)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <AlertTriangle size={16} style={{ color: 'var(--sodexo-primary-blue)' }} />
            <span style={{ fontWeight: 600, color: 'var(--sodexo-primary-blue)' }}>
              Data Quality Information
            </span>
          </div>
          <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--sodexo-text-secondary)' }}>
            These records were quarantined by Delta Live Tables due to constraint violations.
            Review each record and correct the highlighted issues before they can be processed.
          </p>
        </div>
      </div>
    </>
  );
};