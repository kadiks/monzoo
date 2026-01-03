#!/usr/bin/env node

import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import fs from 'fs';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageJsonPath = path.join(__dirname, '../package.json');

const version = process.argv[2];
const customCommit = process.argv[3];

if (!version) {
  console.error('❌ Version argument is required');
  console.error('Usage: npm run version <version> [commit-message]');
  console.error('Example: npm run version 1.0.2');
  console.error('Example: npm run version 1.0.2 "feat: add new feature"');
  process.exit(1);
}

// Validate version format (simple check for semantic versioning)
if (!/^\d+\.\d+\.\d+/.test(version)) {
  console.error('❌ Invalid version format. Use semantic versioning (e.g., 1.0.2)');
  process.exit(1);
}

try {
  console.log(`📦 Updating version to ${version}...`);

  // Read package.json
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
  const oldVersion = packageJson.version;

  // Update version
  packageJson.version = version;
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
  console.log(`✓ Updated package.json: ${oldVersion} → ${version}`);

  // Stage the change
  console.log(`📝 Staging package.json...`);
  execSync('git add .', { cwd: path.join(__dirname, '..') });
  console.log(`✓ Staged package.json`);

  // Commit with custom or default message
  const commitMessage = customCommit || `chore: bump version to ${version}`;
  console.log(`💾 Committing changes...`);
  execSync(`git commit -m "${commitMessage}"`, {
    cwd: path.join(__dirname, '..'),
  });
  console.log(`✓ Committed with message: ${commitMessage}`);

  // Push commit
  console.log(`🚀 Pushing commit...`);
  execSync('git push origin', { cwd: path.join(__dirname, '..') });
  console.log(`✓ Pushed commit to origin`);

  // Create and push tag
  const tag = `v${version}`;
  console.log(`🏷️  Creating tag ${tag}...`);
  execSync(`git tag ${tag}`, { cwd: path.join(__dirname, '..') });
  console.log(`✓ Created tag ${tag}`);

  console.log(`📤 Pushing tag...`);
  execSync(`git push origin ${tag}`, { cwd: path.join(__dirname, '..') });
  console.log(`✓ Pushed tag ${tag}`);

  console.log(`\n✅ Version bump complete!`);
  console.log(`   - Updated package.json to ${version}`);
  console.log(`   - Committed and pushed changes`);
  console.log(`   - Created and pushed tag ${tag}`);
  console.log(`   - GitHub Actions workflow should start building...`);
} catch (error) {
  console.error(`\n❌ Error during version bump:`);
  console.error(error.message);
  process.exit(1);
}
