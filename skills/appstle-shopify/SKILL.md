---
name: appstle-shopify
description: This skill should be used when managing Appstle subscriptions on Shopify — customer lookup, billing history, pause/resume/cancel subscriptions, skip or reschedule orders, update payment methods, change delivery frequency, apply discount codes, swap product variants, or update shipping addresses. Relevant for queries about subscriptions, Appstle, recurring orders, subscription billing, subscription portal links, or selling plans.
user-invocable: true
argument-hint: [customer-email-or-action]
---

# Appstle Subscription Management

You have access to the `appstle_api` MCP tool for authenticated Appstle Subscription API requests. This skill teaches you the endpoints, workflows, and safety rules.

## Quick Reference

- **Base path**: All endpoints start with `/api/external/v2/`
- **Auth**: Handled automatically by the MCP tool (X-API-Key header + api_key query param)
- **Pagination**: Spring Pageable — `page` (0-based), `size` (default 20, max 50), `sort` (e.g. `created_at,desc`)
- **Customer IDs**: Always numeric — strip `gid://shopify/Customer/` prefix if present
- **Contract IDs**: Always numeric int64
- **Dates**: ISO 8601 with timezone: `2024-03-15T00:00:00Z`
- **Status values**: Send lowercase to API (`active`, `paused`, `cancelled`) even though they display as uppercase
- **Bulk operations**: See Workflow 11 for pagination-then-act pattern, rate limiting, and error handling

## Troubleshooting Setup

If the `appstle_api` tool is not available, check:
1. Run `/mcp` — is `appstle-shopify` listed? If not, restart Claude Code.
2. Is `APPSTLE_API_KEY` set? Check your project `.env` or run `echo $APPSTLE_API_KEY` in your shell.
3. The plugin loads `.env` automatically from your project directory.

### Tool Invocation

Call the `appstle_api` MCP tool with these parameters:

```
// GET with query params
appstle_api({ method: "GET", path: "/api/external/v2/subscription-contract-details", params: { customerName: "user@example.com", size: 5 } })

// PUT with query params (most PUT endpoints)
appstle_api({ method: "PUT", path: "/api/external/v2/subscription-contracts-update-status", params: { contractId: 123456, status: "PAUSED" } })

// PUT with body (exceptions: add-line-items, remove-line-items, update-shipping-address)
appstle_api({ method: "PUT", path: "/api/external/v2/subscription-contracts-update-shipping-address", params: { contractId: 123456 }, body: { firstName: "Max", lastName: "Mustermann", address1: "Bahnhofstrasse 1", city: "Zürich", country: "CH", zip: "8001" } })

// POST with body (variant swap)
appstle_api({ method: "POST", path: "/api/external/v2/subscription-contract-details/replace-variants-v3", body: { contractId: 123456, lineId: "gid://shopify/SubscriptionLine/789", newVariantId: "44681299468571" } })
```

## Critical API Quirks

1. **Response formats vary**: Some endpoints return arrays directly, others return `{ content: [], totalElements, ... }`. Always check with `Array.isArray()` logic when processing responses.

2. **PUT endpoints use query params, NOT body**: Almost all PUT endpoints pass data as query parameters. Exceptions that use request body:
   - `add-line-items` (body for items array)
   - `remove-line-items` (body for lineIds array)
   - `update-shipping-address` (body for address fields)

3. **Customer endpoint gaps**: `GET /subscription-customers/{id}` does NOT return `email`, `firstName`, or `lastName` at the top level. Enrich from the nested contract's `customer` field via `contract-external`.

4. **Activity log field naming**: Uses `createAt` (not `createdAt`) and JHipster filter syntax: `entityId.equals=value`, `createAt.greaterThanOrEqual=value`.

5. **Portal link response field**: The field is `manageSubscriptionLink` (not `portalLink` or `link`).

6. **Contract search by email**: Use `customerName` query param (not `email`) on `/subscription-contract-details`.

7. **WARNING — customerId filter overrides all others**: When `customerId` is provided to the contract-details endpoint, all other filters (email, status, dates, product) are SILENTLY IGNORED. Always use separate calls if you need both customer lookup and filtered results.

8. **fromNextDate/toNextDate must be paired**: Providing only one may return unexpected results.

9. **Rate limiting**: ~2 req/sec max. Bursting triggers 429s with long cooldown (minutes). For bulk operations use sequential requests with ≥1s delay. Exponential backoff on 429s (start 3s, double each retry).

10. **Cancel is DELETE**: Cancel with feedback uses `DELETE /subscription-contracts/{contractId}` with query params, not the PUT status endpoint.

11. **Sort field names are snake_case**: `created_at,desc`, `billingDate,desc`, `createAt,desc` (activity logs).

12. **Auto-dump for large responses**: Responses >4KB are automatically saved to `/tmp/appstle_*.json` and a compact summary is returned instead. The summary includes field names, a sample record, and ready-to-use `query.js` commands for SQL filtering. Use `size` up to 50 for efficient bulk fetches — the dump keeps Claude's context lean while preserving all data in the temp file.

## Working with Large Responses

Responses larger than 4KB are automatically dumped to `/tmp/appstle_*.json` files. Instead of the full JSON, you receive a compact summary with:
- Item count, pagination info, and file path
- Field names and a sample record
- Ready-to-use `query.js` commands

### Querying dump files with SQL

Use the bundled `query.js` script via Bash to filter, aggregate, or search dump files:

```bash
# Basic filtering
node <path-from-summary>/query.js "<file>" "SELECT id, customerEmail, status FROM ? WHERE status = 'ACTIVE'"

# Aggregation
node <path-from-summary>/query.js "<file>" "SELECT status, COUNT(*) as n FROM ? GROUP BY status"

# Search by email pattern
node <path-from-summary>/query.js "<file>" "SELECT * FROM ? WHERE customerEmail LIKE '%@example.com'"

# Date filtering (string comparison works for ISO dates)
node <path-from-summary>/query.js "<file>" "SELECT * FROM ? WHERE nextBillingDate > '2026-03-01'"

# Top N by value
node <path-from-summary>/query.js "<file>" "SELECT * FROM ? ORDER BY orderAmount DESC" --limit 10

# Compact output (single line)
node <path-from-summary>/query.js "<file>" "SELECT COUNT(*) as cnt FROM ?" --compact
```

The exact `node` command path is included in every dump summary — copy-paste it directly.

> **Reserved words**: alasql treats common words as keywords. Do NOT use these as column aliases:
> `total`, `count`, `name`, `order`, `key`, `value`, `number`, `status`, `type`, `table`, `select`
>
> Use short aliases instead: `as n`, `as cnt`, `as s`, `as v`, `as t`

### Common SQL patterns by endpoint

| Endpoint | Useful queries |
|----------|---------------|
| contract-details | `GROUP BY status`, `WHERE customerEmail LIKE '%...'`, `ORDER BY orderAmount DESC` |
| billing-attempts | `WHERE status = 'FAILURE'`, `SUM(amount)`, date range filters |
| activity-logs | `WHERE eventType = '...'`, `GROUP BY eventType`, date range |
| customers | `COUNT(*) GROUP BY ...`, email pattern search |

### Cleanup

Dump files older than 2 hours are automatically deleted when the MCP server starts. To clean up manually:
```bash
rm /tmp/appstle_*.json
```

## Safety Rules

### Destructive Operations — ALWAYS confirm with user first:

| Operation | Risk | Confirmation Required |
|-----------|------|----------------------|
| Cancel subscription | **IRREVERSIBLE** — cannot be undone | Yes, always |
| Trigger billing | Charges customer's payment method | Yes, always |
| Send portal link email | Sends real email to customer | Yes, always |
| Change billing date to today/past | May trigger immediate charge | Yes, warn user |
| Remove last line item | May cancel the subscription | Yes, warn user |
| Remove discount | Increases customer's next charge | Yes, inform user |
| Replace variant | Changes what customer receives next delivery | Yes, confirm swap |
| Bulk mutations (>10 items) | **HIGH** — rate limiting, partial failures possible | Yes, confirm total count once |

### Before any modification:
1. Always fetch the subscription first to confirm current state
2. Confirm the action and its consequences with the user
3. After modification, fetch again to verify the change took effect

## Endpoint Quick Map

For full endpoint details with all parameters, read `references/endpoints.md`.
For example JSON response structures, read `references/response-shapes.md`.
For step-by-step workflow playbooks, read `examples/workflows.md`.

### Customer Lookup
| Action | Method | Path |
|--------|--------|------|
| Search by email | GET | `/subscription-contract-details?customerName={email}&size=1` |
| Get customer by ID | GET | `/subscription-customers/{customerId}` |
| Get portal link | GET | `/manage-subscription-link?customerId={id}&email={email}` |
| Send portal email | GET | `/subscription-contracts-email-magic-link?customerId={id}` |
| Validate active | GET | `/subscription-customers/valid/{customerId}` |
| Validate detailed | GET | `/subscription-customers-detail/valid/{customerId}` |
| List all customers | GET | `/subscription-contract-details/customers?page=0&size=20` |

### Subscriptions
| Action | Method | Path |
|--------|--------|------|
| List/filter | GET | `/subscription-contract-details?status=active&size=20` |
| Get full details | GET | `/subscription-contracts/contract-external/{contractId}` |
| Pause | PUT | `/subscription-contracts-update-status?contractId={id}&status=PAUSED` |
| Resume | PUT | `/subscription-contracts-update-status?contractId={id}&status=ACTIVE` |
| Cancel (simple) | PUT | `/subscription-contracts-update-status?contractId={id}&status=CANCELLED` |
| Cancel (with feedback) | DELETE | `/subscription-contracts/{contractId}?cancellationFeedback=...` |

### Billing & Orders
| Action | Method | Path |
|--------|--------|------|
| Past orders | GET | `/subscription-billing-attempts/past-orders?contractId={id}` |
| Upcoming orders | GET | `/subscription-billing-attempts/top-orders?contractId={id}` |
| Current cycle | GET | `/subscription-contract-details/current-cycle/{contractId}` |
| Trigger billing | PUT | `/subscription-billing-attempts/attempt-billing/{billingAttemptId}` |
| Set billing date | PUT | `/subscription-contracts-update-billing-date?contractId={id}&nextBillingDate=...` |
| Set billing interval | PUT | `/subscription-contracts-update-billing-interval?contractId={id}&interval=MONTH&intervalCount=1` |
| Set delivery interval | PUT | `/subscription-contracts-update-delivery-interval?contractId={id}&deliveryInterval=MONTH&deliveryIntervalCount=1` |
| Set min cycles | PUT | `/subscription-contracts-update-min-cycles?contractId={id}&minCycles=3` |
| Set max cycles | PUT | `/subscription-contracts-update-max-cycles?contractId={id}&maxCycles=12` |
| Skip order | PUT | `/subscription-billing-attempts/skip-order/{billingAttemptId}` |
| Unskip order | PUT | `/subscription-billing-attempts/unskip-order/{billingAttemptId}` |
| Reschedule order | PUT | `/subscription-billing-attempts/reschedule-order/{billingAttemptId}?billingDate=...` |
| Skip upcoming | PUT | `/subscription-billing-attempts/skip-upcoming-order?subscriptionContractId={id}` |
| Fulfillments | GET | `/subscription-contract-details/subscription-fulfillments/{contractId}` |

### Line Items & Products
| Action | Method | Path | Params/Body |
|--------|--------|------|-------------|
| Add item | PUT | `/subscription-contracts-add-line-item` | Query: `contractId, variantId, quantity` |
| Add (custom price) | PUT | `/subscription-contract-add-line-item` | Query: `contractId, variantId, quantity, basePrice` |
| Add multiple | PUT | `/subscription-contracts-add-line-items` | Query: `contractId`, Body: items array |
| Remove item | PUT | `/subscription-contracts-remove-line-item` | Query: `contractId, lineId, removeDiscount` |
| Remove multiple | PUT | `/subscription-contracts-remove-line-items` | Query: `contractId, removeDiscount`, Body: lineIds array |
| Update quantity | PUT | `/subscription-contracts-update-line-item-quantity` | Query: `contractId, lineId, quantity` |
| List one-time | GET | `/subscription-contract-one-offs-by-contractId?contractId={id}` |
| Add one-time | PUT | `/subscription-contract-one-offs-by-contractId-and-billing-attempt-id` | Query: all params |
| Remove one-time | DELETE | `/subscription-contract-one-offs-by-contractId-and-billing-attempt-id` | Query: `contractId, billingAttemptId, variantId` |

### Pricing & Discounts
| Action | Method | Path |
|--------|--------|------|
| Set line price | PUT | `/subscription-contracts-update-line-item-price?contractId={id}&lineId={lid}&basePrice={price}` |
| Set pricing policy | PUT | `/subscription-contracts-update-line-item-pricing-policy?contractId={id}&lineId={lid}&basePrice={price}` |
| Set delivery price | PUT | `/subscription-contracts-update-delivery-price?contractId={id}&deliveryPrice={price}` |
| Add custom discount | PUT | `/subscription-contracts-add-discount?contractId={id}&percentage=10` |
| Apply discount code | PUT | `/subscription-contracts-apply-discount?contractId={id}&discountCode=SAVE10` |
| Remove discount | PUT | `/subscription-contracts-remove-discount?contractId={id}&discountId={did}` |

### Shipping
| Action | Method | Path | Notes |
|--------|--------|------|-------|
| Update address | PUT | `/subscription-contracts-update-shipping-address?contractId={id}` | Body: address fields |
| Update delivery method | PUT | `/subscription-contracts-update-delivery-method` | Query: all params |

### Payment Methods
| Action | Method | Path |
|--------|--------|------|
| List methods | GET | `/subscription-contract-details/shopify/customer/{customerId}/payment-methods` |
| Update method | PUT | `/subscription-contracts-update-payment-method?contractId={id}&paymentMethodId={pmId}` |

### Notes
| Action | Method | Path |
|--------|--------|------|
| Set contract note | PUT | `/subscription-contracts-update-order-note/{contractId}?note={text}` |
| Set order note | PUT | `/subscription-billing-attempts-update-order-note/{billingAttemptId}?note={text}` |

### Activity Logs & Analytics
| Action | Method | Path |
|--------|--------|------|
| Search logs | GET | `/activity-logs?entityId.equals={contractId}&sort=createAt,desc` |
| Get analytics | GET | `/subscription-contract-details/analytics/{contractId}` |

### Selling Plans & Groups
| Action | Method | Path |
|--------|--------|------|
| List groups | GET | `/subscription-groups` |
| Get group | GET | `/subscription-groups/{groupId}` |
| List all plans | GET | `/subscription-groups/all-selling-plans` |
| Change frequency | PUT | `/subscription-contracts-update-frequency-by-selling-plan?contractId={id}&sellingPlanId={spId}` |
| Change line plan | PUT | `/subscription-contracts-update-line-item-selling-plan?contractId={id}&lineId={lid}&sellingPlanId={spId}` |

### Variant Swaps
| Action | Method | Path | Notes |
|--------|--------|------|-------|
| Replace variant | POST | `/subscription-contract-details/replace-variants-v3` | Body: `{ contractId, lineId, newVariantId, quantity? }` |
| Get swap options | POST | `/product-swaps-by-variant-groups/{contractId}` | Returns available swaps |
| List swap rules | GET | `/product-swaps` | Returns configured rules |
