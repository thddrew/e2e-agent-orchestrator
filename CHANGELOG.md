# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2024-01-15

## [1.0.3] - 2026-01-21

### Changed
- (Update this section with your changes)


## [1.0.2] - 2026-01-21

### Changed
- (Update this section with your changes)


## [1.0.1] - 2026-01-21

### Added
- Automated release process with release scripts
- GitHub Actions workflows for CI and automated publishing
- Comprehensive developer documentation in README

### Changed
- Require Node.js >=24.0.0 (upgraded from >=18.20.2)
- Improved release workflow documentation


### Added
- Initial release of E2E Agent Orchestrator
- CLI tool (`e2e-agent`) for running tests
- Programmatic API for integration
- Support for parallel test execution
- Configurable via config file, environment variables, or CLI arguments
- Health check before running tests
- Detailed test reports with timestamps
- Debug mode for real-time agent output
- Template generation via `init` command

### Features
- Agent-first architecture using Cursor agent + agent-browser
- Declarative test specs (no code needed)
- Automatic element discovery via agent-browser snapshots
- Progress tracking and real-time updates
- Support for both Bun and Node.js runtimes
