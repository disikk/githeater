// src/config.js

const fs = require('fs');
const path = require('path');

module.exports = {
    TOTAL_DAYS: 90,
    COMMITS_PER_ACCOUNT: 60,
    STARS_OWN_REPOS_PER_ACCOUNT: 10,
    STARS_OTHER_REPOS_PER_ACCOUNT: 20,
    PULL_REQUESTS_OPEN_PER_ACCOUNT: 5,
    PULL_REQUESTS_ACCEPT_PER_ACCOUNT: 20,
    REPOS_THRESHOLD: 5,
    MAX_COMMITS_PER_DAY: 3,
    MAX_RETRIES: 10,
    RETRY_DELAY: 10000,
    accounts: JSON.parse(fs.readFileSync(path.join(__dirname, '../data', 'accounts.json'))),
    codeSnippets: JSON.parse(fs.readFileSync(path.join(__dirname, '../data', 'code_snippets.json'))),
    randomWords: JSON.parse(fs.readFileSync(path.join(__dirname, '../data', 'random_words.json'))),
    commitMessages: JSON.parse(fs.readFileSync(path.join(__dirname, '../data', 'commit_messages.json'))),
    fileNames: JSON.parse(fs.readFileSync(path.join(__dirname, '../data', 'file_names.json')))
};