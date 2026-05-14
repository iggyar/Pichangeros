# Security Specification - Pichangeros

## Data Invariants
1. **Users**: Only the account owner can modify their profile (except for role/admin status which is locked to Admin).
2. **Fields**: Users can read approved fields. Owners can create fields (pending status). Admins can update status.
3. **Bookings**: Users can create bookings for themselves. Users can read their own bookings. Owners can read bookings for their fields.
4. **Payments**: Only admins can confirm manual payments (Yape).
5. **Chats**: participants only.

## The Dirty Dozen Payloads (Red Team)
1. **User Spoofing**: Attempt to update another user's `displayName`.
2. **Privilege Escalation**: Attempt to set `role: "admin"` on own user doc.
3. **Ghost Field**: Attempt to create a field as "approved" directly.
4. **Price Manipulation**: Attempt to set a negative price on a field.
5. **Booking Hijack**: Attempt to create a booking for another user ID.
6. **Payment Forgery**: Attempt to mark a booking as `paymentStatus: "released"` or `estadoPago: "Pago confirmado"` as a player.
7. **Identity Poisoning**: Use a 1MB string as a field name.
8. **Chat Sniffing**: Attempt to read a chat where the user is not a participant.
9. **Support Ticket Tampering**: Attempt to close a support ticket as a normal user.
10. **Global Settings Hack**: Attempt to change the commission percentage in `settings/global`.
11. **Review Spam**: Attempt to post multiple reviews for the same field in 1 second.
12. **Double Booking**: Attempt to overwrite an existing booking doc.

## Test Runner Plan
See `firestore.rules`.
