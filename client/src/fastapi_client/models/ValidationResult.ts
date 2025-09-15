/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ViolationType } from './ViolationType';
/**
 * Result of validating a record against DLT constraints.
 */
export type ValidationResult = {
    composite_key: string;
    is_valid: boolean;
    violations: Array<ViolationType>;
    errors?: Array<string>;
};

