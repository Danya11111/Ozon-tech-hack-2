# Production releases metadata

- `CURRENT_RELEASE.txt` / `CURRENT_BUNDLE.txt` — last successful deploy markers
- `backup-pre-*` directories are local backups (gitignored)
- Deploy: `bash scripts/deploy-production.sh`
- Rollback: see `docs/PRODUCTION_DEPLOYMENT_REPORT.md`
