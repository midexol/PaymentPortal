# FUTA University Payment Portal

A modern, secure, full-stack university payment portal designed for the Federal University of Technology, Akure (FUTA). Built with a **React** frontend, an **Express/Node.js** backend, a **MongoDB** database, and seamless **Paystack** payment gateway integration.

---

## 🚀 Key Features

*   **Student Payment Wizard**: A clean 3-step payment flow (Student Info -> Fee Selection -> Checkout Confirmation) built with React.
*   **Institutional Fee Types**: Preconfigured amounts for:
    *   School fees (₦150,000)
    *   Hostel fees (₦45,000)
    *   Exam fees (₦5,000)
    *   Library dues (₦3,000)
    *   Sport levy (₦2,500)
    *   Others (₦10,000)
*   **Dynamic Paystack Fee Computation**: Automatically calculates Paystack's transaction charge (1.5% + ₦100 for payments above ₦2,500, capped at ₦2,000) on the fly, matching the backend math exactly.
*   **Secure Webhooks (HMAC-SHA512)**: Verifies Paystack's digital signature before editing database records to prevent request tampering or spoofing.
*   **Student Payment History**: Retrieve previous transactions, aggregate paid fees, and verify pending transactions manually.
*   **Administrative APIs**: Secured endpoints (JWT) for dashboard aggregates, CSV spreadsheet downloads, and daily email digests (via Nodemailer).
*   **Decoupled Database Resilience**: Server runs on port 5000 even if MongoDB Atlas is temporarily down, ensuring network API calls fail gracefully rather than crashing the server.

---

## 📁 Project Structure

```
payment-portal/
├── payment-portal/                  # Backend Express Service
│   ├── app.js                       # Server entry point & static serving
│   ├── src/
│   │   ├── config/                  # Paystack & SMTP Nodemailer settings
│   │   ├── controllers/             # Backend business logic (Payments & Admin)
│   │   ├── middleware/              # JWT verification
│   │   ├── models/                  # Mongoose schemas (Payment & Admin)
│   │   └── routes/                  # API endpoints
│   ├── public/                      # Compiled frontend assets (served in production)
│   └── .env                         # Secrets configuration (Git ignored)
│
└── frontend/                        # Frontend React Application
    ├── index.html                   # HTML entry point
    ├── vite.config.js               # Dev proxy settings & build compilation paths
    ├── src/
    │   ├── App.jsx                  # State coordination
    │   ├── App.css                  # Custom Vanilla CSS styles
    │   ├── main.jsx                 # React root mounting
    │   └── components/              # Step wizard & history components
```

---

## 🛠️ Installation & Setup

### Prerequisites
*   Node.js (v18 or higher)
*   MongoDB (Atlas Cluster or local MongoDB Server)
*   Paystack developer account (for test API keys)

---

### Step 1: Configure Environment Variables
Create a `.env` file inside the `payment-portal/` folder (the backend directory) and add the following keys:

```ini
PORT=5000
MONGODB_URI=your_mongodb_connection_string
PAYSTACK_SECRET_KEY=your_paystack_secret_key
PAYSTACK_PUBLIC_KEY=your_paystack_public_key
FRONTEND_URL=http://localhost:5173
NODE_ENV=development

# Email (SMTP details for Nodemailer)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
EMAIL_FROM="FUTA Payment Portal <noreply@futa.edu.ng>"

# Admin Configuration
ADMIN_JWT_SECRET=your_jwt_secret_string
ADMIN_JWT_EXPIRES_IN=8h
```

---

### Step 2: Running in Development (Separate Servers)

To enjoy features like Hot Module Replacement (HMR) and automatic server reloading, run the client and API server separately:

#### 1. Run the Express Backend
Open your terminal in the `payment-portal/payment-portal` folder and run:
```bash
npm install
npm run dev
```
*   **Port**: Starts listening on `http://localhost:5000`.

#### 2. Run the React Frontend
Open another terminal in the `payment-portal/payment-portal/frontend` folder and run:
```bash
npm install
npm run dev
```
*   **Port**: Launches in your browser on `http://localhost:5173`.
*   *Vite's built-in proxy will automatically forward any client requests matching `/api/*` to the backend running on port 5000.*

---

### Step 3: Running in Production (Unified Server)

In production, the backend serves the React frontend directly from a single port:

1.  Open your terminal in the `frontend` folder and build the React app:
    ```bash
    npm run build
    ```
    *   *This compiles all React source code into optimized static assets directly inside the backend's `public/` directory.*
2.  Start the Express server in the backend folder:
    ```bash
    npm start
    ```
3.  Open your browser and navigate to **`http://localhost:5000`**. The backend will serve both the payment page and process all API requests natively.

---

## 🔒 Security Measures

1.  **HMAC-SHA512 Verification**: Inbound Paystack webhooks are signed. The backend hashes the raw request body with your secret key and compares it against the `x-paystack-signature` header before performing any database updates.
2.  **JWT Authentication**: Admin routes require a valid JSON Web Token inside the request header (`Authorization: Bearer <token>`).
3.  **Rate Limiting**: Limits payment initialization requests (maximum 10 per 15 minutes per IP address) to prevent denial of service or spamming transaction creations.
