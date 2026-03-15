# Appstle API Response Shapes

Example JSON structures for the most complex endpoints. Use these to know which fields to extract.

---

## CustomerResponse (from `/subscription-customers/{id}`)

```json
{
  "id": "gid://shopify/Customer/7654321098765",
  "displayName": null,
  "firstName": null,
  "lastName": null,
  "email": null,
  "productSubscriberStatus": "ACTIVE",
  "tags": ["subscriber", "vip"],
  "subscriptionContracts": {
    "nodes": [
      {
        "id": "gid://shopify/SubscriptionContract/123456",
        "status": "ACTIVE",
        "nextBillingDate": "2024-04-15T00:00:00Z",
        "createdAt": "2024-01-15T10:30:00Z",
        "lastPaymentStatus": "SUCCESS",
        "billingPolicy": { "interval": "MONTH", "intervalCount": 1 },
        "deliveryPolicy": { "interval": "MONTH", "intervalCount": 1 },
        "deliveryPrice": { "amount": "5.00", "currencyCode": "CHF" },
        "lines": {
          "nodes": [
            {
              "id": "gid://shopify/SubscriptionLine/789",
              "productId": "gid://shopify/Product/111",
              "variantId": "gid://shopify/ProductVariant/222",
              "title": "Protein Powder",
              "variantTitle": "Chocolate 1kg",
              "quantity": 1,
              "sku": "PP-CHOC-1KG",
              "currentPrice": { "amount": "49.90", "currencyCode": "CHF" },
              "lineDiscountedPrice": { "amount": "44.91", "currencyCode": "CHF" },
              "variantImage": { "url": "https://cdn.shopify.com/..." }
            }
          ]
        },
        "customer": {
          "id": "gid://shopify/Customer/7654321098765",
          "email": "customer@example.com",
          "displayName": "Max Mustermann",
          "firstName": "Max",
          "lastName": "Mustermann",
          "phone": "+41791234567"
        },
        "customerPaymentMethod": {
          "id": "gid://shopify/CustomerPaymentMethod/456",
          "instrument": {
            "brand": "VISA",
            "lastDigits": "4242",
            "maskedNumber": "****4242",
            "expiryMonth": 12,
            "expiryYear": 2026,
            "expiresSoon": false
          },
          "revokedAt": null
        },
        "originOrder": {
          "id": "gid://shopify/Order/999",
          "name": "#71992",
          "totalPriceSet": { "shopMoney": { "amount": "49.90", "currencyCode": "CHF" } }
        },
        "deliveryMethod": {
          "address": {
            "firstName": "Max",
            "lastName": "Mustermann",
            "address1": "Bahnhofstrasse 1",
            "address2": null,
            "city": "Zürich",
            "province": "ZH",
            "country": "CH",
            "zip": "8001",
            "phone": "+41791234567"
          }
        },
        "discounts": { "nodes": [] },
        "note": "Customer prefers morning delivery"
      }
    ]
  }
}
```

**Key extraction notes:**
- `email`, `firstName`, `lastName` are null at top level — get from `subscriptionContracts.nodes[0].customer`
- `id` fields are Shopify GIDs — extract numeric part with regex: `/\d+$/`
- `currentPrice` vs `lineDiscountedPrice` — use discounted if available
- `customerPaymentMethod` can be null (no payment method on file)

---

## SubscriptionContractNode (from `/subscription-contracts/contract-external/{id}`)

Same structure as the `subscriptionContracts.nodes[*]` object above, but returned directly (not nested in a customer object).

---

## SubscriptionContractDetail (from `/subscription-contract-details`)

Flat format (different from the GraphQL-style contract-external):

```json
{
  "id": 123456,
  "subscriptionContractId": 123456,
  "status": "ACTIVE",
  "customerName": "Max Mustermann",
  "customerEmail": "customer@example.com",
  "customerId": "7654321098765",
  "nextBillingDate": "2024-04-15T00:00:00Z",
  "createdAt": "2024-01-15T10:30:00Z",
  "orderAmount": 49.90,
  "currencyCode": "CHF",
  "billingPolicyInterval": "MONTH",
  "billingPolicyIntervalCount": 1,
  "deliveryPolicyInterval": "MONTH",
  "deliveryPolicyIntervalCount": 1,
  "orderName": "#71992",
  "lines": [
    {
      "lineId": "gid://shopify/SubscriptionLine/789",
      "productId": "gid://shopify/Product/111",
      "variantId": "gid://shopify/ProductVariant/222",
      "title": "Protein Powder",
      "variantTitle": "Chocolate 1kg",
      "quantity": 1,
      "price": 49.90,
      "sku": "PP-CHOC-1KG"
    }
  ],
  "shippingFirstName": "Max",
  "shippingLastName": "Mustermann",
  "shippingAddress1": "Bahnhofstrasse 1",
  "shippingCity": "Zürich",
  "shippingCountry": "CH",
  "shippingZip": "8001"
}
```

---

## PaginatedResponse (wrapper for list endpoints)

```json
{
  "content": [ /* array of items */ ],
  "totalElements": 150,
  "totalPages": 8,
  "size": 20,
  "number": 0,
  "first": true,
  "last": false,
  "empty": false
}
```

**Note**: Some endpoints return bare arrays instead of this paginated wrapper — always check with `Array.isArray()`.

---

## BillingAttempt (from past-orders/top-orders)

```json
{
  "id": 999,
  "shop": "mystore.myshopify.com",
  "billingAttemptId": "gid://shopify/SubscriptionBillingAttempt/999",
  "status": "SUCCESS",
  "billingDate": "2024-03-15T00:00:00Z",
  "contractId": 123456,
  "attemptCount": 1,
  "attemptTime": "2024-03-15T06:00:00Z",
  "graphOrderId": "gid://shopify/Order/888",
  "orderId": 888,
  "orderAmount": 49.90,
  "orderName": "#71993",
  "retryingNeeded": false
}
```

Status values: `SUCCESS`, `FAILURE`, `QUEUED`, `SKIPPED`, `PROGRESS`, `REQUESTING`, `REFUNDED`, `CONTRACT_CANCELLED`, `CONTRACT_PAUSED`

---

## ActivityLog (from `/activity-logs`)

```json
{
  "id": 555,
  "shop": "mystore.myshopify.com",
  "entityId": 123456,
  "entityType": "SUBSCRIPTION_CONTRACT",
  "eventSource": "MERCHANT",
  "eventType": "SUBSCRIPTION_CONTRACT_STATUS_CHANGE",
  "status": "SUCCESS",
  "createAt": "2024-03-15T10:30:00Z",
  "activityBy": "admin@store.com",
  "additionalInfo": "{\"previousStatus\":\"ACTIVE\",\"newStatus\":\"PAUSED\",\"reason\":\"Customer request\"}",
  "clientIp": "192.168.1.1"
}
```

**Note**: `createAt` (not `createdAt`), `additionalInfo` is a JSON string that needs parsing.

---

## PaymentMethodListItem (from payment-methods endpoint)

```json
{
  "id": "gid://shopify/CustomerPaymentMethod/456",
  "instrument": {
    "brand": "VISA",
    "lastDigits": "4242",
    "maskedNumber": "****4242",
    "expiryMonth": 12,
    "expiryYear": 2026,
    "expiresSoon": false,
    "name": "Visa ending in 4242",
    "source": "SHOPIFY_PAYMENTS"
  },
  "revokedAt": null,
  "revokedReason": null
}
```

---

## CreateContractResponse (from `create-subscription-contract`)

Same `SubscriptionContract` shape as `contract-external` — a full GraphQL-style contract object with lines, customer, payment method, shipping address, billing/delivery policies.

Returns HTTP 201 on success.

---

## SplitContractResponse (from `split-existing-contract`)

Same `SubscriptionContract` shape as `contract-external`, but the new contract includes origin metadata in `customAttributes`:

```json
{
  "id": "gid://shopify/SubscriptionContract/999999",
  "status": "ACTIVE",
  "customAttributes": [
    { "key": "_origin_type", "value": "SPLIT_CONTRACT" },
    { "key": "_original_contract_id", "value": "123456" }
  ],
  "lines": {
    "nodes": [
      {
        "id": "gid://shopify/SubscriptionLine/111",
        "title": "Protein Powder",
        "variantTitle": "Chocolate 1kg",
        "quantity": 1,
        "currentPrice": { "amount": "49.90", "currencyCode": "CHF" }
      }
    ]
  }
}
```

---

## BillingIntervalResponse (from `billing-interval`)

```json
[
  {
    "id": "123456",
    "frequencyName": "Every 2 Weeks",
    "interval": "WEEK",
    "intervalCount": 2,
    "deliveryInterval": "WEEK",
    "deliveryIntervalCount": 2,
    "pricingPolicy": {
      "adjustmentType": "PERCENTAGE",
      "adjustmentValue": "10.0"
    }
  }
]
```

Returns empty array `[]` if no plans found.

---

## SubscriptionContractOneOffDTO (from one-time endpoints)

```json
{
  "id": 12345,
  "shop": "example-shop.myshopify.com",
  "contractId": 67890,
  "billingAttemptId": 11111,
  "variantId": 22222,
  "quantity": 2,
  "productTitle": "Coffee Filters - Pack of 100",
  "variantTitle": "Standard Size",
  "image": "https://cdn.shopify.com/.../filter.jpg",
  "price": "9.99",
  "currencyCode": "USD"
}
```

Returned as an array from both `/subscription-contract-one-offs-by-contractId` (all future orders) and `/upcoming-subscription-contract-one-offs-by-contractId` (next order only).

---

## SubscriptionGroup / SellingPlan

```json
{
  "id": 10,
  "groupName": "Monthly Subscription",
  "merchantCode": "monthly-sub",
  "productCount": 5,
  "sellingPlans": [
    {
      "id": 100,
      "sellingPlanName": "Every month",
      "billingPolicy": { "interval": "MONTH", "intervalCount": 1 },
      "deliveryPolicy": { "interval": "MONTH", "intervalCount": 1 },
      "pricingPolicies": [
        { "adjustmentType": "PERCENTAGE", "adjustmentValue": 10 }
      ]
    }
  ]
}
```
