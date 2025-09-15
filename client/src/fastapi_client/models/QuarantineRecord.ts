/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ViolationType } from './ViolationType';
/**
 * Model for a quarantined transaction record.
 */
export type QuarantineRecord = {
    id: number;
    date: string;
    status: string;
    next_payment_date?: (string | null);
    balance?: (number | null);
    arrears_balance?: (number | null);
    cost_center_code?: (string | null);
    acc_fv_change_before_taxes?: (number | null);
    accounting_treatment_id?: (number | null);
    accrued_interest?: (number | null);
    base_rate?: (string | null);
    behavioral_curve_id?: (number | null);
    count?: (number | null);
    country_code?: (string | null);
    encumbrance_type?: (string | null);
    end_date?: (string | null);
    first_payment_date?: (string | null);
    guarantee_scheme?: (string | null);
    limit_amount?: (number | null);
    last_payment_date?: (string | null);
    minimum_balance_eur?: (number | null);
    purpose?: (string | null);
    type?: (string | null);
    accounting_treatment?: (string | null);
    _rescued_data?: (string | null);
    violation_types?: Array<ViolationType>;
    composite_key?: string;
};

