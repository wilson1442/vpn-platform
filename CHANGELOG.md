# Changelog

## v0.0.7

- Add Email Templates management to admin panel with full CRUD
- Rich WYSIWYG email editor powered by TipTap with formatting toolbar (bold, italic, underline, headings, lists, alignment, color, font size, links, images)
- Template variable system with insertable field tags (username, email, site_name, expiry_date, etc.)
- Preview rendered templates with sample data and send test emails via SMTP
- Toggle template active/inactive status from the list view
- Searchable and sortable email templates table
- Database migration for EmailTemplate model

## v0.0.6

- Add Payment Gateways to Settings page (Stripe, PayPal, Authorize.net, Cash App, Zelle, Venmo)
- Payment gateway cards with real brand SVG logos and setup documentation links
- Auto-seed default gateways on first load
- Add database migration for PaymentGateway table
- Fix nginx reverse proxy routing for payment-gateways and checkout endpoints
- Rename admin dashboard title to dynamic site name (e.g. "MyVPN Dashboard")
- Rearrange dashboard layout: bandwidth chart above servers, main server card alongside VPN nodes
- Add search and sortable columns to Users and Resellers tables
- SMTP settings UI and PayPal integration
- Full UI redesign with "Midnight Protocol" cyber-noir theme
- Dynamic favicon from uploaded logo
- Fix Next.js standalone build missing static files after updates

## v0.0.5

- Add User Logs page for admin and reseller panels (view create, update, extend, delete actions)
- New API endpoint for querying user-related audit logs with pagination
- Reseller-scoped user logs (resellers only see their own actions)
- Filter buttons for log type (Created, Updated, Extended, Deleted)
- Add session sync, connections page, max connections editing, and tier-based features
- Add license grace period with 7-day countdown and panel lockout
- Change license check-in interval from 24h to 6h
- Fix license status display and SDK hasFeature crash

## v0.0.4

- Add LicenseForge licensing system with SDK-based validation and feature gating
- License activation and status display on admin settings page
- License alert banner for unlicensed installations with activation dialog
- Feature-gated resellers module (requires `resellers` feature on license tier)
- Real-time license validation feedback with detailed error messages
- License context provider for frontend license state management

## v0.0.3

- Add reseller dropdown on create reseller form (replaces raw ID input)
- Hide parent reseller field for non-admin users
- Remove max depth field from create reseller form
- Stop logging successful heartbeats to audit log (reduces noise)
- Purge existing heartbeat entries from audit log on API startup
- Add node heartbeat status cards to audit log page with live online/offline indicators
- Increase action icon size on resellers and users pages

## v0.0.2

- User profile page with avatar upload
- Desktop header with profile dropdown menu (profile link, logout)
- Mobile header avatar link
- Database backup step in update wizard before installing updates
- Fix `git fetch` command in update downloader

## v0.0.1

- Initial release
