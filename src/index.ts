import {GitHubPRCommenter} from './gh-pr-commenter';
import {MigratorTester} from './migrator-tester';
import * as core from '@actions/core';
import * as github from '@actions/github';
import {MIGRATION_FILENAME_DELIMITER} from './config';

type Opts = {
  githubToken: string;
  migrationDirectories: string[];
  baseBranch: string;
  currBranch: string;
  migrationDelimiter: string;
  mentionAuthor: boolean;
};

/**
 * Main function which is invoked
 */
async function main() {
  const githubToken = core.getInput('GITHUB_TOKEN');
  const octokit = github.getOctokit(githubToken);
  const {data: pr} = await octokit.rest.pulls.get({
    pull_number: github.context.payload.pull_request?.number || 0,
    owner: github.context.repo.owner,
    repo: github.context.repo.repo,
  });
  const migrationDirectories = process.env.MT_MIGRATIONS_DIRECTORIES?.split(
      '\n',
  ).forEach((val) => val.trim());

  const opts: Opts = {
    githubToken: githubToken,
    baseBranch: pr.base.ref || process.env.MT_BASE_BRANCH,
    currBranch: pr.head.ref || process.env.MT_CURRENT_BRANCH,
    migrationDirectories:
      core.getMultilineInput('migration_directories') || migrationDirectories,
    migrationDelimiter:
      core.getInput('migration_delimiter') ||
      process.env.MT_MIGRATION_FILENAME_DELIMITER ||
      MIGRATION_FILENAME_DELIMITER,
    mentionAuthor: core.getBooleanInput('mention_author'),
  };
  const errorMessages: string[] = [];
  for (const migrationDir of opts.migrationDirectories) {
    const mtInstance = new MigratorTester({
      baseBranch: opts.baseBranch,
      currBranch: opts.currBranch,
      migrationsDir: migrationDir,
      migrationsDelimiter: opts.migrationDelimiter,
    });

    try {
      mtInstance.validate();
    } catch (error) {
      if (typeof error === 'string') {
        errorMessages.push(error);
      }
    }
  }
  const ghPRCommenterInstance = new GitHubPRCommenter({
    mentionAuthor: opts.mentionAuthor,
    message: errorMessages.join('\n'),
    githubToken: githubToken,
    authorUsername: pr.user?.login || '',
    prNumber: github.context.payload.pull_request?.number || 0,
  });

  ghPRCommenterInstance.comment();
}

main();