import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import * as crypto from 'crypto';
import type { Request, Response, NextFunction, RequestHandler } from 'express';

export interface TransactionRequest {
    userId: string;
    amount: number;
    currency: string;
    merchantId: string;
    txnType?: string;
    receiverId?: string;
    deviceFingerprint?: string;
    [key: string]: unknown;
}

export interface TransactionResponse {
    status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
    txnId: string;
    riskScore?: number;
    message?: string;
    [key: string]: unknown;
}

export interface FintechClientOptions {
    clientId: string;
    secretKey: string;
    baseURL?: string;
    timeoutMs?: number;
    axiosConfig?: AxiosRequestConfig;
}

export interface SignatureHeaders extends Record<string, string> {
    'x-client-id': string;
    'x-timestamp': string;
    'x-signature': string;
}

export interface SignatureParts {
    timestamp: string;
    signature: string;
}

const DEFAULT_BASE_URL = 'http://34.14.156.36';

export class FintechClient {
    private client: AxiosInstance;
    private clientId: string;
    private secretKey: string;

    constructor(options: FintechClientOptions) {
        const { clientId, secretKey, baseURL = DEFAULT_BASE_URL, timeoutMs = 10000, axiosConfig } = options;
        this.clientId = clientId;
        this.secretKey = secretKey;
        this.client = axios.create({
            baseURL,
            timeout: timeoutMs,
            headers: { 'Content-Type': 'application/json' },
            ...axiosConfig
        });
    }

    static buildSignature(secret: string, method: string, path: string, body: unknown, timestamp?: number): SignatureParts {
        const ts = (timestamp ?? Date.now()).toString();
        const serialized = JSON.stringify(body ?? {});
        const payload = `${ts}${method.toUpperCase()}${path}${serialized}`;
        const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');

        return { timestamp: ts, signature };
    }

    private signRequest(method: string, path: string, body: unknown): SignatureHeaders {
        const { timestamp, signature } = FintechClient.buildSignature(this.secretKey, method, path, body);
        return {
            'x-client-id': this.clientId,
            'x-timestamp': timestamp,
            'x-signature': signature
        };
    }

    async assessTransaction(request: TransactionRequest): Promise<TransactionResponse> {
        const path = '/v1/transaction/assess';
        const headers = this.signRequest('POST', path, request);

        try {
            const { data } = await this.client.post<TransactionResponse, AxiosResponse<TransactionResponse>>(path, request, { headers });
            return data;
        } catch (error: any) {
            if (error.response) {
                throw new Error(`Gateway Error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
            }
            throw error;
        }
    }

    async health(): Promise<boolean> {
        try {
            await this.client.get('/health');
            return true;
        } catch (error) {
            return false;
        }
    }
}

export interface MiddlewareOptions {
    client: FintechClient;
    autoRespond?: boolean;
    mapRequest?: (req: Request) => TransactionRequest;
    onSuccess?: (req: Request, res: Response, payload: TransactionResponse) => void;
    onError?: (error: unknown, req: Request, res: Response, next: NextFunction) => void;
}

/**
 * Creates an Express middleware that forwards the incoming body to the Fintech gateway
 * and attaches the assessment result to `res.locals.fintechAssessment`.
 */
export function createAssessmentMiddleware(options: MiddlewareOptions): RequestHandler {
    const { client, mapRequest, onSuccess, onError, autoRespond = true } = options;

    return async (req: Request, res: Response, next: NextFunction) => {
        try {
            const txnRequest = mapRequest ? mapRequest(req) : (req.body as TransactionRequest);
            const assessment = await client.assessTransaction(txnRequest);
            res.locals.fintechAssessment = assessment;

            if (onSuccess) {
                onSuccess(req, res, assessment);
            }

            if (autoRespond) {
                return res.status(202).json(assessment);
            }

            return next();
        } catch (error) {
            if (onError) {
                return onError(error, req, res, next);
            }
            return next(error instanceof Error ? error : new Error('Fintech middleware failure'));
        }
    };
}
