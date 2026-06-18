import { batchQueueConfigSchema } from "@/types/config/translate";
import { getRandomUUID } from "@/utils/crypto-polyfill";
export class BatchCountMismatchError extends Error {
    constructor(expected, got, results) {
        super(`Batch result count mismatch: expected ${expected}, got ${got}.\nResults: ["${results.join("\",\n\"")}"]`);
        this.name = "BatchCountMismatchError";
    }
}
const BASE_BACKOFF_DELAY_MS = 1000;
const MAX_BACKOFF_DELAY_MS = 8000;
export class BatchQueue {
    pendingBatchMap = new Map();
    nextScheduleTimer = null;
    maxCharactersPerBatch;
    maxItemsPerBatch;
    batchDelay;
    maxRetries;
    enableFallbackToIndividual;
    getBatchKey;
    getCharacters;
    executeBatch;
    executeIndividual;
    onError;
    constructor(config) {
        this.maxCharactersPerBatch = config.maxCharactersPerBatch;
        this.maxItemsPerBatch = config.maxItemsPerBatch;
        this.batchDelay = config.batchDelay;
        this.maxRetries = config.maxRetries ?? 3;
        this.enableFallbackToIndividual = config.enableFallbackToIndividual ?? true;
        this.getBatchKey = config.getBatchKey;
        this.getCharacters = config.getCharacters;
        this.executeBatch = config.executeBatch;
        this.executeIndividual = config.executeIndividual;
        this.onError = config.onError;
    }
    enqueue(data) {
        let resolve;
        let reject;
        const promise = new Promise((res, rej) => {
            resolve = res;
            reject = rej;
        });
        const batchKey = this.getBatchKey(data);
        const task = { data, resolve, reject };
        this.addTaskToBatch(task, batchKey);
        this.schedule();
        return promise;
    }
    schedule() {
        if (this.nextScheduleTimer) {
            clearTimeout(this.nextScheduleTimer);
            this.nextScheduleTimer = null;
        }
        const now = Date.now();
        const batchesToFlush = [];
        for (const [batchKey, batch] of this.pendingBatchMap.entries()) {
            const shouldFlushNow = this.shouldFlushBatch(batch);
            const isTimedOut = now >= batch.createdAt + this.batchDelay;
            if (shouldFlushNow || isTimedOut) {
                batchesToFlush.push(batchKey);
            }
        }
        for (const batchKey of batchesToFlush) {
            this.flushPendingBatchByKey(batchKey);
        }
        if (this.pendingBatchMap.size > 0) {
            this.nextScheduleTimer = setTimeout(() => {
                this.nextScheduleTimer = null;
                this.schedule();
            }, this.batchDelay);
        }
    }
    addTaskToBatch(task, batchKey) {
        const characters = this.getCharacters(task.data);
        const existingBatch = this.pendingBatchMap.get(batchKey);
        if (existingBatch) {
            if (existingBatch.totalCharacters + characters <= this.maxCharactersPerBatch) {
                existingBatch.tasks.push(task);
                existingBatch.totalCharacters += characters;
            }
            else {
                this.flushPendingBatchByKey(batchKey);
                this.createNewPendingBatch(task, batchKey);
            }
        }
        else {
            this.createNewPendingBatch(task, batchKey);
        }
    }
    shouldFlushBatch(batch) {
        return (batch.tasks.length >= this.maxItemsPerBatch
            || batch.totalCharacters >= this.maxCharactersPerBatch);
    }
    createNewPendingBatch(task, batchKey) {
        const batchId = getRandomUUID();
        const pendingBatch = {
            id: batchId,
            tasks: [task],
            totalCharacters: this.getCharacters(task.data),
            createdAt: Date.now(),
        };
        this.pendingBatchMap.set(batchKey, pendingBatch);
    }
    flushPendingBatchByKey(batchKey) {
        const pendingBatch = this.pendingBatchMap.get(batchKey);
        if (!pendingBatch)
            return;
        this.pendingBatchMap.delete(batchKey);
        const { tasks } = pendingBatch;
        void this.executeBatchWithRetry(tasks, batchKey, 0);
    }
    async executeBatchWithRetry(tasks, batchKey, retryCount) {
        try {
            const results = await this.executeBatch(tasks.map(task => task.data));
            if (!results) {
                throw new Error("Batch execution results are undefined");
            }
            if (results.length !== tasks.length) {
                throw new BatchCountMismatchError(tasks.length, results.length, results);
            }
            tasks.forEach((task, index) => task.resolve(results[index]));
        }
        catch (error) {
            const err = error;
            this.onError?.(err, { batchKey, retryCount, isFallback: false });
            // Only retry on count mismatch errors (LLM returned wrong number of results)
            if (retryCount < this.maxRetries && err instanceof BatchCountMismatchError) {
                const delay = this.calculateBackoffDelay(retryCount);
                await this.sleep(delay);
                return this.executeBatchWithRetry(tasks, batchKey, retryCount + 1);
            }
            if (this.enableFallbackToIndividual && this.executeIndividual && err instanceof BatchCountMismatchError) {
                return this.executeFallbackIndividual(tasks, batchKey);
            }
            tasks.forEach(task => task.reject(err));
        }
    }
    async executeFallbackIndividual(tasks, batchKey) {
        await Promise.allSettled(tasks.map(async (task) => {
            try {
                if (!this.executeIndividual) {
                    throw new Error("executeIndividual is not defined");
                }
                const result = await this.executeIndividual(task.data);
                task.resolve(result);
            }
            catch (error) {
                const err = error;
                this.onError?.(err, { batchKey, retryCount: this.maxRetries, isFallback: true });
                task.reject(err);
            }
        }));
    }
    calculateBackoffDelay(retryCount) {
        return Math.min(BASE_BACKOFF_DELAY_MS * (2 ** retryCount), MAX_BACKOFF_DELAY_MS);
    }
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    setBatchConfig(config) {
        const parseConfigStatus = batchQueueConfigSchema.partial().safeParse(config);
        if (parseConfigStatus.error) {
            throw new Error(parseConfigStatus.error.issues[0].message);
        }
        this.maxCharactersPerBatch = config.maxCharactersPerBatch ?? this.maxCharactersPerBatch;
        this.maxItemsPerBatch = config.maxItemsPerBatch ?? this.maxItemsPerBatch;
    }
}
