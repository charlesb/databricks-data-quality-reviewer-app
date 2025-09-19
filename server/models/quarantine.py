"""Data models for quarantine operations."""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime
from enum import Enum


class ViolationType(str, Enum):
    """Types of DLT constraint violations."""
    PAYMENT_DATE = "PAYMENT_DATE"
    BALANCE = "BALANCE"
    COST_CENTER = "COST_CENTER"


class QuarantineRecord(BaseModel):
    """Model for a quarantined transaction record."""
    # Core identifying fields (these map to Unity Catalog columns)
    id: int
    date: str
    status: str

    # Editable constraint fields
    next_payment_date: Optional[str] = None
    balance: Optional[int] = None
    arrears_balance: Optional[int] = None
    cost_center_code: Optional[str] = None

    # Display context fields (read-only from Unity Catalog)
    acc_fv_change_before_taxes: Optional[int] = None
    accounting_treatment_id: Optional[int] = None
    accrued_interest: Optional[int] = None
    base_rate: Optional[str] = None
    behavioral_curve_id: Optional[int] = None
    count: Optional[int] = None
    country_code: Optional[str] = None
    encumbrance_type: Optional[str] = None
    end_date: Optional[str] = None
    first_payment_date: Optional[str] = None
    guarantee_scheme: Optional[str] = None
    imit_amount: Optional[int] = None  # Maps to 'imit_amount' column in Unity Catalog
    last_payment_date: Optional[str] = None
    minimum_balance_eur: Optional[int] = None
    purpose: Optional[str] = None
    type: Optional[str] = None
    accounting_treatment: Optional[str] = None
    rescued_data: Optional[str] = Field(None, alias="_rescued_data")

    # Computed fields
    violation_types: List[ViolationType] = Field(default_factory=list)
    composite_key: str = Field(default="")

    def __init__(self, **data):
        super().__init__(**data)
        # Generate composite key for tracking
        self.composite_key = f"{self.id}_{self.date}_{self.status}"
        # Detect violation types
        self.violation_types = self._detect_violations()

    def _detect_violations(self) -> List[ViolationType]:
        """Detect which DLT constraints this record violates."""
        violations = []

        # Payment date constraint: next_payment_date > '2020-12-31'
        if not self.next_payment_date or self.next_payment_date <= '2020-12-31':
            violations.append(ViolationType.PAYMENT_DATE)

        # Balance constraints: balance > 0 AND arrears_balance > 0
        if (self.balance is None or self.balance <= 0 or
            self.arrears_balance is None or self.arrears_balance <= 0):
            violations.append(ViolationType.BALANCE)

        # Cost center constraint: cost_center_code IS NOT NULL
        if not self.cost_center_code:
            violations.append(ViolationType.COST_CENTER)

        return violations


class QuarantineRecordUpdate(BaseModel):
    """Model for updating quarantine record fields."""
    composite_key: str
    next_payment_date: Optional[str] = None
    balance: Optional[int] = None
    arrears_balance: Optional[int] = None
    cost_center_code: Optional[str] = None


class BatchUpdateRequest(BaseModel):
    """Model for batch update requests."""
    updates: List[QuarantineRecordUpdate]
    user_email: str = "system@databricks.com"  # Default, will be overridden


class ValidationResult(BaseModel):
    """Result of validating a record against DLT constraints."""
    composite_key: str
    is_valid: bool
    violations: List[ViolationType]
    errors: List[str] = Field(default_factory=list)


class BatchValidationResult(BaseModel):
    """Result of batch validation."""
    total_records: int
    valid_records: int
    invalid_records: int
    results: List[ValidationResult]


class MergeResult(BaseModel):
    """Result of merging records back to cleaned table."""
    total_records: int
    merged_records: int
    failed_records: int
    pipeline_triggered: bool
    errors: List[str] = Field(default_factory=list)


class AuditTrailEntry(BaseModel):
    """Model for audit trail entries."""
    audit_id: Optional[int] = None
    record_id: int
    record_date: str
    user_email: str
    action: str  # 'EDIT', 'MERGE', 'VALIDATION_FAILED'
    old_values: Dict[str, Any]
    new_values: Dict[str, Any]
    violation_types: List[str]
    timestamp: Optional[datetime] = None
    session_id: str


class QuarantineFilter(BaseModel):
    """Filter options for quarantine records."""
    violation_type: Optional[ViolationType] = None
    limit: int = Field(default=100, ge=1, le=2000)
    offset: int = Field(default=0, ge=0)


class QuarantineResponse(BaseModel):
    """Response model for quarantine data queries."""
    records: List[QuarantineRecord]
    total_count: int
    filtered_count: int
    violation_type_counts: Dict[str, int]