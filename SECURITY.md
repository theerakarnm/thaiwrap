# Security policy

## Reporting a vulnerability

Please do not open a public issue.
Use the "Report a vulnerability" button on the Security tab of the GitHub repository.
Include the input, the version, and your platform.

## Scope

`thaiwrap` is a native addon.
A crash, panic, or memory error caused by any input is a security bug.
Invalid arguments must throw `TypeError` or `RangeError`.

## Supported versions

Only the latest 0.x release gets fixes.
