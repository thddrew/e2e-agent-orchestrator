#!/usr/bin/env node
/**
 * Release script for e2e-agent-orchestrator
 * 
 * Usage:
 *   npm run release patch   # 1.0.0 -> 1.0.1
 *   npm run release minor    # 1.0.0 -> 1.1.0
 *   npm run release major    # 1.0.0 -> 2.0.0
 */

import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

function readJson(path) {
	return JSON.parse(readFileSync(path, 'utf-8'));
}

function writeJson(path, data) {
	writeFileSync(path, JSON.stringify(data, null, '\t') + '\n', 'utf-8');
}

function readFile(path) {
	return readFileSync(path, 'utf-8');
}

function writeFile(path, content) {
	writeFileSync(path, content, 'utf-8');
}

function exec(command, options = {}) {
	console.log(`\n📦 ${command}`);
	try {
		execSync(command, { stdio: 'inherit', cwd: rootDir, ...options });
	} catch (error) {
		console.error(`\n❌ Error: ${command}`);
		process.exit(1);
	}
}

function getCurrentVersion() {
	const pkg = readJson(join(rootDir, 'package.json'));
	return pkg.version;
}

function bumpVersion(version, type) {
	const [major, minor, patch] = version.split('.').map(Number);
	
	switch (type) {
		case 'major':
			return `${major + 1}.0.0`;
		case 'minor':
			return `${major}.${minor + 1}.0`;
		case 'patch':
			return `${major}.${minor}.${patch + 1}`;
		default:
			throw new Error(`Invalid version type: ${type}. Use patch, minor, or major.`);
	}
}

function updateChangelog(newVersion, type) {
	const changelogPath = join(rootDir, 'CHANGELOG.md');
	let changelog = readFile(changelogPath);
	
	const today = new Date().toISOString().split('T')[0];
	const versionHeader = `## [${newVersion}] - ${today}`;
	
	// Find the first ## header and insert new version after it
	const firstHeaderIndex = changelog.indexOf('## [');
	if (firstHeaderIndex === -1) {
		throw new Error('Could not find version header in CHANGELOG.md');
	}
	
	const afterFirstHeader = changelog.indexOf('\n', firstHeaderIndex);
	const newChangelog = 
		changelog.slice(0, afterFirstHeader + 1) +
		'\n' +
		versionHeader + '\n' +
		'\n' +
		'### Changed\n' +
		'- (Update this section with your changes)\n' +
		'\n' +
		changelog.slice(afterFirstHeader + 1);
	
	writeFile(changelogPath, newChangelog);
	console.log(`✅ Updated CHANGELOG.md with version ${newVersion}`);
}

function main() {
	const args = process.argv.slice(2);
	const versionType = args[0];
	
	if (!versionType || !['patch', 'minor', 'major'].includes(versionType)) {
		console.error('Usage: npm run release <patch|minor|major>');
		console.error('Example: npm run release patch');
		process.exit(1);
	}
	
	console.log('🚀 Starting release process...\n');
	
	// Check if working directory is clean
	try {
		execSync('git diff --quiet HEAD', { stdio: 'ignore' });
	} catch {
		console.error('❌ Working directory is not clean. Commit or stash changes first.');
		process.exit(1);
	}
	
	// Get current version
	const currentVersion = getCurrentVersion();
	console.log(`📌 Current version: ${currentVersion}`);
	
	// Bump version
	const newVersion = bumpVersion(currentVersion, versionType);
	console.log(`📌 New version: ${newVersion}`);
	
	// Update package.json
	const pkg = readJson(join(rootDir, 'package.json'));
	pkg.version = newVersion;
	writeJson(join(rootDir, 'package.json'), pkg);
	console.log(`✅ Updated package.json to version ${newVersion}`);
	
	// Update CHANGELOG.md
	updateChangelog(newVersion, versionType);
	
	// Build
	console.log('\n🔨 Building package...');
	exec('npm run build');
	
	// Commit changes
	console.log('\n📝 Committing changes...');
	exec(`git add package.json CHANGELOG.md`);
	exec(`git commit -m "chore: release v${newVersion}"`);
	
	// Create tag
	console.log('\n🏷️  Creating git tag...');
	exec(`git tag -a v${newVersion} -m "Release v${newVersion}"`);
	
	// Push to GitHub
	console.log('\n📤 Pushing to GitHub...');
	exec('git push origin main');
	exec(`git push origin v${newVersion}`);
	
	console.log('\n✅ Release prepared successfully!');
	console.log(`\n📦 Next steps:`);
	console.log(`   1. Review the changes in CHANGELOG.md`);
	console.log(`   2. Update CHANGELOG.md with actual changes if needed`);
	console.log(`   3. If CHANGELOG was updated, commit and push:`);
	console.log(`      git add CHANGELOG.md && git commit --amend --no-edit && git push --force-with-lease`);
	console.log(`   4. Publish to npm:`);
	console.log(`      npm publish --otp=<your-otp-code>`);
	console.log(`\n🎉 Release v${newVersion} is ready!`);
}

main();
