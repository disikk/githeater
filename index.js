// index.js

const GitHubManager = require('./src/github');
const Tasks = require('./src/tasks');
const Planner = require('./src/planner');
const Logger = require('./src/logger');
const config = require('./src/config');

const logger = new Logger('Main');

async function logAccountInfo(githubManager) {
    for (const account of config.accounts) {
        try {
            const { totalCommits, ageInDays } = await githubManager.getAccountInfo(account.username);
            logger.info(`Account ${account.username}: Total commits: ${totalCommits}, Age: ${ageInDays} days`);
        } catch (error) {
            logger.error(`Failed to get info for account ${account.username}: ${error.message}`);
        }
    }
}

async function main() {
    try {
        const githubManager = new GitHubManager();
        await logAccountInfo(githubManager);
        const tasks = new Tasks(githubManager);
        const planner = new Planner(tasks);

        logger.info('Starting task scheduling...');
        await planner.run();

        logger.info('Scheduling completed successfully.');
    } catch (error) {
        logger.error(`Main process error: ${error.message}`);
    }
}

main();