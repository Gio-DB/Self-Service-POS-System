# Notes for next releases

Please add or review the following requirements in the document. Afterwards, please implement these requirements in the Restaurant Self-Service POS System:

- Waiter UI – new section: The waiter interface shall display a new section called “Served orders to customer”, in addition to the existing sections.
- Waiter UI – rename section: The section “Active orders” shall be renamed to “Active orders being prepared in KDS”.
- Waiter UI – section order: The waiter interface sections shall be sorted as follows, which also represents the process flow:
  1. Awaiting review
  2. Active orders being prepared in KDS
  3. Served orders to customer
  4. Paid orders
  5. Archive
- Admin UI – password visibility: The Admin UI shall always display the current password.
- Admin UI – password management: The Admin UI shall allow the administrator to change all current passwords using a simple method.
- KDS UI – bug fix: Orders without an optional description incorrectly display “DINE IN”, “Dine in”, “TAKEAWAY”, or “Takeaway” twice. This shall be fixed.
- KDS UI – optional description: The optional description field shall only appear when the customer or waiter adds information during the ordering process. Otherwise, the field shall remain empty and shall not be displayed in the KDS UI.

==============================================================

- Currency: The currency shall be euros (EUR).
- Waiter UI – price alignment: The price is not fixed on the right side of the interface. This unexpected behaviour occurs only when the waiter adds an order modification.
- Kiosk UI – field title: Rename the optional field title “Table number” to “Your name or table number”.
- Kiosk UI – field placeholder: For the optional field “Your name or table number”, the placeholder text shall appear inside the field itself. The placeholder text shall be “Optional”, not “e.g. 12”.
- Kiosk UI – takeaway orders: The optional field “Your name or table number” shall also be available for takeaway orders.
- Database – consecutive order number: Add a new column to the database for a consecutive ordeas the order reference.r number, in addition to the UUID. This number shall reset at 00:00 each day and shall have five digits, beginning with 00001.
- Order reference: This new consecutive order number shall be displayed in the Waiter UI and in the KDS 
