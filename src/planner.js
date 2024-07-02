// src/planner.js

const schedule = require('node-schedule');
const Logger = require('./logger');
const config = require('./config');
const Utils = require('./utils');

class Planner {
    constructor(tasks) {
        this.tasks = tasks;
        this.logger = new Logger('Planner');
        this.scheduledJobs = [];
    }

    async createSchedule() {
        let globalSchedule = {};

        for (const account of config.accounts) {
            const accountSchedule = {
                commits: this.planTasks(config.COMMITS_PER_ACCOUNT),
                starsOwn: this.planTasks(config.STARS_OWN_REPOS_PER_ACCOUNT),
                starsOther: this.planTasks(config.STARS_OTHER_REPOS_PER_ACCOUNT),
                pullRequestsOpen: this.planTasks(config.PULL_REQUESTS_OPEN_PER_ACCOUNT),
                pullRequestsAccept: this.planTasks(config.PULL_REQUESTS_ACCEPT_PER_ACCOUNT)
            };

            globalSchedule[account.username] = accountSchedule;
        }

        return globalSchedule;
    }

    planTasks(count) {
        let plan = [];
        for (let i = 0; i < count; i++) {
            const day = Math.floor(Math.random() * config.TOTAL_DAYS);
            const time = new Date();
            time.setDate(time.getDate() + day);
            time.setHours(Math.floor(Math.random() * 24), Math.floor(Math.random() * 60), 0, 0);
            plan.push(time);
        }
        return plan.sort((a, b) => a - b);
    }

    scheduleAllTasks(globalSchedule) {
        for (const [username, accountSchedule] of Object.entries(globalSchedule)) {
            const account = config.accounts.find(acc => acc.username === username);
            
            this.scheduleTasks(account, accountSchedule.commits, this.tasks.makeCommit.bind(this.tasks));
            this.scheduleTasks(account, accountSchedule.starsOwn, this.tasks.starOwnRepo.bind(this.tasks));
            this.scheduleTasks(account, accountSchedule.starsOther, this.tasks.starRandomRepo.bind(this.tasks));
            this.scheduleTasks(account, accountSchedule.pullRequestsOpen, this.tasks.openPullRequest.bind(this.tasks));
            this.scheduleTasks(account, accountSchedule.pullRequestsAccept, this.tasks.acceptPullRequest.bind(this.tasks));
        }
    }

    scheduleTasks(account, times, taskFunction) {
        for (const time of times) {
            const job = schedule.scheduleJob(time, () => taskFunction(account, time));
            this.scheduledJobs.push(job);
        }
    }

    async run() {
        const globalSchedule = await this.createSchedule();
        this.scheduleAllTasks(globalSchedule);
        await Utils.createCsvFile(globalSchedule);
        this.logger.info('All tasks have been scheduled');
    }
}

module.exports = Planner;