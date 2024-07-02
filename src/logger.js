// src/logger.js

const winston = require('winston');
const path = require('path');
const chalk = require('chalk');

class Logger {
    constructor(module) {
        this.logger = winston.createLogger({
            level: 'info',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.printf(({ timestamp, level, message }) => {
                    const color = this.getLevelColor(level);
                    return color(`${timestamp} [${module}] ${level}: ${message}`);
                })
            ),
            transports: [
                new winston.transports.Console(),
                new winston.transports.File({ filename: path.join(__dirname, '../logs/error.log'), level: 'error' }),
                new winston.transports.File({ filename: path.join(__dirname, '../logs/combined.log') }),
            ],
        });
    }

    getLevelColor(level) {
        switch (level) {
            case 'info':
                return chalk.green;
            case 'warn':
                return chalk.yellow;
            case 'error':
                return chalk.red;
            default:
                return chalk.white;
        }
    }

    info(message) {
        this.logger.info(message);
    }

    warn(message) {
        this.logger.warn(message);
    }

    error(message) {
        this.logger.error(message);
    }
}

module.exports = Logger;