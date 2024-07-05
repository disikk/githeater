// src/tasks.js

const Logger = require('./logger');
const config = require('./config');
const Utils = require('./utils');

class Tasks {
    constructor(githubManager) {
        this.githubManager = githubManager;
        this.logger = new Logger('Tasks');
    }

    async makeCommit(account, repoName, fileName, commitMessage, codeSnippet, time) {
        const { username, token } = account;
        if (!token || !username) {
            throw new Error(`Invalid account data: ${JSON.stringify(account)}`);
        }
        const octokit = this.githubManager.getOctokitByToken(token);
        try {
            if (repoName === 'NEW_REPO') {
                repoName = await this.githubManager.createNewRepo(octokit, username, await this.githubManager.listReposWithRetry(octokit));
                this.logger.info(`Account ${username}: Created new repo ${repoName}`);
            }

            let fileExists = await this.githubManager.checkFileExists(octokit, account.realUsername, repoName, fileName);
            while(fileExists) {
                fileName = Utils.getRandomElement(config.fileNames);
                fileExists = await this.githubManager.checkFileExists(octokit, account.realUsername, repoName, fileName);
            }
            // Проверяем, что codeSnippet не undefined
            if (typeof codeSnippet !== 'string' || codeSnippet.trim() === '') {
                throw new Error('Invalid code snippet');
            }
    
            const content = Buffer.from(codeSnippet).toString('base64');

            await octokit.rest.repos.createOrUpdateFileContents({
                owner: account.realUsername,
                repo: repoName,
                path: fileName,
                message: commitMessage,
                content: content,
            });
            
            this.logger.info(`Account ${username}: Committed to ${repoName} at ${time}`);
        } catch (error) {
            this.logger.error(`Account ${username}: Failed to commit: ${error.message}`);
            if (error.response) {
                this.logger.error(`Status: ${error.response.status}`);
                this.logger.error(`Response data: ${JSON.stringify(error.response.data)}`);
            }
            throw error;
        }
    }

    async starOwnRepo(account, time) {
        const octokit = this.githubManager.getOctokit(account.username);
        try {
            const targetAccount = Utils.getRandomElement(config.accounts.filter(acc => acc.username !== account.username));
            const targetRepos = await octokit.rest.repos.listForUser({ username: targetAccount.realUsername });
            if (targetRepos.length > 0) {
                const targetRepo = Utils.getRandomElement(targetRepos.data);
                await octokit.rest.activity.starRepoForAuthenticatedUser({
                    owner: targetAccount.realUsername,
                    repo: targetRepo.name
                });
                this.logger.info(`Account ${account.username}: Starred own repo ${targetRepo.name} at ${time}`);
            } else {
                this.logger.warn(`Account ${account.username}: No repositories to star`);
            }
        } catch (error) {
            this.logger.error(`Account ${account.username}: Failed to star own repo: ${error.message}`);
        }
    }

    async starRandomRepo(account, time) {
        const octokit = this.githubManager.getOctokit(account.username);
        try {
            const randomRepo = await this.githubManager.getRandomPublicRepo();
            await octokit.rest.activity.starRepoForAuthenticatedUser({
                owner: randomRepo.owner.login,
                repo: randomRepo.name
            });
            this.logger.info(`Account ${account.username}: Starred random repo ${randomRepo.owner.login}/${randomRepo.name} at ${time}`);
        } catch (error) {
            this.logger.error(`Account ${account.username}: Failed to star random repo: ${error.message}`);
        }
    }

    async openPullRequest(account, time) {
        const octokit = this.githubManager.getOctokit(account.username);
        const commitMessage = Utils.getRandomElement(config.commitMessages);
        const codeSnippet = Utils.getRandomElement(config.codeSnippets);

        const targetAccount = Utils.getRandomElement(config.accounts.filter(acc => acc.username !== account.username));

        try {
            const repos = await octokit.rest.repos.listForUser({ username: targetAccount.realUsername });
            if(repos.length > 0) {
                const targetRepo = Utils.getRandomElement(repos.data);
                const pullRequest = await octokit.rest.pulls.create({
                    owner: targetAccount.realUsername,
                    repo: targetRepo.name,
                    head: `${account.username}:main`,
                    base: 'main',
                    title: commitMessage,
                    body: codeSnippet
                });
                this.logger.info(`Account ${account.username}: Created pull request #${pullRequest.data.number} to ${targetAccount.username}/${targetRepo.name} at ${time}`);
            } else {
                this.logger.warn(`Account ${account.username}: No repositories to create pull request`);
            }
            
        } catch (error) {
            this.logger.error(`Account ${account.username}: Failed to create pull request to ${targetAccount.username}/${targetRepo.name}: ${error.message}`);
        }
    }

    async acceptPullRequest(account, time) {
        if (!account) {
            this.logger.error(`acceptPullRequest called with invalid account: ${JSON.stringify(account)}`);
            return;
        }
        const octokit = this.githubManager.getOctokit(account.username);

        try {
            const { data: repos } = await octokit.rest.repos.listForAuthenticatedUser();
            for (const repo of repos) {
                const { data: pullRequests } = await octokit.rest.pulls.list({
                    owner: account.realUsername,
                    repo: repo.name,
                    state: 'open'
                });

                if (pullRequests.length > 0) {
                    const randomPR = Utils.getRandomElement(pullRequests);
                    await octokit.rest.pulls.merge({
                        owner: account.realUsername,
                        repo: repo.name,
                        pull_number: randomPR.number
                    });
                    this.logger.info(`Account ${account.username}: Accepted pull request #${randomPR.number} in ${repo.name} at ${time}`);
                    return;
                }
            }
            this.logger.warn(`Account ${account.username}: No open pull requests found`);
        } catch (error) {
            this.logger.error(`Account ${account.username}: Failed to accept pull request: ${error.message}`);
        }
    }
}

module.exports = Tasks;