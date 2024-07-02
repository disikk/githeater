// src/utils.js

const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const { format } = require('date-fns');

class Utils {
    static async createCsvFile(globalSchedule) {
        const accounts = Object.keys(globalSchedule);
        const header = ['Date', ...accounts];
        const csvWriter = createCsvWriter({
            path: 'schedule_plan.csv',
            header: header.map(column => ({ id: column, title: column }))
        });

        let dailyTasks = {};

        for (const [username, accountSchedule] of Object.entries(globalSchedule)) {
            for (const times of Object.values(accountSchedule)) {
                times.forEach(time => {
                    const date = format(time, 'yyyy-MM-dd');
                    if (!dailyTasks[date]) {
                        dailyTasks[date] = {};
                    }
                    if (!dailyTasks[date][username]) {
                        dailyTasks[date][username] = 0;
                    }
                    dailyTasks[date][username]++;
                });
            }
        }

        const records = Object.entries(dailyTasks).map(([date, tasks]) => {
            const record = { Date: date };
            accounts.forEach(account => {
                record[account] = tasks[account] || 0;
            });
            return record;
        });

        records.sort((a, b) => new Date(a.Date) - new Date(b.Date));

        await csvWriter.writeRecords(records);
    }

    static getRandomElement(array) {
        return array[Math.floor(Math.random() * array.length)];
    }
}

module.exports = Utils;