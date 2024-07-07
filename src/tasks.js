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
        const availableAccounts = config.accounts.filter(acc => acc.username !== account.username);
        
        while (availableAccounts.length > 0) {
            const targetAccount = Utils.getRandomElement(availableAccounts);
            try {
                const targetRepos = await octokit.rest.repos.listForUser({ username: targetAccount.realUsername });
                if (targetRepos.data.length > 0) {
                    const targetRepo = Utils.getRandomElement(targetRepos.data);
                    await octokit.rest.activity.starRepoForAuthenticatedUser({
                        owner: targetAccount.realUsername,
                        repo: targetRepo.name
                    });
                    this.logger.info(`Account ${account.username}: Starred repo ${targetAccount.username}/${targetRepo.name} at ${time}`);
                    return;
                } else {
                    this.logger.warn(`Account ${account.username}: No repositories found for ${targetAccount.username}`);
                    availableAccounts.splice(availableAccounts.indexOf(targetAccount), 1);
                }
            } catch (error) {
                this.logger.error(`Account ${account.username}: Failed to star repo: ${error.message}`);
                availableAccounts.splice(availableAccounts.indexOf(targetAccount), 1);
            }
        }
        this.logger.warn(`Account ${account.username}: No repositories to star on any account`);
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
    
        const otherAccounts = config.accounts.filter(acc => acc.username !== account.username);
        let pullRequestCreated = false;
    
        while (!pullRequestCreated && otherAccounts.length > 0) {
            const targetAccount = Utils.getRandomElement(otherAccounts);
            otherAccounts.splice(otherAccounts.indexOf(targetAccount), 1);
    
            try {
                const { data: repos } = await octokit.rest.repos.listForUser({ 
                    username: targetAccount.realUsername, 
                    type: 'all' 
                });
    
                const eligibleRepos = repos.filter(repo => !repo.fork && !repo.archived);
                //this.logger.info(`Account ${account.username}: Found ${eligibleRepos.length} eligible repos for ${targetAccount.realUsername}`);
    
                // Перемешиваем массив репозиториев
                const shuffledRepos = Utils.shuffleArray(eligibleRepos);
    
                for (const targetRepo of shuffledRepos) {
                    try {
                        // Проверяем, существует ли репозиторий
                        const repoExists = await this.githubManager.repoExists(octokit, targetAccount.realUsername, targetRepo.name);
                        if (!repoExists) {
                            this.logger.info(`Repository ${targetRepo.name} does not exist. Skipping.`);
                        continue;
                        }

                        // Проверяем, не пустой ли репозиторий
                        let isEmpty = true;
                        try {
                            const { data: commits } = await octokit.rest.repos.listCommits({
                                owner: targetAccount.realUsername,
                                repo: targetRepo.name,
                                per_page: 1
                            });
                            isEmpty = commits.length === 0;
                        } catch (error) {
                            if (error.status === 409) {
                                // Репозиторий пуст (GitHub API возвращает 409 для пустых репозиториев)
                                isEmpty = true;
                            } else {
                                throw error;
                            }
                        }

                        if (isEmpty) {
                            //this.logger.info(`Repository ${targetRepo.name} is empty. Skipping.`);
                            continue;
                        }
                        
    
                        const { data: fork } = await octokit.rest.repos.createFork({
                            owner: targetAccount.realUsername,
                            repo: targetRepo.name
                        });
    
                        await new Promise(resolve => setTimeout(resolve, 10000));
    
                        const { data: ref } = await octokit.rest.git.getRef({
                            owner: targetAccount.realUsername,
                            repo: targetRepo.name,
                            ref: `heads/${targetRepo.default_branch}`,
                        });
    
                        const branchName = `pr-${Date.now()}`;
                        await octokit.rest.git.createRef({
                            owner: account.realUsername,
                            repo: fork.name,
                            ref: `refs/heads/${branchName}`,
                            sha: ref.object.sha
                        });
    
                        await octokit.rest.repos.createOrUpdateFileContents({
                            owner: account.realUsername,
                            repo: fork.name,
                            path: `file-${Date.now()}.txt`,
                            message: commitMessage,
                            content: Buffer.from(codeSnippet).toString('base64'),
                            branch: branchName
                        });
    
                        const pullRequest = await octokit.rest.pulls.create({
                            owner: targetAccount.realUsername,
                            repo: targetRepo.name,
                            title: commitMessage,
                            head: `${account.realUsername}:${branchName}`,
                            base: targetRepo.default_branch,
                            body: codeSnippet
                        });
    
                        this.logger.info(`Account ${account.username}: Created pull request #${pullRequest.data.number} to ${targetAccount.username}/${targetRepo.name} at ${time}`);
                        pullRequestCreated = true;
                        break;
                    } catch (repoError) {
                        this.logger.warn(`Account ${account.username}: Failed to create pull request for repo ${targetRepo.name}: ${repoError.message}`);
                        if (repoError.status) {
                            this.logger.warn(`HTTP Status: ${repoError.status}`);
                        }
                        if (repoError.response) {
                            this.logger.warn(`Response: ${JSON.stringify(repoError.response.data)}`);
                        }
                    }
                }
                
                if (pullRequestCreated) break;
            } catch (error) {
                this.logger.error(`Account ${account.username}: Failed to process account ${targetAccount.username}: ${error.message}`);
            }
        } 
        if (!pullRequestCreated) {
            this.logger.warn(`Account ${account.username}: Failed to create pull request for any repository`);
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
            let opened_found = false;
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
            if (!opened_found) {
                this.logger.warn(`Account ${account.username}: No opened pull requests found on account`);
            }
            
        } catch (error) {
            this.logger.error(`Account ${account.username}: Failed to accept pull request: ${error.message}`);
        }
    }
}

module.exports = Tasks;