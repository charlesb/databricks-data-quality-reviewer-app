/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { QuarantineRecord } from './QuarantineRecord';
/**
 * Response model for quarantine data queries.
 */
export type QuarantineResponse = {
    records: Array<QuarantineRecord>;
    total_count: number;
    filtered_count: number;
    violation_type_counts: Record<string, number>;
};

