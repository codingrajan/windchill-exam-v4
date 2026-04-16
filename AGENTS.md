## Repository Instructions

1. Keep project documentation current with implementation changes.
2. Update these files when relevant behavior, architecture, setup, flows, admin capabilities, or reporting changes:
   - `README.md`
   - `DEPLOYMENT_QA_CHECKLIST.md`
   - user/admin/technical/project guides when present
3. Do not defer documentation updates when code changes materially affect usage, deployment, operations, or maintenance.
4. Prefer updating existing docs in the same change set as the feature or fix.
5. Environment constraints for this workspace:
   - do not assume global `npm` installs are allowed
   - prefer Python or local-repo tooling over global Node tooling
   - if `pandoc` is installed but not on `PATH`, use its absolute executable path or repair `PATH` before relying on it
