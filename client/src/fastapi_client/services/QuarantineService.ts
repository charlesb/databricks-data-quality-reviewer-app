/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { BatchUpdateRequest } from '../models/BatchUpdateRequest';
import type { BatchValidationResult } from '../models/BatchValidationResult';
import type { MergeResult } from '../models/MergeResult';
import type { QuarantineRecordUpdate } from '../models/QuarantineRecordUpdate';
import type { QuarantineResponse } from '../models/QuarantineResponse';
import type { ValidationResult } from '../models/ValidationResult';
import type { ViolationType } from '../models/ViolationType';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class QuarantineService {
    /**
     * Get Test Quarantine Data
     * Get test quarantine data for UI demonstration.
     * @returns QuarantineResponse Successful Response
     * @throws ApiError
     */
    public static getTestQuarantineDataApiQuarantineTestDataGet(): CancelablePromise<QuarantineResponse> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/quarantine/test-data',
        });
    }
    /**
     * Get Quarantine Records
     * Get quarantined records with optional filtering by violation type.
     *
     * - **violation_type**: Filter by specific violation type (PAYMENT_DATE, BALANCE, COST_CENTER)
     * - **limit**: Maximum number of records to return (1-1000)
     * - **offset**: Number of records to skip for pagination
     * @param violationType
     * @param limit
     * @param offset
     * @returns QuarantineResponse Successful Response
     * @throws ApiError
     */
    public static getQuarantineRecordsApiQuarantineRecordsGet(
        violationType?: ViolationType,
        limit: number = 100,
        offset?: number,
    ): CancelablePromise<QuarantineResponse> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/quarantine/records',
            query: {
                'violation_type': violationType,
                'limit': limit,
                'offset': offset,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Get Violation Counts
     * Get counts of quarantined records by violation type.
     * @returns any Successful Response
     * @throws ApiError
     */
    public static getViolationCountsApiQuarantineViolationCountsGet(): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/quarantine/violation-counts',
        });
    }
    /**
     * Validate Records
     * Validate quarantine record updates against DLT constraints.
     *
     * Returns validation results for each record showing which constraints pass/fail.
     * @param requestBody
     * @returns ValidationResult Successful Response
     * @throws ApiError
     */
    public static validateRecordsApiQuarantineValidatePost(
        requestBody: Array<QuarantineRecordUpdate>,
    ): CancelablePromise<Array<ValidationResult>> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/quarantine/validate',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Validate Batch
     * Validate a batch of quarantine record updates.
     *
     * Returns summary statistics and individual validation results.
     * @param requestBody
     * @returns BatchValidationResult Successful Response
     * @throws ApiError
     */
    public static validateBatchApiQuarantineValidateBatchPost(
        requestBody: BatchUpdateRequest,
    ): CancelablePromise<BatchValidationResult> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/quarantine/validate-batch',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Merge Records
     * Merge validated quarantine records back to the cleaned table.
     *
     * This endpoint:
     * 1. Validates all records against DLT constraints
     * 2. Merges only valid records to the cleaned_new_txs table
     * 3. Removes merged records from quarantine
     * 4. Triggers the DLT pipeline
     * 5. Logs all operations to audit trail
     *
     * Processing is done asynchronously for large batches.
     * @param requestBody
     * @returns MergeResult Successful Response
     * @throws ApiError
     */
    public static mergeRecordsApiQuarantineMergePost(
        requestBody: BatchUpdateRequest,
    ): CancelablePromise<MergeResult> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/quarantine/merge',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Merge Records Async
     * Merge quarantine records asynchronously (for large batches).
     *
     * Returns immediately with a task ID for status tracking.
     * This endpoint is useful for processing large batches (50+ records).
     * @param requestBody
     * @returns any Successful Response
     * @throws ApiError
     */
    public static mergeRecordsAsyncApiQuarantineMergeAsyncPost(
        requestBody: BatchUpdateRequest,
    ): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/quarantine/merge-async',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                422: `Validation Error`,
            },
        });
    }
    /**
     * Health Check
     * Health check endpoint for the quarantine API.
     * @returns any Successful Response
     * @throws ApiError
     */
    public static healthCheckApiQuarantineHealthGet(): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/quarantine/health',
        });
    }
    /**
     * Get Violation Types
     * Get list of available violation types.
     * @returns any Successful Response
     * @throws ApiError
     */
    public static getViolationTypesApiQuarantineViolationTypesGet(): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/quarantine/violation-types',
        });
    }
}
