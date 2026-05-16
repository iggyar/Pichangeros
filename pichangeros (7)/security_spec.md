# Security Specification - Pichangeros

## Data Invariants
1. A user can only manage their own profile and payment methods.
2. Only admins can approve or reject fields.
3. Only participants can read and write in a chat.
4. Bookings can only be created by the user who will play.
5. Reviews can only be created for fields that the user has booked (ideally, but for now we enforce user identity).
6. Admins have full read/write access to everything except potentially sensitive PII if isolated.

## The "Dirty Dozen" Payloads (Denial Tests)
1. **Admin Escalation**: User tries to update their own role to "admin".
2. **Field Spoofing**: User tries to create a field with `ownerId` of another user.
3. **Ghost Booking**: User tries to book a field on behalf of another user.
4. **Chat Eavesdropping**: User tries to read a chat they are not a participant of.
5. **Review Poisoning**: User tries to create a review with a 1MB string comment.
6. **Payment Hijacking**: User tries to add a payment method for another user's UID.
7. **Status Bypass**: Field owner tries to approve their own pending field.
8. **ID Injection**: User tries to use a 1KB string as a document ID.
9. **Query Scraping**: Authenticated user tries to list ALL users via `isSignedIn()` blanket rule.
10. **Report Forgery**: User tries to resolve their own reported content.
11. **System Field Overwrite**: User tries to modify `createdAt` or `totalAmount` on a verified booking.
12. **PII Leak**: Non-admin user tries to get another user's private profile via `isSignedIn()` get rule.
