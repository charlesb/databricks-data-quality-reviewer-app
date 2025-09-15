/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ValidationResult } from './ValidationResult';
/**
 * Result of batch validation.
 */
export type BatchValidationResult = {
    total_records: number;
    valid_records: number;
    invalid_records: number;
    results: Array<ValidationResult>;
};

