# OfficeOrbit API Documentation

All frontend data flows through **Supabase Edge Functions**. The frontend never queries the database directly (except for auth, which uses the Supabase Auth JS SDK).

---

## Authentication

Auth is handled via the **Supabase Auth JS SDK** on the client side. All Edge Functions validate the user's JWT from the `Authorization` header.

---

## Edge Function Endpoints

All endpoints accept `POST` requests with a JSON body. Every request body can include an optional `timezoneOffset` (number, from `new Date().getTimezoneOffset()`) for timezone-safe date calculations.

### Profile

#### `profile-get`
Fetch the authenticated user's profile.

**Request Body:** `{}` (empty)

**Response:**
```json
{ "success": true, "data": { "id": "...", "username": "...", "email": "...", "company": "...", "company_location": { "latitude": 12.97, "longitude": 77.59, "address": "123 Main St" }, "office_window_start": "09:00", "office_window_end": "18:00", "minimum_login_time_minutes": 480, "wfh_days": 2, "wfh_period": "week" } }
```

#### `profile-update`
Update the authenticated user's profile. Fields `id`, `email`, and `created_at` are stripped for security.

**Request Body:**
```json
{ "company": "Acme Corp", "company_location": { "latitude": 12.97, "longitude": 77.59, "address": "123 Main St" }, "office_window_start": "09:00", "office_window_end": "18:00", "wfh_days": 2, "wfh_period": "week" }
```

**Response:** `{ "success": true, "data": { ...updatedProfile }, "message": "Profile updated successfully" }`

---

### Attendance

#### `attendance-today`
Get today's attendance log for the authenticated user.

**Request Body:** `{ "timezoneOffset": -330 }` (optional)

**Response:** `{ "success": true, "data": { ...attendanceLog } }` or `{ "success": true, "data": null }` if no check-in.

#### `attendance-history`
Get recent attendance history.

**Request Body:** `{ "limit": 7 }` (optional, default: 7, max: 90)

**Response:** `{ "success": true, "data": [ ...attendanceLogs ] }`

#### `check-in`
Check in to the office or mark WFH.

**Request Body:**
```json
{ "location": { "latitude": 12.97, "longitude": 77.59 }, "status": "present", "timezoneOffset": -330 }
```

- `status`: `"present"` (validates 500m proximity) or `"wfh"` (skips distance check)
- Only `address` and `at_office` boolean are stored — **no raw GPS persisted**.

**Response:** `{ "success": true, "data": { ...attendanceLog }, "message": "Checked in successfully" }`

#### `check-out`
Check out (marks the end of the work session).

**Request Body:** `{ "timezoneOffset": -330 }` (optional)

- Automatically calculates `duration_minutes` from `check_in` to now.

**Response:** `{ "success": true, "data": { ...attendanceLog }, "message": "Checked out successfully. Duration: 480 minutes." }`

---

## Database Tables

### user_profiles
| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key (same as auth.users.id) |
| `username` | TEXT | Display name |
| `email` | TEXT | User email |
| `company` | TEXT | Company name |
| `company_location` | JSONB | `{ latitude, longitude, address }` |
| `office_window_start` | TIME | Office start time (default: 09:00) |
| `office_window_end` | TIME | Office end time (default: 18:00) |
| `minimum_login_time_minutes` | INTEGER | Required office time (default: 480) |
| `wfh_days` | INTEGER | Allowed WFH days |
| `wfh_period` | TEXT | 'week' or 'month' |

### attendance_logs
| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `user_id` | UUID | Foreign key to user_profiles |
| `date` | DATE | Attendance date |
| `check_in` | TIMESTAMPTZ | Check-in timestamp |
| `check_out` | TIMESTAMPTZ | Check-out timestamp |
| `status` | TEXT | 'present', 'wfh', 'leave', 'holiday', 'absent' |
| `location_check_in` | JSONB | `{ address, at_office }` |
| `duration_minutes` | INTEGER | Calculated at check-out |

---

## Standard Response Format

All Edge Functions return responses in this format:

```json
// Success
{ "success": true, "data": { ... }, "message": "Optional message" }

// Error
{ "success": false, "error": "Error description" }
```
