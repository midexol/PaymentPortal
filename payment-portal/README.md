# Payment Portal — Backend

Node.js + Express + MongoDB backend for the FUTA University Payment Portal with Paystack integration.

## Stack
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB (Mongoose ODM)
- **Payment**: Paystack
- **Security**: Helmet, CORS, HMAC webhook verification, rate limiting

---

## Project Structure

```
payment-portal/
├── app.js                          # Entry point
├── .env.example                    # Environment variables template
└── src/
    ├── config/
    │   └── paystack.js             # Paystack client, amounts, charge calculator
    ├── controllers/
    │   └── paymentController.js    # All payment logic
    ├── models/
    │   └── Payment.js              # MongoDB schema
    └── routes/
        ├── payment.js              # /api/pay/* routes
        └── webhook.js              # /api/paystack/webhook
```

---

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment variables
```bash
cp .env.example .env
```
Edit `.env` and fill in:
```
PAYSTACK_SECRET_KEY=sk_live_xxxxxxxxxxxxxxxxxxxx
PAYSTACK_PUBLIC_KEY=pk_live_xxxxxxxxxxxxxxxxxxxx
MONGODB_URI=mongodb://localhost:27017/payment_portal
FRONTEND_URL=https://your-frontend-domain.com
```
Get your keys from: https://dashboard.paystack.com/#/settings/developer

### 3. Start the server
```bash
# Development (requires nodemon)
npm run dev

# Production
npm start
```

---

## API Endpoints

### POST `/api/pay/initialize`
Initialize a new payment session.

**Request body:**
```json
{
  "studentName": "Adewale Mide",
  "matricNumber": "FUT/CSC/20/0034",
  "email": "mide@futa.edu.ng",
  "phone": "08012345678",
  "department": "Computer Science",
  "level": "400 level",
  "paymentType": "fees",
  "session": "2024/2025"
}
```

**Payment types:** `fees` | `hostel` | `exam` | `library` | `sport` | `other`

**Response:**
```json
{
  "success": true,
  "data": {
    "authorizationUrl": "https://checkout.paystack.com/xxxx",
    "reference": "PP-FEES-1718000000000-AB12C",
    "totalNaira": 152250
  }
}
```
Redirect the student to `authorizationUrl` to complete payment on Paystack's hosted checkout.

---

### GET `/api/pay/verify/:reference`
Verify a payment after Paystack redirects back.

**Response:**
```json
{
  "success": true,
  "message": "Payment verified successfully.",
  "data": { ...paymentRecord }
}
```

---

### POST `/api/paystack/webhook`
Paystack calls this automatically when a payment completes.
- Validates HMAC-SHA512 signature using your secret key
- Updates payment status to `success` or `failed`
- Register this URL in your Paystack Dashboard → Settings → Webhooks

---

### GET `/api/pay/history/:matricNumber`
Fetch all payments for a student.

**Response:**
```json
{
  "success": true,
  "data": {
    "payments": [...],
    "summary": {
      "totalPaidNaira": 302250,
      "count": 3,
      "successCount": 2
    }
  }
}
```

---

### GET `/api/pay/receipt/:reference`
Fetch a single verified payment receipt.

---

## Frontend Integration (Paystack Inline)

Instead of redirecting, you can use Paystack's inline popup on your frontend:

```html
<script src="https://js.paystack.co/v2/inline.js"></script>
<script>
  async function pay() {
    // 1. Call your backend to initialize
    const res = await fetch('/api/pay/initialize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...studentData })
    });
    const { data } = await res.json();

    // 2. Open Paystack popup with access code
    const popup = new PaystackPop();
    popup.resumeTransaction(data.accessCode);
  }
</script>
```

---

## Webhook Setup (Production)

1. Deploy your server (Render, Railway, VPS)
2. Go to https://dashboard.paystack.com/#/settings/developer
3. Add webhook URL: `https://yourdomain.com/api/paystack/webhook`
4. Paystack will POST to this URL on every `charge.success` and `charge.failed` event

---

## Payment Amounts

| Type    | Amount (₦)  |
|---------|------------|
| fees    | 150,000    |
| hostel  | 45,000     |
| exam    | 5,000      |
| library | 3,000      |
| sport   | 2,500      |
| other   | 10,000     |

Amounts are in `src/config/paystack.js` — update them to match your institution's fees.

---

## Security Notes
- Webhook signature verified with HMAC-SHA512 before any DB write
- Rate limiting on payment initialization (10 requests / 15 min per IP)
- Raw body preserved for webhook route (required for signature check)
- Helmet sets secure HTTP headers
- `.env` is gitignored — never commit your secret key
