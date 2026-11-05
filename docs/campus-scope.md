# Campus scope

The localized scope toggle stores `my_campus` or `all_campuses` in Zustand and
local storage (`campus360_listing_scope`). A recognized URL scope takes
precedence, including the legacy `scope=all`; navigation keeps the scope and
other query parameters. The civic administrative `scope=admin` is not replaced.
The events map includes the same control directly on the page.

All Universities broadens **public listings only**. Shared module reads use a
stateless anonymous Supabase client, so the anonymous row policies and column
grants from 0013 apply even to signed-in or demo users. They do not grant access
to other campuses' private contact details. Cross-campus event reads include
only public events (plus the user's own campus events); the civic board uses a
public projection and excludes sensitive categories. Archive list metadata is
projected without storage paths or checksums and only public files are listed
across campuses. Downloads still enforce file visibility and verification.
Reviews use the public projection; the average shown for cross-campus results is
computed over the returned page. Private complaints, donor and counselling
records, messages, orders, bookings and owner-only lists stay protected.

Migration `0023_ju_image_and_cross_campus_scope.sql` updates JU's cover and adds
restrictive campus write and parent guards. It deliberately does **not** grant
cross-campus base-table SELECT: row policies cannot protect individual columns.
Existing service-role clients bypass RLS and require explicit server-side
checks. Before release, verify the migration and test with users at two
universities, including direct database reads, private records and cross-campus
write attempts. Do not apply a policy that grants unrestricted event reads.
