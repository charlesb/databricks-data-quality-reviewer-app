/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * Result of merging records back to cleaned table.
 */
export type MergeResult = {
    total_records: number;
    merged_records: number;
    failed_records: number;
    pipeline_triggered: boolean;
    errors?: Array<string>;
};

