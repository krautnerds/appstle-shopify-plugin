# Appstle API Endpoint Reference

Full parameter documentation for all Appstle Subscription API v2 endpoints.

All paths are relative to `/api/external/v2/`.

---

## Customer Endpoints

### Search customers by email
```
GET /subscription-contract-details
```
| Param | Type | Required | Notes |
|-------|------|----------|-------|
| customerName | string | Yes | Email address (misleading param name — searches by email) |
| size | number | No | Results per page (default 20) |
| page | number | No | 0-based page number |
| status | string | No | `active`, `paused`, `cancelled` (lowercase) |
| sort | string | No | e.g. `created_at,desc` |

Returns: `SubscriptionContractDetail[]` or `PaginatedResponse<SubscriptionContractDetail>`

### Get customer by Shopify ID
```
GET /subscription-customers/{customerId}
```
| Param | Type | Required | Notes |
|-------|------|----------|-------|
| customerId | number (path) | Yes | Numeric Shopify customer ID |

Returns: `CustomerResponse` — **IMPORTANT**: Does NOT return email/firstName/lastName at top level. Enrich from nested `subscriptionContracts.nodes[0].customer` via the contract-external endpoint.

### Generate portal link
```
GET /manage-subscription-link
```
| Param | Type | Required | Notes |
|-------|------|----------|-------|
| customerId | string | Yes | Numeric customer ID |
| email | string | No | Customer email (API uses on-file email if omitted) |

Returns: `{ manageSubscriptionLink: string, tokenExpirationTime: string }` — link expires in 2 hours.

### Send portal link email
```
GET /subscription-contracts-email-magic-link
```
| Param | Type | Required | Notes |
|-------|------|----------|-------|
| customerId | string | Yes | Numeric customer ID |
| email | string | No | Override email address |

**DESTRUCTIVE**: Sends a real email to the customer.

### Validate customer — quick check
```
GET /subscription-customers/valid/{customerId}
```
Returns: `{ valid: boolean, hasActiveSubscription: boolean, subscriptionCount: number }`

### Validate customer — detailed
```
GET /subscription-customers-detail/valid/{customerId}
```
Returns: Extended validation data including subscription details.

### List all subscription customers
```
GET /subscription-contract-details/customers
```
| Param | Type | Required | Notes |
|-------|------|----------|-------|
| page | number | No | 0-based page number |
| size | number | No | Results per page |

---

## Subscription Contract Endpoints

### List/filter contracts
```
GET /subscription-contract-details
```
| Param | Type | Required | Notes |
|-------|------|----------|-------|
| status | string | No | `active`, `paused`, `cancelled` (lowercase!) |
| customerName | string | No | Email search (partial match) |
| orderName | string | No | e.g. "#71992" |
| productId | number | No | Shopify product ID |
| variantId | number | No | Shopify variant ID |
| fromCreatedDate | string | No | ISO 8601 |
| toCreatedDate | string | No | ISO 8601 |
| fromNextDate | string | No | ISO 8601 — **must pair with toNextDate** |
| toNextDate | string | No | ISO 8601 — **must pair with fromNextDate** |
| size | number | No | Results per page (default 20, max 100) |
| page | number | No | 0-based |
| sort | string | No | `created_at,desc`, `created_at,asc`, `next_billing_date,asc`, `next_billing_date,desc` |

### Get full contract details
```
GET /subscription-contracts/contract-external/{contractId}
```
Returns: `SubscriptionContractNode` — deeply nested GraphQL-style response with line items, customer, payment method, shipping address, billing/delivery policies, discounts, notes.

### Update subscription status
```
PUT /subscription-contracts-update-status
```
| Param | Type | Required | Notes |
|-------|------|----------|-------|
| contractId | number | Yes | Query param |
| status | string | Yes | `PAUSED`, `ACTIVE`, `CANCELLED` (uppercase for this endpoint) |

### Cancel with feedback
```
DELETE /subscription-contracts/{contractId}
```
| Param | Type | Required | Notes |
|-------|------|----------|-------|
| contractId | number (path) | Yes | |
| cancellationFeedback | string | No | e.g. "too_expensive", "not_needed", "switching_product", "other" |
| cancellationNote | string | No | Free text note |

**IRREVERSIBLE**: Cannot be undone.

---

## Billing & Order Endpoints

### Past orders (billing history)
```
GET /subscription-billing-attempts/past-orders
```
| Param | Type | Required | Notes |
|-------|------|----------|-------|
| contractId | number | Yes | |
| size | number | No | Default 20 |
| page | number | No | 0-based |
| sort | string | No | `billingDate,desc` (default), `billingDate,asc` |

### Upcoming orders
```
GET /subscription-billing-attempts/top-orders
```
| Param | Type | Required | Notes |
|-------|------|----------|-------|
| contractId | number | Yes | |

### Current billing cycle
```
GET /subscription-contract-details/current-cycle/{contractId}
```

### Trigger billing attempt
```
PUT /subscription-billing-attempts/attempt-billing/{billingAttemptId}
```
**DESTRUCTIVE**: Creates a real charge on the customer's payment method.

### Update billing date
```
PUT /subscription-contracts-update-billing-date
```
| Param | Type | Required | Notes |
|-------|------|----------|-------|
| contractId | number | Yes | |
| nextBillingDate | string | Yes | ISO 8601 |
| rescheduleFutureOrder | boolean | No | Also reschedule future orders |
| skipOrderUpdate | boolean | No | Skip updating associated orders |

### Update billing interval
```
PUT /subscription-contracts-update-billing-interval
```
| Param | Type | Required | Notes |
|-------|------|----------|-------|
| contractId | number | Yes | |
| interval | string | Yes | `DAY`, `WEEK`, `MONTH`, `YEAR` |
| intervalCount | number | Yes | e.g. 2 for "every 2 months" |

**Both interval and intervalCount are required together.**

### Update delivery interval
```
PUT /subscription-contracts-update-delivery-interval
```
| Param | Type | Required | Notes |
|-------|------|----------|-------|
| contractId | number | Yes | |
| deliveryInterval | string | Yes | `DAY`, `WEEK`, `MONTH`, `YEAR` |
| deliveryIntervalCount | number | Yes | |

### Update min/max cycles
```
PUT /subscription-contracts-update-min-cycles?contractId={id}&minCycles={n}
PUT /subscription-contracts-update-max-cycles?contractId={id}&maxCycles={n}
```

### Skip order
```
PUT /subscription-billing-attempts/skip-order/{billingAttemptId}
```
| Param | Type | Required | Notes |
|-------|------|----------|-------|
| subscriptionContractId | number | No | Optional contract ID for context |

### Unskip order
```
PUT /subscription-billing-attempts/unskip-order/{billingAttemptId}
```

### Reschedule order
```
PUT /subscription-billing-attempts/reschedule-order/{billingAttemptId}
```
| Param | Type | Required | Notes |
|-------|------|----------|-------|
| billingDate | string | Yes | New date (ISO 8601) |
| rescheduleFutureOrder | boolean | No | Also reschedule future orders |

### Skip upcoming order (by contract)
```
PUT /subscription-billing-attempts/skip-upcoming-order
```
| Param | Type | Required | Notes |
|-------|------|----------|-------|
| subscriptionContractId | number | Yes | |

### Fulfillment history
```
GET /subscription-contract-details/subscription-fulfillments/{contractId}
```

---

## Line Item Endpoints

### Add single line item
```
PUT /subscription-contracts-add-line-item
```
| Param | Type | Required | Notes |
|-------|------|----------|-------|
| contractId | number | Yes | Query param |
| variantId | string | Yes | Shopify variant ID (numeric string) |
| quantity | number | Yes | |

### Add line item with custom pricing
```
PUT /subscription-contract-add-line-item
```
| Param | Type | Required | Notes |
|-------|------|----------|-------|
| contractId | number | Yes | Query param |
| variantId | string | Yes | |
| quantity | number | Yes | |
| basePrice | number | No | Custom price override |
| isOneTimeProduct | boolean | No | Mark as one-time (not recurring) |

### Add multiple line items
```
PUT /subscription-contracts-add-line-items
```
Query: `contractId`
Body: `[{ variantId: string, quantity: number }, ...]`

### Remove single line item
```
PUT /subscription-contracts-remove-line-item
```
| Param | Type | Required | Notes |
|-------|------|----------|-------|
| contractId | number | Yes | Query param |
| lineId | string | Yes | Line item ID |
| removeDiscount | boolean | No | Also remove associated discounts |

### Remove multiple line items
```
PUT /subscription-contracts-remove-line-items
```
Query: `contractId, removeDiscount`
Body: `["lineId1", "lineId2", ...]`

### Update line item quantity
```
PUT /subscription-contracts-update-line-item-quantity
```
| Param | Type | Required | Notes |
|-------|------|----------|-------|
| contractId | number | Yes | Query param |
| lineId | string | Yes | |
| quantity | number | Yes | |

---

## One-Time Product Endpoints

### List one-time products
```
GET /subscription-contract-one-offs-by-contractId?contractId={id}
```

### Add one-time product
```
PUT /subscription-contract-one-offs-by-contractId-and-billing-attempt-id
```
| Param | Type | Required | Notes |
|-------|------|----------|-------|
| contractId | number | Yes | Query param |
| billingAttemptId | number | Yes | From upcoming orders |
| variantId | string | Yes | Shopify variant ID |
| variantHandle | string | Yes | Shopify variant handle |
| quantity | number | No | Default 1 |

### Remove one-time product
```
DELETE /subscription-contract-one-offs-by-contractId-and-billing-attempt-id
```
| Param | Type | Required | Notes |
|-------|------|----------|-------|
| contractId | number | Yes | Query param |
| billingAttemptId | number | Yes | |
| variantId | string | Yes | |

---

## Pricing & Discount Endpoints

### Update line item price
```
PUT /subscription-contracts-update-line-item-price
```
Query: `contractId, lineId, basePrice`

### Update pricing policy
```
PUT /subscription-contracts-update-line-item-pricing-policy
```
Query: `contractId, lineId, basePrice`

### Update delivery price
```
PUT /subscription-contracts-update-delivery-price
```
Query: `contractId, deliveryPrice`

### Add custom discount
```
PUT /subscription-contracts-add-discount
```
| Param | Type | Required | Notes |
|-------|------|----------|-------|
| contractId | number | Yes | |
| percentage | number | Conditional | Mutually exclusive with `amount` |
| amount | number | Conditional | Mutually exclusive with `percentage` |
| discountTitle | string | No | Display name |
| recurringCycleLimit | number | No | Cycles the discount applies |
| appliesOnEachItem | boolean | No | Per-item vs total |

### Apply discount code
```
PUT /subscription-contracts-apply-discount
```
Query: `contractId, discountCode`

### Remove discount
```
PUT /subscription-contracts-remove-discount
```
Query: `contractId, discountId`

---

## Shipping Endpoints

### Update shipping address
```
PUT /subscription-contracts-update-shipping-address
```
Query: `contractId`
Body: `{ firstName, lastName, address1, address2, city, province, country, zip, phone }`

**Exception**: This PUT endpoint uses request body for address fields.

### Update delivery method
```
PUT /subscription-contracts-update-delivery-method
```
| Param | Type | Required | Notes |
|-------|------|----------|-------|
| contractId | number | Yes | Query param |
| delivery-method-title | string | Yes | Display name |
| delivery-method-code | string | Yes | Internal code |
| delivery-method-presentment-title | string | Yes | Presentment title |

---

## Payment Method Endpoints

### List payment methods
```
GET /subscription-contract-details/shopify/customer/{customerId}/payment-methods
```
Returns: `PaymentMethodListItem[]`

### Update payment method
```
PUT /subscription-contracts-update-payment-method
```
Query: `contractId, paymentMethodId`

---

## Note Endpoints

### Set contract note
```
PUT /subscription-contracts-update-order-note/{contractId}
```
Query: `note`

### Set order/billing attempt note
```
PUT /subscription-billing-attempts-update-order-note/{billingAttemptId}
```
Query: `note`

---

## Activity Log Endpoint

### Search activity logs
```
GET /activity-logs
```
Uses JHipster filter syntax:

| Param | Type | Notes |
|-------|------|-------|
| entityId.equals | number | Contract ID |
| eventType.equals | string | e.g. `SUBSCRIPTION_CONTRACT_CREATE`, `SUBSCRIPTION_BILLING_ATTEMPT_SUCCESS` |
| entityType.equals | string | e.g. `SUBSCRIPTION_CONTRACT`, `BILLING_ATTEMPT` |
| eventSource.equals | string | e.g. `MERCHANT`, `CUSTOMER`, `SYSTEM` |
| status.equals | string | e.g. `SUCCESS`, `FAILURE` |
| createAt.greaterThanOrEqual | string | ISO 8601 (note: `createAt` not `createdAt`) |
| createAt.lessThanOrEqual | string | ISO 8601 |
| sort | string | `createAt,desc` |
| size | number | |
| page | number | |

Known event types: `SUBSCRIPTION_CONTRACT_CREATE`, `SUBSCRIPTION_CONTRACT_UPDATE`, `SUBSCRIPTION_CONTRACT_STATUS_CHANGE`, `TAGS_UPDATED`, `SUBSCRIPTION_BILLING_ATTEMPT_SUCCESS`, `SUBSCRIPTION_BILLING_ATTEMPT_FAILURE`, `LINE_ITEM_ADDED`, `LINE_ITEM_REMOVED`, `DISCOUNT_ADDED`, `DISCOUNT_REMOVED`, `SHIPPING_ADDRESS_UPDATED`, `BILLING_DATE_UPDATED`

---

## Analytics Endpoint

### Get contract analytics
```
GET /subscription-contract-details/analytics/{contractId}
```
Returns: Revenue metrics, active/paused/cancelled counts, average order value.

---

## Selling Plan Endpoints

### List subscription groups
```
GET /subscription-groups
```

### Get single group
```
GET /subscription-groups/{groupId}
```

### List all selling plans
```
GET /subscription-groups/all-selling-plans
```

### Change frequency by selling plan
```
PUT /subscription-contracts-update-frequency-by-selling-plan
```
Query: `contractId, sellingPlanId`

### Change line item selling plan
```
PUT /subscription-contracts-update-line-item-selling-plan
```
Query: `contractId, lineId, sellingPlanId`

---

## Variant Swap Endpoints

### Replace variant
```
POST /subscription-contract-details/replace-variants-v3
```
Body: `{ contractId, lineId, newVariantId, quantity? }`

### Get available swap options
```
POST /product-swaps-by-variant-groups/{contractId}
```
Returns: Map of variant groups to available swap products.

### List swap rules
```
GET /product-swaps
```
Returns: `ProductSwapRule[]` — configured swap rules.
