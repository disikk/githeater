// src/tasks.js

const Logger = require('./logger');
const config = require('./config');
const Utils = require('./utils');

class Tasks {
    constructor(githubManager) {
        this.githubManager = githubManager;
        this.logger = new Logger('Tasks');
    }

    async makeCommit(account, login, repoName, fileName, commitMessage, codeSnippet, time) {
        // Проверяем, передан ли первый аргумент как объект (что указывает на старый формат вызова)
        if (typeof account === 'object' && account !== null && account.username) {
            // Если передан объект, извлекаем нужные данные
            login = account.username;
            // Остальные параметры сдвигаются
            repoName = login;
            fileName = repoName;
            commitMessage = fileName;
            codeSnippet = commitMessage;
            time = codeSnippet;
        }
    
        // Проверяем, что все необходимые параметры определены
        if (!account || !login || !repoName || !fileName || !commitMessage || !codeSnippet) {
            throw new Error(`Invalid arguments for makeCommit: ${JSON.stringify({account, login, repoName, fileName, commitMessage, codeSnippet})}`);
        }
    
        const octokit = this.githubManager.getOctokit(account.username);
    try {
        const repos = await this.githubManager.listReposWithRetry(octokit);

        if (repoName === 'NEW_REPO') {
            repoName = await this.githubManager.createNewRepo(octokit, account.username, repos);
            this.logger.info(`Account ${account.username}: Created new repo ${repoName}`);
        }

        let fileExists = await this.githubManager.checkFileExists(octokit, account.username, repoName, fileName);
        while (fileExists) {
            fileName = Utils.getRandomElement(config.fileNames);
            fileExists = await this.githubManager.checkFileExists(octokit, account.username, repoName, fileName);
        }

        await octokit.rest.repos.createOrUpdateFileContents({
            owner: account.username,
            repo: repoName,
            path: fileName,
            message: commitMessage,
            content: Buffer.from(codeSnippet).toString('base64'),
        });

        this.logger.info(`Account ${account.username}: Committed to ${repoName} at ${time}`);
    } catch (error) {
        this.logger.error(`Account ${account.username}: Failed to commit: ${error.message}`);
        throw error;
    }
    }

    async starOwnRepo(account, time) {
        const octokit = this.githubManager.getOctokit(account.username);
        try {
            const { data: repos } = await octokit.rest.repos.listForAuthenticatedUser();
            if (repos.length > 0) {
                const randomRepo = Utils.getRandomElement(repos);
                await octokit.rest.activity.starRepoForAuthenticatedUser({
                    owner: account.username,
                    repo: randomRepo.name
                });
                this.logger.info(`Account ${account.username}: Starred own repo ${randomRepo.name} at ${time}`);
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

        const targetAccount = Utils.getRandomElement(config.accounts.filter(acc => acc.username !== account.username));
        const repos = await octokit.rest.repos.listForUser({ username: targetAccount.username });
        const targetRepo = Utils.getRandomElement(repos.data);

        try {
            const pullRequest = await octokit.rest.pulls.create({
                owner: targetAccount.username,
                repo: targetRepo.name,
                head: `${account.username}:main`,
                base: 'main',
                title: commitMessage,
                body: commitMessage
            });

            this.logger.info(`Account ${account.username}: Created pull request #${pullRequest.data.number} to ${targetAccount.username}/${targetRepo.name} at ${time}`);
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
                    owner: account.username,
                    repo: repo.name,
                    state: 'open'
                });

                if (pullRequests.length > 0) {
                    const randomPR = Utils.getRandomElement(pullRequests);
                    await octokit.rest.pulls.merge({
                        owner: account.username,
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