# Admin Panel Integration Guide - Rider Metrics

This integration guide provides the database paths, schemas, and Firestore queries required to display rider wallet status, transaction history, rating calculations, and live shift analytics on your **Admin Panel**.

---

## 1. Database Schema Reference

### A. Employee Database (Rider Status)
- **Path**: `employees/{riderUID}`
- **Fields**:
  - `holdingBalance` (Number): The current cash in hand collected by this rider.
  - `dutyStatus` (String): `"online"` or `"offline"`.
  - `name` (String): Full name of the rider.

### B. Transactions collection (Wallet Ledger)
- **Path**: `transactions/{transactionId}`
- **Fields**:
  - `riderId` (String): UID matching the rider's doc ID in `employees`.
  - `orderId` (String): The ID of the order delivered.
  - `orderSeq` (String): Seq code for user-facing sequence representation.
  - `amount` (Number): The cash amount collected or settled.
  - `type` (String): `"cash_collection"` (credit) or `"admin_transfer"` (debit/settled).
  - `status` (String): `"completed"` or `"pending"`.
  - `createdAt` (Timestamp): Timestamp when transaction occurred.

### C. Reviews Collection (Rating)
- **Path**: `reviews/{reviewId}`
- **Fields**:
  - `rider` (Map):
    - `riderId` (String): UID of the rider being reviewed.
  - `rating` (Number): Value from `1` to `5`.

### D. Orders Collection (Deliveries)
- **Path**: `orders/{orderId}`
- **Fields**:
  - `riderId` (String): UID of the executing rider.
  - `status` (String): `"delivered"`, `"picked"`, `"cancelled"`, etc.
  - `deliveredAt` (Timestamp): Timestamp of delivery completion.

---

## 2. Integration Queries & Code Snippets

Here are standard Firestore JavaScript SDK queries (suitable for React, Next.js, or Node.js) to retrieve these metrics on the admin panel:

### Query 1: Get Rider Profile & Cash in Hand
Retrieve a single rider's name, active duty status, and total cash in hand.
```javascript
import { doc, getDoc } from "firebase/firestore";
import { db } from "./firebaseConfig";

async function getRiderCashInHand(riderUID) {
  const riderRef = doc(db, "employees", riderUID);
  const snap = await getDoc(riderRef);
  
  if (snap.exists()) {
    const data = snap.data();
    return {
      name: data.name,
      dutyStatus: data.dutyStatus,
      cashInHand: data.holdingBalance || 0
    };
  }
  return null;
}
```

### Query 2: Get Rider Transaction Ledger (History)
List all collections and admin balance settlements for a rider, ordered by time.
```javascript
import { collection, query, where, orderBy, getDocs } from "firebase/firestore";
import { db } from "./firebaseConfig";

async function getRiderTransactions(riderUID) {
  const q = query(
    collection(db, "transactions"),
    where("riderId", "==", riderUID),
    orderBy("createdAt", "desc")
  );
  
  const snap = await getDocs(q);
  return snap.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    createdAtDate: doc.data().createdAt?.toDate()
  }));
}
```

### Query 3: Calculate Dynamic "Today's Cash Collected"
Calculate how much cash the rider has collected during today's shift.
```javascript
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "./firebaseConfig";

async function getTodaysCashCollected(riderUID) {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0); // set to 12:00 AM

  const q = query(
    collection(db, "transactions"),
    where("riderId", "==", riderUID),
    where("type", "==", "cash_collection"),
    where("createdAt", ">=", startOfToday)
  );

  const snap = await getDocs(q);
  const total = snap.docs.reduce((sum, doc) => sum + (doc.data().amount || 0), 0);
  return total;
}
```

### Query 4: Calculate Dynamic Rider Rating Average
```javascript
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "./firebaseConfig";

async function getRiderAverageRating(riderUID) {
  const q = query(
    collection(db, "reviews"),
    where("rider.riderId", "==", riderUID)
  );

  const snap = await getDocs(q);
  if (snap.empty) return 5.0; // default rating if no reviews exist
  
  const totalRating = snap.docs.reduce((sum, doc) => sum + (doc.data().rating || 0), 0);
  return (totalRating / snap.docs.length).toFixed(1);
}
```

---

## 3. Recommended Admin Panel UI Mockup

To display these metrics in a premium design on the admin dashboard, we suggest a grid layout matching the rider app's HUD style:

### Rider Shift Summary Cards
```
+------------------------+------------------------+------------------------+
|   🔴 Live Duty Status   |   💵 Cash In Hand      |   🛵 Completed Today   |
|   ONLINE               |   ৳5,230               |   5 Orders             |
+------------------------+------------------------+------------------------+
|   ⭐ Average Rating    |   📈 Total Deliveries  |   💰 Today's Cash      |
|   4.8 ★ (12 Reviews)   |   124 Orders           |   ৳2,100               |
+------------------------+------------------------+------------------------+
```

### Transaction Ledger Table
Inside the rider's details page, render their ledger:
| Date / Time | Description | Type | Amount | Status |
| :--- | :--- | :--- | :--- | :--- |
| `01 Jun, 04:30 PM` | Order #1042 (Cash Collection) | `CREDIT` | `+৳420` | `COMPLETED` |
| `01 Jun, 11:20 AM` | Admin Balance Settlement | `DEBIT` | `-৳5,000` | `COMPLETED` |
