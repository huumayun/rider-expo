# Graam Rider Native - Feature Implementation Note

This document tracks the native features and architectural decisions implemented in the Graam Rider application (Expo/React Native).

## 🚀 Core Architecture
- **Framework**: Expo SDK 52 (SDK 52.0.0)
- **Language**: TypeScript (Strict Mode)
- **Routing**: Expo Router v4 (File-based navigation)
- **Styling**: NativeWind (Tailwind CSS for React Native)
- **State Management**: 
    - **Zustand**: Global state for Auth and Orders.
    - **Context API**: specialized contexts for App Theme/Language, Real-time Location, and Rider Metadata.
- **Local Storage**: `react-native-mmkv` for high-performance persistence and `AsyncStorage`.

## 📱 Native Features Implemented

### 1. Real-time Location & Tracking
- **Foreground Tracking**: Uses `expo-location` to monitor rider coordinates during duty.
- **Background Tracking**: Implemented via `expo-task-manager` and `expo-location` to ensure tracking continues when the app is minimized or the screen is off.
- **Geo-fencing**: Logic for verifying "Arrived at Branch" and "Arrived at Customer" based on GPS proximity.

### 2. Map View & Navigation System
- **Engine**: `react-native-maps` using the Google Maps renderer for optimal performance on Android and iOS.
- **Marker System**:
    - **Rider Marker**: An animated marker tracking the `livePos` from `LocationContext`, featuring a custom truck/car icon and orientation support.
    - **Intelligent Branch Markers**: Circular, premium-styled markers that display branch identifiers. These are rendered using the `globalBranchCache` to ensure they appear instantly without waiting for Firestore lookups.
    - **Destination Markers**: Dynamic markers that appear for the specific customer location or pickup branch depending on the active order step.
- **Dynamic Routing (Polyline)**:
    - Automatically calculates and draws a `Polyline` between the rider's current coordinates and the next target destination.
    - The target location switches contextually: **Branch** (if status is `accepted`/`arrived_at_branch`) or **Customer** (if status is `picked`/`arrived_at_customer`).
- **Camera & Interaction Logic**:
    - **Auto-Animate**: The map smoothly pans and zooms (`animateToRegion`) to the target location when a rider selects an order from the bottom queue.
    - **Theme Synchronization**: Map styles (standard vs. dark) are dynamically updated to match the application's `T` (theme) token.
    - **Interactive Overlays**: Custom UI controls for centering on the rider, toggling map settings, and hiding/showing the order queue cards.

### 3. Order Execution State Machine
- **Full Operational Flow**:
    - `accepted`: Initial state after receiving an order.
    - `arrived_at_branch`: Verified via GPS proximity.
    - `picked`: confirmed after branch handover.
    - `arrived_at_customer`: Verified via GPS proximity.
    - `delivered`: Final completion state.
    - `returning_to_branch`: Handles order returns with reason logging.
- **Batching**: Automatic grouping of multiple orders (Batches) for optimized delivery routes.

### 4. Communication & Notifications
- **Real-time Chat**: Fully integrated chat system using Firebase Realtime Database/Firestore.
- **Push Notifications**: `expo-notifications` integrated with Firebase Cloud Messaging (FCM).
- **System Alerts**: Vibration and Haptic feedback (`expo-haptics`) for new order alerts and status changes.

### 5. Media & Storage
- **Camera Access**: `expo-camera` for delivery proof/QR scanning (if needed).
- **Image Picker**: `expo-image-picker` for selecting and uploading profile/delivery photos.
- **Firebase Storage**: Automated upload pipeline with compression.

### 7. Authentication & Security
- **Firebase Auth**: Integrated phone and email authentication.
- **Session Persistence**: Managed via `react-native-mmkv` for sub-millisecond data retrieval.
- **Protected Routes**: Middleware in `_layout.tsx` ensures only authenticated riders access the `(app)` group.
- **Duty Logic**: Session-based duty status (`online`/`offline`) tied to real-time location reporting.

### 8. Firebase Infrastructure Details
- **Firestore**: Optimized with real-time listeners for the order queue and notifications to ensure zero-latency UI updates.
- **Realtime Database (RTDB)**: Specifically utilized for the **Chat System** to handle high-frequency message synchronization between rider and customer.
- **Cloud Storage**: Structured storage for:
    - `/profiles`: Rider identity photos.
    - `/proofs`: Delivery completion images.
    - `/chats`: Multimedia shared during delivery.
- **Caching Layer**: Custom `firebaseCache.ts` utility implementing a TTL (Time-To-Live) mechanism to reduce document read costs.

### 9. UI/UX & Design System
- **Theme Engine**: Centralized `T` token system in `AppContext` supporting dynamic switching between premium Dark and Light modes.
- **Typography**: Responsive font scaling for Bengali scripts using `Hind Siliguri`.
- **Animated Components**: 
    - `react-native-reanimated` for smooth transitions in Order Execution cards.
    - `expo-haptics` for tactile feedback on critical actions (Accepting orders, error alerts).
- **Custom Modals**: Specialized bottom-sheet style modals for Cancelation, Delivery Confirmation, and Order Details.

## 🛠️ Performance Optimizations
- **Global Branch Cache**: Stores branch coordinates in memory to prevent redundant Firestore queries when rendering the map.
- **Image Pipeline**: Integrated `expo-image-manipulator` to compress images before Firebase upload, saving user bandwidth.
- **Path Aliasing**: Configured `tsconfig.json` with `@/*` mapping for cleaner, more maintainable imports.
- **Asset Preloading**: Essential fonts and assets are pre-loaded in the root layout to prevent "Flash of Unstyled Content" (FOUC).

## 📁 Feature-to-File Mapping

| Feature | Primary Source Files |
| :--- | :--- |
| **Map & Navigation** | `src/components/map/RouteOverviewMap.tsx` |
| **Order State Machine** | `app/(app)/order-execution.tsx`, `src/pages/Order/OrderExecution.tsx` |
| **Active Order UI** | `src/components/order/ActiveOrderCard.tsx`, `src/components/OrderCard.tsx` |
| **Real-time Chat** | `src/components/chat/ChatWindow.tsx`, `app/(app)/chat.tsx` |
| **Location Tracking** | `src/context/LocationContext.tsx`, `src/services/locationService.ts` |
| **Attendance (Duty)** | `src/pages/Attendance/AttendancePage.tsx` |
| **Wallet & Earnings** | `src/pages/Home/WalletPage.tsx` |
| **Notifications** | `src/pages/Notifications/NotificationsPage.tsx` |
| **Auth & Sessions** | `src/store/authStore.ts`, `app/(auth)/login.tsx` |
| **Firebase Services** | `src/config/firebase.ts`, `src/utils/firebaseCache.ts` |
| **Theme & Language** | `src/context/AppContext.tsx`, `src/constants/translations.ts` |
| **Order Popups** | `src/components/modals/OrderPopup.tsx` |

---
*Last Updated: 2026-05-07*
*Note: This file should be updated whenever a new native module or significant architectural change is introduced.*
