const fs = require('fs');
const path = require('path');

function loadJsonFile(filename) {
    const filePath = path.join(__dirname, '..', 'data', filename);
    try {
        const data = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error(`Error loading ${filename}: ${error.message}`);
        process.exit(1);
    }
}

const accounts = loadJsonFile('accounts.json');
const codeSnippets = loadJsonFile('code_snippets.json');
console.log('Loaded code snippets:', codeSnippets.length); 
const commitMessages = loadJsonFile('commit_messages.json');
const fileNames = loadJsonFile('file_names.json');
const randomWords = loadJsonFile('random_words.json');

// Проверка валидности загруженных данных
if (!Array.isArray(codeSnippets) || codeSnippets.length === 0) {
    console.error('codeSnippets must be a non-empty array');
    process.exit(1);
}

module.exports = {
    TOTAL_DAYS: 1,
    COMMITS_PER_ACCOUNT: 200,
    STARS_OWN_REPOS_PER_ACCOUNT: 5,
    STARS_OTHER_REPOS_PER_ACCOUNT: 10,
    PULL_REQUESTS_OPEN_PER_ACCOUNT: 5,
    PULL_REQUESTS_ACCEPT_PER_ACCOUNT: 20,
    REPOS_THRESHOLD: 5,
    MAX_RETRIES: 10,
    RETRY_DELAY: 10000,
    accounts,
    codeSnippets,
    commitMessages,
    fileNames,
    randomWords
};