"""Service for quarantine data operations with Databricks."""

import os
import json
import logging
from typing import List, Optional, Dict, Any, Tuple
from datetime import datetime
from databricks.sdk import WorkspaceClient
from databricks.sdk.service.sql import StatementExecutionAPI
import pandas as pd

from ..models.quarantine import (
    QuarantineRecord,
    QuarantineRecordUpdate,
    ValidationResult,
    MergeResult,
    AuditTrailEntry,
    ViolationType,
    QuarantineFilter,
    QuarantineResponse
)

logger = logging.getLogger(__name__)


class QuarantineService:
    """Service for managing quarantined transaction data."""

    QUARANTINE_TABLE = "charles_bernard.dbdemos_dlt_loans.quarantine_bad_txs"
    CLEANED_TABLE = "charles_bernard.dbdemos_dlt_loans.cleaned_new_txs"
    AUDIT_TABLE = "charles_bernard.dbdemos_dlt_loans.audit_trail"
    PIPELINE_NAME = "dbdemos_dlt_loan_charles_bernard_dbdemos_dlt_loans"

    def __init__(self):
        """Initialize the service with Databricks client."""
        self.client = WorkspaceClient()
        self._ensure_audit_table_exists()

    def _ensure_audit_table_exists(self):
        """Create audit trail table if it doesn't exist."""
        create_sql = f"""
        CREATE TABLE IF NOT EXISTS {self.AUDIT_TABLE} (
            audit_id BIGINT GENERATED ALWAYS AS IDENTITY,
            record_id BIGINT,
            record_date STRING,
            user_email STRING,
            action STRING,
            old_values STRING,
            new_values STRING,
            violation_types STRING,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
            session_id STRING
        ) USING DELTA
        """
        try:
            self._execute_sql(create_sql)
            logger.info(f"Audit table {self.AUDIT_TABLE} ready")
        except Exception as e:
            logger.error(f"Failed to create audit table: {e}")

    def _execute_sql(self, sql: str) -> Any:
        """Execute SQL statement using Databricks SQL execution API."""
        try:
            response = self.client.statement_execution.execute_statement(
                statement=sql,
                warehouse_id=os.getenv("DATABRICKS_WAREHOUSE_ID")
            )
            return response
        except Exception as e:
            logger.error(f"SQL execution failed: {e}")
            raise

    def _execute_sql_to_dataframe(self, sql: str) -> pd.DataFrame:
        """Execute SQL and return results as pandas DataFrame."""
        try:
            response = self._execute_sql(sql)

            # Convert response to DataFrame
            if hasattr(response, 'result') and response.result:
                data = []
                if hasattr(response.result, 'data_array') and response.result.data_array:
                    columns = [col.name for col in response.result.manifest.schema.columns]
                    for row in response.result.data_array:
                        data.append(row)
                    return pd.DataFrame(data, columns=columns)

            return pd.DataFrame()
        except Exception as e:
            logger.error(f"SQL to DataFrame conversion failed: {e}")
            return pd.DataFrame()

    async def get_quarantine_records(self, filter_params: QuarantineFilter) -> QuarantineResponse:
        """Retrieve quarantined records with optional filtering."""
        try:
            # Base query
            base_sql = f"SELECT * FROM {self.QUARANTINE_TABLE}"
            count_sql = f"SELECT COUNT(*) as total_count FROM {self.QUARANTINE_TABLE}"

            # Add violation type filtering if specified
            where_clause = ""
            if filter_params.violation_type:
                # We'll filter in Python since violation detection is computed
                pass

            # Execute queries
            df = self._execute_sql_to_dataframe(f"{base_sql} LIMIT {filter_params.limit} OFFSET {filter_params.offset}")
            count_df = self._execute_sql_to_dataframe(count_sql)

            total_count = int(count_df.iloc[0]['total_count']) if not count_df.empty else 0

            # Convert to QuarantineRecord objects
            records = []
            violation_type_counts = {vt.value: 0 for vt in ViolationType}

            for _, row in df.iterrows():
                record_data = row.to_dict()
                # Handle None values
                for key, value in record_data.items():
                    if pd.isna(value):
                        record_data[key] = None

                record = QuarantineRecord(**record_data)

                # Apply violation type filter if specified
                if (filter_params.violation_type is None or
                    filter_params.violation_type in record.violation_types):
                    records.append(record)

                # Count violation types
                for vt in record.violation_types:
                    violation_type_counts[vt.value] += 1

            # If we filtered by violation type, adjust the records
            if filter_params.violation_type:
                filtered_records = [r for r in records if filter_params.violation_type in r.violation_types]
                records = filtered_records

            return QuarantineResponse(
                records=records,
                total_count=total_count,
                filtered_count=len(records),
                violation_type_counts=violation_type_counts
            )

        except Exception as e:
            logger.error(f"Failed to get quarantine records: {e}")
            return QuarantineResponse(
                records=[],
                total_count=0,
                filtered_count=0,
                violation_type_counts={vt.value: 0 for vt in ViolationType}
            )

    async def validate_records(self, records: List[QuarantineRecordUpdate]) -> List[ValidationResult]:
        """Validate records against DLT constraints."""
        results = []

        for update in records:
            violations = []
            errors = []

            try:
                # Payment date constraint
                if not update.next_payment_date or update.next_payment_date <= '2020-12-31':
                    violations.append(ViolationType.PAYMENT_DATE)
                    errors.append("Payment date must be after 2020-12-31")

                # Balance constraints
                if (update.balance is None or update.balance <= 0 or
                    update.arrears_balance is None or update.arrears_balance <= 0):
                    violations.append(ViolationType.BALANCE)
                    errors.append("Both balance and arrears_balance must be positive")

                # Cost center constraint
                if not update.cost_center_code:
                    violations.append(ViolationType.COST_CENTER)
                    errors.append("Cost center code is required")

                is_valid = len(violations) == 0

                results.append(ValidationResult(
                    composite_key=update.composite_key,
                    is_valid=is_valid,
                    violations=violations,
                    errors=errors
                ))

            except Exception as e:
                logger.error(f"Validation error for {update.composite_key}: {e}")
                results.append(ValidationResult(
                    composite_key=update.composite_key,
                    is_valid=False,
                    violations=[],
                    errors=[f"Validation error: {str(e)}"]
                ))

        return results

    async def merge_validated_records(self, updates: List[QuarantineRecordUpdate], user_email: str) -> MergeResult:
        """Merge validated records back to cleaned table and trigger pipeline."""
        merged_count = 0
        failed_count = 0
        errors = []

        try:
            # First, validate all records
            validation_results = await self.validate_records(updates)
            valid_updates = [
                update for update, result in zip(updates, validation_results)
                if result.is_valid
            ]

            if not valid_updates:
                return MergeResult(
                    total_records=len(updates),
                    merged_records=0,
                    failed_records=len(updates),
                    pipeline_triggered=False,
                    errors=["No valid records to merge"]
                )

            # Process each valid update
            for update in valid_updates:
                try:
                    # Parse composite key
                    id_val, date_val, status_val = update.composite_key.split('_', 2)

                    # First, log the audit trail
                    await self._log_audit_trail(
                        record_id=int(id_val),
                        record_date=date_val,
                        user_email=user_email,
                        action="MERGE",
                        old_values={},  # Would need to fetch original values
                        new_values=update.dict(exclude_unset=True),
                        violation_types=[],
                        session_id=f"merge_{datetime.now().isoformat()}"
                    )

                    # Update the quarantine record with new values
                    update_sql = f"""
                    UPDATE {self.QUARANTINE_TABLE}
                    SET next_payment_date = '{update.next_payment_date}',
                        balance = {update.balance},
                        arrears_balance = {update.arrears_balance},
                        cost_center_code = '{update.cost_center_code or ""}'
                    WHERE id = {id_val} AND date = '{date_val}' AND status = '{status_val}'
                    """

                    self._execute_sql(update_sql)

                    # Insert into cleaned table
                    insert_sql = f"""
                    INSERT INTO {self.CLEANED_TABLE}
                    SELECT * FROM {self.QUARANTINE_TABLE}
                    WHERE id = {id_val} AND date = '{date_val}' AND status = '{status_val}'
                    """

                    self._execute_sql(insert_sql)

                    # Remove from quarantine table
                    delete_sql = f"""
                    DELETE FROM {self.QUARANTINE_TABLE}
                    WHERE id = {id_val} AND date = '{date_val}' AND status = '{status_val}'
                    """

                    self._execute_sql(delete_sql)

                    merged_count += 1

                except Exception as e:
                    logger.error(f"Failed to merge record {update.composite_key}: {e}")
                    errors.append(f"Failed to merge {update.composite_key}: {str(e)}")
                    failed_count += 1

            # Trigger DLT pipeline if any records were merged
            pipeline_triggered = False
            if merged_count > 0:
                try:
                    pipeline_triggered = await self._trigger_dlt_pipeline()
                except Exception as e:
                    logger.error(f"Failed to trigger pipeline: {e}")
                    errors.append(f"Pipeline trigger failed: {str(e)}")

            return MergeResult(
                total_records=len(updates),
                merged_records=merged_count,
                failed_records=failed_count,
                pipeline_triggered=pipeline_triggered,
                errors=errors
            )

        except Exception as e:
            logger.error(f"Merge operation failed: {e}")
            return MergeResult(
                total_records=len(updates),
                merged_records=0,
                failed_records=len(updates),
                pipeline_triggered=False,
                errors=[f"Merge operation failed: {str(e)}"]
            )

    async def _log_audit_trail(self, record_id: int, record_date: str, user_email: str,
                              action: str, old_values: Dict, new_values: Dict,
                              violation_types: List[str], session_id: str):
        """Log an entry to the audit trail."""
        try:
            insert_sql = f"""
            INSERT INTO {self.AUDIT_TABLE}
            (record_id, record_date, user_email, action, old_values, new_values, violation_types, session_id)
            VALUES (
                {record_id},
                '{record_date}',
                '{user_email}',
                '{action}',
                '{json.dumps(old_values)}',
                '{json.dumps(new_values)}',
                '{json.dumps(violation_types)}',
                '{session_id}'
            )
            """

            self._execute_sql(insert_sql)

        except Exception as e:
            logger.error(f"Failed to log audit trail: {e}")

    async def _trigger_dlt_pipeline(self) -> bool:
        """Trigger the DLT pipeline."""
        try:
            # Find the job by name
            jobs = self.client.jobs.list()
            pipeline_job = None

            for job in jobs:
                if self.PIPELINE_NAME in (job.settings.name or ""):
                    pipeline_job = job
                    break

            if pipeline_job:
                self.client.jobs.run_now(job_id=pipeline_job.job_id)
                logger.info(f"Triggered DLT pipeline {self.PIPELINE_NAME}")
                return True
            else:
                logger.warning(f"DLT pipeline {self.PIPELINE_NAME} not found")
                return False

        except Exception as e:
            logger.error(f"Failed to trigger DLT pipeline: {e}")
            return False

    async def get_violation_type_counts(self) -> Dict[str, int]:
        """Get counts of records by violation type."""
        try:
            # Get all quarantine records
            df = self._execute_sql_to_dataframe(f"SELECT * FROM {self.QUARANTINE_TABLE}")

            counts = {vt.value: 0 for vt in ViolationType}

            for _, row in df.iterrows():
                record_data = row.to_dict()
                # Handle None values
                for key, value in record_data.items():
                    if pd.isna(value):
                        record_data[key] = None

                record = QuarantineRecord(**record_data)
                for vt in record.violation_types:
                    counts[vt.value] += 1

            return counts

        except Exception as e:
            logger.error(f"Failed to get violation counts: {e}")
            return {vt.value: 0 for vt in ViolationType}