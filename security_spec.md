# Security Specification - Payment Gateways

This document details the security model, invariants, and testing conditions for the `payment_gateways` collection in Firestore.

## 1. Data Invariants
1. A payment gateway configuration must have a unique identifier (`sslcommerz` or `shurjopay`).
2. Only authorized administrators with `super_admin` role are permitted to write to the `payment_gateways` collection.
3. Guests and authenticated standard users are permitted read-only access to determine if a gateway is active or needs to be rendered on the checkout screen.

## 2. Dirty Dozen payloads for test coverage
The following payloads must be rejected by the rules:
- Attempting to update `is_active` without being a Super Admin.
- Attempting to rewrite the entire config as an unauthenticated guest.
- Spoofing store ID properties.
