# Appstle Workflow Playbooks

Step-by-step guides for common subscription management tasks.

---

## 1. Look Up a Customer

**Goal**: Find a customer and view their subscription details.

### By email:
```
Step 1: Search for customer
→ GET /subscription-contract-details?customerName=customer@example.com&size=1

Step 2: Extract customerId from the result
→ customerId is in the response (e.g. "7654321098765")

Step 3: Get full customer details
→ GET /subscription-customers/{customerId}

Step 4: Enrich with name/email (customer endpoint doesn't return these)
→ Extract first contract GID, get numeric ID
→ GET /subscription-contracts/contract-external/{contractId}
→ Read customer.email, customer.firstName, customer.lastName from response
```

### By customer ID:
```
Step 1: Get customer details directly
→ GET /subscription-customers/{customerId}

Step 2: Enrich if needed (same as step 4 above)
```

### Common follow-ups:
- Generate portal link: `GET /manage-subscription-link?customerId={id}&email={email}`
- View specific subscription: `GET /subscription-contracts/contract-external/{contractId}`

---

## 2. Investigate a Billing Issue

**Goal**: Understand why a customer's subscription billing failed or is unexpected.

```
Step 1: Look up the customer (workflow 1)
→ Note their contract IDs and current status

Step 2: Get full subscription details
→ GET /subscription-contracts/contract-external/{contractId}
→ Check: status, nextBillingDate, lastPaymentStatus, payment method

Step 3: Check billing history
→ GET /subscription-billing-attempts/past-orders?contractId={id}&size=10&sort=billingDate,desc
→ Look for: FAILURE status, missing orders, gaps in billing dates

Step 4: Check current billing cycle
→ GET /subscription-contract-details/current-cycle/{contractId}
→ Verify: cycle number, next billing date

Step 5: Search activity logs for the contract
→ GET /activity-logs?entityId.equals={contractId}&sort=createAt,desc&size=20
→ Look for: SUBSCRIPTION_BILLING_ATTEMPT_FAILURE events, status changes

Step 6: Check payment method
→ GET /subscription-contract-details/shopify/customer/{customerId}/payment-methods
→ Look for: expired cards, revoked methods
```

### Common resolutions:
- **Expired card**: Inform user, send portal link for customer to update
- **Billing date issue**: `PUT /subscription-contracts-update-billing-date`
- **Failed attempt**: After payment method is fixed, `PUT /subscription-billing-attempts/attempt-billing/{id}` (with confirmation!)

---

## 3. Process a Cancellation

**Goal**: Cancel a subscription with proper documentation.

```
Step 1: Get subscription details first
→ GET /subscription-contracts/contract-external/{contractId}
→ Confirm: this is the right subscription, verify customer and products

Step 2: CONFIRM with user
→ "Are you sure you want to cancel subscription #{contractId} for {customerName}?
   This is IRREVERSIBLE. Products: {list products}. Next billing: {date}."

Step 3: Cancel with feedback
→ DELETE /subscription-contracts/{contractId}?cancellationFeedback={reason}&cancellationNote={note}
→ Feedback options: "too_expensive", "not_needed", "switching_product", "other"

Step 4: Verify cancellation
→ GET /subscription-contracts/contract-external/{contractId}
→ Confirm status is now CANCELLED
```

### Alternative — Pause instead of cancel:
```
→ PUT /subscription-contracts-update-status?contractId={id}&status=PAUSED
```
(Pausing is reversible, cancellation is not)

---

## 4. Change Product/Variant (Swap)

**Goal**: Replace a product variant in a subscription.

```
Step 1: Get subscription details
→ GET /subscription-contracts/contract-external/{contractId}
→ Note: line item IDs, current variants, quantities

Step 2: Check available swap options
→ POST /product-swaps-by-variant-groups/{contractId}
→ See which replacement variants are allowed

Step 3: (Optional) Check swap rules
→ GET /product-swaps
→ Understand configured swap policies

Step 4: Confirm with user
→ "Replace {current product} with {new product} in subscription #{contractId}?"

Step 5: Execute swap
→ POST /subscription-contract-details/replace-variants-v3
→ Body: { contractId, lineId, newVariantId, quantity? }

Step 6: Verify change
→ GET /subscription-contracts/contract-external/{contractId}
→ Confirm the line item now shows the new variant
```

---

## 5. Update Payment Method

**Goal**: Change the payment method on a subscription.

```
Step 1: Look up customer (workflow 1)
→ Get customerId

Step 2: List available payment methods
→ GET /subscription-contract-details/shopify/customer/{customerId}/payment-methods
→ Note: method IDs, card brands, expiry dates, revoked status

Step 3: Identify the right payment method
→ Show user the options (card type, last 4 digits, expiry)
→ Confirm which one to use

Step 4: Update the subscription's payment method
→ PUT /subscription-contracts-update-payment-method?contractId={id}&paymentMethodId={pmId}

Step 5: Verify change
→ GET /subscription-contracts/contract-external/{contractId}
→ Confirm customerPaymentMethod shows the new method
```

### If no valid payment methods exist:
- Send portal link for customer to add a new method
- `GET /subscription-contracts-email-magic-link?customerId={id}` (with confirmation!)

---

## 6. Manage Selling Plan Frequency

**Goal**: Change how often a subscription bills/delivers.

```
Step 1: List available selling plans
→ GET /subscription-groups/all-selling-plans
→ OR: GET /subscription-groups (to see groups first)
→ Note: selling plan IDs and their frequencies

Step 2: Get current subscription details
→ GET /subscription-contracts/contract-external/{contractId}
→ Note: current billing/delivery intervals

Step 3: Confirm with user
→ "Change subscription #{contractId} from {current interval} to {new interval}?"

Step 4a: Change entire subscription frequency
→ PUT /subscription-contracts-update-frequency-by-selling-plan?contractId={id}&sellingPlanId={spId}

Step 4b: OR change a specific line item's plan
→ PUT /subscription-contracts-update-line-item-selling-plan?contractId={id}&lineId={lid}&sellingPlanId={spId}

Step 5: Verify change
→ GET /subscription-contracts/contract-external/{contractId}
→ Confirm billingPolicy and deliveryPolicy reflect the new interval
```

### Alternative — Direct interval change (without selling plan):
```
→ PUT /subscription-contracts-update-billing-interval?contractId={id}&interval=MONTH&intervalCount=2
→ PUT /subscription-contracts-update-delivery-interval?contractId={id}&deliveryInterval=MONTH&deliveryIntervalCount=2
```
(Both interval and intervalCount must be provided together)

---

## 7. Skip or Reschedule an Order

**Goal**: Skip the next delivery or move it to a different date.

```
Step 1: Get upcoming orders
→ GET /subscription-billing-attempts/top-orders?contractId={id}
→ Note: billingAttemptId, billingDate for the order to modify

Step 2: Confirm with user
→ "Skip/reschedule order #{billingAttemptId} (billing date: {date})?"

Step 3a: Skip the order
→ PUT /subscription-billing-attempts/skip-order/{billingAttemptId}

Step 3b: OR reschedule to a new date
→ PUT /subscription-billing-attempts/reschedule-order/{billingAttemptId}?billingDate={newDate}

Step 3c: OR skip the next upcoming order (by contract, no need for billingAttemptId)
→ PUT /subscription-billing-attempts/skip-upcoming-order?subscriptionContractId={contractId}

Step 4: Verify
→ GET /subscription-billing-attempts/top-orders?contractId={id}
→ Confirm the order status changed or date moved
```

---

## 8. Update Shipping Address

**Goal**: Change the delivery address on a subscription.

```
Step 1: Get current subscription details
→ GET /subscription-contracts/contract-external/{contractId}
→ Note current shipping address in deliveryMethod.address

Step 2: Confirm new address with user

Step 3: Update address
→ PUT /subscription-contracts-update-shipping-address?contractId={id}
→ Body: { firstName, lastName, address1, address2, city, province, country, zip, phone }
→ NOTE: This is one of the few PUT endpoints that uses request body

Step 4: Verify
→ GET /subscription-contracts/contract-external/{contractId}
→ Confirm deliveryMethod.address shows the new address
```

---

## 9. Add/Remove Discounts

**Goal**: Apply or remove discounts on a subscription.

### Apply a discount code:
```
Step 1: Confirm code and subscription with user

Step 2: Apply
→ PUT /subscription-contracts-apply-discount?contractId={id}&discountCode=SAVE10

Step 3: Verify
→ GET /subscription-contracts/contract-external/{contractId}
```

### Add a custom percentage discount:
```
Step 1: Confirm with user

Step 2: Apply
→ PUT /subscription-contracts-add-discount?contractId={id}&percentage=10&discountTitle=Loyalty%20Discount

Step 3: Verify
→ GET /subscription-contracts/contract-external/{contractId}
→ Confirm discount appears in discounts.nodes
```

### Add a custom fixed amount discount:
```
Step 1: Confirm with user

Step 2: Apply
→ PUT /subscription-contracts-add-discount?contractId={id}&amount=5.00&discountTitle=Special%20Offer

Step 3: Verify
→ GET /subscription-contracts/contract-external/{contractId}
→ Confirm discount appears in discounts.nodes
```
Note: `percentage` and `amount` are mutually exclusive.

---

## 10. Bulk Data Extraction with SQL

**Goal**: Extract, filter, or aggregate data from large API responses using SQL queries on dump files.

### Fetch and query a large dataset:
```
Step 1: Fetch with large page size (auto-dumps to file)
→ GET /subscription-contract-details?status=active&size=50
→ Response: summary with file path + query.js commands

Step 2: Get an overview of the data
→ Bash: node <query.js path> "<file>" "SELECT status, COUNT(*) as n FROM ? GROUP BY status"

Step 3: Extract specific records
→ Bash: node <query.js path> "<file>" "SELECT id, customerEmail, orderAmount FROM ? WHERE orderAmount > 100 ORDER BY orderAmount DESC" --limit 20

Step 4: Search by email pattern
→ Bash: node <query.js path> "<file>" "SELECT id, customerEmail, status FROM ? WHERE customerEmail LIKE '%@example.com'"
```

### Multi-page extraction:
```
Step 1: Fetch page 0
→ GET /subscription-contract-details?size=50&page=0
→ Note totalElements and totalPages from summary

Step 2: Fetch remaining pages
→ GET /subscription-contract-details?size=50&page=1
→ GET /subscription-contract-details?size=50&page=2
→ (continue until all pages fetched)

Step 3: Query across pages
→ Run query.js on each dump file separately
→ Or combine: "SELECT COUNT(*) as n FROM ?" on each file, sum manually
```

### Billing failure analysis:
```
Step 1: Fetch billing history
→ GET /subscription-billing-attempts/past-orders?contractId={id}&size=50

Step 2: Find failures
→ Bash: node <query.js path> "<file>" "SELECT billingDate, status, errorMessage FROM ? WHERE status = 'FAILURE' ORDER BY billingDate DESC"

Step 3: Summarize amounts
→ Bash: node <query.js path> "<file>" "SELECT status, COUNT(*) as n, SUM(amount) as amt FROM ? GROUP BY status"
```

---

## 11. Bulk Mutations

**Goal**: Collect IDs across paginated results, then apply a mutation (cancel, pause, update, etc.) to each one with rate limiting, progress reporting, and error handling.

### Step A: Collect IDs across pages

```
Step 1: Fetch page 0 with max page size
→ GET /subscription-contract-details?status=active&size=50&page=0
→ Note totalElements from summary (e.g. 827)
→ Extract IDs from dump file:
  Bash: node <query.js path> "<file>" "SELECT id FROM ?"

Step 2: Fetch page 1
→ GET /subscription-contract-details?status=active&size=50&page=1
→ Extract IDs from this dump file too

Step 3: Repeat for page 2, 3, ... until the returned array length < requested page size
→ Termination rule: STOP when items on page < size parameter (e.g. page returns 27 items but size=50)
→ Do NOT rely on totalPages — some endpoints omit it. Array length < page size is the reliable signal.

Step 4: Merge all collected IDs into a single list
→ You now have the complete ID set to mutate
```

### Step B: Execute mutations with batching and progress

```
Step 1: Confirm with user ONCE before starting
→ "About to cancel 827 subscriptions with feedback 'store_closing'. Proceed?"
→ Do NOT ask per-item confirmation — one confirmation for the entire batch

Step 2: Process in batches of 25, reporting progress after each batch
→ After batch 1:  "Processed 25/827 (3%)..."
→ After batch 2:  "Processed 50/827 (6%)..."
→ After batch 10: "Processed 250/827 (30%)..."

Step 3: Rate limiting between each request
→ Minimum 1 second delay between mutations
→ On HTTP 429: back off starting at 3 seconds, double each retry (3s → 6s → 12s → ...)
→ Max 5 retries per item before recording as failure

Step 4: Error handling — collect failures, do NOT stop on first error
→ If a mutation fails, record { id, error } and continue with the next item
→ After all items processed, report failures:
  "Completed: 819/827 succeeded, 8 failed"
  "Failed IDs: 123, 456, 789, ... — errors: [details]"
```

### Cancel-specific recipe

Bulk cancel uses `DELETE /subscription-contracts/{id}`, NOT the PUT status endpoint.

```
For each contractId in collected IDs:
→ DELETE /subscription-contracts/{contractId}?cancellationFeedback={reason}
→ Optional: &cancellationNote={note}

Example with feedback:
→ DELETE /subscription-contracts/12345?cancellationFeedback=store_closing&cancellationNote=Business%20closed%20March%202026

Feedback options: "too_expensive", "not_needed", "switching_product", "other", or any custom string
```

### Pause-specific recipe

```
For each contractId in collected IDs:
→ PUT /subscription-contracts-update-status?contractId={contractId}&status=PAUSED
```

### Template: progress reporting

```
Report format after every 25 mutations:
  "Processed {done}/{total} ({percentage}%)... {failures} failures so far"

Final report:
  "Bulk {operation} complete: {succeeded}/{total} succeeded, {failed} failed"
  If failures > 0: list each failed ID with its error message
```

---

### Remove a discount:
```
Step 1: Get subscription to find discount IDs
→ GET /subscription-contracts/contract-external/{contractId}
→ Look in discounts.nodes for the discount ID

Step 2: Confirm with user (removing increases their next charge)

Step 3: Remove
→ PUT /subscription-contracts-remove-discount?contractId={id}&discountId={did}

Step 4: Verify
→ GET /subscription-contracts/contract-external/{contractId}
→ Confirm discount no longer in discounts.nodes
```
