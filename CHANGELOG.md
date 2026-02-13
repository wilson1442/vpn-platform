# Changelog

## v0.0.3

- Add reseller dropdown on create reseller form (replaces raw ID input)
- Hide parent reseller field for non-admin users
- Remove max depth field from create reseller form
- Stop logging successful heartbeats to audit log (reduces noise)
- Purge existing heartbeat entries from audit log on API startup
- Add node heartbeat status cards to audit log page with live online/offline indicators

## v0.0.2

- User profile page with avatar upload
- Desktop header with profile dropdown menu (profile link, logout)
- Mobile header avatar link
- Database backup step in update wizard before installing updates
- Fix `git fetch` command in update downloader

## v0.0.1

- Initial release
