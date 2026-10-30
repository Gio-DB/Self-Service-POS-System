# Restaurant Self-Service POS System
## System Requirements Specification - MVP (Minimum Viable Product)

| Document control | Value |
|---|---|
| Status | Draft for stakeholder review |
| Version | 0.2 |
| System | Restaurant Self-Service POS System |
| Source baseline | `restaurant_pos_project_plan_en.md` |
| Requirements approach | Traceable and verifiable; structured using systems-engineering practices informed by ISO/IEC/IEEE 15288 |

This specification is a project-specific draft. Its structure is informed by systems-engineering practice; it does not assert certification or formal conformance to ISO/IEC/IEEE 15288. Requirement thresholds and policies not established by the source plan are recorded as TBDs rather than invented.

## 1. Purpose

This document defines the stakeholders, boundary, operational concept, constraints, assumptions, and verifiable MVP requirements for a self-hosted restaurant ordering and point-of-sale system. It is intended to support design, implementation, review, integration, and acceptance.

Each requirement has a unique identifier, one normative statement, a verification method, and an observable pass condition. Requirements are traceable to stakeholder needs and the source project plan. The document is a draft baseline until the open decisions in Section 12 are resolved and approved.

## 2. System overview

The system supports customer self-ordering at an in-restaurant kiosk, staff review and approval, kitchen order preparation, cash payment recording, menu administration, and basic sales reporting. The MVP operates on the restaurant's internal network. It comprises browser-based kiosk, kitchen display system (KDS), and administration/staff screens; one API application; and one authoritative PostgreSQL database.

The kiosk may temporarily queue orders in browser storage when the API cannot be reached. A queued order is not an accepted restaurant order until the server confirms receipt. Full offline operation of the restaurant is not included in this baseline.

## 3. Stakeholders and needs

| ID | Stakeholder | Need |
|---|---|---|
| SN-01 | Customer | Browse the menu, configure an order, submit it, and understand whether the restaurant has received it. |
| SN-02 | Waiter / cashier | Review, correct, approve, and track kiosk orders; enter fallback orders; record cash payments and cancellations. |
| SN-03 | Kitchen staff | Receive approved orders promptly, read their contents clearly, and update preparation status. |
| SN-04 | Restaurant administrator | Maintain menu data, manage staff accounts and roles, view reports, and control operational mode. |
| SN-05 | Restaurant operator | Operate the core system on the internal network, protect order integrity, and recover from equipment or software faults. |
| SN-06 | Maintainer / support staff | Diagnose system health and perform controlled maintenance without exposing normal operations to unauthorized remote access. |

## 4. System boundary and interfaces

### 4.1 Inside the system boundary

- Customer kiosk application and local pending-order queue.
- Staff interface for waiters/cashiers and kitchen staff.
- Administrator interface.
- One API application, including application logic and role-based access control.
- PostgreSQL database containing menu and order records.
- REST API and a WebSocket connection for live KDS updates.

### 4.2 External actors and systems

| External entity | Interface / interaction |
|---|---|
| Customer | Touchscreen browser UI on the kiosk |
| Waiter / cashier | Staff UI on a browser-capable device |
| Kitchen staff | KDS UI on a browser-capable display |
| Administrator | Admin UI on a browser-capable device |
| Restaurant LAN | Carries browser-to-API and API-to-database traffic |
| Remote support personnel | Optional access path, governed by the maintenance/out-of-order control; access mechanism is TBD |
| Backup destination | NAS or other approved backup target; target and transfer method are TBD |

Payment-provider services, mobile card readers, customer-facing online ordering, and electronic receipt providers are outside the MVP system boundary.

## 5. Operational concept

### 5.1 Normal order flow

1. The kiosk obtains the current menu from the API or its permitted local cache.
2. The customer selects menu items and takeaway or dine-in details; item modifications are added only by a waiter during review.
3. The kiosk submits the order. The server stores it with a unique ID and a review-required status.
4. A waiter reviews and, if necessary, edits the order before approving it.
5. After approval, the KDS receives and displays the order.
6. Kitchen staff update its preparation status; the current status is shown to staff and, where supported, the customer.
7. Under the assumed MVP business flow, after the customer receives the prepared food, the customer pays the waiter in cash and the waiter records payment.

### 5.2 Degraded operation

If the kiosk cannot reach the API, it stores a pending submission locally and clearly tells the customer that the restaurant has not received the order yet. The kiosk retries with the same order ID after connectivity returns. The server confirms receipt before the kiosk marks the entry as synced. The KDS only displays server-accepted, waiter-approved orders.

### 5.3 Operating modes

- **Running:** customer and staff functions are available according to role and connectivity.
- **Out of order / maintenance:** customer order submission is disabled; permitted staff maintenance functions may remain available.
- The exact remote-support activation, shutdown, and recovery procedures remain subject to the TBD register.

## 6. Assumptions, constraints, and exclusions

### 6.1 Assumptions requiring confirmation

- **A-01:** A waiter reviews and approves each kiosk order before it reaches the KDS.
- **A-02:** The customer pays the waiter in cash after receiving the prepared food.
- **A-03:** Offline kiosk submissions are queued but are not restaurant-accepted orders until acknowledged by the API.
- **A-04:** The initial deployment is for one restaurant site on its internal network.
- **A-05:** Prices are stored as integer minor units and displayed in euros (EUR); tax inclusion and rounding rules remain to be defined.

### 6.2 Design constraints from the current plan

- The MVP is self-hosted on the restaurant network; internet access is not required for normal ordering.
- The proposed implementation is one React web application, one Node.js/Express API application, and one PostgreSQL database.
- The designated Raspberry Pi system computer shall run Ubuntu and connect to the restaurant's internal Wi-Fi router. Ubuntu edition/version and Wi-Fi configuration are TBD.
- IndexedDB is the proposed browser-side store for pending kiosk orders; PostgreSQL is authoritative after order acceptance.
- REST is used for ordinary menu/order operations; WebSocket push is used for live KDS updates.
- The schema and API are kept small. Redis, multiple backend services, generalized workflow engines, and advanced conflict-resolution mechanisms are not required for the MVP.

These are current design constraints, not proof that the design has been validated against all deployment needs.

### 6.3 Exclusions and deferred capabilities

- Mobile payment readers and payment-provider integration, including PayPal.
- Customer ordering from a public online menu.
- Printed or digital/QR receipts.
- Multiple backend instances, Redis Pub/Sub, and cloud-hosted operation.
- Full order processing by staff while disconnected from the authoritative server.
- Promotions and discounts unless separately approved for MVP.
- Structured modifier pricing and allergen filtering are mentioned in the source plan but their business rules and data requirements are incomplete. They are not considered ready for acceptance until the TBDs are resolved.
- Until allergen data and handling rules are approved, the system must not claim that a menu item is safe for a particular allergen.

## 7. Requirement conventions and verification

### 7.1 Requirement quality

The word **shall** marks a mandatory requirement. Each requirement is intended to be singular, necessary, feasible, unambiguous, and verifiable. Rationale and design detail are kept outside the normative requirement sentence.

### 7.2 Verification methods

| Code | Method | Use |
|---|---|---|
| T | Test | Execute the system or component under stated conditions and record the result. |
| D | Demonstration | Operate the system to show the required behavior. |
| I | Inspection | Examine configuration, stored data, UI, logs, or implementation evidence. |
| A | Analysis | Evaluate calculations, measurements, or documented evidence against a criterion. |

For each verification, record the requirement ID, build/configuration, test conditions, observed result, evidence location, pass/fail, and defect reference if applicable.

### 7.3 Source traceability

The basis references in the requirements tables point to stakeholder needs (SN-xx) and the existing plan section (SP-xx). SP references map to headings in `restaurant_pos_project_plan_en.md`:

| Source reference | Existing plan section |
|---|---|
| SP-1 | Project Goal & Scope |
| SP-2 | Hardware |
| SP-3 | Key Points |
| SP-4 | General Capability |
| SP-5 | Concept of Operation and Failure Cases |
| SP-6 | Operational Concept, Roles, Maintenance, Monitoring |
| SP-7 | Software Architecture, Data Model, API, Offline Queue |
| SP-8 | Recommended Tech Stack |

## 8. System requirements

### 8.1 Order lifecycle and staff workflow

| ID | Requirement | Verification / pass condition | Trace |
|---|---|---|---|
| SYS-F-001 | The system shall allow a customer to create an order containing one or more menu items and a selected order type of takeaway or dine-in. | T: A submitted order contains the selected items and exactly one supported order type. | SN-01; SP-4, SP-5 |
| SYS-F-002 | The system shall assign each newly created order a unique identifier before its first submission attempt. | T: Two distinct orders receive different IDs; a retry of one order reuses its original ID. | SN-01, SN-05; SP-3, SP-7 |
| SYS-F-003 | The system shall store the submitted order and all its order lines atomically. | T: Force a storage failure during submission; no partial order or orphan order line remains. | SN-02, SN-05; SP-7 |
| SYS-F-004 | The system shall place a server-received kiosk order in a review-required state until a waiter approves or cancels it. | T: Create an order and inspect status; it is not sent to the KDS before approval. | SN-02, SN-03; SP-5 |
| SYS-F-005 | The system shall allow only an authorized waiter to change quantities and add, change, or remove per-item modification notes on a review-required order before approving it. | T/D: Edit an order as waiter and verify saved quantities and notes. Attempt the same change as a customer, kitchen user, or administrator; each attempt is denied. | SN-02, SN-05; SP-5, SP-6 |
| SYS-F-006 | The system shall send an order to the KDS only after the waiter approves it. | T: Observe the KDS before and after approval; the order appears only after approval. | SN-02, SN-03; SP-5 |
| SYS-F-007 | The system shall allow authorized staff to create a manual order as a fallback to kiosk entry. | D: Create a manual order and verify it appears in the staff order list with its items and type. | SN-02; SP-4 |
| SYS-F-008 | The system shall allow authorized staff to cancel an order and record the cancellation status. | T: Cancel an eligible order; verify its status and that it is not presented as an active order. | SN-02; SP-6 |
| SYS-F-009 | The system shall maintain an order lifecycle status that distinguishes review-required, accepted, preparing, ready, and cancelled orders. | I/T: Inspect the stored and displayed statuses; each lifecycle state is represented distinctly. | SN-02, SN-03; SP-5, SP-7 |
| SYS-F-010 | The system shall allow the waiter to record a cash payment against an order. | D: Record cash payment; verify the order is marked paid and payment time is recorded. | SN-02; SP-4, SP-5 |
| SYS-F-011 | The system shall provide staff with a daily sales summary derived from recorded orders and payments. | T: Load known test orders and payments; report totals match an independently calculated result. | SN-04; SP-4, SP-7 |
| SYS-F-012 | The system shall allow an administrator to enable and disable out-of-order mode. | D: Toggle the mode as an authorized administrator and verify the active state is shown. | SN-04; SP-1, SP-4 |
| SYS-F-013 | The system shall record the cash tendered and calculate and display the change due when a waiter records a cash payment. | T: Use known order totals and tender amounts; the recorded tender and displayed change match the inputs and calculation, and insufficient tender is rejected. | SN-02; SP-4 |
| SYS-F-014 | The waiter shall enter cash tendered using an on-screen numeric keypad opened from the cash-payment action. | D/T: Open cash entry for a ready, unpaid order; enter digits and a decimal amount; verify the displayed amount and payment use the same value. Verify clear, backspace, cancel, and invalid/insufficient tender behavior. | SN-02; SP-4 |
| SYS-F-015 | The waiter interface shall display orders in sorted Awaiting review, Active orders, Paid orders, and Archive sections. | T: Create current-day and prior-day orders in each relevant state. Verify current pending, unpaid active, and paid orders are in the named sections; prior-day orders are in Archive; each section uses its specified ordering. | SN-02; SP-5, SP-6 |
| SYS-F-016 | The system shall assign each newly stored order a consecutive reference from 00001 through 99999 for its restaurant business date, resetting to 00001 at local midnight in `RESTAURANT_TIME_ZONE`; a repeated request with the same UUID shall retain its original reference, and orders later canceled shall keep their assigned reference. | T: Create orders around a configured local midnight, retry an identical UUID, cancel an order, and verify dates, references, and no duplicate allocation. Verify order 99,999 succeeds and the next new order is rejected with a clear error until the next business date. | SN-01, SN-02, SN-03, SN-05; SP-3, SP-5, SP-7 |
| SYS-F-017 | The waiter interface shall display the five-digit order reference for each order while retaining the UUID as the system's unique identifier. | I/T: Inspect waiter cards and verify the displayed reference is zero-padded and corresponds to the stored order reference. | SN-02; SP-4, SP-7 |

For SYS-F-015, the configured restaurant timezone determines the current business day. Orders created before that day start are in Archive regardless of later status or payment. Current-day pending orders are Awaiting review; current-day unpaid accepted, preparing, and ready orders are Active; and current-day paid orders are Paid. Awaiting review and Active are oldest first, Paid is newest paid first, and Archive is newest created first. Current-day cancelled orders are not shown.

### 8.2 Menu and kiosk

| ID | Requirement | Verification / pass condition | Trace |
|---|---|---|---|
| KSK-F-001 | The kiosk shall display available menu items with their names and prices. | T: Configure available and unavailable items; only available items appear with their configured prices. | SN-01; SP-4 |
| KSK-F-002 | The kiosk shall group menu items by their configured category. | T: Configure items in two categories and verify grouping and labels. | SN-01; SP-4 |
| KSK-F-003 | The kiosk shall allow the customer to add items to, remove items from, and review the current order before submission. | D: Perform each action; the displayed order matches the resulting selection. | SN-01; SP-4, SP-5 |
| KSK-F-004 | The kiosk shall show the order type selection and retain the customer's selected type with the submitted order. | T: Submit one takeaway and one dine-in order and inspect stored values. | SN-01; SP-4, SP-5 |
| KSK-F-005 | The kiosk shall prevent submission of an order with no order lines. | T: Attempt an empty submission; no order is created and the kiosk explains that an item is required. | SN-01; SP-5 |
| KSK-F-006 | The kiosk shall display a clear submission result that distinguishes server-confirmed receipt from a locally queued, not-yet-received order. | T: Submit once with API connectivity and once without; the two outcomes are distinguishable. | SN-01, SN-05; SP-3, SP-5 |
| KSK-F-007 | The kiosk shall display the current menu availability state received from the API and shall not permit selection of an item marked unavailable. | T: Mark an item unavailable in the admin/API; after the kiosk receives the update, it is unavailable for selection. | SN-01, SN-04; SP-3, SP-4 |
| KSK-F-008 | The kiosk shall display the total calculated from the selected item prices and configured options before submission. | T: Compare displayed total with an independent calculation using configured price data. | SN-01; SP-4 |
| KSK-F-009 | The kiosk shall display configured item images when image data is provided. | I/D: Configure an image for a menu item and verify it is displayed; verify an item without an image remains usable. | SN-01; SP-4 |
| KSK-F-010 | The kiosk shall provide a way to return to a clean ordering state after an order is submitted or abandoned. | D: Complete or abandon an order and verify the next customer cannot see or modify the prior cart. | SN-01, SN-05; SP-4 |
| KSK-F-011 | The kiosk shall not offer or submit per-item modification notes; only a waiter may record such notes during review. | T/I: Inspect the kiosk and submit a request containing an item note; the kiosk offers no note field and the server rejects the supplied note. | SN-01, SN-02, SN-05; SP-4, SP-7 |
| KSK-F-012 | Before submitting an order, the kiosk shall display a confirmation dialog summarizing the order type, name or table number when supplied, items, quantities, and total; the customer shall be able to confirm submission or return to edit the order. | D/T: Select items and an order type; verify the summary matches the basket. Confirm and verify exactly one order is submitted. Return to editing and verify the basket and name/table value remain unchanged and no order is submitted. | SN-01; SP-4, SP-5 |
| KSK-F-013 | The kiosk shall provide an optional field labeled “Your name or table number” with the placeholder “Optional” for both takeaway and dine-in orders and retain its value with the submitted order. | D/T: Verify the field label and placeholder for both order types; submit each with and without a value and verify the stored and confirmed values. | SN-01; SP-4, SP-5 |

The source plan mentions modifiers and allergen filters, but does not define modifier pricing, allergen data ownership, or cross-contamination semantics. These functions are subject to TBD-06 and TBD-07 and are not represented as accepted MVP capabilities in this draft.

### 8.3 Food safety information

| ID | Requirement | Verification / pass condition | Trace |
|---|---|---|---|
| SAF-001 | Until allergen data and handling rules are approved, the system shall not present a menu item as safe for a particular allergen. | I/T: With no approved allergen dataset configured, inspect the kiosk and menu API; neither presents an allergen-safe claim or filter result. | SN-01; SP-4, SP-7 |

### 8.4 Kitchen display

| ID | Requirement | Verification / pass condition | Trace |
|---|---|---|---|
| KDS-F-001 | The KDS shall display orders approved by a waiter and not display unapproved kiosk orders as kitchen work. | T: Compare KDS contents before and after approval. | SN-03; SP-4, SP-5 |
| KDS-F-002 | The KDS shall show each active order's identifier, arrival time, order type, items, quantities, and item notes. | I/T: Create an order with known values and verify each value is visible. | SN-03; SP-4, SP-7 |
| KDS-F-003 | The KDS shall display the table number when one is supplied for a dine-in order. | T: Submit dine-in orders with and without a table number; display the value when provided. | SN-03; SP-4 |
| KDS-F-004 | The KDS shall order each current-day operational section by the time the server accepted the order, earliest first. | T: Submit orders in a known sequence and verify ordering within Approved orders, Preparing, and Completed. | SN-03; SP-4 |
| KDS-F-005 | The KDS shall allow kitchen staff to update an order to preparing and ready. | D: Update an order through both states; verify each state is stored and displayed. | SN-03; SP-4, SP-5 |
| KDS-F-006 | The system shall make a kitchen status update visible to connected staff clients after the server accepts the update. | T: Change status on one client and verify a second connected client receives the new status. | SN-02, SN-03; SP-3, SP-5 |
| KDS-F-007 | The KDS shall provide an audible indication when a newly approved order is received, subject to the display device supporting audio. | D: Approve an order while the KDS is active and verify the configured alert is produced. | SN-03; SP-4 |
| KDS-F-008 | The KDS shall allow the user to filter orders by configured kitchen station when station assignments are configured. | T: Configure orders for two stations and verify each filter result. | SN-03; SP-4 |
| KDS-F-009 | The KDS shall render order-line notes in red and distinguish them from item names and quantities using a non-color visual cue. | I/D: View an order containing a note and verify red text and an additional visual distinction from the item name and quantity. | SN-03; SP-4 |
| KDS-F-010 | The KDS shall present all active approved orders in one continuous queue without pagination, allowing scrolling when the queue exceeds the viewport. | T: Load more active orders than fit on the screen; verify every order is reachable in the same KDS view without a page control, and each ticket's information is not clipped. | SN-03; SP-4 |
| KDS-F-011 | The KDS shall display approved kitchen orders in sorted Approved orders, Preparing, Completed, and Archive sections. | T: Create current-day orders in each kitchen state and older approved orders. Verify the current orders appear in their matching section, older approved orders appear in Archive, and unapproved/cancelled orders are absent. | SN-03; SP-4, SP-5 |
| KDS-F-012 | The KDS shall display the five-digit daily order reference on each order ticket. | I/T: Inspect tickets for sequential orders, including references with leading zeroes, and verify each matches the stored reference. | SN-03; SP-4, SP-7 |

For KDS-F-011, Approved orders, Preparing, and Completed correspond respectively to the accepted, preparing, and ready lifecycle statuses. Current-day operational sections are oldest approved first; Archive is newest created first. An archived accepted or preparing order remains actionable so work is not stranded at the business-day boundary.

### 8.5 Staff, administration, and authorization

| ID | Requirement | Verification / pass condition | Trace |
|---|---|---|---|
| ADM-F-001 | The system shall allow an authorized administrator to create and update menu categories and menu items. | D: Create and edit test menu records; verify saved values appear in the menu API/UI. | SN-04; SP-4, SP-7 |
| ADM-F-002 | The system shall allow an authorized administrator to change an item's availability without deleting its historical order data. | T: Mark an item unavailable and verify it is hidden from new kiosk orders while past order lines remain readable. | SN-04, SN-05; SP-3, SP-7 |
| ADM-F-003 | The system shall restrict menu and user administration functions to an authenticated administrator role. | T: Attempt each restricted action as anonymous, kitchen, waiter, and admin users; only admin actions succeed. | SN-04, SN-05; SP-4, SP-6 |
| ADM-F-004 | The system shall restrict kitchen users to viewing kitchen orders and changing permitted kitchen statuses. | T: Attempt menu, payment, and user-management actions as kitchen; each is denied. | SN-03, SN-05; SP-6 |
| ADM-F-005 | The system shall restrict waiter/cashier users to order review, permitted order changes, cash-payment recording, and cancellation functions. | T: Attempt representative permitted and prohibited actions using the waiter/cashier role. | SN-02, SN-05; SP-6 |
| ADM-F-006 | The system shall allow administrators to create, disable, and assign a role to staff accounts. | D: Create, change role, and disable test accounts; verify access changes accordingly. | SN-04, SN-05; SP-4 |
| ADM-F-007 | The system shall identify its current operating mode to staff and prevent customers from starting an order while out-of-order mode is active. | T: Enable the mode and attempt kiosk ordering; ordering is blocked and staff can see the mode. | SN-01, SN-04; SP-1, SP-4 |
| ADM-F-008 | The system shall expose a health-check endpoint that reports whether the API can serve requests and reach its required database. | T: Call `GET /health` in healthy and database-unavailable conditions; response distinguishes the conditions. | SN-05, SN-06; SP-6 |

The current demo baseline uses configured shared role PINs with signed, HTTP-only sessions that expire after eight hours by default. A shared PIN establishes the role, not an individual staff identity; individual-account lifecycle, recovery, and attributable audit logging remain deferred in TBD-04.

### 8.6 Platform and network

| ID | Requirement | Verification / pass condition | Trace |
|---|---|---|---|
| PLT-001 | The designated Raspberry Pi system computer shall run Ubuntu as its operating system. | I: Inspect the Raspberry Pi's operating-system identification and verify that it reports Ubuntu. | SN-05, SN-06; SP-2 |
| PLT-002 | The designated Raspberry Pi system computer shall connect to the restaurant's internal Wi-Fi router. | T: Verify the Pi is associated with the configured router and can communicate with the system's required internal-network services. | SN-05; SP-1, SP-2 |

The Ubuntu release/edition and Wi-Fi credentials, security mode, and network configuration must be selected before deployment; see TBD-17 and TBD-18.

## 9. External interface and data requirements

| ID | Requirement | Verification / pass condition | Trace |
|---|---|---|---|
| IF-001 | The system shall expose REST operations for menu retrieval, menu administration, customer order creation, staff-session management, role-specific order-board retrieval, order status changes, waiter order edits, cash-payment recording, and daily reporting. | T: Exercise each documented operation and verify the specified success response and resulting state. | SN-02, SN-04; SP-7 |
| IF-002 | The system shall publish a KDS WebSocket update when a waiter approves an order and when an order status changes. | T: Observe the KDS connection for the two events and verify event data matches server state. | SN-03; SP-3, SP-7 |
| IF-003 | The system shall store each order and its order lines in one database transaction. | T: Cause a transaction failure and verify the order and all its lines are either committed together or not committed. | SN-05; SP-7 |
| IF-004 | The system shall retain the item name and unit price charged on each order line as order-time snapshots. | T: Change a menu item's name and price after an order; verify the historical order values do not change. | SN-02, SN-05; SP-7 |
| IF-005 | The system shall represent monetary values as integer minor units in persistent order and menu records. | I/T: Inspect schema and round-trip representative values; no binary floating-point amount is persisted. | SN-05; SP-7 |
| IF-006 | The system shall display all menu prices, order amounts, and sales totals in euros (EUR), storing monetary values as integer euro cents. | I/T: Verify that customer-facing prices, order totals, and reports display EUR and that persisted monetary values are integer euro cents. | SN-01, SN-04, SN-05; SP-4, SP-7 |
| IF-007 | The system shall treat a repeated order-creation request with the same order identifier and identical payload as the same order, and shall reject a request with that identifier but a different payload without changing the existing order. | T: Repeat an identical request, then submit a changed payload with the same ID; only one unchanged order exists and the changed request is rejected. | SN-01, SN-05; SP-3, SP-7 |
| IF-008 | The system shall not accept client-supplied totals as authoritative; it shall calculate the order total from server-side menu prices and configured options. | T: Submit a request with an altered total; the stored total is calculated from trusted prices or the request is rejected. | SN-02, SN-05; SP-4, SP-7 |
| IF-009 | The system shall store a daily order reference separately from the UUID, associate it with the restaurant business date, and enforce uniqueness of the reference within that date. | I/T: Inspect the schema and create concurrent orders; verify the UUID remains unique, references are unique per business date, and each committed order receives one reference atomically. | SN-01, SN-02, SN-03, SN-05; SP-3, SP-7 |

EUR is the required operating currency. TBD-05 remains open only for tax inclusion/calculation, rounding rules, and price display details; those decisions do not change the EUR currency requirement.

## 10. Quality, performance, and operating requirements

| ID | Requirement | Verification / pass condition | Trace |
|---|---|---|---|
| QLT-P-001 | While the API and KDS are connected on the restaurant LAN, the system shall display an approved order on the KDS less than 1.0 second after the server records waiter approval. | T/A: Measure server approval time and KDS display time over the agreed test configuration; each measured approval-to-display interval is less than 1.0 second. | SN-03; SP-3 |
| QLT-P-002 | The system shall display a current menu item as unavailable at the kiosk after the kiosk receives the corresponding availability update from the API. | T: Change availability and verify the kiosk no longer permits selection after update receipt. The allowable update propagation time is TBD-03. | SN-01, SN-04; SP-3 |
| QLT-R-001 | The system shall use the same order identifier for every retry of a locally queued order. | T: Interrupt the API during submission, restore connectivity, and verify retries reuse the stored identifier. | SN-01, SN-05; SP-3, SP-5 |
| QLT-R-002 | The kiosk shall retain a locally queued order across a browser reload and kiosk application restart until the server acknowledges it or an authorized staff member resolves it. | T: Queue an order, restart/reload, and verify the order remains pending. | SN-01, SN-05; SP-3, SP-7 |
| QLT-R-003 | The system shall not mark a queued order as synced until the API confirms durable receipt. | T: Simulate no response, failed response, and success response; only the success response changes the local state to synced. | SN-01, SN-05; SP-3, SP-5 |
| QLT-U-001 | The kiosk shall provide visible feedback for menu loading, order submission, submission failure, pending synchronization, and server-confirmed receipt. | D: Trigger each state and verify distinct, understandable feedback. | SN-01; SP-3, SP-4 |
| QLT-U-002 | The kiosk and KDS shall present order content in a readable layout on the selected deployment displays. | I/D: Review the target hardware at the agreed viewing distance and confirm text, prices, status, and order details are legible. Contrast criteria and the agreed viewing distance are TBD-08; KDS font-size minimums are specified in QLT-U-003. | SN-01, SN-03; SP-2, SP-3, SP-4 |
| QLT-U-003 | The KDS shall render order identifiers, order type, table number, status, item names, and quantities at no less than 22 CSS pixels, and arrival times, item notes, amounts, and action labels at no less than 18 CSS pixels. | I/T: Inspect computed styles at desktop and narrow viewport widths; verify the stated minimum sizes and confirm the content remains legible at the agreed viewing distance on the selected KDS display (TBD-08). | SN-03; SP-2, SP-3, SP-4 |
| QLT-U-004 | The waiter interface shall keep each order-line price aligned in a consistent right-hand column when an order contains a modification note. | I/T: Compare waiter order lines with and without notes at supported widths; verify prices remain right-aligned and notes appear below item names without moving the price column. | SN-02; SP-4 |
| QLT-O-001 | The normal order, menu, and KDS functions shall operate on the restaurant LAN without requiring general internet connectivity. | T: Block internet access while preserving LAN connectivity and verify the normal connected workflow. | SN-05; SP-1, SP-3, SP-7 |
| QLT-O-002 | The system shall prevent new customer submissions while out-of-order mode is active. | T: Activate the mode and verify the kiosk blocks submission and gives a maintenance message. | SN-01, SN-04; SP-1, SP-4 |
| QLT-M-001 | The MVP shall deploy the kiosk, KDS, and admin experiences from one web application and serve their data from one API application and one authoritative PostgreSQL database. | I: Inspect deployment configuration and verify the deployed component count and database source of truth. | SN-05, SN-06; SP-7, SP-8 |
| QLT-M-002 | The system shall provide a documented procedure to create a database backup and restore it to a test environment. | D: Follow the procedure and verify the restored test database contains the selected backup's menu and order records. Backup frequency and recovery objectives are TBD-09. | SN-05, SN-06; SP-6 |

## 11. Security, privacy, and maintenance requirements

| ID | Requirement | Verification / pass condition | Trace |
|---|---|---|---|
| SEC-001 | The system shall require a configured staff-role credential before granting access to staff-only functions. | T: Attempt staff access without authentication and with each valid shared role PIN; unauthenticated access is denied and each successful session has only its configured role. | SN-02, SN-03, SN-04; SP-6 |
| SEC-002 | The system shall enforce the role-specific permissions defined in ADM-F-003 through ADM-F-006 on the server, not only in the user interface. | T: Send direct API requests as each test role; unauthorized operations are rejected and do not change data. | SN-05; SP-6 |
| SEC-003 | The system shall not expose customer order data or staff functions through an internet-facing endpoint during normal operation. | I/T: Inspect deployment/network configuration and test from an external network under normal mode; no such access is available. | SN-05, SN-06; SP-1, SP-6 |
| SEC-004 | The system shall permit remote support access only when the authorized maintenance/out-of-order procedure is active. | T/I: Test support access before, during, and after activation; access is unavailable outside the active procedure. Exact control mechanism is TBD-10. | SN-05, SN-06; SP-1, SP-6 |
| SEC-005 | The system shall record order creation, approval, status changes, cancellation, and payment recording with timestamps and the responsible staff identity when performed by staff. | T: Perform each action and verify the resulting record identifies the action, time, and actor. Audit-log format and retention are TBD-11. | SN-02, SN-04, SN-05; SP-5, SP-6 |
| OPS-001 | The system shall provide an administrator-visible way to identify whether the API, database connection, and KDS update channel are operational. | D: Disable each dependency in a test environment and verify its health state is distinguishable. | SN-04, SN-06; SP-6 |
| OPS-002 | The system shall document the supported installation, update, backup, restore, and out-of-order procedures before operational acceptance. | I: Review the operations package against all five procedures; each procedure is present and review-approved. | SN-05, SN-06; SP-6 |
| OPS-003 | The system shall preserve accepted orders and their payment/status history across a normal application restart. | T: Create and update test orders, restart the application, and verify the stored state is unchanged. | SN-02, SN-05; SP-5, SP-7 |

The security requirements establish minimum access behavior; they do not prescribe a security standard, encryption policy, vulnerability-management process, or retention period. These require stakeholder decisions in Section 12.

The shared role-PIN baseline does not satisfy the individual staff-identity attribution in SEC-005; that requirement remains a deferred production capability under TBD-04.

## 12. Open decisions and TBD register

Each TBD must be assigned to an owner, resolved, and approved before the affected requirements are baselined. Where a TBD blocks safe operation or acceptance, the affected capability must not be declared accepted until resolved.

| ID | Decision required | Affected requirement(s) | Suggested decision owner |
|---|---|---|---|
| TBD-01 | Confirm the waiter-review/approval flow and whether every kiosk order requires approval. | A-01; SYS-F-004 to SYS-F-006; KDS-F-001 | Restaurant owner / operations |
| TBD-02 | Confirm payment timing and whether MVP supports cash only; define tender/change recording, refunds/voids, and required payment-history fields. | A-02; SYS-F-010, SYS-F-013; payment status API and schema | Restaurant owner / finance |
| TBD-03 | Set acceptable menu update propagation latency and behavior when the kiosk has a stale cached menu. | KSK-F-007; QLT-P-002 | Product owner / operations |
| TBD-04 | Replace the shared role-PIN demo baseline with individual-account lifecycle, account recovery, credential policy, and attributable audit logging. | ADM-F-003 to ADM-F-006; SEC-001, SEC-002, SEC-005 | Product owner / security lead |
| TBD-05 | Define tax inclusion/calculation rules, rounding rules, and price display format for EUR prices. | KSK-F-008; IF-005, IF-006, IF-008; SYS-F-011 | Restaurant owner / finance |
| TBD-06 | Decide whether configurable modifiers are in MVP; define modifier choices, price impacts, selection limits, and historical capture. | KSK-F-003, KSK-F-008; order schema | Product owner / menu owner |
| TBD-07 | Decide whether allergen filtering is in MVP; define authoritative allergen data, filter behavior, warnings, and cross-contamination wording. | KSK menu requirements; menu schema and UI | Restaurant owner / food-safety lead |
| TBD-08 | Set accessibility target, contrast/text criteria, supported languages, and supported display/input hardware. | QLT-U-002; kiosk/KDS presentation | Product owner / accessibility owner |
| TBD-09 | Define expected order volume/concurrency, availability target, backup frequency/location, retention, recovery point/time objectives, and restore test cadence. Resolve overlap between the existing daily and weekly backup notes. | QLT-M-002; system capacity and operations | Restaurant owner / operations |
| TBD-10 | Define remote-support access path, authorization, audit evidence, activation, duration, and deactivation controls. | SEC-003, SEC-004; maintenance procedure | Restaurant owner / security lead |
| TBD-11 | Define audit-log retention, privacy/data retention, deletion, and access rules. | SEC-005; reporting and backup | Restaurant owner / privacy owner |
| TBD-12 | Define allowable response times for kiosk menu/cart/order operations, health checks, and status updates other than the stated 1.0-second KDS target; also define the KDS target test load, sample count, hardware, and network conditions. | QLT-P-001; IF-001, IF-002 | Product owner / technical lead |
| TBD-13 | Confirm whether waiter edits to an order require customer acknowledgement or re-confirmation before approval, and how the revised total is communicated. | SYS-F-005, KSK-F-008 | Restaurant owner / operations |
| TBD-14 | Define the exact out-of-order mode permissions, local behavior when the API/database is unavailable, and re-entry criteria after maintenance. | SYS-F-012; ADM-F-007; QLT-O-002; SEC-004 | Restaurant owner / operations |
| TBD-15 | Confirm whether promotions/discounts and kitchen station assignments are in or out of MVP and define their rules if included. | SYS-F-011; KDS-F-008; schema/API | Product owner / restaurant owner |
| TBD-16 | Define minimum production security controls for internal-network traffic, secret storage, software/dependency updates, incident response, and security testing. | SEC-001 to SEC-004; deployment and operations | Restaurant owner / security lead |
| TBD-17 | Select the Ubuntu edition and supported release for the Raspberry Pi system computer. | PLT-001; installation and update procedures | Technical lead / operations |
| TBD-18 | Specify the internal Wi-Fi router/SSID, authentication and security mode, addressing method, and required LAN services for the Raspberry Pi. | PLT-002; QLT-O-001; deployment configuration | Network administrator / operations |

## 13. Verification, validation, and acceptance

### 13.1 Verification

Verification asks whether each requirement was implemented as specified. The method and pass condition in each requirement row define the minimum evidence. Test results should identify the software version, database migration, browser/device, network condition, test data, and observed result.

### 13.2 Validation

Validation asks whether the system supports the restaurant's actual operations. Conduct stakeholder walkthroughs of the normal order flow, waiter correction/approval, kitchen status updates, cash payment recording, menu availability changes, outage queueing, restore procedure, and maintenance mode. Record stakeholder approval and issues against the affected requirement IDs.

### 13.3 MVP acceptance gates

The MVP is acceptable for a controlled restaurant pilot only when:

1. All approved, in-scope requirements have passed their stated verification.
2. No unresolved TBD that affects payment correctness, order acceptance, access control, food-allergen claims, backup/recovery, or remote access is being treated as an implemented capability.
3. The end-to-end connected order flow and offline queued-order behavior have passed on the target deployment hardware/network.
4. The authorized restaurant stakeholders have accepted the operational procedures and the open assumptions in Section 6.
5. Any requirement not included in the pilot is explicitly marked deferred, with the corresponding capability disabled or clearly unavailable.

## 14. Traceability and change control

Maintain a requirements-to-design-to-test traceability matrix with, at minimum, these columns:

| Requirement ID | Stakeholder need | Source-plan section | Design element | Verification case/evidence | Status |
|---|---|---|---|---|---|
| Example: SYS-F-006 | SN-02, SN-03 | SP-5 | Order approval/API/KDS event | Test case ID and result | Draft |

Every implementation task and verification case should reference one or more requirement IDs. A proposed change should identify affected requirements, interfaces, schema, tests, and operational procedures before approval. Do not silently relax a requirement; revise its text, rationale, and verification condition through review.

## 15. Baseline and readiness

This draft requires review by the restaurant owner, operations/waiter representative, kitchen representative, administrator, and technical lead. Resolve or explicitly defer the applicable TBDs, approve the assumptions, and set a versioned requirements baseline before implementation acceptance. The requirement IDs are stable references for review and change tracking; draft wording may change before baseline approval.
