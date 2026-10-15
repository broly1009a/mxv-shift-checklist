import { EventEmitter } from 'events';
import type { DomainEventName, DomainEventMap } from './domain-events';

export interface EventBusOptions {
  onSubscriberError?: (error: unknown, eventName: DomainEventName) => void;
}

export type EventHandler<T> = (payload: T) => void | Promise<void>;

export class EventBus {
  private readonly emitter: EventEmitter;
  private readonly onSubscriberError?: (error: unknown, eventName: DomainEventName) => void;

  constructor(options?: EventBusOptions) {
    this.emitter = new EventEmitter();
    this.onSubscriberError = options?.onSubscriberError;
  }

  public on<K extends DomainEventName>(eventName: K, handler: EventHandler<DomainEventMap[K]>): () => void {
    const wrappedHandler = this.createWrappedHandler(eventName, handler);
    this.emitter.on(eventName, wrappedHandler);
    return () => {
      this.emitter.off(eventName, wrappedHandler);
    };
  }

  public once<K extends DomainEventName>(eventName: K, handler: EventHandler<DomainEventMap[K]>): () => void {
    const wrappedHandler = this.createWrappedHandler(eventName, handler);
    this.emitter.once(eventName, wrappedHandler);
    return () => {
      this.emitter.off(eventName, wrappedHandler);
    };
  }

  public emit<K extends DomainEventName>(eventName: K, payload: DomainEventMap[K]): void {
    // Subscriber runs best-effort and does not block the caller.
    // Errors are isolated and passed to onSubscriberError without throwing back.
    this.emitter.emit(eventName, payload);
  }

  private createWrappedHandler<K extends DomainEventName>(
    eventName: K,
    handler: EventHandler<DomainEventMap[K]>
  ): (payload: DomainEventMap[K]) => void {
    return (payload: DomainEventMap[K]) => {
      setImmediate(async () => {
        try {
          await handler(payload);
        } catch (error) {
          if (this.onSubscriberError) {
            try {
              this.onSubscriberError(error, eventName);
            } catch {
              // Ignore error from error handler to avoid unhandled rejections
            }
          }
        }
      });
    };
  }
}
