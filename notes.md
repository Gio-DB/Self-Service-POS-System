# Notes for next releases

Please add or review the following requirements in the document. Afterwards, please implement these requirements in the Restaurant Self-Service POS System:

- Currency: The currency shall be euros (EUR).
- Waiter UI – price alignment: The price is not fixed on the right side of the interface. This unexpected behaviour occurs only when the waiter adds an order modification.
- Kiosk UI – field title: Rename the optional field title “Table number” to “Your name or table number”.
- Kiosk UI – field placeholder: For the optional field “Your name or table number”, the placeholder text shall appear inside the field itself. The placeholder text shall be “Optional”, not “e.g. 12”.
- Kiosk UI – takeaway orders: The optional field “Your name or table number” shall also be available for takeaway orders.
- Database – consecutive order number: Add a new column to the database for a consecutive ordeas the order reference.r number, in addition to the UUID. This number shall reset at 00:00 each day and shall have five digits, beginning with 00001.
- Order reference: This new consecutive order number shall be displayed in the Waiter UI and in the KDS 
