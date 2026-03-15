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
| size | number | No | Results per page (default 20, max 50) |
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

### Sync customer data from Shopify
```
GET /subscription-customers/sync-info/{customerId}
```
| Param | Type | Required | Notes |
|-------|------|----------|-------|
| customerId | number (path) | Yes | Numeric Shopify customer ID |

Triggers a synchronous Shopify→Appstle data sync for the customer. Blocks until complete (1–5s typical).

Returns: void / empty (side effect is the sync)

Errors: 400 (invalid ID), 404 (customer not found), 429 (rate limited), 502 (Shopify API error)

**Use cases**: Fix data discrepancies, refresh after manual Shopify changes, recover from webhook failures.

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
| size | number | No | Results per page (default 20, recommended max 50) |
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

### Create subscription contract
```
POST /subscription-contract-details/create-subscription-contract
```
Body (`SubscriptionContractDTO`):

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| customerId | string | Yes | Numeric Shopify customer ID |
| nextBillingDate | string | Yes | ISO 8601 date-time |
| status | string | Yes | `ACTIVE` or `PAUSED` |
| billingIntervalType | string | Yes | `DAY`, `WEEK`, `MONTH`, `YEAR` |
| billingIntervalCount | number | Yes | Min 1 |
| deliveryIntervalType | string | No | Defaults to billing interval |
| deliveryIntervalCount | number | No | Defaults to billing interval count |
| deliveryFirstName | string | Yes | |
| deliveryLastName | string | Yes | |
| deliveryAddress1 | string | Yes | |
| deliveryAddress2 | string | No | |
| deliveryCity | string | Yes | |
| deliveryProvinceCode | string | No | |
| deliveryZip | string | No | |
| deliveryCountryCode | string | Yes | e.g. `US`, `CH`, `DE` |
| deliveryPhone | string | No | |
| deliveryPriceAmount | number | No | Shipping cost |
| currencyCode | string | No | Defaults to store currency |
| paymentMethodId | string | No | Defaults to customer default |
| createWithoutPaymentMethod | boolean | No | Default false — if true, status forced to PAUSED |
| maxCycles | number | No | |
| minCycles | number | No | |
| allowDeliveryAddressOverride | boolean | No | Default false |
| allowDeliveryPriceOverride | boolean | No | Default false |
| customAttributes | array | No | `[{ key, value }]` |
| lines | array | Yes | See line item fields below |

Line item fields (`SubscriptionContractLineDTO`):

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| variantId | string | Yes | Numeric, without gid prefix |
| productId | string | No | |
| quantity | number | Yes | Min 1 |
| sellingPlanId | string | No | Full gid format |
| currentPrice | number | No | |
| unitPrice | number | No | |
| customAttributes | array | No | `[{ key, value }]` |
| linePricingPolicy | string | No | `SELLING_PLAN_PRICING_POLICY`, `CUSTOM_PRICING_POLICY`, `NO_PRICING_POLICY` |
| pricingPolicy | array | No | AppstleCycle objects for custom pricing |

Returns (201): `SubscriptionContract` — full GraphQL-style contract object

Errors: 400 (missing customerId, no payment method, multiple payment methods without ID, invalid selling plan), 401, 403, 422 (Shopify API error)

**DESTRUCTIVE**: Creates a real subscription that will bill the customer. Always confirm.

### Split/duplicate contract
```
POST /subscription-contract-details/split-existing-contract
```
| Param | Type | Required | Notes |
|-------|------|----------|-------|
| contractId | number (query) | Yes | Source contract ID |
| isSplitContract | boolean (query) | No | Default false. true=move items (destructive), false=copy items |
| attemptBilling | boolean (query) | No | Default false. true=bill the new contract immediately |

Body: `string[]` — array of line item IDs to split/copy

Returns (200): `SubscriptionContract` — the new contract, with `customAttributes` containing `_origin_type: SPLIT_CONTRACT` and `_original_contract_id`

Errors: 400 (all products selected, contract not found, no payment method, invalid line IDs)

**DESTRUCTIVE** when `isSplitContract=true` — removes items from original contract. When `attemptBilling=true`, also charges customer. Always confirm.

---

## Billing & Order Endpoints

### Past orders (billing history)
```
GET /subscription-billing-attempts/past-orders
```
| Param | Type | Required | Notes |
|-------|------|----------|-------|
| contractId | number | Yes | |
| size | number | No | Default 20, recommended max 50 |
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

### Past orders report (advanced)
```
GET /subscription-billing-attempts/past-orders/report
```
| Param | Type | Required | Notes |
|-------|------|----------|-------|
| status | string | Yes | See status enum below |
| contractId | number | No | Filter by contract |
| includeShopifyException | boolean | No | Default false — include error details for failures |
| fromDay | string | No | ISO 8601 — range start |
| toDay | string | No | ISO 8601 — range end |
| attemptCount | number | No | Filter by retry count |
| contractStatus | string | No | Filter by contract status |
| page | number | No | 0-based |
| size | number | No | Results per page |
| sort | string[] | No | e.g. `id,desc` |

Status enum: `SUCCESS`, `FAILURE`, `REQUESTING`, `PROGRESS`, `QUEUED`, `SKIPPED`, `SOCIAL_CONNECTION_NULL`, `CONTRACT_CANCELLED`, `CONTRACT_ENDED`, `CONTRACT_PAUSED`, `AUTO_CHARGE_DISABLED`, `SHOPIFY_EXCEPTION`, `SKIPPED_DUNNING_MGMT`, `SKIPPED_INVENTORY_MGMT`, `IMMEDIATE_TRIGGERED`, `SECURITY_CHALLENGE`, `CONTRACT_PAUSED_MAX_CYCLES`, `REFUNDED`, `SKIPPED_DEMO_SHOP`, `SKIPPED_SHOP_INFO_NOT_FOUND`, `SKIPPED_BILLING_DATE_STALE`, `SKIPPED_DUNNING_NOT_CONFIGURED`

Returns: `SubscriptionBillingAttemptDetails[]` — same shape as BillingAttempt but may include additional fields when `includeShopifyException=true`

### Update billing attempt
```
PUT /subscription-billing-attempts
```
Body (`SubscriptionBillingAttemptDTO`):

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | number | Yes | Billing attempt ID |
| billingDate | string | No | New billing date (ISO 8601) |
| orderNote | string | No | Order note |

Returns (200): Updated `SubscriptionBillingAttemptDTO`

**Constraint**: Only QUEUED billing attempts can be modified.

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

### Update line item (comprehensive)
```
PUT /subscription-contracts-update-line-item
```
| Param | Type | Required | Notes |
|-------|------|----------|-------|
| contractId | number (query) | Yes | |
| lineId | string (query) | Yes | Full gid format |
| quantity | number (query) | No | 1–9999 |
| variantId | string (query) | No | gid format — changes the product |
| price | number (query) | No | 0.01–999999.99 |
| isPricePerUnit | boolean (query) | No | Default false. For prepaid: true=per delivery, false=per billing period |
| sellingPlanName | string (query) | No | Max 255 chars — update by plan name |

Returns (200): `SubscriptionContract` with updated lines. May return 207 for partial success.

Only provide params you want to change. Updates apply in order: selling plan → price → quantity → variant.

**Note**: This is the "swiss army knife" version of the individual update-quantity/update-price endpoints.

### Update line item attributes
```
PUT /subscription-contracts-update-line-item-attributes
```
| Param | Type | Required | Notes |
|-------|------|----------|-------|
| contractId | number (query) | Yes | |
| lineId | string (query) | Yes | gid format |

Body: `AttributeInfo[]` — `[{ "key": "color", "value": "red" }]`

Returns (200): `SubscriptionContract`

Errors: 400, 404 (line item not found), 422 (constraint violation)

### Update multiple line item attributes (bulk)
```
PUT /subscription-contracts-update-multiple-line-item-attributes
```
| Param | Type | Required | Notes |
|-------|------|----------|-------|
| contractId | number (query) | Yes | |

Body: `Record<string, AttributeInfo[]>` — keys are line item GIDs:
```json
{
  "gid://shopify/SubscriptionLineItem/123": [{ "key": "color", "value": "red" }],
  "gid://shopify/SubscriptionLineItem/456": [{ "key": "size", "value": "L" }]
}
```

Returns (200): `SubscriptionContract`

Errors: 400, 404 (contract or line item not found), 422

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

### List upcoming one-time products (next order only)
```
GET /upcoming-subscription-contract-one-offs-by-contractId
```
| Param | Type | Required | Notes |
|-------|------|----------|-------|
| contractId | number (query) | Yes | |

Returns (200): `SubscriptionContractOneOffDTO[]` — one-time products for the NEXT upcoming order only.

Returns empty array if no queued billing attempts exist.

**Difference from `/subscription-contract-one-offs-by-contractId`**: That endpoint returns ALL one-time products across all future orders. This one returns ONLY those for the next delivery.

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
Query: `contractId, paymentMethodId` (numeric ID)

### Update existing payment method (gid format)
```
PUT /subscription-contracts-update-existing-payment-method
```
| Param | Type | Required | Notes |
|-------|------|----------|-------|
| contractId | number (query) | Yes | |
| paymentMethodId | string (query) | Yes | Full gid format: `gid://shopify/CustomerPaymentMethod/{id}`. Must be valid, non-expired, non-revoked |

Returns (200): `{ "message": "Payment method updated successfully" }`

Errors: 400 (invalid/expired/revoked payment method, contract not found), 422 (pending charges block update)

**Note**: Difference from `update-payment-method` — this endpoint takes a gid-format `paymentMethodId` and works through Shopify's draft system. The existing `update-payment-method` takes a numeric ID.

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

### Get billing interval options
```
GET /subscription-contract-details/billing-interval
```
| Param | Type | Required | Notes |
|-------|------|----------|-------|
| sellingPlanIds | string (query) | Yes | Comma-separated selling plan IDs |

Returns (200): Array of frequency options with `id`, `frequencyName`, `interval`, `intervalCount`, `deliveryInterval`, `deliveryIntervalCount`, and `pricingPolicy` (adjustmentType + adjustmentValue).

Returns empty array `[]` if no plans found (not an error).

**Use case**: Populate frequency selector UIs, show available billing options for a selling plan.

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
