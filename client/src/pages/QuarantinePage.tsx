import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CheckCircle, AlertCircle, Clock, Filter, Save, RefreshCw, BarChart3, AlertTriangle, DollarSign, Building } from 'lucide-react';
import '../styles/sodexo-theme.css';

import { QuarantineService } from '@/fastapi_client';
import { QuarantineRecord, ViolationType, QuarantineRecordUpdate, BatchUpdateRequest, MergeResult } from '@/fastapi_client';

type ViolationTab = 'ALL' | ViolationType;

interface EditState {
  [compositeKey: string]: Partial<QuarantineRecordUpdate>;
}

export const QuarantinePage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ViolationTab>('ALL');
  const [selectedRecords, setSelectedRecords] = useState<Set<string>>(new Set());
  const [editState, setEditState] = useState<EditState>({});
  const [batchMode, setBatchMode] = useState(false);

  const queryClient = useQueryClient();

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

  // Fetch quarantine records
  const {
    data: quarantineData,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['quarantine-records', activeTab, 'v4'],
    queryFn: async () => {
      // Use real Unity Catalog data - fetch all records
      const violationType = activeTab !== 'ALL' ? activeTab : undefined;
      return await QuarantineService.getQuarantineRecordsApiQuarantineRecordsGet(
        violationType,
        2000,
        0
      );
    },
    refetchInterval: 30000, // Auto-refresh every 30 seconds
    staleTime: 0, // Always consider data stale to force refresh
  });

  // Fetch violation counts
  const { data: violationCounts } = useQuery({
    queryKey: ['violation-counts'],
    queryFn: () => QuarantineService.getViolationCountsApiQuarantineViolationCountsGet(),
    refetchInterval: 30000,
  });

  // Merge records mutation
  const mergeMutation = useMutation({
    mutationFn: async (request: BatchUpdateRequest) => {
      return await QuarantineService.mergeRecordsApiQuarantineMergePost(request);
    },
    onSuccess: (result: MergeResult) => {
      // Clear selections and edits
      setSelectedRecords(new Set());
      setEditState({});
      setBatchMode(false);

      // Refresh data
      queryClient.invalidateQueries({ queryKey: ['quarantine-records'] });
      queryClient.invalidateQueries({ queryKey: ['violation-counts'] });

      // Show success message
      console.log('Merge completed:', result);
    },
    onError: (error) => {
      console.error('Merge failed:', error);
    }
  });

  const records = quarantineData?.records || [];
  const totalCount = quarantineData?.total_count || 0;

  const handleRecordSelection = (compositeKey: string, selected: boolean) => {
    const newSelection = new Set(selectedRecords);
    if (selected) {
      newSelection.add(compositeKey);
    } else {
      newSelection.delete(compositeKey);
    }
    setSelectedRecords(newSelection);
  };

  const handleFieldEdit = (compositeKey: string, field: string, value: any) => {
    setEditState(prev => ({
      ...prev,
      [compositeKey]: {
        ...prev[compositeKey],
        [field]: value,
        composite_key: compositeKey
      }
    }));
  };

  const handleBatchEdit = (field: string, value: any) => {
    const updates: EditState = {};
    selectedRecords.forEach(key => {
      updates[key] = {
        ...editState[key],
        [field]: value,
        composite_key: key
      };
    });
    setEditState(prev => ({ ...prev, ...updates }));
  };

  const handleSave = async () => {
    const updates = Object.values(editState).filter(update =>
      selectedRecords.has(update.composite_key || '')
    ) as QuarantineRecordUpdate[];

    if (updates.length === 0) {
      alert('No records selected for saving');
      return;
    }

    const request: BatchUpdateRequest = {
      updates,
      user_email: 'data-steward@company.com' // TODO: Get from auth
    };

    mergeMutation.mutate(request);
  };

  const getViolationBadgeColor = (violationType: ViolationType) => {
    switch (violationType) {
      case 'PAYMENT_DATE': return 'bg-blue-100 text-blue-800';
      case 'BALANCE': return 'bg-red-100 text-red-800';
      case 'COST_CENTER': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const renderRecord = (record: QuarantineRecord) => {
    const isSelected = selectedRecords.has(record.composite_key);
    const edits = editState[record.composite_key] || {};

    return (
      <Card key={record.composite_key} className={`mb-4 ${isSelected ? 'ring-2 ring-blue-500' : ''}`}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <input
                type="checkbox"
                checked={isSelected}
                onChange={(e) => handleRecordSelection(record.composite_key, e.target.checked)}
                className="w-4 h-4 rounded border-gray-300"
              />
              <div>
                <CardTitle className="text-sm font-medium">
                  Record ID: {record.id}
                </CardTitle>
                <CardDescription className="text-xs">
                  Date: {record.date} | Status: {record.status}
                </CardDescription>
              </div>
            </div>
            <div className="flex flex-wrap gap-1">
              {record.violation_types.map(violation => (
                <Badge
                  key={violation}
                  className={`text-xs ${getViolationBadgeColor(violation)}`}
                >
                  {violation.replace('_', ' ')}
                </Badge>
              ))}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Editable Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Payment Date */}
            {record.violation_types.includes('PAYMENT_DATE') && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Next Payment Date
                </label>
                <Input
                  type="date"
                  value={edits.next_payment_date || record.next_payment_date || ''}
                  onChange={(e) => handleFieldEdit(record.composite_key, 'next_payment_date', e.target.value)}
                  className="w-full"
                  disabled={!isSelected}
                />
              </div>
            )}

            {/* Balance Fields */}
            {record.violation_types.includes('BALANCE') && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Balance
                  </label>
                  <Input
                    type="number"
                    value={edits.balance !== undefined ? edits.balance : record.balance || ''}
                    onChange={(e) => handleFieldEdit(record.composite_key, 'balance', parseInt(e.target.value) || 0)}
                    className="w-full"
                    disabled={!isSelected}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Arrears Balance
                  </label>
                  <Input
                    type="number"
                    value={edits.arrears_balance !== undefined ? edits.arrears_balance : record.arrears_balance || ''}
                    onChange={(e) => handleFieldEdit(record.composite_key, 'arrears_balance', parseInt(e.target.value) || 0)}
                    className="w-full"
                    disabled={!isSelected}
                  />
                </div>
              </>
            )}

            {/* Cost Center */}
            {record.violation_types.includes('COST_CENTER') && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cost Center Code
                </label>
                <Input
                  type="text"
                  value={edits.cost_center_code !== undefined ? edits.cost_center_code : record.cost_center_code || ''}
                  onChange={(e) => handleFieldEdit(record.composite_key, 'cost_center_code', e.target.value)}
                  className="w-full"
                  disabled={!isSelected}
                  placeholder="Enter cost center code"
                />
              </div>
            )}
          </div>

          {/* Context Fields (Read-only) */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-gray-600 pt-2 border-t">
            <div>Country: {record.country_code}</div>
            <div>Type: {record.type}</div>
            <div>Purpose: {record.purpose}</div>
            <div>Status: {record.status}</div>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 space-y-4">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Failed to load quarantine data. Please try again.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Data Quality Reviewer</h1>
          <p className="text-gray-600">Review and correct quarantined transactions</p>
        </div>
        <div className="flex space-x-2">
          <Button
            variant="outline"
            onClick={() => refetch()}
            disabled={isLoading}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button
            variant={batchMode ? "default" : "outline"}
            onClick={() => setBatchMode(!batchMode)}
          >
            <Filter className="w-4 h-4 mr-2" />
            Batch Mode
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Clock className="w-5 h-5 text-orange-500" />
              <div>
                <p className="text-sm font-medium">Total Quarantined</p>
                <p className="text-2xl font-bold">{totalCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-5 h-5 text-blue-500" />
              <div>
                <p className="text-sm font-medium">Payment Date</p>
                <p className="text-2xl font-bold">{violationCounts?.violation_counts?.PAYMENT_DATE || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-5 h-5 text-red-500" />
              <div>
                <p className="text-sm font-medium">Balance Issues</p>
                <p className="text-2xl font-bold">{violationCounts?.violation_counts?.BALANCE || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-5 h-5 text-yellow-500" />
              <div>
                <p className="text-sm font-medium">Cost Center</p>
                <p className="text-2xl font-bold">{violationCounts?.violation_counts?.COST_CENTER || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Batch Actions */}
      {batchMode && selectedRecords.size > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Batch Edit ({selectedRecords.size} records selected)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Payment Date (All)
                </label>
                <Input
                  type="date"
                  onChange={(e) => handleBatchEdit('next_payment_date', e.target.value)}
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Balance (All)
                </label>
                <Input
                  type="number"
                  onChange={(e) => handleBatchEdit('balance', parseInt(e.target.value) || 0)}
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Arrears Balance (All)
                </label>
                <Input
                  type="number"
                  onChange={(e) => handleBatchEdit('arrears_balance', parseInt(e.target.value) || 0)}
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cost Center (All)
                </label>
                <Input
                  type="text"
                  onChange={(e) => handleBatchEdit('cost_center_code', e.target.value)}
                  className="w-full"
                  placeholder="Enter cost center code"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Save Button */}
      {selectedRecords.size > 0 && Object.keys(editState).length > 0 && (
        <div className="flex justify-center">
          <Button
            onClick={handleSave}
            disabled={mergeMutation.isPending}
            className="px-8 py-2"
            size="lg"
          >
            <Save className="w-4 h-4 mr-2" />
            {mergeMutation.isPending ? 'Saving...' : `Save & Merge ${selectedRecords.size} Records`}
          </Button>
        </div>
      )}

      {/* Tabs for Violation Types */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as ViolationTab)}>
        <TabsList>
          <TabsTrigger value="ALL">All ({totalCount})</TabsTrigger>
          <TabsTrigger value="PAYMENT_DATE">
            Payment Date ({violationCounts?.violation_counts?.PAYMENT_DATE || 0})
          </TabsTrigger>
          <TabsTrigger value="BALANCE">
            Balance ({violationCounts?.violation_counts?.BALANCE || 0})
          </TabsTrigger>
          <TabsTrigger value="COST_CENTER">
            Cost Center ({violationCounts?.violation_counts?.COST_CENTER || 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          {records.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Quarantined Records</h3>
                <p className="text-gray-600">
                  {activeTab === 'ALL'
                    ? 'All transactions are clean and validated!'
                    : `No records with ${activeTab.replace('_', ' ').toLowerCase()} violations.`
                  }
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {records.map(renderRecord)}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Merge Result */}
      {mergeMutation.isSuccess && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            Successfully merged {mergeMutation.data.merged_records} records.
            {mergeMutation.data.pipeline_triggered && ' DLT pipeline has been triggered.'}
          </AlertDescription>
        </Alert>
      )}

      {mergeMutation.isError && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Failed to merge records. Please try again.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};