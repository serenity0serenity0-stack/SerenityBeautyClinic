# Booking System Business Logic Improvements

> **Note:**  
> UI/UX improvements are already being handled in a separate task.
> Do **NOT** modify layouts, colors, styling, responsiveness, or design in this task.
> Focus only on the booking workflow, backend logic, and database consistency.

---

# 1. Understand the Current Booking Flow

Before making any changes:

- Analyze the complete booking workflow.
- Understand how appointments are created, edited, cancelled, and completed.
- Review:
  - Booking APIs
  - Cashier workflow
  - Waiting List
  - Doctor schedules
  - Database schema
  - Backend validation

Do **not** modify anything until the current workflow is fully understood.

---

# 2. Doctor Availability

Appointment availability must be calculated **per doctor**.

Example:

Doctor A

- 3:00 PM → Booked ❌

Doctor B

- 3:00 PM → Available ✅

Changing the selected doctor must automatically refresh the available appointment times.

---

# 3. Prevent Double Booking

A doctor must never have two appointments at the same date and time.

Validation must exist in:

- Frontend
- Backend
- Database

If necessary:

- Add a UNIQUE constraint.
- Generate the required SQL migration.
- Prevent race conditions.

---

# 4. Appointment Status

If a time slot is already booked for the selected doctor:

- Show:
  - Booked
  - Occupied
  - Unavailable

Disable selecting that slot.

If another doctor is available at the same time, the slot should remain available for that doctor.

---

# 5. Past Time Validation

The system must use the current local clinic time.

Example:

Current time:

3:00 PM

Bookings for today:

- 2:00 PM ❌
- 2:30 PM ❌
- 2:45 PM ❌
- 3:00 PM ❌ (or according to clinic policy)
- 3:15 PM ✅
- 3:30 PM ✅

Users must never be able to book appointments in the past.

Validation must exist in both frontend and backend.

---

# 6. Working Hours

Bookings must respect:

- Clinic working hours
- Doctor schedules
- Doctor vacations (if supported)

Unavailable doctors must not show available appointment slots.

---

# 7. Cashier Integration

The booking system and cashier must stay synchronized.

Scenario:

1. Customer books an appointment.
2. Customer arrives.
3. Reception opens the Cashier.
4. Invoice is created.
5. Payment is completed.

After successful payment:

The related appointment must automatically update its status.

Example:

Pending

↓

Confirmed

↓

Checked In

↓

Completed

No manual action should be required.

---

# 8. Waiting List

Patients should only be added to the waiting list when:

- No appointments are available for the selected doctor.

If appointments are available:

- The patient must book normally.

---

# 9. Service Duration

Appointment availability must consider the duration of the selected service.

Example:

Laser Session

Duration:

30 minutes

If booked:

3:00 PM

Next available slot:

3:30 PM

Not:

3:05 PM

Different services may have different durations.

---

# 10. Database Integrity

Review the booking database.

If required:

- Add UNIQUE constraints.
- Add indexes.
- Improve foreign keys.
- Improve validation.
- Generate SQL migrations.

Never break existing production data.

---

# 11. Performance

Review the booking system for:

- Duplicate API calls
- Slow queries
- Expensive filtering
- Unnecessary re-renders
- Large payloads
- N+1 queries

Optimize while preserving existing functionality.

---

# Final Verification Checklist

The final implementation must guarantee:

- ✅ A doctor cannot be booked twice at the same date and time.
- ✅ Different doctors can be booked at the same time.
- ✅ Past appointment times cannot be booked.
- ✅ Future appointment times remain available.
- ✅ Available slots refresh automatically when changing doctors.
- ✅ Cashier automatically updates appointment status after successful payment.
- ✅ Waiting List works only when no appointment is available.
- ✅ Service duration affects slot availability.
- ✅ Backend validation is implemented.
- ✅ Frontend validation is implemented.
- ✅ Database constraints protect data integrity.
- ✅ Existing functionality remains intact.

---

# Deliverables

Provide:

1. Root cause analysis.
2. Backend changes.
3. Frontend changes.
4. Database changes.
5. SQL migrations (if required).
6. Rollback SQL (if required).
7. Performance improvements.
8. Final verification report.