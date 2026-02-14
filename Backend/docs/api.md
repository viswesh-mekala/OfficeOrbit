# OfficeOrbit API Documentation

## Database Tables

### user_profiles
Stores user profile data linked to Supabase Auth.

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

### attendance_records
Tracks daily attendance and location logs.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `user_id` | UUID | Foreign key to user_profiles |
| `date` | DATE | Attendance date |
| `check_in_time` | TIMESTAMPTZ | First check-in time |
| `check_out_time` | TIMESTAMPTZ | Last check-out time |
| `total_minutes` | INTEGER | Total time at office |
| `is_wfh` | BOOLEAN | Work from home flag |
| `location_logs` | JSONB | Array of location checks |

---

## Frontend Usage (Supabase JS Client)

### Get User Profile
```typescript
const { data, error } = await supabase
  .from('user_profiles')
  .select('*')
  .eq('id', user.id)
  .single();
```

### Update User Profile
```typescript
const { error } = await supabase
  .from('user_profiles')
  .update({
    company: 'Acme Corp',
    company_location: { latitude: 12.97, longitude: 77.59, address: '123 Main St' },
    office_window_start: '09:00',
    office_window_end: '18:00',
    wfh_days: 2,
    wfh_period: 'week'
  })
  .eq('id', user.id);
```

### Log Attendance
```typescript
const { error } = await supabase
  .from('attendance_records')
  .upsert({
    user_id: user.id,
    date: new Date().toISOString().split('T')[0],
    check_in_time: new Date().toISOString(),
    location_logs: [{ timestamp: Date.now(), latitude: 12.97, longitude: 77.59, at_office: true }]
  });
```
