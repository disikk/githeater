// src/github.js

const { Octokit } = require('@octokit/rest');
const HttpsProxyAgent = require('https-proxy-agent');
const config = require('./config');
const Logger = require('./logger');

class GitHubManager {
    constructor() {
        this.octokitInstances = {};
        this.logger = new Logger('GitHubManager');
        this.initOctokitInstances();
    }

    initOctokitInstances() {
        config.accounts.forEach(account => {
            let octokit;
            if (account.proxy) {
                const proxyAgent = new HttpsProxyAgent(account.proxy);
                octokit = new Octokit({
                    auth: account.token,
                    request: { agent: proxyAgent }
                });
            } else {
                octokit = new Octokit({ auth: account.token });
            }
            this.octokitInstances[account.username] = octokit;
        });
    }

    getOctokit(username) {
        if (!this.octokitInstances[username]) {
            throw new Error(`Octokit not initialized for ${username}`);
        }
        return this.octokitInstances[username];
    }

    async getCommitCount(octokit, username) {
        let totalCommits = 0;
        try {
            const repos = await octokit.rest.repos.listForUser({ username });
            const commitPromises = repos.data.map(async (repo) => {
                try {
                    const commits = await octokit.rest.repos.listCommits({ owner: username, repo: repo.name });
                    return commits.data.length;
                } catch (error) {
                    if (error.status === 409) {
                        return 0;
                    } else {
                        this.logger.error(`Error fetching commits for repo ${repo.name}: ${error.message}`);
                        throw error;
                    }
                }
            });

            const commitCounts = await Promise.all(commitPromises);
            totalCommits = commitCounts.reduce((sum, count) => sum + count, 0);
        } catch (error) {
            this.logger.error(`Failed to get commit count for ${username}: ${error.message}`);
        }
        return totalCommits;
    }

    async getAccountAge(octokit, username) {
        try {
            const { data } = await octokit.rest.users.getByUsername({ username });
            const creationDate = new Date(data.created_at);
            const now = new Date();
            const ageInDays = Math.floor((now - creationDate) / (1000 * 60 * 60 * 24));
            return ageInDays;
        } catch (error) {
            this.logger.error(`Failed to get account age for ${username}: ${error.message}`);
            throw error;
        }
    }

    async getAccountInfo(username) {
        const octokit = this.getOctokit(username);
        try {
            const { data: user } = await octokit.rest.users.getAuthenticated();
            const totalCommits = await this.getCommitCount(octokit, user.login);
            //this.logger.info(`Total commits for ${user.login}: ${totalCommits}`);
            const ageInDays = await this.getAccountAge(octokit, user.login);
            //this.logger.info(`Account age for ${user.login}: ${ageInDays} days`);
            return { totalCommits, ageInDays };
        } catch (error) {
            this.logger.error(`Failed to get info for ${username}: ${error.message}`);
            throw error;
        }
    }

    async listReposWithRetry(octokit, retries = config.MAX_RETRIES) {
        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                const { data: repos } = await octokit.rest.repos.listForAuthenticatedUser();
                return repos;
            } catch (error) {
                if (attempt === retries) {
                    throw error;
                }
                this.logger.warn(`Failed to list repositories (attempt ${attempt}): ${error.message}`);
                await new Promise(resolve => setTimeout(resolve, config.RETRY_DELAY));
            }
        }
    }
    
    async createNewRepo(octokit, login, repos) {
        let newRepoName;
        let attempts = 0;
    
        do {
            newRepoName = this.getRandomElement(config.randomWords);
            attempts++;
        } while (repos.find(r => r.name === newRepoName) && attempts < config.randomWords.length);
    
        if (attempts === config.randomWords.length) {
            throw new Error('Failed to find a unique repository name');
        }
    
        await octokit.rest.repos.createForAuthenticatedUser({
            name: newRepoName,
            private: false
        });
    
        return newRepoName;
    }
    
    async checkFileExists(octokit, owner, repo, path) {
        try {
            await octokit.rest.repos.getContent({
                owner,
                repo,
                path
            });
            return true;
        } catch (error) {
            if (error.status === 404) {
                return false;
            } else {
                throw error;
            }
        }
    }
    
    async getRandomPublicRepo() {
        const response = await fetch('https://api.github.com/search/repositories?q=stars:>100&sort=stars&order=desc&per_page=100');
        const data = await response.json();
        return this.getRandomElement(data.items);
    }
}

module.exports = GitHubManager;