import type { streamText } from 'ai'

export type BackgroundStreamTextParams = Omit<Parameters<typeof streamText>[0], 'model' | 'abortSignal'>

export type BackgroundStreamTextPayload = {
  providerId: string
} & BackgroundStreamTextParams

export const BACKGROUND_STREAM_PORTS = {
  streamText: 'stream-text',
} as const

export type BackgroundStreamChannel = keyof typeof BACKGROUND_STREAM_PORTS
export type BackgroundStreamPortName = (typeof BACKGROUND_STREAM_PORTS)[BackgroundStreamChannel]

export interface BackgroundStreamPayloadMap {
  streamText: BackgroundStreamTextPayload
}

export interface BackgroundStreamResponseMap {
  streamText: string
}

export type StreamPortResponse<T = string>
  = | { type: 'chunk', requestId: string, data: T }
    | { type: 'done', requestId: string, data: T }
    | { type: 'error', requestId: string, error: string }

export interface StreamPortStartMessage<TPayload> {
  type: 'start'
  requestId: string
  payload: TPayload
}

export interface StreamPortPingMessage {
  type: 'ping'
  requestId: string
}

export type StreamPortRequestMessage<TPayload>
  = StreamPortStartMessage<TPayload> | StreamPortPingMessage
