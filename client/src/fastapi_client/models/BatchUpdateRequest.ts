/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { QuarantineRecordUpdate } from './QuarantineRecordUpdate';
/**
 * Model for batch update requests.
 */
export type BatchUpdateRequest = {
    updates: Array<QuarantineRecordUpdate>;
    user_email?: string;
};

