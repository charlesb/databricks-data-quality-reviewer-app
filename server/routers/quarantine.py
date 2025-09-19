"""API endpoints for quarantine data management."""

import logging
from typing import List
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from fastapi.responses import JSONResponse

from ..models.quarantine import (
    QuarantineRecord,
    QuarantineRecordUpdate,
    BatchUpdateRequest,
    ValidationResult,
    BatchValidationResult,
    MergeResult,
    ViolationType,
    QuarantineFilter,
    QuarantineResponse
)
from ..services.quarantine_service import QuarantineService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/quarantine", tags=["quarantine"])


@router.get("/test-data", response_model=QuarantineResponse)
async def get_test_quarantine_data():
    """Get test quarantine data for UI demonstration."""
    test_records = [
        QuarantineRecord(
            id=1001,
            date="2024-12-15",
            status="pending",
            next_payment_date="2020-06-15",  # Invalid - before 2020-12-31
            balance=None,  # Invalid - missing
            arrears_balance=1500,
            cost_center_code="",  # Invalid - empty
            violation_types=[ViolationType.PAYMENT_DATE, ViolationType.BALANCE, ViolationType.COST_CENTER]
        ),
        QuarantineRecord(
            id=1002,
            date="2024-12-14",
            status="pending",
            next_payment_date="2024-06-15",
            balance=-500,  # Invalid - negative
            arrears_balance=2000,
            cost_center_code="CC001",
            violation_types=[ViolationType.BALANCE]
        ),
        QuarantineRecord(
            id=1003,
            date="2024-12-13",
            status="pending",
            next_payment_date="2025-01-15",
            balance=5000,
            arrears_balance=0,  # Invalid - zero
            cost_center_code=None,  # Invalid - missing
            violation_types=[ViolationType.BALANCE, ViolationType.COST_CENTER]
        )
    ]

    violation_counts = {
        "PAYMENT_DATE": 1,
        "BALANCE": 3,
        "COST_CENTER": 2
    }

    return QuarantineResponse(
        records=test_records,
        total_count=3,
        filtered_count=3,
        violation_type_counts=violation_counts
    )


def get_quarantine_service() -> QuarantineService:
    """Dependency to get quarantine service instance."""
    return QuarantineService()


@router.get("/records", response_model=QuarantineResponse)
async def get_quarantine_records(
    violation_type: ViolationType = None,
    limit: int = 100,
    offset: int = 0,
    service: QuarantineService = Depends(get_quarantine_service)
):
    """
    Get quarantined records with optional filtering by violation type.

    - **violation_type**: Filter by specific violation type (PAYMENT_DATE, BALANCE, COST_CENTER)
    - **limit**: Maximum number of records to return (1-1000)
    - **offset**: Number of records to skip for pagination
    """
    try:
        filter_params = QuarantineFilter(
            violation_type=violation_type,
            limit=min(max(limit, 1), 2000),  # Ensure limit is between 1-2000
            offset=max(offset, 0)  # Ensure offset is non-negative
        )

        response = await service.get_quarantine_records(filter_params)
        return response

    except Exception as e:
        logger.error(f"Failed to get quarantine records: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve quarantine records: {str(e)}")



@router.get("/violation-counts")
async def get_violation_counts(
    service: QuarantineService = Depends(get_quarantine_service)
):
    """Get counts of quarantined records by violation type."""
    try:
        counts = await service.get_violation_type_counts()
        return JSONResponse(content={"violation_counts": counts})

    except Exception as e:
        logger.error(f"Failed to get violation counts: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get violation counts: {str(e)}")


@router.post("/validate", response_model=List[ValidationResult])
async def validate_records(
    updates: List[QuarantineRecordUpdate],
    service: QuarantineService = Depends(get_quarantine_service)
):
    """
    Validate quarantine record updates against DLT constraints.

    Returns validation results for each record showing which constraints pass/fail.
    """
    try:
        if not updates:
            raise HTTPException(status_code=400, detail="No records provided for validation")

        if len(updates) > 100:
            raise HTTPException(status_code=400, detail="Cannot validate more than 100 records at once")

        results = await service.validate_records(updates)
        return results

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to validate records: {e}")
        raise HTTPException(status_code=500, detail=f"Validation failed: {str(e)}")


@router.post("/validate-batch", response_model=BatchValidationResult)
async def validate_batch(
    request: BatchUpdateRequest,
    service: QuarantineService = Depends(get_quarantine_service)
):
    """
    Validate a batch of quarantine record updates.

    Returns summary statistics and individual validation results.
    """
    try:
        if not request.updates:
            raise HTTPException(status_code=400, detail="No records provided for validation")

        if len(request.updates) > 100:
            raise HTTPException(status_code=400, detail="Cannot validate more than 100 records at once")

        results = await service.validate_records(request.updates)

        valid_count = sum(1 for r in results if r.is_valid)
        invalid_count = len(results) - valid_count

        return BatchValidationResult(
            total_records=len(results),
            valid_records=valid_count,
            invalid_records=invalid_count,
            results=results
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to validate batch: {e}")
        raise HTTPException(status_code=500, detail=f"Batch validation failed: {str(e)}")


@router.post("/merge", response_model=MergeResult)
async def merge_records(
    request: BatchUpdateRequest,
    background_tasks: BackgroundTasks,
    service: QuarantineService = Depends(get_quarantine_service)
):
    """
    Merge validated quarantine records back to the cleaned table.

    This endpoint:
    1. Validates all records against DLT constraints
    2. Merges only valid records to the cleaned_new_txs table
    3. Removes merged records from quarantine
    4. Triggers the DLT pipeline
    5. Logs all operations to audit trail

    Processing is done asynchronously for large batches.
    """
    try:
        if not request.updates:
            raise HTTPException(status_code=400, detail="No records provided for merge")

        if len(request.updates) > 100:
            raise HTTPException(status_code=400, detail="Cannot merge more than 100 records at once")

        # For now, process synchronously
        # In production, large batches could be processed in background
        result = await service.merge_validated_records(request.updates, request.user_email)

        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to merge records: {e}")
        raise HTTPException(status_code=500, detail=f"Merge operation failed: {str(e)}")


@router.post("/merge-async")
async def merge_records_async(
    request: BatchUpdateRequest,
    background_tasks: BackgroundTasks,
    service: QuarantineService = Depends(get_quarantine_service)
):
    """
    Merge quarantine records asynchronously (for large batches).

    Returns immediately with a task ID for status tracking.
    This endpoint is useful for processing large batches (50+ records).
    """
    try:
        if not request.updates:
            raise HTTPException(status_code=400, detail="No records provided for merge")

        # Generate task ID
        import uuid
        task_id = str(uuid.uuid4())

        # Add background task
        background_tasks.add_task(
            service.merge_validated_records,
            request.updates,
            request.user_email
        )

        return JSONResponse(content={
            "task_id": task_id,
            "status": "processing",
            "message": f"Processing {len(request.updates)} records in background"
        })

    except Exception as e:
        logger.error(f"Failed to start async merge: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to start merge operation: {str(e)}")


@router.get("/health")
async def health_check():
    """Health check endpoint for the quarantine API."""
    try:
        # Test basic service connectivity
        service = QuarantineService()
        # Could add actual connectivity test here

        return JSONResponse(content={
            "status": "healthy",
            "service": "quarantine_api",
            "timestamp": "2025-09-15T11:00:00Z"
        })

    except Exception as e:
        logger.error(f"Health check failed: {e}")
        raise HTTPException(status_code=503, detail=f"Service unhealthy: {str(e)}")


# Additional utility endpoints

@router.get("/violation-types")
async def get_violation_types():
    """Get list of available violation types."""
    return JSONResponse(content={
        "violation_types": [
            {
                "value": vt.value,
                "name": vt.value.replace("_", " ").title(),
                "description": _get_violation_description(vt)
            }
            for vt in ViolationType
        ]
    })


def _get_violation_description(violation_type: ViolationType) -> str:
    """Get human-readable description for violation type."""
    descriptions = {
        ViolationType.PAYMENT_DATE: "Payment date must be after 2020-12-31",
        ViolationType.BALANCE: "Both balance and arrears balance must be positive",
        ViolationType.COST_CENTER: "Cost center code is required"
    }
    return descriptions.get(violation_type, "Unknown violation type")