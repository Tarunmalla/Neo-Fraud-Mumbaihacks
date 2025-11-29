// Standardized JSON Logger for GCP Cloud Logging
// Outputs logs in a format that Cloud Logging automatically parses.

export enum LogLevel {
    INFO = 'INFO',
    WARN = 'WARNING',
    ERROR = 'ERROR',
    DEBUG = 'DEBUG'
}

export class Logger {
    private serviceName: string;

    constructor(serviceName: string) {
        this.serviceName = serviceName;
    }

    private log(level: LogLevel, message: string, meta: any = {}) {
        const entry = {
            severity: level,
            message: message,
            serviceContext: {
                service: this.serviceName,
            },
            timestamp: new Date().toISOString(),
            ...meta
        };
        console.log(JSON.stringify(entry));
    }

    info(message: string, meta?: any) {
        this.log(LogLevel.INFO, message, meta);
    }

    warn(message: string, meta?: any) {
        this.log(LogLevel.WARN, message, meta);
    }

    error(message: string, error?: any) {
        const meta = error ? {
            stack_trace: error.stack || error.toString(),
            error_message: error.message
        } : {};
        this.log(LogLevel.ERROR, message, meta);
    }

    debug(message: string, meta?: any) {
        this.log(LogLevel.DEBUG, message, meta);
    }
}
